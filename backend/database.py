"""MySQL persistence. Tables are created on startup in local development."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
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


def get_db():
    with SessionLocal() as session:
        yield session


def init_db():
    Base.metadata.create_all(bind=engine)
