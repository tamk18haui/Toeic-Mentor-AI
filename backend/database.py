"""MySQL persistence. Tables are created on startup in local development."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

load_dotenv(Path(__file__).with_name('.env'))
DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://toeic:toeic123@127.0.0.1:3307/toeic_studio?charset=utf8mb4')
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, connect_args={'connect_timeout': 3} if DATABASE_URL.startswith('mysql') else {})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    attempts: Mapped[list['PracticeAttempt']] = relationship(back_populates='user')


class PracticeAttempt(Base):
    __tablename__ = 'practice_attempts'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True, nullable=False)
    mode: Mapped[str] = mapped_column(String(40), nullable=False)
    part: Mapped[str] = mapped_column(String(50), nullable=False)
    question_ref: Mapped[str] = mapped_column(String(80), nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default='{}')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    user: Mapped[User] = relationship(back_populates='attempts')


class LessonProgress(Base):
    __tablename__ = 'lesson_progress'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    lesson_ref: Mapped[str] = mapped_column(String(80), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    best_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)


class VocabularyLesson(Base):
    __tablename__ = 'vocabulary_lessons'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    collection: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    lesson_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_empty: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms: Mapped[list['VocabularyTerm']] = relationship(back_populates='lesson', cascade='all, delete-orphan')


class VocabularyTerm(Base):
    __tablename__ = 'vocabulary_terms'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey('vocabulary_lessons.id'), index=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    word: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    part_of_speech: Mapped[str | None] = mapped_column(String(80))
    level: Mapped[str | None] = mapped_column(String(10))
    ipa_uk: Mapped[str | None] = mapped_column(String(255))
    ipa_us: Mapped[str | None] = mapped_column(String(255))
    meaning_vi: Mapped[str | None] = mapped_column(Text)
    example_en: Mapped[str | None] = mapped_column(Text)
    example_vi: Mapped[str | None] = mapped_column(Text)
    collocations_json: Mapped[str] = mapped_column(Text, default='[]')
    synonyms_json: Mapped[str] = mapped_column(Text, default='[]')
    lesson: Mapped[VocabularyLesson] = relationship(back_populates='terms')


class GrammarTopic(Base):
    __tablename__ = 'grammar_topics'
    slug: Mapped[str] = mapped_column(String(180), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    blocks_json: Mapped[str] = mapped_column(Text, nullable=False)


class ExamCollection(Base):
    __tablename__ = 'exam_collections'
    slug: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    test_names_json: Mapped[str] = mapped_column(Text, nullable=False)
    parts_json: Mapped[str] = mapped_column(Text, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=120)


class AdminAccount(Base):
    """Independent admin identity; no migration of the existing learner table."""
    __tablename__ = 'admin_accounts'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class Exam(Base):
    __tablename__ = 'exams'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    collection: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(120), default='admin-import', nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    media_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)
    questions: Mapped[list['ExamQuestion']] = relationship(back_populates='exam', cascade='all, delete-orphan')
    passages: Mapped[list['ExamPassage']] = relationship(back_populates='exam', cascade='all, delete-orphan')
    media_assets: Mapped[list['ExamMediaAsset']] = relationship(back_populates='exam', cascade='all, delete-orphan')


class ExamQuestion(Base):
    __tablename__ = 'exam_questions'
    __table_args__ = (UniqueConstraint('exam_id','number',name='uq_exam_question_number'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey('exams.id'), index=True, nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    part: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[dict] = mapped_column(JSON, nullable=False)
    exam: Mapped[Exam] = relationship(back_populates='questions')


class ExamPassage(Base):
    __tablename__ = 'exam_passages'
    __table_args__ = (UniqueConstraint('exam_id','group_ref',name='uq_exam_passage_ref'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey('exams.id'), index=True, nullable=False)
    group_ref: Mapped[str] = mapped_column(String(100), nullable=False)
    body: Mapped[dict] = mapped_column(JSON, nullable=False)
    exam: Mapped[Exam] = relationship(back_populates='passages')


class ExamMediaAsset(Base):
    __tablename__ = 'exam_media_assets'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey('exams.id'), index=True, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    stored_url: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    exam: Mapped[Exam] = relationship(back_populates='media_assets')


def get_db():
    with SessionLocal() as session:
        yield session


def init_db():
    Base.metadata.create_all(bind=engine)
