"""Optional *real* GOPT/ Kaldi bridge to E3zra's Docker-backed web_server.py.

The original GOPT REST /predict endpoint accepts Kaldi GOP feature arrays,
NOT WAV audio. This adapter calls the fork's /upload task API instead. It
never passes E2E-GOP scores off as 84-dimensional GOPT features.
"""
from __future__ import annotations

import logging
import os
import time
from urllib.parse import urlparse

LOG = logging.getLogger(__name__)


def assess_gopt(wav: bytes, transcript: str) -> dict:
    url = os.getenv('GOPT_WEB_URL', '').strip().rstrip('/')
    if not url:
        return {'status': 'not_configured', 'model': 'GOPT + Kaldi',
                'note': 'GOPT thật cần Kaldi GOP features; xem hướng dẫn bật GOPT Docker trong README.'}
    parsed = urlparse(url)
    # It is a local service with access to audio; block arbitrary remote URLs.
    if parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost'} or parsed.username or parsed.password:
        return {'status': 'invalid_config', 'note': 'GOPT_WEB_URL chỉ được trỏ đến http://127.0.0.1 hoặc localhost.'}
    if not transcript.strip():
        return {'status': 'skipped', 'note': 'Whisper chưa nhận dạng được lời nói để tạo transcript GOPT.'}
    try:
        import httpx
        with httpx.Client(timeout=httpx.Timeout(15, read=45), trust_env=False) as client:
            upload = client.post(f'{url}/upload', files={'file': ('answer.wav', wav, 'audio/wav')},
                                 data={'transcript': transcript[:3000]})
            upload.raise_for_status()
            task_id = upload.json()['task_id']
            if not isinstance(task_id, str) or not task_id.startswith('task_'):
                raise ValueError('GOPT server returned an unexpected task_id')
            deadline = time.monotonic() + min(240, max(20, int(os.getenv('GOPT_TIMEOUT_SECONDS', '100'))))
            while time.monotonic() < deadline:
                state = client.get(f'{url}/status/{task_id}')
                state.raise_for_status()
                info = state.json()
                if info.get('status') == 'completed':
                    result = client.get(f'{url}/result/{task_id}')
                    result.raise_for_status()
                    data = result.json()
                    # Preserve the author's GOPT output separately; never merge
                    # incomparable GOPT scales into E2E-GOP phone values.
                    return {'status': 'completed', 'model': 'GOPT + Kaldi',
                            'task_id': task_id, 'data': data}
                if info.get('status') in {'error', 'failed'}:
                    return {'status': 'failed', 'model': 'GOPT + Kaldi',
                            'note': 'Pipeline GOPT báo lỗi; xem log Docker và trang GOPT.',
                            'stage': str(info.get('stage', ''))[:200]}
                time.sleep(2)
        return {'status': 'timeout', 'model': 'GOPT + Kaldi',
                'note': 'GOPT chưa xử lý xong trong giới hạn chờ. Kiểm tra trạng thái trên cổng 8080.'}
    except Exception as exc:
        LOG.warning('GOPT sidecar unavailable (%s): %s', type(exc).__name__, exc)
        return {'status': 'unavailable', 'model': 'GOPT + Kaldi',
                'note': 'Không kết nối được GOPT Docker. Phần E2E-GOP/Whisper vẫn hoạt động độc lập.'}

