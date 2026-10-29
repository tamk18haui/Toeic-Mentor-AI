"""TOEIC learning content: local-first APIs plus idempotent MySQL import.

The bundled source file makes public learning pages available without MySQL.
When MySQL is connected, a one-time seed stores the same content in relational
tables for future admin editing and reporting, without touching user progress.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .database import Exam, ExamCollection, GrammarTopic, SessionLocal, VocabularyLesson, VocabularyTerm


logger = logging.getLogger('toeic-studio.content')
router = APIRouter(prefix='/api/content', tags=['Learning content'])
CONTENT_FILE = Path(__file__).resolve().parent / 'content' / 'toeic_studio_content.json'


def lesson_id(lesson: dict) -> str:
    url = lesson['source_url']
    return url.rsplit('db%3A', 1)[-1] if 'db%3A' in url else url.rsplit('/', 1)[-1]


@lru_cache(maxsize=1)
def source_data() -> dict:
    with CONTENT_FILE.open(encoding='utf-8') as stream:
        data = json.load(stream)
    data['_vocab_index'] = {lesson_id(lesson): lesson for lesson in data['vocabulary_lessons']}
    data['_grammar_index'] = {lesson['slug']: lesson for lesson in data['grammar']}
    return data


def lesson_summary(lesson: dict) -> dict:
    return {
        'id': lesson_id(lesson), 'collection': lesson.get('collection', 'toeic-600'),
        'lesson_number': lesson['lesson_number'], 'title': lesson['lesson'],
        'term_count': len(lesson['terms']), 'source_empty': lesson.get('status') == 'source_empty',
    }


def db_read(callback, fallback):
    """Prefer admin-editable MySQL content, retain legacy public offline fallback."""
    try:
        with SessionLocal() as db:
            return callback(db)
    except SQLAlchemyError:
        return fallback()


def db_lesson_summary(row: VocabularyLesson, count: int) -> dict:
    return {'id': row.id, 'collection': row.collection, 'lesson_number': row.lesson_number,
            'title': row.title, 'term_count': count, 'source_empty': row.source_empty}


def db_term(row: VocabularyTerm) -> dict:
    return {'word': row.word, 'part_of_speech': row.part_of_speech, 'level': row.level,
            'ipa_uk': row.ipa_uk, 'ipa_us': row.ipa_us, 'meaning_vi': row.meaning_vi,
            'example_en': row.example_en, 'example_vi': row.example_vi,
            'collocations': json.loads(row.collocations_json or '[]'),
            'synonyms': json.loads(row.synonyms_json or '[]')}


def seed_content(db: Session) -> dict:
    """Add only previously unseen content; a restart never duplicates rows."""
    data = source_data()
    existing_lessons = set(db.scalars(select(VocabularyLesson.id)).all())
    existing_grammar = set(db.scalars(select(GrammarTopic.slug)).all())
    existing_exams = set(db.scalars(select(ExamCollection.slug)).all())
    created = {'vocabulary_lessons': 0, 'vocabulary_terms': 0, 'grammar_topics': 0, 'exam_collections': 0}
    for lesson in data['vocabulary_lessons']:
        key = lesson_id(lesson)
        if key in existing_lessons:
            continue
        db.add(VocabularyLesson(
            id=key, collection=lesson.get('collection', 'toeic-600'),
            lesson_number=lesson['lesson_number'], title=lesson['lesson'],
            source_url=lesson['source_url'], source_empty=lesson.get('status') == 'source_empty',
        ))
        for i, word in enumerate(lesson['terms']):
            db.add(VocabularyTerm(
                lesson_id=key, sort_order=i, word=word['word'], part_of_speech=word.get('part_of_speech'),
                level=word.get('level'), ipa_uk=word.get('ipa_uk'), ipa_us=word.get('ipa_us'),
                meaning_vi=word.get('meaning_vi'), example_en=word.get('example_en'),
                example_vi=word.get('example_vi'),
                collocations_json=json.dumps(word.get('collocations') or [], ensure_ascii=False),
                synonyms_json=json.dumps(word.get('synonyms') or [], ensure_ascii=False),
            ))
            created['vocabulary_terms'] += 1
        created['vocabulary_lessons'] += 1
    for topic in data['grammar']:
        if topic['slug'] in existing_grammar:
            continue
        db.add(GrammarTopic(
            slug=topic['slug'], title=topic['title'], source_url=topic['source_url'],
            blocks_json=json.dumps(topic['blocks'], ensure_ascii=False),
        ))
        created['grammar_topics'] += 1
    for exam in data['exam_catalog']:
        key = exam['collection'].lower().replace(' ', '-')
        if key in existing_exams:
            continue
        db.add(ExamCollection(
            slug=key, title=exam['collection'], source_url=exam['source_url'],
            test_names_json=json.dumps(exam['test_names'], ensure_ascii=False),
            parts_json=json.dumps(exam['parts'], ensure_ascii=False),
            duration_minutes=exam['duration_minutes'],
        ))
        created['exam_collections'] += 1
    if any(created.values()):
        db.commit()
        logger.info('Imported learning content into MySQL: %s', created)
    return created


@router.get('/summary')
def summary():
    data = source_data()
    stats = data.get('data_quality', {})
    fallback = {
        'vocabulary_lessons': len(data['vocabulary_lessons']),
        'vocabulary_terms': sum(len(item['terms']) for item in data['vocabulary_lessons']),
        'grammar_topics': len(data['grammar']),
        'exam_catalog_tests': sum(item['tests'] for item in data['exam_catalog']),
        'exam_questions_available': 0,
        'unique_spellings': stats.get('distinct_vocab_spellings'),
    }
    def from_db(db):
        return {**fallback,
                'vocabulary_lessons': db.scalar(select(func.count()).select_from(VocabularyLesson)),
                'vocabulary_terms': db.scalar(select(func.count()).select_from(VocabularyTerm)),
                'grammar_topics': db.scalar(select(func.count()).select_from(GrammarTopic)),
                'exam_questions_available': db.scalar(select(func.sum(Exam.question_count)).where(Exam.published.is_(True))) or 0}
    return db_read(from_db, lambda: fallback)


@router.get('/vocabulary/collections')
def vocabulary_collections():
    def from_db(db):
        rows = db.execute(select(VocabularyLesson.collection, func.count(func.distinct(VocabularyLesson.id)),
            func.count(VocabularyTerm.id)).outerjoin(VocabularyTerm).group_by(VocabularyLesson.collection)).all()
        return [{'id': key, 'title': key.replace('-', ' ').upper(), 'lessons': n, 'terms': count}
                for key, n, count in rows]
    def from_file():
        groups = {}
        for lesson in source_data()['vocabulary_lessons']:
            key = lesson.get('collection', 'toeic-600')
            item = groups.setdefault(key, {'id': key, 'title': key.replace('-', ' ').upper(), 'lessons': 0, 'terms': 0})
            item['lessons'] += 1
            item['terms'] += len(lesson['terms'])
        return list(groups.values())
    return db_read(from_db, from_file)


@router.get('/vocabulary/lessons')
def vocabulary_lessons(collection: str = '', q: str = '', limit: int = Query(100, ge=1, le=300), offset: int = Query(0, ge=0)):
    search = q.casefold().strip()[:100]
    def from_db(db):
        query = select(VocabularyLesson)
        if collection:
            query = query.where(VocabularyLesson.collection == collection)
        if search:
            term_match = select(VocabularyTerm.lesson_id).where(
                VocabularyTerm.word.ilike(f'%{search}%') | VocabularyTerm.meaning_vi.ilike(f'%{search}%'))
            query = query.where(VocabularyLesson.title.ilike(f'%{search}%') | VocabularyLesson.id.in_(term_match))
        rows = db.scalars(query.order_by(VocabularyLesson.collection, VocabularyLesson.lesson_number)).all()
        counts = dict(db.execute(select(VocabularyTerm.lesson_id, func.count()).group_by(VocabularyTerm.lesson_id)).all())
        return {'total': len(rows), 'items': [db_lesson_summary(row, counts.get(row.id, 0)) for row in rows[offset:offset+limit]]}
    def from_file():
        rows = []
        for lesson in source_data()['vocabulary_lessons']:
            if collection and lesson.get('collection', 'toeic-600') != collection:
                continue
            if search and search not in lesson['lesson'].casefold() and not any(search in word['word'].casefold() or search in (word.get('meaning_vi') or '').casefold() for word in lesson['terms']):
                continue
            rows.append(lesson_summary(lesson))
        return {'total': len(rows), 'items': rows[offset:offset + limit]}
    return db_read(from_db, from_file)


@router.get('/vocabulary/lessons/{item_id}')
def vocabulary_lesson(item_id: str):
    def from_db(db):
        row = db.get(VocabularyLesson, item_id)
        if not row:
            raise HTTPException(404, 'Không tìm thấy bài từ vựng.')
        terms = db.scalars(select(VocabularyTerm).where(VocabularyTerm.lesson_id == item_id).order_by(VocabularyTerm.sort_order)).all()
        return {**db_lesson_summary(row, len(terms)), 'source_url': row.source_url, 'terms': [db_term(t) for t in terms]}
    def from_file():
        lesson = source_data()['_vocab_index'].get(item_id)
        if lesson is None:
            raise HTTPException(404, 'Không tìm thấy bài từ vựng.')
        return {**lesson_summary(lesson), 'source_url': lesson['source_url'], 'terms': lesson['terms']}
    return db_read(from_db, from_file)


@router.get('/grammar')
def grammar_topics(q: str = ''):
    search = q.casefold().strip()[:100]
    def from_db(db):
        query = select(GrammarTopic)
        if search:
            query = query.where(GrammarTopic.title.ilike(f'%{search}%'))
        return [{'slug': row.slug, 'title': row.title, 'level': None,
                 'block_count': len(json.loads(row.blocks_json))} for row in db.scalars(query.order_by(GrammarTopic.title)).all()]
    def from_file():
        return [{'slug': t['slug'], 'title': t['title'], 'level': None, 'block_count': len(t['blocks'])}
                for t in source_data()['grammar'] if not search or search in t['title'].casefold()]
    return db_read(from_db, from_file)


@router.get('/grammar/{slug}')
def grammar_topic(slug: str):
    def from_db(db):
        row = db.get(GrammarTopic, slug)
        if row is None:
            raise HTTPException(404, 'Không tìm thấy chủ điểm ngữ pháp.')
        return {'slug': row.slug, 'title': row.title, 'source_url': row.source_url,
                'blocks': json.loads(row.blocks_json)}
    def from_file():
        item = source_data()['_grammar_index'].get(slug)
        if item is None:
            raise HTTPException(404, 'Không tìm thấy chủ điểm ngữ pháp.')
        return item
    return db_read(from_db, from_file)


@router.get('/exams')
def exam_catalog():
    return {'collections': source_data()['exam_catalog'], 'questions_available': False,
            'notice': 'Danh mục 25 đề; chưa có câu hỏi, đáp án, audio hoặc hình ảnh. Chỉ bài demo tự biên soạn có thể làm.'}
