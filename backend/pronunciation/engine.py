"""Real CPU phoneme scoring. Models are lazy loaded; no fabricated fallback scores."""

from __future__ import annotations

import logging
import math
import os
from functools import lru_cache

from phonetics import classify_score, get_tip


logger = logging.getLogger(__name__)

E2E_MODEL_ID = "anonym-coling2027/E2E-GOP-SpeechOcean762"
# Pin remote Python code as well as model weights to a reviewed snapshot.
E2E_MODEL_REVISION = "2062306816c2a14022a26bc63937999160bd42d8"
PHONE_MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"


def _cpu_only():
    # Do not let PyTorch consume every logical core on an already busy laptop.
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    import torch
    torch.set_num_threads(max(1, min(4, (os.cpu_count() or 2) // 2)))
    return torch


@lru_cache(maxsize=1)
def load_scorer():
    torch = _cpu_only()
    from transformers import AutoModel, AutoProcessor

    logger.info("Downloading/loading E2E-GOP model (first run ~1.3 GB): %s", E2E_MODEL_ID)
    processor = AutoProcessor.from_pretrained(
        E2E_MODEL_ID, revision=E2E_MODEL_REVISION, trust_remote_code=True
    )
    model = AutoModel.from_pretrained(
        E2E_MODEL_ID, revision=E2E_MODEL_REVISION, trust_remote_code=True,
        use_safetensors=True,
    ).to("cpu").eval()
    return processor, model


@lru_cache(maxsize=1)
def load_phone_recognizer():
    _cpu_only()
    from huggingface_hub import hf_hub_download
    from transformers import AutoModelForCTC, Wav2Vec2CTCTokenizer, Wav2Vec2FeatureExtractor

    logger.info("Downloading/loading optional Wav2Vec2 phoneme model: %s", PHONE_MODEL_ID)
    # Its upstream tokenizer uses phonemizer + eSpeak just for text->phones.
    # Here we only DECODE acoustically predicted phone token IDs, so a plain
    # CTC vocab decoder avoids the missing-phonemizer/Windows-eSpeak failure.
    vocab_path = hf_hub_download(repo_id=PHONE_MODEL_ID, filename="vocab.json")
    tokenizer = Wav2Vec2CTCTokenizer(
        vocab_file=vocab_path, unk_token="<unk>", pad_token="<pad>",
        bos_token="<s>", eos_token="</s>", word_delimiter_token="|",
    )
    extractor = Wav2Vec2FeatureExtractor.from_pretrained(PHONE_MODEL_ID)
    model = AutoModelForCTC.from_pretrained(PHONE_MODEL_ID).to("cpu").eval()
    return extractor, model, tokenizer


def score_phonemes(waveform, rate: int, canonical: dict) -> list[float]:
    """Return a *real* 0..2 pronunciation prediction for each canonical phone."""
    torch = _cpu_only()
    processor, model = load_scorer()
    phones = canonical["arpa"]
    token_ids = processor.tokenizer.convert_tokens_to_ids(phones)
    unk = processor.tokenizer.unk_token_id
    if any(v is None or v == unk for v in token_ids):
        raise ValueError("Model chấm chưa hỗ trợ một số âm vị trong phiên âm chuẩn.")

    token_ids = torch.tensor([token_ids], dtype=torch.long)
    lengths = torch.tensor([len(phones)], dtype=torch.long)
    mask = torch.ones((1, len(phones)), dtype=torch.bool)
    inputs = processor(
        waveform, sampling_rate=rate, return_tensors="pt", return_attention_mask=True
    )
    with torch.inference_mode():
        output = model(
            **inputs, canonical_token_ids=token_ids, token_lengths=lengths, token_mask=mask
        )
    scores = output.logits[0][mask[0]].detach().cpu().tolist()
    if len(scores) != len(phones) or not all(math.isfinite(float(v)) for v in scores):
        raise RuntimeError("Model trả về số lượng điểm âm vị không hợp lệ.")
    return [float(s) for s in scores]


def recognize_phonemes(waveform, rate: int) -> dict:
    """Unconstrained phoneme recognition, for display only; NEVER used as truth."""
    torch = _cpu_only()
    extractor, model, tokenizer = load_phone_recognizer()
    inputs = extractor(waveform, sampling_rate=rate, return_tensors="pt", padding=True)
    with torch.inference_mode():
        logits = model(inputs.input_values).logits
    decoded_ids = torch.argmax(logits, dim=-1)[0].cpu().tolist()
    blank = model.config.pad_token_id
    heard_tokens = []
    previous = None
    for token_id in decoded_ids:
        if token_id != previous and token_id != blank:
            phone = tokenizer.convert_ids_to_tokens(token_id)
            if phone and phone not in ("<unk>", "<s>", "</s>", "<pad>"):
                heard_tokens.append(phone)
        previous = token_id
    heard = " ".join(heard_tokens).strip()
    return {
        "heard": heard,
        "model": PHONE_MODEL_ID,
        "warning": "Đây chỉ là dự đoán âm mô hình nghe được; có thể chèn hoặc bỏ âm nhầm. "
                   "Không dùng kết quả này để tự động kết luận bạn phát âm thêm /t/ hay âm khác.",
    }


def evaluate(waveform, rate: int, canonical: dict, verify_phonemes: bool = False) -> dict:
    scores = score_phonemes(waveform, rate, canonical)
    rows = []
    for index, (arpa, ipa, score) in enumerate(
        zip(canonical["arpa"], canonical["ipa"], scores), start=1
    ):
        # This percentage is an uncalibrated visualization of the 0..2 scale.
        ratio = max(0.0, min(1.0, score / 2))
        color = classify_score(score)
        rows.append({
            "index": index,
            "arpa": arpa,
            "ipa": ipa,
            "raw_score": round(score, 4),
            "display_score": round(ratio * 100),
            "color": color,
            "borderline": min(abs(score - 1.1), abs(score - 1.6)) < 0.13,
            "tip": get_tip(arpa, color),
        })

    independent = None
    recognition_problem = None
    if verify_phonemes:
        try:
            independent = recognize_phonemes(waveform, rate)
        except Exception as exc:
            # The independently downloaded optional model is NOT a prerequisite
            # for real E2E pronunciation scores.
            logger.warning("Optional phoneme recognizer failed: %s", exc)
            recognition_problem = (
                "Không chạy được model kiểm tra độc lập. Điểm E2E-GOP vẫn là kết quả thật. "
                "Xem cửa sổ chạy web để biết lỗi tải mô hình phụ."
            )

    low = [x for x in rows if x["color"] == "red"]
    return {
        "word": canonical["word"],
        "ipa_text": canonical["ipa_text"],
        "source": canonical["source"],
        "phones": rows,
        "mean_display_score": round(sum(x["display_score"] for x in rows) / len(rows)),
        "red_count": len(low),
        "recognition": independent,
        "recognition_problem": recognition_problem,
        "model": E2E_MODEL_ID,
        "disclaimer": "Điểm và màu là ước lượng chưa hiệu chuẩn với người chấm; "
                      "không phải xác suất phát âm đúng hay điểm TOEIC chính thức.",
    }
