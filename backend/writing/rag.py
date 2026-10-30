"""Offline deterministic rubric retrieval for a tiny, reviewed ETS-inspired corpus.

This is retrieval-augmented grading, NOT vector embeddings. Rubric selection is
exact by TOEIC writing Part; related coaching guidance is retrieved by words.
"""
from __future__ import annotations
from functools import lru_cache
from pathlib import Path
import json
import re

PATH = Path(__file__).resolve().parent / 'rag_data' / 'rubrics.json'

@lru_cache(maxsize=1)
def corpus() -> dict:
    data = json.loads(PATH.read_text(encoding='utf-8'))
    assert all(str(n) in data['parts'] for n in (1,2,3))
    return data

def retrieve(part: int, question: str = '', answer: str = '', limit: int = 3) -> dict:
    book = corpus()
    rubric = book['parts'].get(str(part))
    if rubric is None:
        raise ValueError('Writing Part khong hop le (1, 2, 3).')
    tokens = set(re.findall(r'[a-z]+', (question + ' ' + answer[:300]).lower()))
    guides = []
    for doc in book['guides']:
        if doc['part'] not in (part, 0):
            continue
        score = len(tokens.intersection(doc['keywords']))
        guides.append((score, doc))
    guides.sort(key=lambda item: (-item[0], item[1]['id']))
    best = [doc for _, doc in guides[:limit]]
    return {'rubric': rubric, 'guides': best,
            'citation': {'title': book['reference']['title'], 'url': book['reference']['url'],
                         'page': rubric['page'], 'rubric_id': f'ETS-WRITING-PART-{part}',
                         'description': book['reference']['usage']}}
