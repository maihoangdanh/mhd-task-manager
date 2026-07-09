---
name: integration-qa
description: "Quy trình xác thực chéo nhất quán ranh giới giữa schema database Supabase và code frontend Next.js cho task manager: đối chiếu tên cột, RLS, quan hệ khóa ngoại, và routing. Dùng khi cần kiểm tra chất lượng tích hợp sau khi schema hoặc UI thay đổi, trước khi deploy."
---

# QA Tích hợp: Schema Supabase ↔ Frontend Next.js

## Nguyên tắc cốt lõi: So sánh chéo, không kiểm tra sự tồn tại

Code review tĩnh (build pass, TypeScript compile pass) không bắt được lỗi ranh giới vì generic cast (`fetchJson<T>()`, `.select<T>()`) luôn compile được ngay cả khi response runtime thực tế khác `T`. Phải **đọc đồng thời cả hai bên** rồi so sánh trực tiếp, không đọc một bên rồi suy đoán bên kia.

| Checklist yếu (kiểm tra tồn tại) | Checklist mạnh (so sánh chéo) |
|----------------------------------|-------------------------------|
| Bảng `tasks` có tồn tại không? | Tên cột trong `.select()` của frontend có khớp CHÍNH XÁC schema-contract không? |
| RLS có được bật không? | Policy RLS có dùng đúng `auth.uid() = user_id` không, có cả `using` lẫn `with check` không? |
| Trang `/tasks/[id]` có tồn tại không? | Tất cả `href`/`router.push` trong code có trỏ đúng đường dẫn trang thực tế không? |

## Các bước xác thực

### 1. Tên cột/kiểu dữ liệu (ưu tiên cao nhất)
1. Mở `_workspace/01_db-architect_schema-contract.md` — liệt kê tên cột từng bảng
2. Mở đồng thời file frontend gọi Supabase (`.from('table').select(...)`) và file `types/database.ts`
3. Đối chiếu từng tên cột — Postgres/Supabase dùng snake_case (`due_date`), lỗi phổ biến nhất là frontend viết nhầm camelCase (`dueDate`) hoặc sai tên hoàn toàn
4. Xác nhận type TypeScript khớp đúng kiểu (`text` → `string`, `timestamptz` → `string`, cột nullable → union `| null`)

### 2. Row Level Security
1. Mở file migration SQL, tìm `enable row level security` và `create policy`
2. Xác nhận MỌI bảng chứa `user_id` đều có RLS bật — bảng thiếu RLS là lỗ hổng cho phép đọc/ghi dữ liệu của người khác
3. Xác nhận policy dùng cả `using` (chặn đọc) và `with check` (chặn ghi/sửa), không chỉ một trong hai

### 3. Quan hệ khóa ngoại/join
1. Đối chiếu FK trong schema-contract (v.d. `tasks.project_id → projects.id`)
2. Kiểm tra câu query join trong frontend (`.select('*, projects(name)')`) dùng đúng tên bảng quan hệ

### 4. Routing
1. Liệt kê đường dẫn URL suy ra từ cấu trúc `app/**/page.tsx` (App Router: `(group)` bị xóa khỏi URL, `[id]` là dynamic segment)
2. Đối chiếu với tất cả `href=`, `router.push(`, `redirect(` trong code
3. Đánh dấu bất kỳ link nào trỏ đến đường dẫn không có page thực tế tương ứng

## Báo cáo kết quả

Ghi vào `_workspace/03_qa-inspector_report.md` theo format:

```markdown
## Kết quả QA — {ngày}

### Pass
- [Mục đã xác thực khớp]

### Fail
- [File:dòng] — [Mô tả lệch cụ thể] — [Đề xuất sửa] — Đã báo: {agent phụ trách}

### Chưa xác thực được (cần thêm thông tin)
- [Lý do không đủ thông tin để kết luận]
```

Khi phát hiện Fail, gửi SendMessage trực tiếp đến agent phụ trách (db-architect nếu lỗi ở schema, frontend-developer nếu lỗi ở query/type) kèm file:dòng cụ thể — không chỉ ghi vào báo cáo rồi chờ leader chuyển tiếp.
