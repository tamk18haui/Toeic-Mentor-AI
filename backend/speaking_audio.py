"""Decode longer Speaking recordings and estimate timing, without guessing phonemes."""
from __future__ import annotations

import io
import subprocess
import wave
from pathlib import Path

MAX_SPEAKING_SECONDS = 100


class SpeakingAudioError(ValueError):
    pass


def prepare_speaking_audio(source: Path) -> tuple[bytes, dict]:
    try:
        import imageio_ffmpeg
        import numpy as np
        import webrtcvad
    except ImportError as exc:
        raise SpeakingAudioError('Thiếu thư viện xử lý âm thanh. Hãy chạy SETUP_WINDOWS.bat để cài lại requirements.txt.') from exc
    binary = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [binary, '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', str(source),
           '-ac', '1', '-ar', '16000', '-t', str(MAX_SPEAKING_SECONDS + 1),
           '-f', 'wav', '-acodec', 'pcm_s16le', 'pipe:1']
    try:
        completed = subprocess.run(cmd, capture_output=True, timeout=65, check=False)
    except subprocess.TimeoutExpired as exc:
        raise SpeakingAudioError('Không xử lý kịp bản ghi âm. Hãy thử ghi lại.') from exc
    if completed.returncode or not completed.stdout:
        raise SpeakingAudioError('Không đọc được bản ghi. Hãy ghi bằng Chrome/Edge hoặc tải WAV/MP3.')

    wav = completed.stdout
    try:
        with wave.open(io.BytesIO(wav), 'rb') as audio:
            if audio.getnchannels() != 1 or audio.getframerate() != 16000 or audio.getsampwidth() != 2:
                raise SpeakingAudioError('Không chuyển âm thanh sang WAV 16 kHz được.')
            samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2')
    except wave.Error as exc:
        raise SpeakingAudioError('Dữ liệu WAV không hợp lệ.') from exc

    seconds = len(samples) / 16000
    if seconds < 0.8:
        raise SpeakingAudioError('Bài nói quá ngắn (dưới 0,8 giây).')
    if seconds > MAX_SPEAKING_SECONDS:
        raise SpeakingAudioError('Bản ghi quá 100 giây, vui lòng ghi ngắn hơn.')
    if not len(samples) or float(np.sqrt(np.mean(samples.astype(np.float64) ** 2))) < 100:
        raise SpeakingAudioError('Không nghe thấy âm thanh đủ rõ. Kiểm tra microphone.')

    vad = webrtcvad.Vad(2)
    frame_len = 480
    active = [bool(vad.is_speech(samples[i:i + frame_len].tobytes(), 16000))
              for i in range(0, len(samples) - frame_len + 1, frame_len)]
    if sum(active) < 7:
        raise SpeakingAudioError('Hầu như không phát hiện tiếng nói. Hãy thử phòng yên tĩnh hơn.')
    first = active.index(True)
    last = len(active) - 1 - active[::-1].index(True)
    gaps = []
    gap = 0
    for hit in active[first:last + 1]:
        if hit:
            if gap >= 15:
                gaps.append(round(gap * 0.03, 2))
            gap = 0
        else:
            gap += 1
    metrics = {
        'duration_seconds': round(seconds, 1),
        'speech_seconds_est': round(sum(active) * 0.03, 1),
        'speech_ratio_est': round(sum(active) / max(1, len(active)), 2),
        'long_pause_count_est': len(gaps),
        'longest_pause_seconds_est': max(gaps, default=0),
        'timing_method': 'WebRTC VAD trên CPU: chỉ ước lượng thời lượng và khoảng lặng',
    }
    return wav, metrics
