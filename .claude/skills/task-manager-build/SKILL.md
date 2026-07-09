---
name: task-manager-build
description: "Điều phối nhóm agent xây dựng ứng dụng web quản lý công việc và lịch trình cá nhân (Task Manager) — thiết kế database Supabase, xây UI Next.js, xác thực tích hợp, và triển khai lên AWS Amplify. Dùng khi yêu cầu xây dựng, thêm tính năng, sửa lỗi, cập nhật schema, cập nhật UI, deploy lại, hoặc bất kỳ thay đổi nào liên quan đến task manager này. Bao gồm cả yêu cầu 'làm lại', 'sửa', 'thêm tính năng X vào task manager', 'deploy lại', 'cập nhật schema', 'thêm trang mới'."
---

# Task Manager Orchestrator

Skill tích hợp điều phối nhóm agent xây dựng ứng dụng quản lý công việc/lịch trình cá nhân: database Supabase (Postgres) → UI Next.js → xác thực tích hợp → triển khai AWS Amplify Hosting.

## Chế độ thực thi: Nhóm agent (mặc định)

## Stack đã chốt
- Frontend: Next.js (App Router) + Supabase JS client
- Database: Supabase (Postgres) — free tier
- Deploy: AWS Amplify Hosting
- QA: xác thực chéo schema ↔ frontend liên tục (incremental, không chờ đến cuối)

## Cấu thành Agent

| Thành viên | Loại agent | Vai trò | Skill | Đầu ra |
|-----------|-----------|---------|-------|--------|
| db-architect | Tùy chỉnh | Thiết kế schema Postgres + RLS trên Supabase | supabase-schema-design | `_workspace/01_db-architect_schema-contract.md` + `supabase/migrations/*.sql` |
| frontend-developer | Tùy chỉnh | Xây UI Next.js, tích hợp Supabase client | nextjs-task-ui | Code `app/`, `lib/`, `types/` + `_workspace/02_frontend-developer_pages-map.md` |
| qa-inspector | general-purpose | Xác thực chéo ranh giới DB ↔ Frontend | integration-qa | `_workspace/03_qa-inspector_report.md` |
| deploy-engineer | Tùy chỉnh | Triển khai lên AWS Amplify Hosting | aws-amplify-deploy | `_workspace/04_deploy-engineer_deploy-report.md` |

## Quy trình

### Phase 0: Kiểm tra context (Hỗ trợ tác vụ tiếp theo)

1. Kiểm tra `_workspace/` có tồn tại trong thư mục dự án không
2. Quyết định chế độ:
   - **Chưa tồn tại** → Chạy lần đầu, tiến hành Phase 1 xây toàn bộ (schema → UI → deploy)
   - **Tồn tại + người dùng yêu cầu sửa/thêm một phần** (v.d. "thêm tính năng nhắc hẹn", "sửa schema task") → Chạy lại một phần, chỉ gọi lại agent liên quan, đọc `_workspace/` cũ để agent nắm bối cảnh trước khi sửa
   - **Tồn tại + người dùng muốn làm lại từ đầu** → Di chuyển `_workspace/` sang `_workspace_{YYYYMMDD_HHMMSS}/` rồi chạy lại Phase 1
3. Khi chạy lại một phần, đính kèm đường dẫn output cũ liên quan vào prompt của agent được gọi lại

### Phase 1: Chuẩn bị
1. Phân tích yêu cầu — tính năng nào cần thêm/sửa, có ảnh hưởng schema không, có ảnh hưởng UI không
2. Tạo (hoặc giữ nguyên nếu chạy lại một phần) `_workspace/` trong thư mục dự án
3. Lưu yêu cầu gốc vào `_workspace/00_input/request.md`

### Phase 2: Cấu thành nhóm

```
TeamCreate(
  team_name: "task-manager-team",
  members: [
    { name: "db-architect", agent_type: "db-architect", model: "opus",
      prompt: "Thiết kế schema Postgres trên Supabase cho: {yêu cầu tính năng}. Dùng skill supabase-schema-design. Ghi kết quả vào _workspace/01_db-architect_schema-contract.md và supabase/migrations/." },
    { name: "frontend-developer", agent_type: "frontend-developer", model: "opus",
      prompt: "Xây UI Next.js cho: {yêu cầu tính năng}. Chờ/đọc _workspace/01_db-architect_schema-contract.md trước khi viết query. Dùng skill nextjs-task-ui." },
    { name: "qa-inspector", agent_type: "general-purpose", model: "opus",
      prompt: "Xác thực chéo ranh giới DB↔Frontend ngay khi db-architect hoặc frontend-developer báo hoàn thành một phần. Dùng skill integration-qa." },
    { name: "deploy-engineer", agent_type: "deploy-engineer", model: "opus",
      prompt: "Chờ frontend-developer + qa-inspector hoàn tất rồi triển khai lên AWS Amplify Hosting. Dùng skill aws-amplify-deploy." }
  ]
)
```

Đăng ký tác vụ:

```
TaskCreate(tasks: [
  { title: "Thiết kế schema + RLS", assignee: "db-architect" },
  { title: "Xây UI task + schedule", assignee: "frontend-developer", depends_on: ["Thiết kế schema + RLS"] },
  { title: "QA schema ↔ frontend", assignee: "qa-inspector", depends_on: ["Thiết kế schema + RLS"] },
  { title: "Deploy AWS Amplify", assignee: "deploy-engineer", depends_on: ["Xây UI task + schedule", "QA schema ↔ frontend"] }
])
```

### Phase 3: Xây dựng (thành viên tự điều phối)

**Cách thực thi:** Thành viên tự điều phối qua SendMessage + danh sách tác vụ dùng chung.

- db-architect hoàn thành schema trước, thông báo ngay cho frontend-developer + qa-inspector qua SendMessage khi `schema-contract.md` sẵn sàng
- qa-inspector xác thực NGAY sau khi db-architect xong (không chờ frontend) — kiểm tra RLS, đặt tên cột hợp lý trước khi frontend bắt đầu code theo
- frontend-developer code UI dựa trên schema-contract, báo qa-inspector mỗi khi xong 1 trang để xác thực incremental (không dồn đến cuối)
- Khi qa-inspector phát hiện lệch ranh giới, gửi thẳng cho agent phụ trách (file:dòng + cách sửa), không qua leader trước

Leader giám sát tiến độ bằng TaskGet, can thiệp nếu 1 thành viên bị kẹt quá lâu.

### Phase 4: Deploy
1. Chờ frontend-developer + qa-inspector báo hoàn thành (TaskGet xác nhận)
2. deploy-engineer nhận danh sách biến môi trường từ frontend-developer, cấu hình AWS Amplify, verify build
3. Nếu build lỗi, deploy-engineer trao đổi trực tiếp với frontend-developer qua SendMessage để xác định do code hay do thiếu env var

### Phase 5: Dọn dẹp
1. Thu thập báo cáo từ 4 thành viên (Read các file `_workspace/0N_*`)
2. Tổng hợp báo cáo cuối cho người dùng: schema đã tạo, trang UI đã xây, kết quả QA, URL production
3. Yêu cầu thành viên kết thúc, giải thể nhóm (TeamDelete)
4. Giữ nguyên `_workspace/` để tham chiếu cho lần chạy tiếp theo

## Luồng dữ liệu

```
[Leader] → TeamCreate
   db-architect → schema-contract.md ──┬──→ frontend-developer (đọc trước khi code)
                                        └──→ qa-inspector (xác thực RLS/naming ngay)
   frontend-developer → pages-map.md + code ──→ qa-inspector (xác thực incremental mỗi trang)
   qa-inspector → phát hiện lỗi ──→ SendMessage trực tiếp đến agent phụ trách
   (frontend + qa hoàn tất) ──→ deploy-engineer → deploy-report.md
   [Leader] ← Read tất cả _workspace/0N_* ← Tổng hợp báo cáo cuối
```

## Xử lý lỗi

| Tình huống | Chiến lược |
|-----------|-----------|
| db-architect thiết kế schema mơ hồ/thiếu | qa-inspector phát hiện và yêu cầu bổ sung ngay, tránh lan sang frontend |
| frontend-developer code sai tên cột | qa-inspector báo file:dòng cụ thể, frontend tự sửa, không phải qa sửa hộ |
| deploy-engineer build lỗi trên Amplify | Kiểm tra biến môi trường trước (nguyên nhân phổ biến nhất), thử lại 1 lần, nếu vẫn lỗi trao đổi trực tiếp với frontend-developer |
| 1 thành viên dừng/timeout | Leader phát hiện qua theo dõi rảnh rỗi, SendMessage kiểm tra, khởi động lại nếu cần |
| Quá nửa thành viên thất bại | Dừng lại, báo người dùng, xác nhận có tiếp tục không |

## Kịch bản kiểm thử

### Luồng bình thường (xây lần đầu)
1. Người dùng: "Xây task manager có task, project, lịch, deploy lên AWS"
2. Phase 0 phát hiện `_workspace/` chưa tồn tại → chạy lần đầu
3. Phase 2 tạo nhóm 4 thành viên + 4 tác vụ
4. db-architect xong schema trước → qa-inspector xác thực RLS → frontend code UI → qa-inspector xác thực incremental → deploy-engineer deploy
5. Kết quả: có schema-contract.md, code Next.js chạy được, URL Amplify production, báo cáo QA pass

### Luồng lỗi (thêm tính năng sau này)
1. Người dùng: "Thêm tính năng nhắc hẹn (reminder) cho task"
2. Phase 0 phát hiện `_workspace/` đã tồn tại + yêu cầu một phần → chạy lại một phần
3. Chỉ gọi lại db-architect (thêm cột/bảng reminder) + frontend-developer (thêm UI) + qa-inspector xác thực phần mới
4. Giả sử frontend-developer dùng nhầm tên cột `remind_at` thay vì `reminder_time` đã định nghĩa
5. qa-inspector phát hiện lệch tên, gửi SendMessage trực tiếp chỉ rõ file:dòng cho frontend-developer
6. frontend-developer sửa, báo lại qa-inspector xác thực lần 2 → pass
7. deploy-engineer deploy bản cập nhật
8. Báo cáo cuối ghi rõ tính năng mới đã thêm + 1 lần phát hiện/sửa lỗi ranh giới trong quá trình
