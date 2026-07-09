# Báo cáo Deploy — EC2 instance có sẵn (thay thế Amplify)

Ngày: 2026-07-09
Instance: "Tan Muc" (i-03f500c5308032937), Ubuntu 26.04, IP 54.169.31.95

## Đã làm xong trên server (không cần bạn làm gì thêm)

| # | Việc | Chi tiết |
|---|------|---------|
| 1 | Copy code lên server | `/home/ubuntu/apps/task-manager` (qua scp, không dùng git clone để tránh cần auth) |
| 2 | Cài dependency + build | `npm ci` + `npm run build` — PASS, 9 route |
| 3 | Biến môi trường | `.env.production.local` trên server (không commit, không qua git) |
| 4 | Chạy app | PM2, tên process `task-manager`, cổng nội bộ `127.0.0.1:3001` |
| 5 | Tự khởi động lại khi reboot | `pm2 startup` (systemd service `pm2-ubuntu`) + `pm2 save` |
| 6 | Nginx | Server block mới `/etc/nginx/sites-available/tasks.hoangdanh.cloud`, theo đúng mẫu `agent.hoangdanh.cloud` — KHÔNG đụng site cũ |
| 7 | SSL | Cert self-signed `/etc/nginx/ssl/tasks.hoangdanh.cloud.{crt,key}` (cùng kiểu site cũ, dùng với Cloudflare Full SSL) |
| 8 | Test | `curl https://tasks.hoangdanh.cloud/login` qua Nginx → HTTP 200. HTTP → HTTPS redirect hoạt động. |

## Việc DUY NHẤT bạn cần làm: trỏ DNS ở Cloudflare

1. Vào Cloudflare Dashboard → chọn zone `hoangdanh.cloud` → **DNS** → **Add record**
2. Điền:
   - Type: `A`
   - Name: `tasks`
   - IPv4 address: `54.169.31.95`
   - Proxy status: **Proxied** (đám mây cam) — giống cách bạn đã set cho `agent.hoangdanh.cloud`
3. Chờ 1-2 phút, mở `https://tasks.hoangdanh.cloud` → sẽ vào thẳng trang `/login` của task manager

## Vẫn cần: chạy migration SQL trên Supabase (nếu chưa làm)
Dashboard project `wvudgvdrgoiocalthbsi` → SQL Editor → dán nội dung `supabase/migrations/20260709120000_init_schema.sql` → Run. Thiếu bước này thì đăng nhập được nhưng tạo task sẽ lỗi vì bảng chưa tồn tại.

## Không đụng đến
- Site `hoangdanh.cloud` và `agent.hoangdanh.cloud` (Hermes agent) — nguyên vẹn, không restart, không sửa config
- Port 8767 (Hermes agent) — không đổi gì
