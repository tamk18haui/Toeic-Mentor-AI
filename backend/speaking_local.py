"""CPU TOEIC Speaking assessment: real ASR + acoustic phoneme predictions.

ASR is never treated as proof that every spoken phone is correct. E2E-GOP
predicts only on ASR-confidence-gated, time-aligned samples; unexamined words
remain unscored. The two models have separate, explicitly named outputs.
"""
from __future__ import annotations

import io
import logging
import os
import re
import wave
from difflib import SequenceMatcher
from functools import lru_cache

from .pronunciation.phonetics import ARPA_TO_IPA, classify_score, get_canonical, get_tip

LOG = logging.getLogger(__name__)
WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")


@lru_cache(maxsize=1)
def load_asr():
    from faster_whisper import WhisperModel

    model_name = os.getenv('SPEAKING_WHISPER_MODEL', 'tiny.en').strip() or 'tiny.en'
    if model_name not in {'tiny.en', 'base.en', 'small.en'}:
        raise ValueError('SPEAKING_WHISPER_MODEL chỉ hỗ trợ tiny.en, base.en, small.en.')
    LOG.info('Loading faster-whisper %s, CPU int8', model_name)
    model = WhisperModel(model_name, device='cpu', compute_type='int8',
                         cpu_threads=min(4, os.cpu_count() or 2), num_workers=1)
    return model


def transcribe(wav: bytes) -> tuple[str, list[dict]]:
    model = load_asr()
    # The source is already 16kHz mono PCM WAV, converted in speaking_audio.py.
    segments, _info = model.transcribe(io.BytesIO(wav), language='en', beam_size=3,
                                      word_timestamps=True, vad_filter=True,
                                      condition_on_previous_text=False)
    sentences = []
    words = []
    for segment in segments:
        sentences.append(segment.text.strip())
        for item in (segment.words or []):
            match = WORD.search(item.word)
            if match is None:
                continue
            words.append({
                'word': match.group(), 'start': max(0.0, float(item.start)),
                'end': float(item.end), 'asr_confidence': round(float(item.probability or 0), 3)
            })
    return ' '.join(s for s in sentences if s).strip(), words


def _read_alignment(reference: str, words: list[dict]) -> list[dict]:
    ref = WORD.findall(reference)
    hyp = [w['word'] for w in words]
    aligned = [{'word': w, 'status': 'unverified'} for w in ref]
    matching = SequenceMatcher(None, [x.lower() for x in ref],
                               [x.lower() for x in hyp], autojunk=False)
    for typ, i1, i2, j1, j2 in matching.get_opcodes():
        if typ == 'equal':
            for ix, jx in zip(range(i1, i2), range(j1, j2)):
                aligned[ix]['status'] = 'recognized'
                words[jx]['reference_match'] = True
    return aligned


def _unpack_audio(wav: bytes):
    import numpy as np
    with wave.open(io.BytesIO(wav), 'rb') as reader:
        if reader.getframerate() != 16000 or reader.getnchannels() != 1 or reader.getsampwidth() != 2:
            raise ValueError('Audio Speaking cần là WAV PCM mono 16 kHz.')
        data = np.frombuffer(reader.readframes(reader.getnframes()), dtype='<i2')
    return data.astype('float32') / 32768.0


def _balanced_samples(eligible: list[dict], limit: int) -> list[dict]:
    """Spread limited CPU inference across a response, never imply full coverage."""
    if len(eligible) <= limit:
        return eligible
    if limit == 1:
        return [eligible[len(eligible)//2]]
    indexes = sorted({round(i * (len(eligible) - 1) / (limit - 1)) for i in range(limit)})
    return [eligible[i] for i in indexes]


def score_words(wav: bytes, words: list[dict], part: str, reference: str = '') -> dict:
    """Real E2E-GOP per-word audio predictions; no interpolation of unscored phones."""
    from .pronunciation.engine import score_phonemes, recognize_phonemes

    aligned = _read_alignment(reference, words) if part == 'read' else []
    total = len(words)
    eligible = []
    for w in words:
        if w['asr_confidence'] < 0.68 or w['end'] - w['start'] < 0.12:
            continue
        if part == 'read' and not w.get('reference_match'):
            continue
        if not re.fullmatch('[A-Za-z]{1,28}', w['word']):
            continue
        try:
            w['canonical'] = get_canonical(w['word'])
            eligible.append(w)
        except (ValueError, RuntimeError):
            continue
    max_words = min(16, max(1, int(os.getenv('SPEAKING_E2E_MAX_WORDS', '8'))))
    chosen = _balanced_samples(eligible, max_words)
    samples = _unpack_audio(wav)
    results = []
    verify = os.getenv('SPEAKING_VERIFY_PHONEMES', 'false').lower() == 'true'
    for word in chosen:
        start = max(0, round((word['start'] - .12) * 16000))
        stop = min(len(samples), round((word['end'] + .12) * 16000))
        audio = samples[start:stop]
        if len(audio) < 3200:
            continue
        canonical = word['canonical']
        try:
            scores = score_phonemes(audio, 16000, canonical)
        except Exception:
            LOG.exception('E2E-GOP failed on word %r (remaining words skipped)', word['word'])
            if not results:
                raise
            break
        phones = []
        for arpa, ipa, raw in zip(canonical['arpa'], canonical['ipa'], scores):
            color = classify_score(raw)
            phones.append({'arpa': arpa, 'ipa': ipa, 'raw_score': round(raw, 3),
                           'display_score': round(max(0, min(100, raw * 50))),
                           'color': color, 'tip': get_tip(arpa, color)})
        row = {'word': word['word'], 'start': round(word['start'], 2),
               'end': round(word['end'], 2), 'asr_confidence': word['asr_confidence'],
               'ipa_text': canonical['ipa_text'], 'phones': phones,
               'score': round(sum(p['display_score'] for p in phones) / len(phones)),
               'status': 'sampled_estimate', 'model': 'E2E-GOP'}
        if verify and len(results) < 2:
            try:
                row['independent_phonemes'] = recognize_phonemes(audio, 16000)
            except Exception as exc:
                LOG.warning('Optional Wav2Vec2 recognition unavailable: %s', exc)
        results.append(row)
    pronunciation = (round(sum(w['score'] for w in results) / len(results))
                     if results else None)
    return {
        'pronunciation_score': pronunciation, 'pronunciation_words': results,
        'word_alignment': aligned, 'total_asr_words': total,
        'scored_word_count': len(results), 'eligible_word_count': len(eligible),
        'models': {'phoneme_scoring': 'anonym-coling2027/E2E-GOP-SpeechOcean762',
                   'phoneme_recognition': 'facebook/wav2vec2-lv-60-espeak-cv-ft' if verify else None},
    }


def prosody_indicators(wav: bytes) -> dict:
    """Acoustic pitch indicators, NOT a trained prosody score."""
    import numpy as np
    x = _unpack_audio(wav)
    # Low-cost normalized autocorrelation. F0 is approximate and not graded.
    pitches = []
    for start in range(0, len(x) - 640, 1600):
        frame = x[start:start+640]
        if float(np.sqrt(np.mean(frame*frame))) < .025:
            continue
        frame = frame - frame.mean()
        corr = np.correlate(frame, frame, mode='full')[len(frame)-1:]
        if corr[0] <= 1e-6:
            continue
        lag = 50 + int(np.argmax(corr[50:267]))
        if corr[lag] / corr[0] > 0.55:
            pitches.append(16000 / lag)
    return {
        'median_pitch_hz_est': round(float(np.median(pitches)), 1) if pitches else None,
        'pitch_range_hz_est': round(float(np.percentile(pitches, 90)-np.percentile(pitches, 10)), 1) if len(pitches)>5 else None,
        'note': 'F0/biên độ ngữ điệu chỉ mang tính tham khảo; chưa phải điểm nhấn giọng bằng AI.',
    }


def fluency_indicators(words: list[dict], metrics: dict) -> tuple[int | None, dict]:
    spoken = max(0.1, float(metrics.get('speech_seconds_est') or 0))
    pace = round(len(words) / spoken * 60) if len(words)>1 else None
    pauses = int(metrics.get('long_pause_count_est') or 0)
    return None, {'words_per_speech_minute_est': pace, 'long_pauses': pauses,
                  'note': 'Nhịp nói và khoảng dừng đo được, chưa hiệu chuẩn thành điểm Fluency 0–100.'}
