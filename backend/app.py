"""React API: auth, MySQL history, IPA, TOEIC Writing and Speaking analysis."""
from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from .auth import create_token, current_user, hash_password, normalize_email, verify_password
from .database import LessonProgress, PracticeAttempt, SessionLocal, User, engine as db_engine, get_db, init_db
from .content_service import router as content_router, seed_content
from .admin_service import router as admin_router, seed_admin
from .exams_service import router as exams_router, media_router

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')
sys.path.insert(0, str(ROOT / 'pronunciation'))
logger = logging.getLogger('toeic-studio')
logging.basicConfig(level=logging.INFO)
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')

app = FastAPI(title='TOEIC Studio API', version='0.1.0', docs_url='/api/docs')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(','), allow_credentials=True, allow_methods=['GET','POST','PUT','PATCH','OPTIONS'], allow_headers=['Content-Type','Authorization'])
app.include_router(content_router)
app.include_router(admin_router)
app.include_router(exams_router)
app.include_router(media_router)
model_lock=Lock()


@app.exception_handler(OperationalError)
async def unavailable_mysql(request, exc):
    logger.warning('MySQL request unavailable: %s', type(exc).__name__)
    return JSONResponse(status_code=503, content={'detail':'MySQL đang chưa sẵn sàng. Hãy mở Docker Desktop và kiểm tra DATABASE_URL trong backend/.env.'})


@app.on_event('startup')
def startup():
    try:
        init_db()
        with SessionLocal() as db:
            seed_content(db)
            seed_admin(db)
        logger.info('MySQL learning tables available')
    except Exception as exc:
        logger.warning('Database offline: %s. Public pages and pronunciation still work.', type(exc).__name__)


class AuthRequest(BaseModel):
    email:str
    password:str
    name:str = 'Học viên'


class AttemptRequest(BaseModel):
    mode:str = Field(pattern='^(ipa|speaking_practice|speaking_mock|writing_practice|writing_mock|vocabulary_quiz|grammar_review|reading_demo|reading_full)$')
    part:str = Field(max_length=50)
    question_ref:str = Field(max_length=80)
    score:float | None = Field(default=None,ge=0,le=200)
    max_score:float | None = Field(default=None,ge=0,le=200)
    details:dict = Field(default_factory=dict)


@app.get('/api/health')
def health():
    try:
        with db_engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        mysql='connected'
    except Exception:
        mysql='offline'
    return {'status':'ready','database':mysql,'pronunciation':'E2E-GOP CPU (lazy-loaded)',
            'writing_ai_configured':bool(os.getenv('GEMINI_API_KEY')),
            'speaking_ai_configured':True,
            'speaking_scoring':'faster-whisper + E2E-GOP local CPU (cài gói AI riêng)',
            'speaking_content_ai_configured':os.getenv('SPEAKING_CONTENT_AI','false').lower()=='true' and bool(os.getenv('GEMINI_API_KEY')),
            'gopt_sidecar_configured':bool(os.getenv('GOPT_WEB_URL'))}


@app.get('/api/speaking/models')
def speaking_models():
    from importlib.util import find_spec
    return {'asr':{'model':'faster-whisper CPU int8','installed':find_spec('faster_whisper') is not None},
            'phoneme_scorer':{'model':'E2E-GOP SpeechOcean762','installed':find_spec('torch') is not None and find_spec('transformers') is not None},
            'phoneme_recognizer':{'model':'Wav2Vec2 Phoneme','enabled':os.getenv('SPEAKING_VERIFY_PHONEMES','false').lower()=='true'},
            'gopt':{'model':'GOPT + Kaldi GOP features','configured':bool(os.getenv('GOPT_WEB_URL'))},
            'content':{'model':'Gemini only for content (optional)','enabled':os.getenv('SPEAKING_CONTENT_AI','false').lower()=='true' and bool(os.getenv('GEMINI_API_KEY'))}}


@app.post('/api/auth/register')
def register(data:AuthRequest,db:Session=Depends(get_db)):
    try:
        email=normalize_email(data.email)
        name=data.name.strip()[:120]
        if not name:
            raise ValueError('Vui lòng nhập họ tên.')
        user=User(name=name,email=email,password_hash=hash_password(data.password))
        db.add(user);db.commit();db.refresh(user)
        return {'token':create_token(user.id),'user':{'id':user.id,'name':user.name,'email':user.email}}
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    except IntegrityError as exc:
        db.rollback();raise HTTPException(409,'Email này đã được đăng ký.') from exc
    except OperationalError as exc:
        db.rollback();raise HTTPException(503,'Chưa kết nối MySQL. Khởi động Docker Compose hoặc MySQL trước.') from exc


@app.post('/api/auth/login')
def login(data:AuthRequest,db:Session=Depends(get_db)):
    try: email=normalize_email(data.email)
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc
    user=db.scalar(select(User).where(User.email==email))
    if not user or not verify_password(data.password,user.password_hash):
        raise HTTPException(401,'Email hoặc mật khẩu không đúng.')
    return {'token':create_token(user.id),'user':{'id':user.id,'name':user.name,'email':user.email}}


@app.get('/api/auth/me')
def whoami(user:User=Depends(current_user)):
    return {'id':user.id,'name':user.name,'email':user.email}


@app.post('/api/attempts')
def save_attempt(data:AttemptRequest,user:User=Depends(current_user),db:Session=Depends(get_db)):
    safe_details=json.dumps(data.details,ensure_ascii=False)
    if len(safe_details)>20000:
        raise HTTPException(413,'Chi tiết kết quả quá dài.')
    item=PracticeAttempt(user_id=user.id,mode=data.mode,part=data.part,question_ref=data.question_ref,score=data.score,max_score=data.max_score,payload_json=safe_details)
    db.add(item)
    ref=f'{data.mode}:{data.question_ref}'
    p=db.scalar(select(LessonProgress).where(LessonProgress.user_id==user.id,LessonProgress.lesson_ref==ref))
    if not p:
        p=LessonProgress(user_id=user.id,lesson_ref=ref,completed=True,attempts_count=0);db.add(p)
    p.attempts_count+=1
    p.completed=True
    if data.score is not None:
        p.best_score=max(data.score,p.best_score) if p.best_score is not None else data.score
    db.commit();db.refresh(item)
    return {'id':item.id,'saved':True}


@app.get('/api/attempts')
def list_attempts(user:User=Depends(current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(PracticeAttempt).where(PracticeAttempt.user_id==user.id).order_by(PracticeAttempt.id.desc()).limit(70)).all()
    return [{'id':row.id,'mode':row.mode,'part':row.part,'question_ref':row.question_ref,'score':row.score,'max_score':row.max_score,'created_at':row.created_at.isoformat()} for row in rows]


@app.get('/api/progress')
def progress(user:User=Depends(current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(LessonProgress).where(LessonProgress.user_id==user.id)).all()
    return {'completed':len(rows),'total_attempts':sum(row.attempts_count for row in rows),'lessons':[{'ref':r.lesson_ref,'completed':r.completed,'attempts':r.attempts_count,'best_score':r.best_score} for r in rows]}


@app.get('/api/pronunciation/phonetics')
def phonetics(word:str):
    from phonetics import PhoneticInputError,get_canonical
    try: return get_canonical(word)
    except PhoneticInputError as exc: raise HTTPException(422,str(exc)) from exc


@app.post('/api/pronunciation/score')
def pronunciation_score(file:UploadFile=File(...),word:str=Form(...),verify_phonemes:bool=Form(False)):
    from audio_utils import ALLOWED_SUFFIXES,MAX_UPLOAD_BYTES,AudioInputError,decode_audio
    from phonetics import PhoneticInputError,get_canonical
    from engine import evaluate
    try: canonical=get_canonical(word)
    except PhoneticInputError as exc:raise HTTPException(422,str(exc)) from exc
    ext=Path(file.filename or '').suffix.lower()
    if ext not in ALLOWED_SUFFIXES: raise HTTPException(400,'Chỉ nhận WAV, MP3, M4A, MP4, WebM, OGG, FLAC.')
    if not model_lock.acquire(blocking=False):raise HTTPException(429,'Bộ chấm đang bận, thử lại sau ít giây.')
    try:
        with tempfile.TemporaryDirectory(prefix='toeic_ipa_') as directory:
            src=Path(directory)/f'voice{ext}';wav=Path(directory)/'converted.wav'
            size=0
            with src.open('wb') as handle:
                while chunk:=file.file.read(1024*1024):
                    size+=len(chunk)
                    if size>MAX_UPLOAD_BYTES:raise HTTPException(413,'Bản ghi không vượt quá 18 MB.')
                    handle.write(chunk)
            if size<100:raise HTTPException(400,'Bản ghi trống.')
            samples,rate,warnings=decode_audio(src,wav)
            result=evaluate(samples,rate,canonical,verify_phonemes=verify_phonemes)
            result['audio_warnings']=warnings
            return result
    except AudioInputError as exc: raise HTTPException(422,str(exc)) from exc
    except HTTPException: raise
    except Exception as exc:
        logger.exception('IPA inference error')
        raise HTTPException(503,'Không thể chấm âm vị. Hãy xem log máy chủ, model hoặc kết nối tải trọng số.') from exc
    finally:
        file.file.close();model_lock.release()


@app.get('/api/writing/status')
def writing_ai_status():
    from .writing.ollama_client import status
    from .writing.rag import retrieve
    from importlib.util import find_spec
    return {'ollama': status(), 'rag': {'ready':True,'source':retrieve(2)['citation']},
            'language_tool_installed':find_spec('language_tool_python') is not None,
            'practice_only':True}


@app.post('/api/writing/grade')
def grade_writing(part:int=Form(...),answer:str=Form(...),question:str=Form(''),keywords:str=Form(''),picture:UploadFile | None=File(None)):
    """Grounded local Qwen3-VL TOEIC writing feedback; no Gemini calls."""
    from .writing.grading import check_grammar_local, grade_with_local
    from .writing.ollama_client import WritingModelError
    if part not in (1,2,3) or not 0 < len(answer.strip()) <= 12000:
        raise HTTPException(422,'Part Writing hoac do dai bai viet khong hop le.')
    image = None
    mime = None
    if part == 1:
        if not picture or picture.content_type not in {'image/jpeg','image/png','image/webp'}:
            raise HTTPException(422,'Writing Part 1 can anh de bai JPEG/PNG/WebP.')
        image = picture.file.read(5*1024*1024+1)
        if len(image) > 5*1024*1024:
            raise HTTPException(413,'Anh qua 5MB.')
        mime = picture.content_type
    try:
        result = grade_with_local(part,answer,question,keywords,image,mime)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    except WritingModelError as exc:
        logger.warning('Local Writing inference not ready: %s',type(exc).__name__)
        raise HTTPException(503,str(exc)) from exc
    except Exception as exc:
        logger.exception('Unexpected local Writing error')
        raise HTTPException(503,'Writing AI chua phan tich duoc. Kiem tra Ollama va log FastAPI.') from exc
    grammar, warning = check_grammar_local(answer)
    result.update({'grammar_matches':grammar,'grammar_warning':warning})
    return result


@app.post('/api/speaking/grade')
def grade_speaking_endpoint(file:UploadFile=File(...),part:str=Form(...),task_json:str=Form('{}'),picture:UploadFile | None=File(None)):
    """On-demand local Whisper / GOPT acoustics / Gemma semantics."""
    from .speaking_audio import SpeakingAudioError,prepare_speaking_audio
    from .speaking_grading import SPEAKING_PARTS,grade_speaking
    from .pronunciation.audio_utils import ALLOWED_SUFFIXES,MAX_UPLOAD_BYTES

    if part not in SPEAKING_PARTS:
        raise HTTPException(422,'Part Speaking không hợp lệ.')
    if len(task_json)>10000:
        raise HTTPException(413,'Nội dung đề bài quá dài.')
    try:
        task=json.loads(task_json)
        if not isinstance(task,dict):raise ValueError('Expected JSON object')
    except (ValueError,TypeError) as exc:
        raise HTTPException(422,'Nội dung đề bài JSON không hợp lệ.') from exc

    ext=Path(file.filename or '').suffix.lower()
    if ext not in ALLOWED_SUFFIXES:
        raise HTTPException(422,'Âm thanh chỉ nhận WAV, MP3, M4A, MP4, WebM, OGG, FLAC.')
    image=None;mime=None
    if part=='picture':
        if not picture or picture.content_type not in {'image/jpeg','image/png','image/webp'}:
            raise HTTPException(422,'Bài mô tả tranh cần ảnh gốc đi kèm (JPEG/PNG/WebP).')
    if picture:
        if picture.content_type not in {'image/jpeg','image/png','image/webp'}:
            raise HTTPException(422,'Ảnh đính kèm không hợp lệ.')
        image=picture.file.read(5*1024*1024+1)
        if len(image)>5*1024*1024:
            raise HTTPException(413,'Ảnh vượt quá 5 MB.')
        mime=picture.content_type

    if not model_lock.acquire(blocking=False):
        raise HTTPException(429,'Đang chấm một bản ghi khác. Hãy chờ kết quả trước khi tiếp tục.')
    try:
        with tempfile.TemporaryDirectory(prefix='toeic_speak_') as directory:
            source=Path(directory)/f'answer{ext}'
            size=0
            with source.open('wb') as handle:
                while chunk:=file.file.read(1024*1024):
                    size+=len(chunk)
                    if size>MAX_UPLOAD_BYTES:
                        raise HTTPException(413,'Bản ghi âm vượt quá 18 MB.')
                    handle.write(chunk)
            if size<100:raise HTTPException(422,'Chưa có dữ liệu ghi âm.')
            wav,metrics=prepare_speaking_audio(source)
            return grade_speaking(part,task,wav,metrics,image,mime)
    except ImportError as exc:
        logger.warning('Speaking dependencies not installed: %s', exc)
        raise HTTPException(503,'Thiếu model Speaking local. Chạy INSTALL_SPEAKING_AI_WINDOWS.bat rồi khởi động lại FastAPI.') from exc
    except SpeakingAudioError as exc:
        raise HTTPException(422,str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    except HTTPException:raise
    except Exception as exc:
        reason=str(exc).lower()
        logger.exception('Speaking model failure: %s',type(exc).__name__)
        raise HTTPException(503,'Không chạy được nhận dạng lời nói bằng faster-whisper. Kiểm tra cài model AI, kết nối tải trọng số lần đầu và log FastAPI.') from exc
    finally:
        file.file.close()
        if picture:picture.file.close()
        model_lock.release()
