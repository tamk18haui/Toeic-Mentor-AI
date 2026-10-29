"""Authenticated admin CRUD and idempotent TOEIC JSON + media ZIP importer."""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .auth import hash_password, normalize_email, verify_password
from .database import (
    AdminAccount, Exam, ExamMediaAsset, ExamPassage, ExamQuestion,
    GrammarTopic, VocabularyLesson, VocabularyTerm, get_db,
)
from .exam_import import MAX_JSON_BYTES, MAX_ZIP_BYTES, audit_exam, map_exam_media, parse_exam_json, substitute_media
from .media_storage import put_media, storage_mode

logger = logging.getLogger('toeic-studio.admin')
router = APIRouter(prefix='/api/admin', tags=['Content administration'])
bearer = HTTPBearer(auto_error=False)


def admin_secret() -> str:
    secret = os.getenv('ADMIN_JWT_SECRET', '')
    if len(secret) < 32 or secret == 'LOCAL_DEMO_ONLY_CHANGE_ME':
        raise HTTPException(503, 'Hãy đặt ADMIN_JWT_SECRET ngẫu nhiên dài ít nhất 32 ký tự trong backend/.env.')
    return secret


def seed_admin(db: Session):
    """Create the initial administrator only when explicit bootstrap env is set."""
    email = os.getenv('ADMIN_EMAIL', '').strip()
    password = os.getenv('ADMIN_PASSWORD', '')
    if not email or not password:
        return False
    admin_secret()
    if len(password) < 12:
        raise ValueError('ADMIN_PASSWORD cần ít nhất 12 ký tự.')
    email = normalize_email(email)
    existing = db.scalar(select(AdminAccount).where(AdminAccount.email == email))
    if existing:
        return False
    db.add(AdminAccount(email=email, password_hash=hash_password(password)))
    db.commit()
    logger.info('Created initial admin account (no password logged)')
    return True


def current_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                  db: Session = Depends(get_db)) -> AdminAccount:
    if not credentials:
        raise HTTPException(401, 'Cần đăng nhập tài khoản quản trị.')
    try:
        payload = jwt.decode(credentials.credentials, admin_secret(),
                             algorithms=['HS256'], audience='toeic-admin')
        admin_id = int(payload['sub'])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(401, 'Phiên admin không hợp lệ hoặc đã hết hạn.') from exc
    admin = db.get(AdminAccount, admin_id)
    if not admin:
        raise HTTPException(401, 'Tài khoản admin không tồn tại.')
    return admin


class Login(BaseModel):
    email: str
    password: str


@router.post('/login')
def admin_login(data: Login, db: Session = Depends(get_db)):
    secret = admin_secret()
    try:
        email = normalize_email(data.email)
    except ValueError as exc:
        raise HTTPException(401, 'Tài khoản hoặc mật khẩu không đúng.') from exc
    admin = db.scalar(select(AdminAccount).where(AdminAccount.email == email))
    if not admin or not verify_password(data.password, admin.password_hash):
        raise HTTPException(401, 'Tài khoản hoặc mật khẩu không đúng.')
    token = jwt.encode({'sub': str(admin.id), 'aud': 'toeic-admin',
                        'exp': datetime.now(timezone.utc) + timedelta(hours=8)}, secret, algorithm='HS256')
    return {'token': token, 'admin': {'email': admin.email, 'id': admin.id}}


@router.get('/me')
def admin_me(admin: AdminAccount = Depends(current_admin)):
    return {'id': admin.id, 'email': admin.email}


@router.get('/stats')
def stats(_: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    return {'exams': db.scalar(select(func.count()).select_from(Exam)) or 0,
            'published': db.scalar(select(func.count()).select_from(Exam).where(Exam.published.is_(True))) or 0,
            'vocabulary_lessons': db.scalar(select(func.count()).select_from(VocabularyLesson)) or 0,
            'vocabulary_terms': db.scalar(select(func.count()).select_from(VocabularyTerm)) or 0,
            'grammar_topics': db.scalar(select(func.count()).select_from(GrammarTopic)) or 0,
            'storage': storage_mode()}


def exam_row(exam: Exam) -> dict:
    return {'id': exam.id, 'collection': exam.collection, 'title': exam.title,
            'published': exam.published, 'question_count': exam.question_count,
            'media_count': exam.media_count, 'duration_minutes': exam.duration_minutes,
            'updated_at': exam.updated_at.isoformat()}


@router.get('/exams')
def admin_exams(_: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    return [exam_row(row) for row in db.scalars(select(Exam).order_by(Exam.updated_at.desc())).all()]


@router.get('/exams/{exam_id}')
def admin_exam_detail(exam_id: str, _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, 'Không tìm thấy đề.')
    rows = db.scalars(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id).order_by(ExamQuestion.number)).all()
    return {**exam_row(exam), 'questions': [row.body for row in rows]}


@router.post('/exams/import')
async def import_exams(json_file: UploadFile = File(...), media_zip: UploadFile | None = File(None),
                       publish: bool = Form(False), _: AdminAccount = Depends(current_admin),
                       db: Session = Depends(get_db)):
    if not (json_file.filename or '').lower().endswith('.json'):
        raise HTTPException(422, 'Hãy chọn file JSON của extension TOEIC Studio.')
    try:
        exams = parse_exam_json(await json_file.read(MAX_JSON_BYTES + 1))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    zip_bytes = None
    if media_zip is not None and media_zip.filename:
        if not media_zip.filename.lower().endswith('.zip'):
            raise HTTPException(422, 'Ảnh/audio phải nằm trong file ZIP.')
        zip_bytes = await media_zip.read(MAX_ZIP_BYTES + 1)
        if len(zip_bytes) > MAX_ZIP_BYTES:
            raise HTTPException(413, 'ZIP media không vượt quá 180MB.')
    imported = []
    try:
        for payload in exams:
            exam = db.get(Exam, payload['exam_id'])
            if exam is None:
                exam = Exam(id=payload['exam_id'], collection=payload['collection'], title=payload['title'])
                db.add(exam)
                db.flush()
            exam.collection = payload['collection']
            exam.title = payload['title']
            exam.source = payload['source']
            exam.published = exam.published or publish
            exam.question_count = len(payload['questions'])

            old_assets = db.scalars(select(ExamMediaAsset).where(ExamMediaAsset.exam_id == exam.id)).all()
            previous = {a.source_url: a.stored_url for a in old_assets}
            media_map, media_rows, media_audit = map_exam_media(zip_bytes, payload, put_media)
            combined = {**previous, **media_map}
            db.execute(delete(ExamQuestion).where(ExamQuestion.exam_id == exam.id))
            db.execute(delete(ExamPassage).where(ExamPassage.exam_id == exam.id))
            db.flush()
            for question in payload['questions']:
                body = substitute_media(question, combined)
                db.add(ExamQuestion(exam_id=exam.id, number=question['number'], part=question['part'], body=body))
            for passage in payload['passages']:
                db.add(ExamPassage(exam_id=exam.id, group_ref=passage['group_ref'],
                                   body=substitute_media(passage, combined)))
            if media_rows:
                db.execute(delete(ExamMediaAsset).where(ExamMediaAsset.exam_id == exam.id))
                db.flush()
                for source_url, stored_url in combined.items():
                    filename = next((a['filename'] for a in media_rows if a['source_url'] == source_url),
                                    source_url.rsplit('/', 1)[-1].split('?', 1)[0][:200])
                    db.add(ExamMediaAsset(exam_id=exam.id, source_url=source_url,
                           stored_url=stored_url, filename=filename,
                           media_type='audio' if filename.lower().endswith(('.mp3','.wav','.ogg','.m4a')) else 'image'))
            exam.media_count = len(combined)
            imported.append({**exam_row(exam), 'audit': audit_exam(payload), 'media': media_audit})
        db.commit()
        return {'imported': len(imported), 'items': imported,
                'note': 'Nếu MEDIA_STORAGE_PROVIDER=s3, media đã được đẩy lên bucket. Nếu local, file nằm trong backend/uploads.'}
    except (ValueError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        db.rollback()
        logger.exception('Admin import failed')
        raise HTTPException(503, 'Nhập dữ liệu hoặc lưu media thất bại; kiểm tra MySQL và cấu hình cloud.') from exc


class ExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    collection: str | None = Field(default=None, min_length=1, max_length=120)
    published: bool | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=240)


@router.patch('/exams/{exam_id}')
def edit_exam(exam_id: str, payload: ExamUpdate, _: AdminAccount = Depends(current_admin),
              db: Session = Depends(get_db)):
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, 'Không tìm thấy đề.')
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(exam, field, value)
    db.commit()
    db.refresh(exam)
    return exam_row(exam)


class QuestionUpdate(BaseModel):
    stem: str | None = Field(default=None, max_length=20000)
    stem_vi: str | None = Field(default=None, max_length=20000)
    correct: str | None = Field(default=None, pattern='^[A-D]$')
    explanation: str | None = Field(default=None, max_length=20000)


@router.patch('/exams/{exam_id}/questions/{number}')
def edit_question(exam_id: str, number: int, payload: QuestionUpdate,
                  _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    item = db.scalar(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id,
                                               ExamQuestion.number == number))
    if not item:
        raise HTTPException(404, 'Không tìm thấy câu hỏi.')
    item.body = {**item.body, **payload.model_dump(exclude_none=True)}
    db.commit()
    return {'saved': True, 'number': number}


@router.get('/vocabulary')
def admin_vocabulary(_: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(VocabularyLesson).order_by(VocabularyLesson.collection,
                      VocabularyLesson.lesson_number).limit(2000)).all()
    return [{'id': r.id, 'collection': r.collection, 'lesson_number': r.lesson_number,
             'title': r.title, 'term_count': db.scalar(select(func.count()).select_from(VocabularyTerm)
             .where(VocabularyTerm.lesson_id == r.id)) or 0} for r in rows]


class LessonInput(BaseModel):
    id: str = Field(min_length=2, max_length=64, pattern='^[a-zA-Z0-9_-]+$')
    collection: str = Field(min_length=1, max_length=80)
    lesson_number: int = Field(ge=1, le=9999)
    title: str = Field(min_length=1, max_length=255)


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    collection: str | None = Field(default=None, min_length=1, max_length=80)
    lesson_number: int | None = Field(default=None, ge=1, le=9999)


@router.post('/vocabulary')
def create_lesson(payload: LessonInput, _: AdminAccount = Depends(current_admin),
                  db: Session = Depends(get_db)):
    if db.get(VocabularyLesson, payload.id):
        raise HTTPException(409, 'ID bài từ vựng đã tồn tại.')
    db.add(VocabularyLesson(id=payload.id, collection=payload.collection,
           lesson_number=payload.lesson_number, title=payload.title,
           source_url='admin://'+payload.id, source_empty=False))
    db.commit()
    return {'saved': True, 'id': payload.id}


@router.patch('/vocabulary/{lesson_id}')
def update_lesson(lesson_id: str, payload: LessonUpdate,
                  _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    lesson = db.get(VocabularyLesson, lesson_id)
    if lesson is None:
        raise HTTPException(404, 'Không tìm thấy bài từ vựng.')
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(lesson, field, value)
    db.commit()
    return {'saved': True, 'id': lesson.id}


@router.get('/vocabulary/{lesson_id}/terms')
def admin_terms(lesson_id: str, _: AdminAccount = Depends(current_admin),
                db: Session = Depends(get_db)):
    rows = db.scalars(select(VocabularyTerm).where(VocabularyTerm.lesson_id == lesson_id)
                      .order_by(VocabularyTerm.sort_order)).all()
    return [{'id': r.id, 'word': r.word, 'meaning_vi': r.meaning_vi,
             'part_of_speech': r.part_of_speech, 'example_en': r.example_en} for r in rows]


class TermInput(BaseModel):
    word: str = Field(min_length=1, max_length=255)
    meaning_vi: str = Field(min_length=1, max_length=5000)
    part_of_speech: str = Field(default='', max_length=80)
    example_en: str = Field(default='', max_length=5000)


class TermsBatch(BaseModel):
    terms: list[TermInput] = Field(min_length=1, max_length=1000)


@router.post('/vocabulary/{lesson_id}/terms')
def create_term(lesson_id: str, payload: TermInput,
                _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    lesson = db.get(VocabularyLesson, lesson_id)
    if not lesson:
        raise HTTPException(404, 'Không tìm thấy bài từ vựng.')
    last = db.scalar(select(func.max(VocabularyTerm.sort_order)).where(VocabularyTerm.lesson_id == lesson_id))
    term = VocabularyTerm(lesson_id=lesson_id, sort_order=(last or 0)+1,
           word=payload.word, meaning_vi=payload.meaning_vi,
           part_of_speech=payload.part_of_speech, example_en=payload.example_en)
    db.add(term)
    db.commit()
    return {'saved': True, 'id': term.id}


@router.post('/vocabulary/{lesson_id}/terms/bulk')
def create_terms_bulk(lesson_id: str, payload: TermsBatch,
                      _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    if not db.get(VocabularyLesson, lesson_id):
        raise HTTPException(404, 'Không tìm thấy bài từ vựng.')
    order = db.scalar(select(func.max(VocabularyTerm.sort_order)).where(VocabularyTerm.lesson_id == lesson_id)) or 0
    for item in payload.terms:
        order += 1
        db.add(VocabularyTerm(lesson_id=lesson_id, sort_order=order,
            word=item.word, meaning_vi=item.meaning_vi, part_of_speech=item.part_of_speech,
            example_en=item.example_en))
    db.commit()
    return {'saved': True, 'count': len(payload.terms)}


@router.patch('/vocabulary/{lesson_id}/terms/{term_id}')
def update_term(lesson_id: str, term_id: int, payload: TermInput,
                _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    term = db.get(VocabularyTerm, term_id)
    if term is None or term.lesson_id != lesson_id:
        raise HTTPException(404, 'Không tìm thấy mục từ.')
    for field, value in payload.model_dump().items():
        setattr(term, field, value)
    db.commit()
    return {'saved': True, 'id': term.id}


@router.get('/grammar')
def admin_grammar(_: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    return [{'slug': r.slug, 'title': r.title} for r in
            db.scalars(select(GrammarTopic).order_by(GrammarTopic.title)).all()]


@router.get('/grammar/{slug}')
def admin_grammar_detail(slug: str, _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    import json
    topic = db.get(GrammarTopic, slug)
    if not topic:
        raise HTTPException(404, 'Không tìm thấy ngữ pháp.')
    blocks = json.loads(topic.blocks_json)
    return {'slug': topic.slug, 'title': topic.title, 'content': '\n\n'.join(str(b.get('text') or '') for b in blocks)}


class GrammarInput(BaseModel):
    slug: str = Field(min_length=2, max_length=180, pattern='^[a-z0-9-]+$')
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=50000)


@router.post('/grammar')
def create_grammar(payload: GrammarInput,
                   _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    if db.get(GrammarTopic, payload.slug):
        raise HTTPException(409, 'Slug ngữ pháp đã tồn tại.')
    import json
    db.add(GrammarTopic(slug=payload.slug, title=payload.title,
                        source_url='admin://'+payload.slug,
                        blocks_json=json.dumps([{'type':'text','text':payload.content}], ensure_ascii=False)))
    db.commit()
    return {'saved': True, 'slug': payload.slug}


@router.patch('/grammar/{slug}')
def edit_grammar(slug: str, payload: GrammarInput,
                 _: AdminAccount = Depends(current_admin), db: Session = Depends(get_db)):
    topic = db.get(GrammarTopic, slug)
    if not topic:
        raise HTTPException(404, 'Không tìm thấy chủ điểm ngữ pháp.')
    import json
    topic.title = payload.title
    topic.blocks_json = json.dumps([{'type':'text','text':payload.content}], ensure_ascii=False)
    db.commit()
    return {'saved': True, 'slug': slug}
