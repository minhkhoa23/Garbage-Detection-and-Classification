# Garbage Detection and Classification

Ứng dụng web nhận diện và phân loại rác từ ảnh. Người dùng tải ảnh lên giao diện React, backend FastAPI chạy mô hình YOLO từ checkpoint `weights/best.pt`, sau đó trả về danh sách vật thể rác được phát hiện kèm bounding box, nhãn, nhóm phân loại, màu hiển thị và độ tin cậy.

## Tính năng chính

- Tải ảnh bằng cách chọn file hoặc kéo thả trên giao diện web.
- Phát hiện nhiều vật thể rác trong cùng một ảnh.
- Vẽ bounding box trực tiếp lên ảnh kết quả.
- Hiển thị nhãn, nhóm rác và điểm confidence cho từng vật thể.
- Cấu hình runtime được backend trả về để frontend tự đồng bộ đường dẫn API, loại file hỗ trợ và giới hạn upload.
- Có endpoint kiểm tra sức khỏe hệ thống và test API cơ bản.

## Công nghệ sử dụng

Backend:

- Python
- FastAPI
- Uvicorn
- Ultralytics YOLO
- OpenCV
- PyTorch

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- npm

## Cấu trúc thư mục

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app và các endpoint
│   │   ├── config.py               # Đọc cấu hình từ backend/.env
│   │   ├── class_catalog.py        # Mapping class model sang label/category/color
│   │   └── services/detector.py    # Load YOLO model và inference
│   ├── config/class_mapping.json   # Cấu hình nhãn hiển thị
│   ├── test/test_api.py            # Test API backend
│   ├── .env.example                # Mẫu biến môi trường backend
│   ├── requirements.txt            # Dependencies Python
│   └── run.py                      # Entrypoint chạy Uvicorn
├── frontend/
│   ├── src/
│   │   ├── components/             # Component giao diện
│   │   ├── hooks/                  # Hook gọi runtime config và phân tích ảnh
│   │   ├── services/               # Client gọi backend API
│   │   └── types/                  # TypeScript types cho API
│   ├── .env.example                # Mẫu biến môi trường frontend
│   ├── package.json
│   └── vite.config.ts
├── notebooks/
│   └── garbage_detection_pipeline.ipynb
├── weights/
│   └── best.pt                     # Checkpoint YOLO dùng để detect rác
└── README.md
```

## Yêu cầu trước khi chạy

Cài sẵn các công cụ sau:

- Python 3.11 hoặc mới hơn, hoặc Conda/Miniconda để tạo môi trường Python 3.11.
- Node.js 20 hoặc mới hơn, khuyến nghị Node.js 22 LTS.
- npm, đi kèm khi cài Node.js.
- Model checkpoint tại `weights/best.pt`.

Lưu ý: `backend/requirements.txt` đang pin bản PyTorch CUDA 11.8 (`torch==2.7.1+cu118`, `torchvision==0.22.1+cu118`). Nếu máy không dùng GPU NVIDIA hoặc cài dependency bị lỗi ở bước PyTorch, xem phần "Lỗi thường gặp" bên dưới.

## Cài đặt môi trường

Chạy các lệnh từ thư mục gốc của project:

```powershell
cd D:\Garbage-Detection-and-Classification
```

Tạo file môi trường cho backend và frontend:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

### 1. Cài backend

#### Cách A: Dùng Conda

Nếu dùng Conda, tạo môi trường Python 3.11 riêng cho project:

```powershell
conda create -n garbage-detection python=3.11 -y
conda activate garbage-detection
python --version
```

Đảm bảo `python --version` trả về Python 3.11.x.

Cài dependencies bằng pip trong môi trường Conda:

```powershell
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt --extra-index-url https://download.pytorch.org/whl/cu118
```

#### Cách B: Dùng venv

Tạo virtual environment:

```powershell
python --version
python -m venv backend\.venv
```

Đảm bảo lệnh `python --version` trả về Python 3.11 hoặc mới hơn. Nếu máy đang dùng Python 3.10, bước cài dependencies sẽ lỗi với một số package như `contourpy`.

Kích hoạt virtual environment:

```powershell
backend\.venv\Scripts\Activate.ps1
python --version
```

Cài dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt --extra-index-url https://download.pytorch.org/whl/cu118
```

### 2. Cài frontend

Mở terminal khác hoặc thoát khỏi thư mục backend nếu đang đứng ở đó, sau đó chạy:

```powershell
cd frontend
npm install
```

## Chạy hệ thống

Nên chạy backend và frontend ở 2 terminal khác nhau.

### Terminal 1 - Backend

Đứng ở thư mục gốc project:

```powershell
cd D:\Garbage-Detection-and-Classification
conda activate garbage-detection
python -m backend.run
```

Nếu bạn dùng `venv` thay vì Conda, thay dòng `conda activate garbage-detection` bằng:

```powershell
backend\.venv\Scripts\Activate.ps1
```

Mặc định backend chạy tại:

```text
http://127.0.0.1:8000
```

Kiểm tra backend:

```powershell
curl.exe http://127.0.0.1:8000/api/v1/health
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

### Terminal 2 - Frontend

Đứng ở thư mục `frontend`:

```powershell
cd D:\Garbage-Detection-and-Classification\frontend
npm run dev
```

Mặc định frontend chạy tại:

```text
http://127.0.0.1:8443
```

Mở trình duyệt tại địa chỉ trên, tải ảnh rác lên và xem kết quả nhận diện.

## Cấu hình môi trường

### Backend: `backend/.env`

Các biến quan trọng:

```env
APP_NAME=Garbage Detection API
APP_VERSION=1.0.0
API_PREFIX=/api/v1

MODEL_PATH=weights/best.pt
CLASS_MAPPING_PATH=backend/config/class_mapping.json
MODEL_DEVICE=
IMAGE_SIZE=640
DEFAULT_CONFIDENCE=0.30
MAX_UPLOAD_MB=20
ALLOWED_IMAGE_TYPES_CSV=image/jpeg,image/png,image/webp

CORS_ORIGINS_CSV=http://localhost:8443,http://127.0.0.1:8443

SERVER_HOST=127.0.0.1
SERVER_PORT=8000
SERVER_RELOAD=true
SERVER_WORKERS=1
```

Gợi ý cấu hình `MODEL_DEVICE`:

- Để trống: Ultralytics tự chọn thiết bị phù hợp.
- `cpu`: ép chạy bằng CPU.
- `0`: dùng GPU CUDA đầu tiên nếu máy có GPU NVIDIA và CUDA phù hợp.

Nếu đổi port frontend, nhớ cập nhật `CORS_ORIGINS_CSV`.

### Frontend: `frontend/.env`

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_RUNTIME_CONFIG_PATH=/api/v1/config
```

Nếu đổi port backend, cập nhật `VITE_API_BASE_URL` theo port mới.

## API chính

### Health check

```http
GET /api/v1/health
```

Trả về trạng thái backend, model đã load hay chưa và danh sách class của checkpoint.

### Runtime config

```http
GET /api/v1/config
```

Trả về cấu hình cho frontend, gồm đường dẫn predict, confidence mặc định, giới hạn upload, MIME type hợp lệ và danh sách class hiển thị.

### Predict image

```http
POST /api/v1/predict
Content-Type: multipart/form-data
```

Form data:

- `file`: ảnh cần phân tích. Hỗ trợ JPEG, PNG, WEBP theo cấu hình mặc định.
- `confidence`: ngưỡng confidence tùy chọn, từ `0.01` đến `1.0`.

Ví dụ:

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/v1/predict -F "file=@sample.jpg" -F "confidence=0.3"
```

Response gồm:

- `request_id`: mã request.
- `image`: kích thước ảnh.
- `count`: số vật thể phát hiện được.
- `detections`: danh sách bbox, label, category, color và confidence.
- `inference_ms`: thời gian inference.

## Chạy test và build

### Test backend

Đứng ở thư mục gốc project, bật môi trường Python rồi chạy:

```powershell
conda activate garbage-detection
python -m pytest backend\test
```

Nếu dùng `venv`, kích hoạt bằng `backend\.venv\Scripts\Activate.ps1`.

### Build frontend

```powershell
cd frontend
npm run build
```

Xem thử bản build production:

```powershell
npm run preview
```

## Quy trình sử dụng nhanh

1. Chạy backend bằng `python -m backend.run`.
2. Chạy frontend bằng `npm run dev`.
3. Mở `http://127.0.0.1:8443`.
4. Upload ảnh có rác.
5. Xem bounding box, nhãn, nhóm rác và confidence score.

## Lỗi thường gặp

### Frontend báo không kết nối được backend

Kiểm tra backend đã chạy chưa:

```powershell
curl.exe http://127.0.0.1:8000/api/v1/health
```

Nếu backend đổi port, sửa lại `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:<PORT_BACKEND>
```

### Backend báo thiếu biến môi trường

Đảm bảo đã tạo file:

```powershell
Copy-Item backend\.env.example backend\.env
```

Sau đó chạy lại backend từ thư mục gốc project.

### Backend không tìm thấy model

Kiểm tra file model có tồn tại:

```text
weights/best.pt
```

Nếu đặt model ở vị trí khác, sửa `MODEL_PATH` trong `backend/.env`.

### Lỗi `contourpy==1.3.3 Requires-Python >=3.11`

Lỗi này nghĩa là virtual environment đang dùng Python 3.10 hoặc thấp hơn. Dấu hiệu thường thấy trong log là tên wheel có `cp310`.

Cách xử lý khuyến nghị:

1. Cài Python 3.11 hoặc Python 3.12.
2. Mở terminal mới và kiểm tra:

```powershell
python --version
```

3. Nếu dùng Conda, tạo lại môi trường Python 3.11 rồi cài dependencies:

```powershell
conda deactivate
conda create -n garbage-detection python=3.11 -y
conda activate garbage-detection
python --version
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt --extra-index-url https://download.pytorch.org/whl/cu118
```

Nếu dùng `venv`, tạo lại virtual environment rồi cài dependencies:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt --extra-index-url https://download.pytorch.org/whl/cu118
```

Nếu trước đó đang active một môi trường cũ như `(.venv)`, hãy chạy `deactivate` hoặc đóng terminal đó trước khi tạo lại môi trường mới.

### Lỗi cài PyTorch hoặc `torch==...+cu118`

Requirements hiện dùng wheel CUDA 11.8. Cài bằng lệnh có PyTorch index:

```powershell
python -m pip install -r backend\requirements.txt --extra-index-url https://download.pytorch.org/whl/cu118
```

Nếu máy chỉ chạy CPU, có thể chỉnh `backend/requirements.txt` để dùng bản CPU của `torch` và `torchvision`, hoặc cài PyTorch CPU theo hướng dẫn chính thức của PyTorch rồi cài các package còn lại.

### Lỗi CORS khi gọi API

Kiểm tra `CORS_ORIGINS_CSV` trong `backend/.env` có chứa đúng địa chỉ frontend hay không:

```env
CORS_ORIGINS_CSV=http://localhost:8443,http://127.0.0.1:8443
```

Sau khi sửa `.env`, tắt và chạy lại backend.

## Ghi chú phát triển

- Luôn chạy backend từ thư mục gốc project để import package `backend` và resolve đường dẫn `weights/best.pt` đúng.
- File `backend/config/class_mapping.json` cần khớp với class name trong checkpoint YOLO.
- Frontend không hard-code endpoint predict, mà lấy từ `GET /api/v1/config`.
- Khi thêm class mới vào model, cập nhật cả checkpoint và `backend/config/class_mapping.json`.
