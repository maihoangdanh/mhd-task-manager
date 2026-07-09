# Pages Map — Frontend (Next.js App Router)

Bản đồ route ↔ file ↔ chức năng cho qa-inspector đối chiếu routing và deploy-engineer biết cấu trúc build.

Stack: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + `@supabase/supabase-js`.
Dữ liệu gọi trực tiếp từ Client Component qua Supabase JS client (`lib/supabase.ts`), bảo mật bằng RLS.

## Biến môi trường (bắt buộc cho build & runtime)

| Biến | Giá trị |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wvudgvdrgoiocalthbsi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_KNW25n5ia06r411ZJvEFqw_5Z6Jzorc` |

Đặt trong `.env.local` (đã có, KHÔNG commit — nằm trong `.gitignore` qua rule `.env*`).
Cả hai là `NEXT_PUBLIC_*` nên được nhúng vào bundle client — deploy-engineer phải khai báo chúng ở môi trường build của AWS Amplify.

## Routes

| Route | File | Chức năng | Auth |
|-------|------|-----------|------|
| `/` | `app/page.tsx` | Điều hướng: có session → `/dashboard`, chưa → `/login` | — |
| `/login` | `app/login/page.tsx` | Đăng nhập / đăng ký bằng email + mật khẩu (Supabase Auth) | public |
| `/dashboard` | `app/dashboard/page.tsx` | Tổng quan: đếm task theo status, task sắp đến hạn, sự kiện sắp tới | cần đăng nhập |
| `/tasks` | `app/tasks/page.tsx` | Danh sách task, lọc theo status, toggle hoàn thành, xóa | cần đăng nhập |
| `/tasks/new` | `app/tasks/new/page.tsx` | Form tạo task mới | cần đăng nhập |
| `/tasks/[id]` | `app/tasks/[id]/page.tsx` | Form sửa task theo id | cần đăng nhập |
| `/schedule` | `app/schedule/page.tsx` | View lịch (agenda nhóm theo ngày), thêm/xóa sự kiện, liên kết task | cần đăng nhập |

## Component & lib dùng chung

| File | Vai trò |
|------|---------|
| `lib/supabase.ts` | Khởi tạo Supabase client (anon key, RLS bảo vệ) |
| `types/database.ts` | Type khớp schema-contract: `Project`, `Task`, `TaskWithProject`, `ScheduleEvent`, `ScheduleEventWithTask` (snake_case) |
| `components/AuthProvider.tsx` | Context session Supabase Auth (`useAuth`), bọc toàn app ở `app/layout.tsx` |
| `components/RequireAuth.tsx` | Route guard: chưa đăng nhập → redirect `/login` |
| `components/Nav.tsx` | Thanh điều hướng + nút đăng xuất (ẩn ở `/login`) |
| `components/TaskForm.tsx` | Form dùng chung cho tạo/sửa task; hỗ trợ chọn/tạo nhanh project |

## Ánh xạ query ↔ schema-contract (điểm QA cần đối chiếu)

- Đọc tasks: `.from('tasks').select('id, title, status, priority, due_date, project_id, projects(name)')` — dùng đúng snake_case, embed FK `projects(name)`.
- Đọc events: `.from('schedule_events').select('id, title, start_time, end_time, task_id, tasks(title)')`.
- INSERT task/project/event: LUÔN set `user_id: user.id` (lấy từ `useAuth()` → Supabase Auth) để thỏa RLS `with check`.
- UPDATE task: gửi kèm `updated_at: new Date().toISOString()` (DB chưa có trigger tự động — theo contract).
- SELECT không lọc `.eq('user_id', ...)` — RLS `to authenticated` tự lọc theo `auth.uid()`.
- `due_date` kiểu `date` → gửi/nhận chuỗi `YYYY-MM-DD` (input type=date).
- `start_time`/`end_time` kiểu `timestamptz` → gửi ISO string (`new Date(datetimeLocal).toISOString()`).

## Ghi chú phụ thuộc

- App yêu cầu ĐĂNG NHẬP mới truy cập dữ liệu (RLS `to authenticated`). Đã thêm auth gate tối thiểu (Supabase Auth email/password) — không phải tính năng ngoài phạm vi mà là điều kiện cần để tầng dữ liệu hoạt động.
- Migration schema CHƯA chạy thật trên Supabase (theo db-architect). Người dùng cần chạy `supabase/migrations/20260709120000_init_schema.sql` trong SQL Editor trước khi app đọc/ghi được dữ liệu.

## Trạng thái verify

- `npx tsc --noEmit`: PASS (không lỗi type, không `any` né lỗi).
- `npm run build`: PASS — 7 route build thành công.
