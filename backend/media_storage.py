"""TOEIC exam media storage: local for development, S3-compatible for cloud.

Never stores secret credentials or third-party request URLs in the frontend.
Cloudflare R2 and AWS S3 both support the same boto3 upload interface.
"""
from __future__ import annotations

import io
import os
import re
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException

UPLOAD_ROOT = Path(os.getenv('MEDIA_LOCAL_DIR', '').strip() or str(Path(__file__).resolve().parent / 'uploads')).resolve()
MIME = {
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
}
MAX_ITEM_BYTES = 20 * 1024 * 1024


def verify_media(filename: str, data: bytes) -> str:
    """Restrict admin ZIP media to supported image/audio signatures."""
    extension = Path(filename).suffix.lower()
    mime = MIME.get(extension)
    if not mime or not 8 <= len(data) <= MAX_ITEM_BYTES:
        raise ValueError(f'Tệp media không hỗ trợ hoặc vượt 20MB: {filename}')
    checks = {
        '.png': data.startswith(b'\x89PNG\r\n\x1a\n'),
        '.jpg': data.startswith(b'\xff\xd8'), '.jpeg': data.startswith(b'\xff\xd8'),
        '.gif': data.startswith((b'GIF87a', b'GIF89a')),
        '.webp': data.startswith(b'RIFF') and data[8:12] == b'WEBP',
        '.wav': data.startswith(b'RIFF') and data[8:12] == b'WAVE',
        '.ogg': data.startswith(b'OggS'),
        '.m4a': data[4:8] == b'ftyp',
        '.mp3': data.startswith(b'ID3') or (data[0] == 0xff and (data[1] & 0xe0) == 0xe0),
    }
    if not checks.get(extension, False):
        raise ValueError(f'Không đúng định dạng ảnh/audio: {filename}')
    return mime


def safe_object_key(exam_id: str, filename: str) -> str:
    if not re.fullmatch(r'[a-zA-Z0-9-]{8,100}', exam_id):
        raise ValueError('Mã đề không hợp lệ.')
    basename = Path(filename).name
    if basename != filename or not re.fullmatch(r'[a-zA-Z0-9_.-]{1,180}', basename):
        raise ValueError('Tên tệp media không an toàn.')
    return f'exams/{exam_id}/{basename}'


def storage_mode() -> str:
    mode = os.getenv('MEDIA_STORAGE_PROVIDER', 'local').strip().lower()
    if mode not in ('local', 's3'):
        raise RuntimeError('MEDIA_STORAGE_PROVIDER chỉ hỗ trợ local hoặc s3.')
    return mode


def put_media(exam_id: str, filename: str, content: bytes) -> str:
    mime = verify_media(filename, content)
    key = safe_object_key(exam_id, filename)
    if storage_mode() == 'local':
        target = (UPLOAD_ROOT / key).resolve()
        if not target.is_relative_to(UPLOAD_ROOT):
            raise ValueError('Đường dẫn lưu file không hợp lệ.')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return '/api/media/' + quote(key, safe='/')

    bucket = os.getenv('S3_BUCKET', '').strip()
    public_base = os.getenv('S3_PUBLIC_BASE_URL', '').rstrip('/')
    if not bucket or not public_base.startswith('https://'):
        raise RuntimeError('Thiếu S3_BUCKET hoặc S3_PUBLIC_BASE_URL (HTTPS).')
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError('Chưa cài boto3; hãy cài backend/requirements.txt.') from exc
    client = boto3.client(
        's3', endpoint_url=os.getenv('S3_ENDPOINT_URL') or None,
        region_name=os.getenv('S3_REGION', 'auto'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID') or None,
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY') or None,
    )
    client.upload_fileobj(
        io.BytesIO(content), bucket, key,
        ExtraArgs={'ContentType': mime, 'CacheControl': 'public, max-age=31536000'},
    )
    return f'{public_base}/{quote(key, safe="/")}'


def local_media_path(key: str) -> Path:
    """Only serve files within uploads/exams; no traversal, no hidden config."""
    if storage_mode() != 'local':
        raise HTTPException(404, 'Media được lưu trên cloud.')
    parts = key.split('/')
    if len(parts) != 3 or parts[0] != 'exams':
        raise HTTPException(404, 'Tệp không tồn tại.')
    try:
        canonical = safe_object_key(parts[1], parts[2])
    except ValueError as exc:
        raise HTTPException(404, 'Tệp không tồn tại.') from exc
    result = (UPLOAD_ROOT / canonical).resolve()
    if not result.is_relative_to(UPLOAD_ROOT) or not result.is_file():
        raise HTTPException(404, 'Tệp không tồn tại.')
    return result
