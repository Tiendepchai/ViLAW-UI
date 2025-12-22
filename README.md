# Chat UI của ViLAW

Giao diện chat UI đơn giản cho các dự án AI hỗ trợ bởi API dạng hỏi đáp (QA), RAG, Chatbot, v.v.

## 1) Yêu cầu
- Node.js 18+ (khuyến nghị 20+)
- Dự án gốc đang chạy API (thường là `http://localhost:8080` theo docker-compose).

## 2) Chạy nhanh (dev)

Từ thư mục repo này:

```bash
# 1) cài dependencies cho cả web + server
npm install

# 2) cấu hình env (tuỳ chọn)
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# 3) chạy đồng thời proxy server + web
npm run dev
```

- Web: `http://localhost:5173`
- Proxy server: `http://localhost:8787`

## 3) Cấu hình để trỏ tới dự án gốc

### Server (proxy + lưu JSON)
File `apps/server/.env`:
- `PROJECT_API_BASE`: base URL API của dự án gốc (vd: `http://localhost:8080`).
- `PROJECT_ASK_PATH`: nếu endpoint trả lời không phải `/ask`.
- `DATA_FILE`: nơi lưu JSON hội thoại.

Proxy sẽ thử lần lượt các endpoint:
`PROJECT_ASK_PATH` (nếu có) → `/ask` → `/rag` → `/qa` → `/chat` → `/answer`.

Payload cũng thử nhiều dạng: `{question}`, `{q}`, `{query}`, `{message}`.

### Web
File `apps/web/.env`:
- `VITE_BACKEND_URL`: URL của proxy server (mặc định `http://localhost:8787`).
- `VITE_STORAGE_MODE`: `server` (lưu file JSON) hoặc `local` (localStorage).

## 4) Tính năng UI
- Sidebar **history**: liệt kê các hội thoại, click để mở.
- New chat / xoá hội thoại.
- Export toàn bộ lịch sử ra file `.json`.
- Import từ file `.json`.
- Hiển thị **Nguồn/Citations** (nếu API trả về `citations`).

## 5) Cách tích hợp vào GitHub
- Repo này: `ViLAW`
- Repo dự án gốc: `Tiendepchai/ViLAW` — https://github.com/Tiendepchai/ViLAW
- Trong README của dự án gốc, chỉ cần link sang repo UI + hướng dẫn set `PROJECT_API_BASE`. 

---

### Gợi ý mapping API dự án gốc
Theo `docker-compose.yml` của dự án gốc, service `api` thường expose cổng `8080`.
Do đó local thường là `http://localhost:8080`.

## 6) Chạy bằng Docker (tuỳ chọn)

```bash
# nhớ cấu hình apps/server/.env trước
docker compose up --build
```

- UI: `http://localhost:5173`
- Server: `http://localhost:8787`

> Lưu ý: build web sẽ bake `VITE_BACKEND_URL` vào bundle. Nếu bạn đổi port/server, hãy chỉnh `docker-compose.yml` phần `build.args` rồi build lại.