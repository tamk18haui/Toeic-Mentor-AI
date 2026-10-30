"""Qwen3-VL 8B via loopback Ollama only. Uses locally installed model."""
from __future__ import annotations
import base64
import json
import logging
import os
from urllib.parse import urlparse

import httpx

LOG = logging.getLogger(__name__)
MODEL_DEFAULT = 'qwen3-vl:8b-instruct'

class WritingModelError(RuntimeError):
    pass

def model_name() -> str:
    return os.getenv('WRITING_OLLAMA_MODEL', '').strip() or os.getenv('OLLAMA_MODEL', '').strip() or MODEL_DEFAULT

def base_url() -> str:
    url = (os.getenv('OLLAMA_URL') or 'http://127.0.0.1:11434').rstrip('/')
    parsed = urlparse(url)
    if (parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost'}
            or parsed.username or parsed.password or parsed.port not in (None, 11434)
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise WritingModelError('Ollama chi duoc ket noi qua localhost port 11434, khong gui bai ra Internet.')
    return url

def status() -> dict:
    name = model_name()
    try:
        with httpx.Client(timeout=4.0, trust_env=False) as client:
            res = client.get(base_url() + '/api/tags')
            res.raise_for_status()
            items = [item.get('name', '') for item in res.json().get('models', [])]
        return {'connected': True, 'model': name, 'model_installed': name in items,
                'ready': name in items, 'available_models': items[:15]}
    except (httpx.HTTPError, KeyError, ValueError, WritingModelError) as exc:
        return {'connected': False, 'model': name, 'model_installed': False, 'ready': False,
                'error': type(exc).__name__}

def chat_json(system: str, prompt: str, picture: bytes | None = None) -> dict:
    if picture is not None and len(picture) > 5 * 1024 * 1024:
        raise WritingModelError('Anh vuot qua 5MB.')
    user = {'role': 'user', 'content': prompt}
    if picture is not None:
        user['images'] = [base64.b64encode(picture).decode('ascii')]
    payload = {'model': model_name(), 'stream': False, 'format': 'json',
               'messages': [{'role':'system', 'content': system}, user],
               'keep_alive': os.getenv('WRITING_KEEP_ALIVE', '0'),
               'options': {'temperature': 0.05, 'num_ctx': int(os.getenv('WRITING_NUM_CTX','8192')),
                           'num_predict': int(os.getenv('WRITING_MAX_PREDICT','1900'))}}
    try:
        timeout = httpx.Timeout(connect=8, read=float(os.getenv('WRITING_TIMEOUT_SECONDS','600')), write=30, pool=8)
        with httpx.Client(timeout=timeout, trust_env=False) as client:
            res = client.post(base_url() + '/api/chat', json=payload)
            res.raise_for_status()
            data = res.json()
            raw = data['message']['content'].strip()
        if raw.startswith('```'):
            raw = raw.split('\n',1)[-1].rsplit('```',1)[0].strip()
        result = json.loads(raw)
    except (httpx.HTTPError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        LOG.warning('Qwen Writing local request failed: %s', type(exc).__name__)
        raise WritingModelError('Khong cham duoc bang Qwen local. Kiem tra ollama list, Ollama dang chay, RAM va backend log.') from exc
    if not isinstance(result, dict):
        raise WritingModelError('Model phai tra ve JSON object, khong phai text.')
    return result
