"""Run `python -m backend.smoke_test` from the project root.

Uses in-memory SQLite to exercise FastAPI endpoints without requiring MySQL,
Gemini API access or downloading large pronunciation models.
"""
from __future__ import annotations

import os
import json
from unittest.mock import patch

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'UNIT_TEST_ONLY_NOT_FOR_PUBLIC_USE'

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from . import database
from . import app as app_module


def run():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    database.engine = engine
    database.SessionLocal.configure(bind=engine)
    app_module.db_engine = engine

    with TestClient(app_module.app) as client:
        response = client.get('/api/health')
        assert response.status_code == 200, response.text
        assert response.json()['database'] == 'connected', response.json()

        new_account = {'name': 'Sang Test', 'email': 'test@example.com', 'password': 'secret123!'}
        r = client.post('/api/auth/register', json=new_account)
        assert r.status_code == 200, r.text
        token = r.json()['token']

        r = client.post('/api/auth/register', json=new_account)
        assert r.status_code == 409, r.text

        r = client.post('/api/auth/login', json={'email': new_account['email'], 'password': 'incorrect'})
        assert r.status_code == 401, r.text

        headers = {'Authorization': f'Bearer {token}'}
        r = client.get('/api/auth/me', headers=headers)
        assert r.status_code == 200 and r.json()['name'] == 'Sang Test', r.text

        r = client.post('/api/attempts', headers=headers, json={
            'mode': 'ipa', 'part': 'theta', 'question_ref': 'think',
            'score': 75, 'max_score': 100, 'details': {'green': 2, 'red': 1}
        })
        assert r.status_code == 200, r.text

        r = client.get('/api/progress', headers=headers)
        assert r.status_code == 200 and r.json()['completed'] == 1, r.text

        r = client.get('/api/attempts', headers=headers)
        assert r.status_code == 200 and len(r.json()) == 1, r.text

        r = client.get('/api/pronunciation/phonetics', params={'word': 'think'})
        assert r.status_code == 200, r.text
        assert r.json()['arpa'][0] == 'TH', r.text

        r = client.get('/api/pronunciation/phonetics', params={'word': 'bad word'})
        assert r.status_code == 422, r.text

    engine.dispose()
    print('PASS: /health, register, duplicate, login, /me, attempts, progress, CMUdict, validation')

    # Exercise the Interactions API payload builder without consuming API quota.
    # This also catches accidental regressions in the output-text JSON shape.
    from .writing import grading

    observed=[]

    class FakeInteractions:
        def create(self, **kwargs):
            assert kwargs['response_format']['type']=='text'
            assert kwargs['response_format']['mime_type']=='application/json'
            assert kwargs['response_format']['schema']['type']=='object'
            assert kwargs['model']=='gemini-3.8-flash'
            observed.append(kwargs)

            class Response:
                output_text=json.dumps({
                    'score':2,'overall_vi':'Nội dung phù hợp.',
                    'strengths_vi':['Đúng chủ đề'], 'mistakes':[],
                    'criteria':[{'name_vi':'Nội dung','comment_vi':'Ổn'}],
                    'improved_answer':'The people are having a meeting.',
                })
            return Response()

    class FakeClient:
        interactions=FakeInteractions()

    original_client=grading._client
    grading._client=lambda:FakeClient()
    try:
        sentence=grading.grade_with_gemini(1,'People are having a meeting.','A meeting','people,meeting',b'picture','image/jpeg')
        assert sentence['score']==2 and sentence['max_score']==3
        assert observed[-1]['input'][1]['type']=='image'
        assert observed[-1]['input'][1]['mime_type']=='image/jpeg'

        email=grading.grade_with_gemini(2,'Thank you for your email.','Reply to the workshop invitation.','')
        assert email['score']==2 and email['max_score']==4
        assert len(observed[-1]['input'])==1

        essay=grading.grade_with_gemini(3,'I agree because it helps employees.','Is remote work beneficial?','')
        assert essay['score']==2 and essay['max_score']==5
    finally:
        grading._client=original_client
    print('PASS: Gemini 2.x Interactions payload for picture/email/essay (mock, no API key)')

    from . import speaking_grading, speaking_audio, speaking_local

    measures={'duration_seconds':3.0,'speech_seconds_est':2.5,'long_pause_count_est':0}
    asr_words=[{'word':'Good','start':0.2,'end':0.6,'asr_confidence':0.92},
               {'word':'morning','start':0.8,'end':1.6,'asr_confidence':0.90}]
    e2e={'pronunciation_score':82,'pronunciation_words':[{'word':'Good','ipa_text':'/ɡ ʊ d/',
          'asr_confidence':0.92,'phones':[{'arpa':'G','ipa':'ɡ','color':'green','display_score':80,'tip':'ok'}],'score':82}],
         'word_alignment':[{'word':'Good','status':'recognized'}],
         'total_asr_words':2,'scored_word_count':1,'eligible_word_count':2,
         'models':{'phoneme_scoring':'E2E-GOP'}}
    with patch.object(speaking_grading,'transcribe',return_value=('Good morning',asr_words)):
        with patch.object(speaking_grading,'score_words',return_value=e2e):
            with patch.object(speaking_grading,'prosody_indicators',return_value={}):
                with patch.object(speaking_grading,'assess_gopt',return_value={'status':'not_configured'}):
                    with patch.dict(os.environ,{'SPEAKING_CONTENT_AI':'false'}):
                        read=speaking_grading.grade_speaking('read',{'text':'Good morning.'},b'WAV_BYTES',measures)
                        assert read['score'] is None and read['pronunciation_score']==82
                        assert read['max_score']==3 and read['pronunciation_words'][0]['word']=='Good'
                        image=speaking_grading.grade_speaking('picture',{},b'WAV_BYTES',measures,b'JPEG','image/jpeg')
                        assert image['pronunciation_score']==82
                        opinion=speaking_grading.grade_speaking('opinion',{'question':'Working from home?'},b'WAV_BYTES',measures)
                        assert opinion['max_score']==5
    print('PASS: Local Speaking on read/picture/opinion, genuine-model structures, no Gemini dependency')

    # Real phoneme identity comes from CMUdict; the ASR's spelling must never
    # invent a /t/ in "rice". These are mocked acoustic values only in tests.
    import io, wave, struct
    pcm=b'\x00\x00'*16000
    with io.BytesIO() as stream:
        with wave.open(stream,'wb') as writer:
            writer.setnchannels(1);writer.setsampwidth(2);writer.setframerate(16000)
            writer.writeframes(pcm)
        wav=stream.getvalue()
    from .pronunciation import engine as pronunciation_engine
    with patch.object(pronunciation_engine,'score_phonemes',side_effect=lambda audio,rate,c:[1.8]*len(c['arpa'])):
        with patch.object(speaking_local,'_unpack_audio',return_value=[0.0]*16000):
            found=speaking_local.score_words(wav,[{'word':'rice','start':0.1,'end':0.65,'asr_confidence':0.99}],'picture')
    assert found['scored_word_count']==1 and found['pronunciation_words'][0]['score']==90
    assert all(p['arpa']!='T' for p in found['pronunciation_words'][0]['phones'])
    assert speaking_local._balanced_samples(list(range(30)),8)[-1]==29
    print('PASS: E2E per-phoneme colors use real canonical phones, no invented /t/, sampled coverage')

    from . import gopt_bridge
    with patch.dict(os.environ,{'GOPT_WEB_URL':'https://example.org'}):
        assert gopt_bridge.assess_gopt(wav,'Good morning')['status']=='invalid_config'
    class FakeGoptResponse:
        def __init__(self,value):self.value=value
        def raise_for_status(self):pass
        def json(self):return self.value
    class FakeGoptClient:
        def __init__(self,**kwargs):pass
        def __enter__(self):return self
        def __exit__(self,*args):return False
        def post(self,url,files,data):
            assert url.endswith('/upload') and files['file'][2]=='audio/wav'
            assert data['transcript']=='Good morning'
            return FakeGoptResponse({'task_id':'task_abc123'})
        def get(self,url):
            return FakeGoptResponse({'status':'completed'} if '/status/' in url else {'result':{'fluency':7.5}})
    import httpx
    with patch.dict(os.environ,{'GOPT_WEB_URL':'http://127.0.0.1:8080'}):
        with patch.object(httpx,'Client',FakeGoptClient):
            report=gopt_bridge.assess_gopt(wav,'Good morning')
    assert report['status']=='completed' and report['data']['result']['fluency']==7.5
    print('PASS: GOPT only accepts localhost and polls genuine WAV-based Kaldi pipeline interface')

    with TestClient(app_module.app) as client:
        models=client.get('/api/speaking/models')
        assert models.status_code==200 and 'phoneme_scorer' in models.json()
        with patch.dict(os.environ,{'GEMINI_API_KEY':'','SPEAKING_CONTENT_AI':'false'}):
            with patch.object(speaking_audio,'prepare_speaking_audio',return_value=(b'FAKE_WAV',measures)):
                with patch.object(speaking_grading,'grade_speaking',return_value=read):
                    r=client.post('/api/speaking/grade',data={'part':'read','task_json':json.dumps({'text':'Good morning.'})},files={'file':('recording.webm',b'X'*200,'audio/webm')})
                    assert r.status_code==200 and r.json()['score'] is None, r.text
                with patch.object(speaking_grading,'grade_speaking',side_effect=ImportError('faster_whisper')):
                    r=client.post('/api/speaking/grade',data={'part':'read','task_json':json.dumps({'text':'Good morning'})},files={'file':('recording.webm',b'X'*200,'audio/webm')})
                    assert r.status_code==503 and 'INSTALL_SPEAKING' in r.json()['detail'], r.text
            r=client.post('/api/speaking/grade',data={'part':'picture','task_json':'{}'},files={'file':('recording.webm',b'X'*200,'audio/webm')})
            assert r.status_code==422, r.text
    print('PASS: /api/speaking/grade runs without Gemini key, model status, input validation')

    with TestClient(app_module.app) as client:
        with patch.dict(os.environ,{'GEMINI_API_KEY':'LOCAL_TEST_ONLY'}):
            with patch.object(grading,'grade_with_gemini',side_effect=Exception('Error code: 503 - high demand')):
                r=client.post('/api/writing/grade',data={'part':'2','answer':'Dear team, I can attend.','question':'Workshop invitation'})
                assert r.status_code==503 and 'quá tải' in r.json()['detail'],r.text
    print('PASS: /api/writing/grade maps upstream Gemini 503 correctly')


if __name__ == '__main__':
    run()
