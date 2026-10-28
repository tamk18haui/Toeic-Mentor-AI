"""English word -> canonical ARPAbet, IPA and learner-facing guidance.

CMUdict is deterministic. G2P is an optional fallback for out-of-dictionary words.
Scores are not derived from this module.
"""

from __future__ import annotations

import re
from functools import lru_cache


ARPA_TO_IPA = {
    "AA": "ɑː", "AE": "æ", "AH": "ʌ", "AO": "ɔː", "AW": "aʊ",
    "AY": "aɪ", "B": "b", "CH": "tʃ", "D": "d", "DH": "ð",
    "EH": "ɛ", "ER": "ɝ", "EY": "eɪ", "F": "f", "G": "ɡ",
    "HH": "h", "IH": "ɪ", "IY": "iː", "JH": "dʒ", "K": "k",
    "L": "l", "M": "m", "N": "n", "NG": "ŋ", "OW": "oʊ",
    "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "uː", "V": "v",
    "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}

TIPS = {
    "TH": "Đặt đầu lưỡi nhẹ giữa hai hàm răng và thổi hơi ra; đừng thay /θ/ bằng /s/ hay /t/.",
    "DH": "Đặt đầu lưỡi giữa hai hàm răng và rung dây thanh; khác với /d/ hoặc /z/.",
    "R": "Cuộn hoặc kéo nhẹ đầu lưỡi về sau, không chạm vòm miệng; phân biệt với /l/.",
    "L": "Chạm đầu lưỡi vào lợi trên, cho luồng hơi đi hai bên lưỡi.",
    "S": "Thổi hơi mạnh qua khe răng, không rung cổ; khác với âm /z/ có rung.",
    "Z": "Giữ luồng hơi như /s/ nhưng rung dây thanh.",
    "IY": "Kéo môi ngang nhẹ và phát âm /iː/ dài, rõ; phân biệt với /ɪ/ ngắn.",
    "IH": "Phát âm /ɪ/ ngắn, miệng mở hơn /iː/, không kéo quá dài.",
    "AY": "Trượt từ /a/ sang /ɪ/ trong cùng một âm tiết; không tách thành hai tiếng.",
    "AE": "Mở miệng rộng, lưỡi hạ thấp để đọc /æ/, tránh đọc thành /e/.",
    "EH": "Mở miệng vừa, lưỡi hướng về trước cho /ɛ/, khác /æ/.",
    "V": "Răng trên chạm nhẹ môi dưới, thổi hơi và rung dây thanh; không đọc /w/.",
    "F": "Răng trên chạm nhẹ môi dưới, thổi hơi nhưng không rung cổ.",
    "W": "Tròn môi rồi mở nhanh; phân biệt với /v/.",
    "SH": "Tròn môi nhẹ và thổi luồng hơi /ʃ/; phân biệt với /s/.",
    "CH": "Bắt đầu với âm chặn /t/ rồi bật sang /ʃ/, tạo /tʃ/.",
    "JH": "Bắt đầu âm chặn /d/ rồi bật thành /ʒ/, có rung dây thanh.",
    "NG": "Nâng phần sau lưỡi chạm ngạc mềm để tạo /ŋ/, tránh thêm /g/ ở cuối nếu từ không có.",
    "T": "Chạm đầu lưỡi lên lợi trên rồi bật hơi nhanh; nghe rõ phụ âm kết thúc khi cần.",
    "D": "Đặt lưỡi như /t/ nhưng rung dây thanh; đừng lẫn phụ âm cuối.",
    "K": "Nâng phần sau lưỡi để chặn hơi ở ngạc mềm rồi bật nhanh.",
}

VALID_WORD = re.compile(r"^[a-zA-Z]{1,28}$")


class PhoneticInputError(ValueError):
    pass


def normalize_word(word: str) -> str:
    cleaned = word.strip().lower()
    if not VALID_WORD.fullmatch(cleaned):
        raise PhoneticInputError("Hãy nhập đúng một từ tiếng Anh (chỉ chữ cái, tối đa 28 ký tự).")
    return cleaned


def strip_stress(token: str) -> str:
    return re.sub(r"[012]$", "", token.upper())


@lru_cache(maxsize=256)
def get_canonical(word: str) -> dict:
    word = normalize_word(word)
    try:
        import cmudict
        phones = cmudict.dict().get(word, [])
    except ImportError as exc:
        raise RuntimeError("Chưa cài cmudict. Hãy chạy setup_windows.bat.") from exc

    source = "CMUdict"
    if phones:
        raw_phones = phones[0]
    else:
        try:
            from g2p_en import G2p
            raw_phones = [p for p in G2p()(word) if p.strip() and p != " "]
            source = "G2P (dự đoán)"
        except (ImportError, LookupError, OSError):
            raise PhoneticInputError(
                f"Không tìm thấy từ '{word}' trong CMUdict. "
                "Dùng từ khác hoặc cài g2p_en để mở rộng từ vựng."
            ) from None

    arpa = [strip_stress(p) for p in raw_phones]
    if not arpa or any(p not in ARPA_TO_IPA for p in arpa):
        raise PhoneticInputError("Chưa xác định được bộ âm chuẩn ARPAbet cho từ này.")
    if len(arpa) > 20:
        raise PhoneticInputError("Từ có quá nhiều âm vị cho chế độ luyện từng từ.")
    ipa = [ARPA_TO_IPA[p] for p in arpa]
    return {"word": word, "arpa": arpa, "ipa": ipa, "ipa_text": "/" + " ".join(ipa) + "/", "source": source}


def classify_score(raw: float, green_threshold: float = 1.6, yellow_threshold: float = 1.1) -> str:
    if raw >= green_threshold:
        return "green"
    if raw >= yellow_threshold:
        return "yellow"
    return "red"


def get_tip(phone: str, color: str) -> str:
    if color == "green":
        return "Âm này được model đánh giá tốt. Hãy giữ cách phát âm hiện tại."
    return TIPS.get(phone, "Nghe lại cách đọc chuẩn, luyện riêng âm này và thử ghi âm lại chậm hơn.")
