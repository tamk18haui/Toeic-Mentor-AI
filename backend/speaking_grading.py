"""Speaking: genuine local CPU models; optional and separately identified content AI."""
from __future__ import annotations

import json
import logging

from .gopt_bridge import assess_gopt
from .speaking_local import fluency_indicators, prosody_indicators, score_words, transcribe

LOG = logging.getLogger(__name__)
SPEAKING_PARTS = {'read', 'picture', 'questions', 'information', 'opinion', 'solution'}
MAX_SCORE = {part: 5 if part == 'opinion' else 3 for part in SPEAKING_PARTS}


def grade_speaking(part: str, task: dict, wav: bytes, metrics: dict,
                   picture: bytes | None = None, mime: str | None = None) -> dict:
    if part not in SPEAKING_PARTS:
        raise ValueError('Part Speaking không hợp lệ.')
    text = str(task.get('text') or '')[:3500]
    question = str(task.get('question') or '')[:1800]
    schedule = task.get('schedule', [])
    if part == 'read' and not text.strip():
        raise ValueError('Cần đoạn văn Read Aloud.')
    if part == 'picture' and not picture:
        raise ValueError('Cần ảnh đề bài Describe a Picture.')
    if part in {'questions','information','opinion','solution'} and not question.strip():
        raise ValueError('Cần câu hỏi Speaking.')
    if not isinstance(schedule,list) or len(json.dumps(schedule,ensure_ascii=False))>4000:
        raise ValueError('Bảng thông tin đề bài không hợp lệ.')

    transcript, words = transcribe(wav)
    if not words:
        return {
            'part':part,'score':None,'max_score':MAX_SCORE[part],
            'official_ets_score':False,'transcript':transcript,
            'pronunciation_score':None,'fluency_score':None,'intonation_score':None,
            'content_score':None,'pronunciation_words':[],'word_alignment':[],
            'suspected_words':[],'timing':metrics,'gopt':{'status':'skipped'},
            'overall_vi':'Whisper không nhận dạng rõ được từ nào. Hãy nghe lại bản ghi.',
            'strengths_vi':[],'improvements_vi':['Ghi âm lại ở nơi ít tiếng ồn.'],
            'confidence_note_vi':'Không có đủ lời nói được nhận dạng để chấm âm vị; không cho điểm giả.'
        }

    acoustic_error = None
    try:
        e2e = score_words(wav, words, part, text)
    except Exception as exc:
        LOG.exception('Speaking E2E-GOP unavailable')
        acoustic_error = f'Không chạy được E2E-GOP ({type(exc).__name__}). Cài INSTALL_SPEAKING_AI_WINDOWS.bat và xem log FastAPI.'
        from .speaking_local import _read_alignment
        e2e = {'pronunciation_score':None,'pronunciation_words':[],
               'word_alignment':_read_alignment(text,words) if part=='read' else [],
               'total_asr_words':len(words),'scored_word_count':0,
               'eligible_word_count':0,'models':{'phoneme_scoring':'unavailable'}}

    fluency_score, fluency_metrics = fluency_indicators(words, metrics)
    pitch = prosody_indicators(wav)
    gopt = assess_gopt(wav, transcript)

    # Only make recommendations supported by observed audio and acoustic scores.
    # A transcript alone is not proof that a phoneme was articulated correctly.
    suspected_words = []
    for spoken_word in e2e['pronunciation_words']:
        weak = sorted((p for p in spoken_word['phones'] if p['color'] in {'red', 'yellow'}),
                      key=lambda p: p['display_score'])
        if not weak:
            continue
        worst = weak[0]
        suspected_words.append({
            'word': spoken_word['word'],
            'start': spoken_word.get('start'), 'end': spoken_word.get('end'),
            'phone': worst['ipa'], 'color': worst['color'],
            'reason_vi': f"Âm /{worst['ipa']}/ cần nghe lại. {worst['tip']}",
        })
    suspected_words = sorted(
        suspected_words, key=lambda row: 0 if row['color'] == 'red' else 1
    )[:5]
    read_coverage = None
    if part == 'read' and e2e['word_alignment']:
        total_reference_words = len(e2e['word_alignment'])
        matched = sum(row['status'] == 'recognized' for row in e2e['word_alignment'])
        read_coverage = {
            'matched': matched, 'total': total_reference_words,
            'percentage': round(matched / total_reference_words * 100),
            'note_vi': 'Mức khớp bản chép lời với đoạn gốc, không phải điểm phát âm.',
        }

    max_score = MAX_SCORE[part]
    content = None
    content_warning = None
    try:
        from .speaking_content import review_content
        content = review_content(part, task, transcript, max_score, picture, mime)
    except Exception as exc:
        LOG.warning('Optional Speaking content AI failed: %s', type(exc).__name__)
        content_warning = ('AI chấm nội dung đang không khả dụng; phần chấm âm vị local không phụ thuộc Gemini. '
                           'Kiểm tra hạn mức/API key nếu đã bật SPEAKING_CONTENT_AI.')

    score = content['score'] if content else None
    message = (f'Whisper nhận dạng {len(words)} từ; E2E-GOP đánh giá mẫu '
               f'{e2e["scored_word_count"]}/{len(words)} từ có độ tin cậy đủ cao.')
    if part != 'read':
        message += ' Đây là đánh giá phát âm của các từ được nhận dạng, không phải xác nhận đúng nội dung câu trả lời.'
    strengths = []
    improvements = []
    if e2e['pronunciation_score'] is not None:
        if e2e['pronunciation_score'] >= 75:
            strengths.append('Nhiều âm trong các từ được phân tích đã được phát âm khá rõ.')
        else:
            improvements.append('Mở chi tiết từng từ bên dưới, ưu tiên luyện lại âm màu đỏ/vàng.')
    if suspected_words:
        improvements.append('Luyện lại ' + ', '.join(w['word'] for w in suspected_words[:3]) +
                            '; chạm từng âm màu để xem khẩu hình và cách sửa.')
    if metrics.get('long_pause_count_est',0) >= 3:
        improvements.append('Có khá nhiều khoảng ngắt dài; thử chia ý thành cụm ngắn và nói liền mạch hơn.')
    pace = fluency_metrics.get('words_per_speech_minute_est')
    if pace is not None and pace < 80 and len(words) >= 10:
        improvements.append('Nhịp nói khá chậm; thử nối các cụm ý sau khi đã phát âm rõ.')
    elif pace is not None and pace > 185 and len(words) >= 10:
        improvements.append('Nhịp nói khá nhanh; thử chậm lại ở các từ khóa và điểm ngắt câu.')
    if acoustic_error:
        improvements.append(acoustic_error)
    if content_warning:
        improvements.append(content_warning)
    if content:
        strengths.extend(content.get('strengths_vi',[])[:3])
        improvements.extend(content.get('improvements_vi',[])[:3])
    if not strengths:
        strengths.append('Bạn đã hoàn thành phần ghi âm để hệ thống phân tích.')
    if not improvements:
        improvements.append('Thử ghi âm nhiều lần để so sánh màu âm vị và nhịp nói.')

    return {
        'part':part,'score':score,'max_score':max_score,'official_ets_score':False,
        'transcript':transcript,'overall_vi':content['overall_vi'] if content else message,
        'strengths_vi':strengths[:4],'improvements_vi':improvements[:5],
        'pronunciation_score':e2e['pronunciation_score'],
        'fluency_score':fluency_score,'intonation_score':None,
        'content_score':content['content_score'] if content else None,
        'pronunciation_words':e2e['pronunciation_words'],
        'word_alignment':e2e['word_alignment'],
        'phoneme_coverage':{'scored_words':e2e['scored_word_count'],
                            'eligible_words':e2e['eligible_word_count'],
                            'recognized_words':e2e['total_asr_words']},
        'suspected_words':suspected_words, 'read_coverage':read_coverage,
        'timing':metrics,
        'fluency_metrics':fluency_metrics,'pitch_indicators':pitch,
        'gopt':gopt,
        'models':{'asr':'faster-whisper CPU int8',**e2e['models'],
                  'content':'Gemini (chỉ nội dung)' if content else 'off',
                  'gopt':'GOPT + Kaldi' if gopt.get('status')=='completed' else 'off/unavailable'},
        'confidence_note_vi':(
            'Màu âm vị là dự đoán E2E-GOP trên các từ được Whisper nhận dạng với độ tin cậy đủ cao. '
            'ASR có thể tự sửa từ sai, vị trí từ có thể lệch; không coi âm đỏ là kết luận chắc chắn. '
            'Không tự suy diễn điểm ETS từ GOP, nhịp nói hoặc pitch. '
            'GOPT chỉ được tính khi pipeline Kaldi thật kết nối thành công.'
        ),
    }
