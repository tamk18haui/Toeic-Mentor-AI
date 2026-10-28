"""Session auth for learning progress; no hard-coded demo user."""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import User, get_db

JWT_SECRET = os.getenv('JWT_SECRET', 'LOCAL_DEMO_ONLY_CHANGE_ME')
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    if not 8 <= len(password) <= 200:
        raise ValueError('Mật khẩu phải có từ 8 đến 200 ký tự.')
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**14, r=8, p=1)
    return f'scrypt$16384${salt.hex()}${digest.hex()}'


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split('$')
        if algorithm != 'scrypt':
            return False
        digest = hashlib.scrypt(password.encode('utf-8'), salt=bytes.fromhex(salt), n=int(rounds), r=8, p=1)
        return hmac.compare_digest(digest, bytes.fromhex(expected))
    except (ValueError, TypeError, OverflowError):
        return False


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError('Email không hợp lệ.')
    return email


def create_token(user_id: int) -> str:
    return jwt.encode({'sub': str(user_id), 'exp': datetime.now(timezone.utc)+timedelta(days=7)}, JWT_SECRET, algorithm='HS256')


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Vui lòng đăng nhập.')
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
        user_id = int(payload['sub'])
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Tài khoản không tồn tại.')
    return user
