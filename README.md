# TOEIC Studio — React + FastAPI + MySQL

Website luyện TOEIC Speaking/Writing với giao diện responsive, được xây dựng bằng mã nguồn mới theo yêu cầu riêng. Các câu hỏi minh họa được tự biên soạn, không sao chép đề thương mại.

## Bản Speaking AI CPU (không cần GPU, không cần Gemini để chấm âm vị)

### Bạn đã hỏi: Describe a Picture và Respond to Questions có cần E2E-GOP + GOPT không?

**Có.** Mọi Part (Read Aloud, Describe a Picture, Respond to Questions, Respond Using Information, Express an Opinion) đều nên chấm phát âm/độ trôi chảy. Hai dạng nói tự do không có đoạn mẫu: hệ thống dùng **faster-whisper** nhận dạng câu thực sự nói và mốc từ, **CMUdict/G2P** chuyển các từ thành IPA/ARPAbet, rồi **E2E-GOP** chấm âm trong đoạn audio tương ứng. Tránh ép so sánh âm với văn bản đề — điều này dễ tố người dùng sai âm khi thực tế họ nói câu khác.

| Công nghệ | Trạng thái | Vai trò |
| --- | --- | --- |
| faster-whisper tiny.en/base.en (CPU int8) | Có trong gói cài | Nhận dạng lời nói + timecodes + mức tin cậy theo từ |
| E2E-GOP SpeechOcean762 | Có trong gói cài | Chấm các âm ở **những từ có mốc thời gian và độ tin cậy đủ cao**, đánh dấu xanh/vàng/đỏ |
| CMUdict / G2P | Có | Âm chuẩn, chỉ dẫn sửa âm |
| Wav2Vec2 Phoneme | Tùy chọn | Nhận dạng chuỗi âm vị độc lập trên 2 từ lấy mẫu, không dùng để tự kết tội thêm âm |
| GOPT + Kaldi GOP | Tùy chọn Docker | Đánh giá phát âm, stress, fluency, prosody từ đặc trưng Kaldi thật; đầu ra độc lập |
| WebRTC VAD / phân tích pitch | Có | Thống kê khoảng ngắt, tốc độ lời nói, cao độ đo được; **không tự biến thành điểm AI** |
| Gemini | Tùy chọn, **chỉ nội dung** | Kiểm tra trả lời đúng câu hỏi, sát tranh/bảng thông tin, lập luận; mất kết nối/503 không làm hỏng chấm âm |

**Giới hạn quan trọng:** Whisper có thể tự sửa chữ khi phát âm sai và word timestamp không phải phone alignment chính xác. Hệ thống chỉ chọn tối đa `SPEAKING_E2E_MAX_WORDS` (mặc định 8 từ dàn đều theo thời gian) để tránh CPU chạy quá lâu, chỉ chấm từ có xác suất ASR từ 0.68 trở lên; từ không chấm không bị tô đỏ. Màu E2E-GOP chưa được hiệu chuẩn chuyên môn và không chứng minh chắc chắn âm nào đã phát ra. Khi chưa bật Gemini chấm **nội dung**, tổng điểm câu hỏi hiện `—`, không giả lập điểm ETS. Fluency/Intonation hiển thị các chỉ số thật chứ không dựng điểm 0–100. Khi có GOPT thật, xem dữ liệu trả về riêng, không cộng lẫn điểm khác thang.

### Cài Speaking AI trên Windows

1. Chạy `SETUP_WINDOWS.bat`, cấu hình MySQL như trước.
2. **Chạy `INSTALL_SPEAKING_AI_WINDOWS.bat`** rồi khởi động lại backend. Máy không cần GPU; lần đầu chấm Whisper và E2E-GOP tự tải trọng số (E2E-GOP ~1.3 GB). Mỗi câu có thể chạy vài chục giây hoặc lâu hơn trên CPU.
3. Truy cập `http://localhost:8000/api/speaking/models` để kiểm tra các thư viện đã cài. Các mục `installed` chỉ kiểm tra thư viện, **không xác nhận model đã tải và inference thành công**.
4. Mở `http://localhost:5173` → Luyện nói → Read Aloud, Describe a Picture, Respond to Questions… → ghi âm → **Chấm bài nói** → xem thẻ từng từ và âm vị màu xanh/vàng/đỏ.
5. Chạy Thi thử Speaking 11 câu. Sau khi hoàn tất, ở trang tổng kết chọn **Chấm AI** mỗi câu; cùng pipeline sẽ chấm từ mẫu trong chính câu ghi âm, không cần Gemini key.

### Thiết lập trong `backend/.env`

```env
SPEAKING_WHISPER_MODEL=tiny.en
SPEAKING_E2E_MAX_WORDS=8
SPEAKING_VERIFY_PHONEMES=false
SPEAKING_CONTENT_AI=false
GOPT_WEB_URL=
GOPT_TIMEOUT_SECONDS=100
```

- Muốn Whisper nghe tốt hơn, đặt `SPEAKING_WHISPER_MODEL=base.en` (tăng RAM/CPU, tải thêm model).
- Muốn nhận dạng âm vị tự do Wav2Vec2 cho 2 từ minh họa, bật `SPEAKING_VERIFY_PHONEMES=true`. Model phụ nặng và không dùng để quyết định âm xanh/đỏ.
- Muốn chấm **nội dung** Describe Picture / Respond Questions / Information / Opinion, bật `SPEAKING_CONTENT_AI=true` và khai báo `GEMINI_API_KEY`, `GEMINI_MODEL` nếu có free tier; audio **không gửi** cho Gemini trong bước này, chỉ gửi bản chép lời và ảnh đề khi có. Nếu quota bị quá tải, chấm âm local vẫn giữ kết quả.

### GOPT thật: cài tùy chọn Docker + Kaldi (không phải chỉ cài pip GOPT)

GOPT pretrained của dự án gốc yêu cầu **Kaldi GOP feature vector 84 chiều/âm**, không nhận trực tiếp WAV hoặc điểm E2E-GOP. Nếu tự tạo 84 số giả từ E2E thì kết quả GOPT là vô nghĩa. Có thể dùng [fork GOPT bổ sung pipeline Kaldi + Docker](https://github.com/E3zra/GOPT-Multi-Aspect-Multi-Granularity-English-Pronunciation-Assessment-System), chạy `docker compose build` và `docker compose up -d`, tải acoustic model theo `DOCKER_USAGE.md`; **cần kiểm tra bộ model thực sự được tải và quá trình pipeline chạy thành công**. Bật web service của fork bằng `python web_server.py` (mặc định cổng `8080`) trong thư mục fork. Không chạy `inference_server.py` ở cổng 8000 cùng web TOEIC Studio: endpoint `/predict` của nó chỉ nhận **GOP features**, không nhận audio. Cấu hình:

```env
GOPT_WEB_URL=http://127.0.0.1:8080
GOPT_TIMEOUT_SECONDS=100
```

TOEIC Studio gọi `/upload` kèm WAV và transcript → chờ `/status/{task_id}` → lấy `/result/{task_id}`. Docker fork khá nặng; khi không sẵn sàng, UI ghi rõ **GOPT chưa chạy** và không giả điểm. Backend chỉ kết nối GOPT ở localhost. Đây là tích hợp adapter được viết theo tài liệu nguồn, **chưa chạy end-to-end Kaldi trên máy Windows của bạn**. Để không giữ audio ngoài ý muốn, kiểm tra chính sách và dọn các file âm thanh trong kho fork Docker sau khi test.

### Kiểm thử và độ chính xác

Chạy `python -m backend.smoke_test` từ thư mục dự án để kiểm tra API không cần GPU/MySQL/Gemini (mock inference, không phải kiểm thử chất lượng model). Sau khi tải model, hãy ghi âm cùng một từ theo ba cách: chuẩn, sai phụ âm, sai nguyên âm; đối chiếu âm gốc bằng tai trước khi tin màu. Chú ý /θ/ trong *three*, /s/ cuối từ *rice*: **không bao giờ suy luận có /t/ chỉ vì ASR/phoneme recognition có thể chèn sai token**. Bài thi chính thức có tiêu chí chấm riêng của ETS; để công bố điểm tin cậy, cần tập audio được giám khảo chấm và hiệu chuẩn.

## Các trang web khác

| Khu vực | Chức năng |
| --- | --- |
| Trang chủ | Dashboard hiện đại, menu hai cấp, lộ trình học, quick links |
| Ngữ pháp / Listening / Reading | Trang giao diện tĩnh, thẻ bài học, bộ lọc bài luyện — chờ người khác triển khai xử lý |
| Speaking → Luyện IPA | 44 âm/cụm âm, mô phỏng động khẩu hình SVG, chỉ dẫn đặt môi/lưỡi, giọng đọc mẫu bằng trình duyệt, khoảng 14 từ/âm |
| IPA AI | Thu âm / tải audio lên, E2E-GOP chấm *mỗi âm vị* và tô xanh–vàng–đỏ; chọn thêm Wav2Vec2 nhận dạng âm vị độc lập; CMUdict/G2P cung cấp IPA mục tiêu |
| Speaking → Luyện TOEIC | 5 nhóm câu hiện hành + 1 nhóm bài mở rộng; Whisper nhận dạng audio, E2E-GOP chấm mẫu từng âm, GOPT Docker và Gemini nội dung tùy chọn |
| Speaking → Thi thử | 11 câu, phát hướng dẫn/câu hỏi bằng TTS, chuẩn bị rồi ghi âm, tự chuyển câu, nghe lại; sau thi chọn **Chấm AI** từng câu, xem điểm ước lượng và điểm yếu. Không tự gọi 11 lần API |
| Writing → Luyện các Part | Tranh (2 từ khóa), email (3 yêu cầu), essay, bản nháp tự lưu, timer, bài mẫu, mẹo, chấm Gemini API theo rubric thực hành |
| Writing → Thi thử | 8 câu, đồng hồ riêng từng phần, tự chuyển khi hết giờ, lưu bản nháp, tự chọn câu để chấm sau thi |
| Tài khoản / MySQL | Đăng ký, đăng nhập mật khẩu scrypt, JWT, lịch sử lượt học, tiến độ; DB MySQL 8.4 hoặc MySQL cài sẵn |

**Lưu ý về độ chính xác:** Phần IPA sử dụng điểm dự đoán E2E-GOP thực, nhưng ngưỡng xanh/vàng/đỏ chưa được hiệu chuẩn. Phần Speaking hiện có E2E-GOP cho cả bài nói tự do, không còn phụ thuộc Gemini cho âm vị. Điểm tổng chỉ hiện khi bật mô-đun chấm nội dung. Writing vẫn cần Gemini; mảng Ngữ pháp/Listening/Reading chỉ là giao diện.

## Cách chạy trên Windows

**Yêu cầu:** Python 3.11 (khuyên dùng) hoặc 3.12, Node.js 20+, npm, MySQL 8.x hoặc Docker Desktop, Chrome/Edge.

1. Giải nén ZIP vào thư mục ngắn, ví dụ `D:\TOEIC_Studio`.
2. Nhấn đúp `SETUP_WINDOWS.bat` một lần để cài API + React và tạo `backend\.env`.
3. Với MySQL: nếu có Docker Desktop và đang chạy, `RUN_WINDOWS.bat` tự bật service `mysql` bằng Docker Compose ở cổng `3307`; nếu dùng MySQL riêng, sửa dòng `DATABASE_URL` trong `backend\.env` cho phù hợp.
4. Muốn chấm **Writing**, mở `backend\.env` và điền `GEMINI_API_KEY=`. **Speaking phát âm local không cần key**; muốn chấm cả nội dung Speaking, bật `SPEAKING_CONTENT_AI=true`. Không đưa khóa vào `frontend`, không commit `.env` lên GitHub. API không mặc định miễn phí vô hạn: theo dõi hạn mức ở Google AI Studio.
5. Nhấn đúp `RUN_WINDOWS.bat`; mở <http://localhost:5173>. API: <http://localhost:8000/api/health>, tài liệu: <http://localhost:8000/api/docs>.
6. **Tùy chọn để chấm IPA bằng AI:** chạy `INSTALL_IPA_AI_WINDOWS.bat`. Lần đầu chấm sẽ tải model E2E-GOP (~1.3 GB) về máy và có thể chạy chậm trên CPU; tùy chọn Wav2Vec2 Phoneme tải thêm model lớn. Không cần GPU rời. Để tránh laptop quá nóng, chỉ nên bật khi thật sự luyện phát âm; bỏ chọn model phụ nếu RAM căng.

### Cách test Speaking AI (không cần GPU)

1. Mở `http://localhost:5173` → **Luyện nói** → chọn **Đọc to đoạn văn**.
2. Bấm bắt đầu, cấp quyền micro, chờ chuẩn bị → đọc bài → nghe lại bản ghi.
3. Bấm **Chấm bài nói**. FastAPI chuẩn hóa WebM thành WAV 16 kHz; Whisper nhận dạng thực tế, E2E-GOP đánh giá mẫu từng từ đã nhận dạng, WebRTC VAD/pitch ghi thống kê. Bạn sẽ thấy bản chép lại và thẻ âm vị xanh/vàng/đỏ, không tự tạo điểm tổng ETS.
4. Thử **Mô tả tranh**, **Trả lời câu hỏi**, **Nêu ý kiến**. Các Part đều chấm phát âm; nếu bật Gemini tùy chọn mới chấm thêm nội dung theo ảnh/câu hỏi.
5. Mở **Thi thử Speaking** → hoàn thành 11 câu → tại trang kết quả chọn **Chấm AI** của câu muốn chấm. Chấm từng câu để tiết kiệm hạn mức.
6. Nếu Gemini quá tải khi bật chấm nội dung, API vẫn trả đánh giá âm vị local. Nếu model local thiếu, chạy `INSTALL_SPEAKING_AI_WINDOWS.bat`; bạn có thể thử chấm lại mà không cần ghi âm mới nếu bản ghi còn trong trình duyệt.

**Quyền riêng tư:** Audio chỉ rời trình duyệt khi nhấn Chấm AI và được FastAPI xử lý trên máy. Nếu bật `GOPT_WEB_URL`, audio được chuyển cho dịch vụ Docker GOPT ở localhost, nơi có thể lưu file riêng. Nếu bật Gemini chấm nội dung, chỉ bản chép lời và ảnh đề được gửi tới Gemini. Không tự lưu audio trong MySQL TOEIC Studio.

### Khi Gemini báo 503 và MySQL offline

- **`503 Service Unavailable` + `high demand`:** Google đang quá tải, không phải do bạn dùng sai SDK/API key. SDK tự thử lại một số lần; dự án sẽ hiện thông báo có thể chấm lại sau, **không retry vô hạn**. Tham khảo [Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting).
- **`Database offline: OperationalError`:** Backend có thể hoạt động với các trang công khai và chấm Speaking/Writing dù MySQL chưa kết nối. Nếu dùng Docker: `docker compose up -d mysql`; nếu dùng MySQL cài sẵn, kiểm tra user, mật khẩu và cổng (3306/3307) trong `backend/.env`.
- **`404 /favicon.ico`:** Không ảnh hưởng học hoặc chấm bài.

### Khắc phục lỗi Gemini HTTP 400: legacy Interactions API schema

Nếu trước đây đã cài bản V1 có `google-genai` 1.x, Google sẽ trả về `BadRequestError` với nội dung *legacy Interactions API schema is no longer supported*. Ở bản cập nhật này `requirements.txt` đã yêu cầu `google-genai>=2.0.0,<3.0.0`. Để nâng cấp trực tiếp môi trường Windows đang chạy mà không cần cài lại toàn bộ, mở PowerShell trong thư mục `toeic-studio`:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade "google-genai>=2.0.0,<3.0.0"
.\.venv\Scripts\python.exe -m pip show google-genai
```

Sau khi cập nhật, **khởi động lại FastAPI**. Trong `backend/.env`, giữ `GEMINI_MODEL=gemini-3.8-flash` nếu tài khoản của bạn được hỗ trợ; nếu API có lỗi hạn mức/khóa, xem log FastAPI. Không cần đổi API key chỉ để xử lý lỗi schema cũ.

> Không có MySQL thì giao diện học tập vẫn mở được, nhưng đăng ký và lưu tiến độ tài khoản sẽ chưa hoạt động. Âm thanh micro trên `localhost` được hỗ trợ; dùng tên miền ngoài phải có HTTPS.

## Chạy bằng lệnh khi phát triển

```powershell
cd D:\TOEIC_Studio
docker compose up -d mysql
Copy-Item backend\.env.example backend\.env
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
# tùy chọn model local: .\.venv\Scripts\python.exe -m pip install -r backend\requirements-ai.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --port 8000
```

Mở PowerShell khác:

```powershell
cd D:\TOEIC_Studio\frontend
npm install
npm run dev
```

Sửa các mẫu đề tại `frontend/src/data/exams.js`, thư viện IPA tại `frontend/src/data/ipa.js`. Giao diện React dùng CSS thuần và Lucide; backend FastAPI/Pydantic/SQLAlchemy. Ảnh minh họa mẫu lưu trong `frontend/public/images`, tải từ Unsplash và không lấy từ đề TOEIC có bản quyền.

## Cấu trúc

```text
toeic-studio/
  frontend/                       React + Vite
    src/pages/                   Dashboard, IPA, Speaking, Writing, mocks
    src/components/              Recorder, timer, prompt, feedback
    src/data/                    IPA và đề luyện demo
    public/images/               Ảnh đề luyện local
  backend/
    app.py                       FastAPI endpoints
    database.py                  MySQL models
    auth.py                      scrypt/JWT
    pronunciation/              E2E-GOP, Wav2Vec2, IPA, ffmpeg
    writing/grading.py           Gemini, rubric, LanguageTool optional
    speaking_audio.py            ffmpeg + CPU VAD thống kê nhịp ngắt
    speaking_grading.py          Điều phối ASR, E2E-GOP, GOPT, nội dung tùy chọn
    speaking_local.py            Whisper CPU + điểm âm vị E2E-GOP + đo nhịp/pitch
    speaking_content.py          Gemini chỉ đánh giá nội dung (tùy chọn)
    gopt_bridge.py               Kết nối web_server.py của GOPT Docker + Kaldi
    requirements.txt             Backend cơ bản
    requirements-ai.txt          AI chấm IPA local (nặng)
    requirements-speaking.txt    E2E-GOP + faster-whisper CPU cho các Part
  docker-compose.yml             MySQL 8.4 local
  SETUP_WINDOWS.bat
  INSTALL_IPA_AI_WINDOWS.bat
  INSTALL_SPEAKING_AI_WINDOWS.bat
  RUN_WINDOWS.bat
```

## Cấu trúc đề thi và giới hạn của phiên bản

### Bản cập nhật UI/UX và phản hồi Speaking

- Giao diện học viên không còn hiện tên mô hình, cấu hình CPU, endpoint hay trạng thái Docker/Kaldi. Thông tin kỹ thuật vẫn được giữ trong backend, README và API trạng thái phục vụ kiểm tra.
- Sau khi chấm Speaking, học viên thấy điểm **phát âm trên các từ được lấy mẫu**, từng âm IPA màu xanh/vàng/đỏ có thể nhấn để mở gợi ý sửa, nhịp nói, khoảng ngắt và các từ ưu tiên luyện lại.
- Phần Read Aloud có so sánh từ được nhận dạng khớp đoạn gốc. Mức khớp này **không** đồng nghĩa với phát âm chuẩn.
- Trang kết quả Speaking mock có nút phân tích tất cả câu đã ghi âm theo thứ tự, đồng thời vẫn cho phép chọn từng câu. Khi máy yếu, có thể dừng hàng đợi sau câu đang chạy.
- Trong phòng thi thử, nội dung đề, hướng dẫn ghi âm, đồng hồ và nút thao tác bằng **tiếng Anh**. Các trang luyện tập vẫn có hỗ trợ tiếng Việt.
- Writing mock Questions 6–7 hiển thị email đầy đủ, xuống dòng rõ ràng và **3 yêu cầu cần trả lời bằng tiếng Anh** ngay bên dưới thư. Việc đánh giá nội dung dùng những yêu cầu tiếng Anh này.

Lưu ý về chất lượng: E2E-GOP chỉ chấm mẫu các từ Whisper nhận dạng đủ chắc chắn. Điểm tô màu là **ước lượng hỗ trợ tự luyện**, chưa được hiệu chuẩn bằng nhãn chuyên gia/ETS. Nhịp nói và cao độ là **chỉ số đo**, chưa phải điểm fluency/intonation được hiệu chuẩn. Nếu không cấu hình bộ chấm nội dung, hệ thống không tự dựng điểm Speaking tổng.

Speaking sử dụng mẫu 11 câu theo cấu trúc TOEIC Speaking hiện hành; nhóm “Đề xuất giải pháp” chỉ là bài luyện bổ sung theo định dạng cũ, không xuất hiện trong mock. Việc phát âm thanh bằng `speechSynthesis` trên trình duyệt **chưa giống hệt audio phòng thi ETS** (chất giọng phụ thuộc hệ thống và mạng); với đề thi chính thức cần thay bằng tập MP3 đã được phép sử dụng. Part 8–10 dùng một bảng dữ liệu chung. Writing thi thử: 5 câu tranh / 8 phút chung, 2 email / 10 phút mỗi email và bài luận / 30 phút.

Các điểm cần làm tiếp khi xây dựng sản phẩm hoàn chỉnh: thêm ngân hàng đề lớn từ nguồn có giấy phép, ảnh/video khẩu hình người thật, thời lượng audio chuẩn phòng thi, **hiệu chuẩn điểm Speaking trên dữ liệu giám khảo gán nhãn** và đối chiếu audio của người học (đặc biệt các âm dễ nhầm), phần Listening/Reading/Grammar do nhóm khác phụ trách, test tương thích thiết bị đa dạng và triển khai HTTPS bảo mật.

TOEIC® là nhãn hiệu của ETS. TOEIC Studio là bản web demo độc lập, không liên kết hoặc được ETS chứng nhận.
