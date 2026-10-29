"""Validate user-owned TOEIC Studio JSON exports and map their ZIP media."""
from __future__ import annotations

import io
import json
import re
import zipfile
from collections import Counter
from pathlib import PurePosixPath
from typing import Callable

MAX_JSON_BYTES = 20 * 1024 * 1024
MAX_ZIP_BYTES = 180 * 1024 * 1024
MAX_ZIP_ENTRIES = 1200
EXAM_ID = re.compile(r'^[A-Za-z0-9-]{8,100}$')


def _short(value, length=12000):
    return str(value or '').strip()[:length]


def parse_exam_json(raw: bytes) -> list[dict]:
    if not raw or len(raw) > MAX_JSON_BYTES:
        raise ValueError('JSON trống hoặc lớn hơn 20MB.')
    try:
        root = json.loads(raw.decode('utf-8-sig'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError('JSON không hợp lệ hoặc không phải UTF-8.') from exc
    exams = root.get('exams') if isinstance(root, dict) and 'exams' in root else [root]
    if not isinstance(exams, list) or not 1 <= len(exams) <= 30:
        raise ValueError('Chỉ hỗ trợ 1–30 đề trong một lần nhập.')
    result = []
    for exam in exams:
        if not isinstance(exam, dict):
            raise ValueError('Mỗi đề phải là một object JSON.')
        exam_id = _short(exam.get('exam_id'), 100)
        collection = _short(exam.get('collection'), 120)
        title = _short(exam.get('title'), 255)
        if not EXAM_ID.fullmatch(exam_id) or not collection or not title:
            raise ValueError('Đề thiếu exam_id, collection hoặc title.')
        questions = exam.get('questions') or []
        if not isinstance(questions, list) or not 1 <= len(questions) <= 200:
            raise ValueError(f'{title}: số câu hỏi phải trong khoảng 1–200.')
        clean_questions = []
        seen_numbers = set()
        for item in questions:
            if not isinstance(item, dict):
                raise ValueError('Câu hỏi không hợp lệ.')
            n = item.get('number')
            if type(n) is not int or n < 1 or n > 200 or n in seen_numbers:
                raise ValueError(f'{title}: trùng hoặc sai số câu {n}.')
            seen_numbers.add(n)
            part = int(item.get('part') or 0)
            if not 1 <= part <= 7:
                raise ValueError(f'{title}: Part không hợp lệ tại câu {n}.')
            options_source = item.get('options') or []
            if not isinstance(options_source, list):
                raise ValueError(f'{title}: câu {n} có options không hợp lệ.')
            options = []
            for option in options_source[:4]:
                if not isinstance(option, dict):
                    continue
                label = _short(option.get('label'), 1).upper()
                if label not in 'ABCD' or any(o['label'] == label for o in options):
                    continue
                options.append({'label': label, 'text': _short(option.get('text'), 5000),
                                'translation_vi': _short(option.get('translation_vi'), 5000)})
            correct = _short(item.get('correct'), 1).upper()
            if correct not in ('', 'A', 'B', 'C', 'D'):
                correct = ''
            media = item.get('media') or {}
            by_option = item.get('by_option') or {}
            if not isinstance(media, dict) or not isinstance(by_option, dict):
                raise ValueError(f'{title}: câu {n} có media/giải thích không hợp lệ.')
            clean_questions.append({
                'number': n, 'part': part, 'stem': _short(item.get('stem'), 20000),
                'stem_vi': _short(item.get('stem_vi'), 20000),
                'question_ref': _short(item.get('question_ref'), 150),
                'group_ref': _short(item.get('group_ref'), 150),
                'options': options, 'correct': correct,
                'explanation': _short(item.get('explanation'), 20000),
                'by_option': {str(k): _short(v, 7000) for k, v in by_option.items() if str(k) in ('A','B','C','D')},
                'media': {kind: list(dict.fromkeys(_short(url, 1500) for url in (media.get(kind) or [])[:20]
                                 if str(url).startswith(('https://', '/api/media/')))) for kind in ('audio', 'images')},
            })
        passages = []
        for item in (exam.get('passages') or [])[:70]:
            if not isinstance(item, dict):
                continue
            ref = _short(item.get('group_ref'), 100)
            if ref and not any(p['group_ref'] == ref for p in passages):
                passages.append({'group_ref': ref, 'part': int(item.get('part') or 0),
                    'question_numbers': [int(x) for x in (item.get('question_numbers') or [])[:12] if isinstance(x, int)],
                    'passage_text': _short(item.get('passage_text'), 90000),
                    # Never rendered as raw HTML by the React exam player.
                    'passage_html': _short(item.get('passage_html'), 90000),
                    'media': item.get('media') or {'audio': [], 'images': []}})
        paths = exam.get('media_download_paths') or {}
        if not isinstance(paths, dict) or len(paths) > 800:
            raise ValueError(f'{title}: media_download_paths không hợp lệ.')
        result.append({'exam_id': exam_id, 'collection': collection, 'title': title,
            'source': _short(exam.get('source') or 'admin-import', 120),
            'questions': sorted(clean_questions, key=lambda q: q['number']), 'passages': passages,
            'media_download_paths': paths})
    ids = [x['exam_id'] for x in result]
    if len(set(ids)) != len(ids):
        raise ValueError('JSON chứa exam_id bị trùng.')
    return result


def map_exam_media(zip_bytes: bytes | None, exam: dict, put: Callable[[str, str, bytes], str]) -> tuple[dict, list[dict], dict]:
    """Upload media matched by exam UUID and manifest filename. Never extracts ZIP paths."""
    paths = exam['media_download_paths']
    if not zip_bytes:
        return {}, [], {'available': len(paths), 'uploaded': 0, 'missing': len(paths)}
    if len(zip_bytes) > MAX_ZIP_BYTES:
        raise ValueError('Media ZIP quá 180MB; hãy chia thành từng bộ đề.')
    try:
        archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise ValueError('ZIP media không hợp lệ.') from exc
    with archive:
        infos = [info for info in archive.infolist() if not info.is_dir()]
        if len(infos) > MAX_ZIP_ENTRIES or sum(info.file_size for info in infos) > 260 * 1024 * 1024:
            raise ValueError('ZIP có quá nhiều tệp hoặc dung lượng giải nén bất thường.')
        by_name = {}
        for info in infos:
            p = PurePosixPath(info.filename.replace('\\', '/'))
            if p.is_absolute() or '..' in p.parts or '\x00' in info.filename:
                raise ValueError('ZIP chứa đường dẫn không an toàn.')
            if exam['exam_id'] in info.filename:
                by_name.setdefault(p.name, info)
        mapping = {}
        assets = []
        for source_url, path in paths.items():
            if not isinstance(source_url, str) or not source_url.startswith('https://') or not isinstance(path, str):
                continue
            basename = PurePosixPath(path.replace('\\', '/')).name
            info = by_name.get(basename)
            if info is None:
                continue
            if info.file_size > 20 * 1024 * 1024:
                raise ValueError(f'Media quá 20MB: {basename}')
            data = archive.read(info)
            stored_url = put(exam['exam_id'], basename, data)
            mapping[source_url] = stored_url
            assets.append({'source_url': source_url, 'stored_url': stored_url,
                           'filename': basename, 'media_type': 'audio' if basename.lower().endswith(('.mp3','.wav','.m4a','.ogg')) else 'image'})
        return mapping, assets, {'available': len(paths), 'uploaded': len(mapping), 'missing': max(0, len(paths)-len(mapping))}


def substitute_media(record: dict, mapping: dict[str, str]) -> dict:
    media = record.get('media') or {}
    return {**record, 'media': {kind: [mapping.get(u, u) for u in (media.get(kind) or [])]
                                  for kind in ('audio', 'images')}}


def audit_exam(exam: dict) -> dict:
    questions = exam['questions']
    numbers = {q['number'] for q in questions}
    return {'questions': len(questions), 'keys': sum(bool(q.get('correct')) for q in questions),
            'explanations': sum(bool(q.get('explanation')) for q in questions),
            'missing_numbers': [n for n in range(1, 201) if n not in numbers],
            'by_part': dict(sorted(Counter(q['part'] for q in questions).items()))}
