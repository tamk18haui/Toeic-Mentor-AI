"""Learner-facing TOEIC Listening & Reading exam API."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Exam, ExamPassage, ExamQuestion, get_db
from .media_storage import local_media_path

router = APIRouter(prefix='/api/exams', tags=['Exam practice'])
media_router = APIRouter(tags=['Exam media'])


def public_exam(db: Session, exam_id: str) -> Exam:
    exam = db.get(Exam, exam_id)
    if not exam or not exam.published:
        raise HTTPException(404, 'Đề chưa được xuất bản hoặc không tồn tại.')
    return exam


def catalog_item(exam: Exam) -> dict:
    return {'id': exam.id, 'collection': exam.collection, 'title': exam.title,
            'question_count': exam.question_count, 'media_count': exam.media_count,
            'duration_minutes': exam.duration_minutes, 'updated_at': exam.updated_at.isoformat()}


@router.get('')
def list_exams(db: Session = Depends(get_db)):
    rows = db.scalars(select(Exam).where(Exam.published.is_(True)).order_by(Exam.collection, Exam.title)).all()
    groups = defaultdict(list)
    for row in rows:
        groups[row.collection].append(catalog_item(row))
    return {'total': len(rows), 'collections': [{'name': name, 'exams': exams} for name, exams in groups.items()]}


@router.get('/{exam_id}')
def exam_questions(exam_id: str, db: Session = Depends(get_db)):
    exam = public_exam(db, exam_id)
    rows = db.scalars(select(ExamQuestion).where(ExamQuestion.exam_id == exam.id).order_by(ExamQuestion.number)).all()
    passages = db.scalars(select(ExamPassage).where(ExamPassage.exam_id == exam.id)).all()
    questions = [{k: v for k, v in q.body.items() if k not in ('correct', 'explanation', 'by_option')}
                 for q in rows]
    reading = [{k: v for k, v in passage.body.items() if k != 'passage_html'} for passage in passages]
    return {**catalog_item(exam), 'questions': questions, 'passages': reading,
            'rules': {'parts': 7, 'reveal_in_practice': True, 'answers_hidden_until_check_or_submit': True}}


class CheckAnswer(BaseModel):
    choice: str = Field(pattern='^[A-D]$')


@router.post('/{exam_id}/questions/{number}/check')
def check_question(exam_id: str, number: int, attempt: CheckAnswer, db: Session = Depends(get_db)):
    exam = public_exam(db, exam_id)
    row = db.scalar(select(ExamQuestion).where(ExamQuestion.exam_id == exam.id, ExamQuestion.number == number))
    if row is None:
        raise HTTPException(404, 'Không có câu hỏi này.')
    question = row.body
    return {'number': number, 'choice': attempt.choice, 'correct': question.get('correct', ''),
            'is_correct': attempt.choice == question.get('correct'),
            'explanation': question.get('explanation') or 'Chưa có giải thích cho câu này.',
            'by_option': question.get('by_option') or {}}


class SubmitExam(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)


@router.post('/{exam_id}/grade')
def grade_exam(exam_id: str, attempt: SubmitExam, db: Session = Depends(get_db)):
    exam = public_exam(db, exam_id)
    if len(attempt.answers) > 200 or any(choice not in ('A', 'B', 'C', 'D') for choice in attempt.answers.values()):
        raise HTTPException(422, 'Bài làm chứa đáp án không hợp lệ.')
    rows = db.scalars(select(ExamQuestion).where(ExamQuestion.exam_id == exam.id).order_by(ExamQuestion.number)).all()
    details = []
    for row in rows:
        key = row.body.get('correct') or ''
        answer = attempt.answers.get(str(row.number), '')
        details.append({'number': row.number, 'part': row.part, 'selected': answer,
                        'correct': key, 'is_correct': bool(key and answer == key),
                        'explanation': row.body.get('explanation') or '',
                        'by_option': row.body.get('by_option') or {}})
    score = sum(x['is_correct'] for x in details)
    return {'exam_id': exam.id, 'total': len(rows), 'answered': sum(bool(x['selected']) for x in details),
            'correct': score, 'percent': round(100 * score / len(rows), 1) if rows else 0,
            'results': details, 'note': 'Số câu đúng/200; không phải điểm TOEIC quy đổi chính thức.'}


@media_router.get('/api/media/{path:path}')
def serve_media(path: str):
    return FileResponse(local_media_path(path), headers={'Cache-Control': 'public, max-age=86400'})
