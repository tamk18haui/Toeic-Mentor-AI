"""Decode browser recordings and normalize to 16 kHz mono WAV in a temp folder."""

from __future__ import annotations

import subprocess
from pathlib import Path


ALLOWED_SUFFIXES = {".wav", ".mp3", ".m4a", ".mp4", ".webm", ".ogg", ".flac"}
MAX_UPLOAD_BYTES = 18 * 1024 * 1024
MIN_DURATION = 0.25
MAX_DURATION = 12.0


class AudioInputError(ValueError):
    pass


def speech_frame_count(waveform, rate: int = 16000) -> int:
    """Count 30 ms frames with speech; avoid scoring silent or noisy recordings."""
    import numpy as np
    import webrtcvad

    vad = webrtcvad.Vad(1)  # moderately permissive for learner speech
    frame_samples = int(rate * 0.03)
    pcm = (np.clip(waveform, -1, 1) * 32767).astype("<i2")
    hits = 0
    for start in range(0, len(pcm) - frame_samples + 1, frame_samples):
        frame = pcm[start:start + frame_samples].tobytes()
        hits += bool(vad.is_speech(frame, rate))
    return hits


def decode_audio(source: Path, destination: Path):
    """Return (float32 mono waveform, sr, warnings) without changing source."""
    try:
        import imageio_ffmpeg
        import numpy as np
        import soundfile as sf
    except ImportError as exc:
        raise RuntimeError("Chưa cài thư viện âm thanh. Hãy chạy setup_windows.bat.") from exc

    binary = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        binary, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(source),
        "-ac", "1", "-ar", "16000", "-t", str(MAX_DURATION + 1), "-y", str(destination),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=50, check=False)
    except subprocess.TimeoutExpired as exc:
        raise AudioInputError("File âm thanh xử lý quá lâu. Hãy ghi lại một từ ngắn.") from exc
    if result.returncode != 0:
        raise AudioInputError("Không đọc được file âm thanh. Hãy thử WAV, MP3 hoặc ghi âm lại.")

    waveform, rate = sf.read(str(destination), dtype="float32", always_2d=False)
    if waveform.ndim != 1 or rate != 16000:
        raise AudioInputError("Âm thanh không chuyển đổi được sang WAV mono 16 kHz.")
    if len(waveform) / rate > MAX_DURATION:
        raise AudioInputError("Bản ghi dài quá 12 giây. Hãy chỉ đọc một từ.")
    if len(waveform) / rate < MIN_DURATION:
        raise AudioInputError("Bản ghi quá ngắn. Hãy ghi ít nhất 0,25 giây.")
    if not np.isfinite(waveform).all():
        raise AudioInputError("Âm thanh bị lỗi giá trị. Hãy ghi âm lại.")

    peak = float(np.max(np.abs(waveform)))
    rms = float(np.sqrt(np.mean(waveform.astype("float64") ** 2)))
    if rms < 0.002 or peak < 0.015:
        raise AudioInputError("Ghi âm quá nhỏ hoặc không có tiếng nói. Hãy kiểm tra microphone.")

    if speech_frame_count(waveform, rate) < 6:
        raise AudioInputError("Không phát hiện tiếng nói đủ rõ. Hãy đọc một từ thành tiếng và ghi lại.")

    warnings = []
    if peak > 0.996:
        warnings.append("Âm thanh chạm ngưỡng clipping; nên đặt micro xa hơn một chút.")
    if rms < 0.017:
        warnings.append("Âm lượng tương đối nhỏ, điểm chấm có thể kém ổn định.")

    # Trim leading/trailing quiet regions while keeping margins for /s/, /f/, /θ/.
    window = 320  # 20 ms
    nframes = len(waveform) // window
    if nframes >= 8:
        energies = np.max(np.abs(waveform[:nframes * window].reshape(-1, window)), axis=1)
        active = np.flatnonzero(energies > max(0.012, peak * 0.075))
        if len(active):
            start = max(0, (int(active[0]) - 15) * window)
            end = min(len(waveform), (int(active[-1]) + 16) * window)
            if end - start >= 4000:
                waveform = waveform[start:end]

    return waveform.astype("float32"), rate, warnings
