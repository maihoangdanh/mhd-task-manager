# Pages Map — Frontend (Next.js App Router)

Bản đồ route ↔ file ↔ chức năng cho qa-inspector đối chiếu routing và deploy-engineer biết cấu trúc build.

Stack: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + `@supabase/supabase-js`.
Dữ liệu gọi trực tiếp từ Client Component qua Supabase JS client (`lib/supabase.ts`), bảo mật bằng RLS.

**Giao diện (redesign 2026-07-09):** Chế độ SÁNG, phong cách hiện đại/trẻ trung. Màu chủ đạo indigo/violet + nhấn amber, nền xám nhạt có wash gradient nhẹ, card bo góc `rounded-2xl` + shadow mềm. Design tokens & component class (`.card`, `.btn`, `.btn-primary`, `.input`, `.pill`) định nghĩa trong `app/globals.css`. Đã bỏ toàn bộ dark mode.

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
| `/tasks` | `app/tasks/page.tsx` | Danh sách task, lọc theo status, toggle hoàn thành, xóa. Task thuộc chuỗi lặp có badge "🔁 Lặp"; khi xóa hỏi qua modal: "Xóa chỉ ngày này" hoặc "Xóa cả chuỗi (N task)" | cần đăng nhập |
| `/tasks/new` | `app/tasks/new/page.tsx` | Form tạo task mới | cần đăng nhập |
| `/tasks/[id]` | `app/tasks/[id]/page.tsx` | Form sửa task theo id | cần đăng nhập |
| `/schedule` | `app/schedule/page.tsx` | View lịch (agenda nhóm theo ngày), thêm/xóa sự kiện, liên kết task | cần đăng nhập |
| `/reports` | `app/reports/page.tsx` | Thống kê/báo cáo: tỷ lệ hoàn thành %, task quá hạn, phân bố theo trạng thái (donut), breakdown theo project (thanh ngang), xu hướng hoàn thành 8 tuần (cột dọc) | cần đăng nhập |

## Component & lib dùng chung

| File | Vai trò |
|------|---------|
| `lib/supabase.ts` | Khởi tạo Supabase client (anon key, RLS bảo vệ) |
| `types/database.ts` | Type khớp schema-contract: `Project`, `Task`, `TaskWithProject`, `ScheduleEvent`, `ScheduleEventWithTask` (snake_case) |
| `components/AuthProvider.tsx` | Context session Supabase Auth (`useAuth`), bọc toàn app ở `app/layout.tsx` |
| `components/RequireAuth.tsx` | Route guard: chưa đăng nhập → redirect `/login` |
| `components/Nav.tsx` | Thanh điều hướng (sticky, logo gradient) + nút đăng xuất (ẩn ở `/login`); có link `/reports` |
| `components/TaskForm.tsx` | Form dùng chung cho tạo/sửa task; hỗ trợ chọn/tạo nhanh project. Khi TẠO mới có toggle "🔁 Lặp lại hàng ngày": chọn khoảng ngày, loại trừ theo thứ trong tuần + theo ngày cụ thể, preview số task sẽ tạo, insert hàng loạt cùng `recurrence_group_id` |
| `components/Loading.tsx` | Spinner tải dùng chung |
| `components/Charts.tsx` | Biểu đồ tự vẽ (SVG/CSS, không thêm dependency): `DonutChart`, `VBars`, `HBars`. Màu theo palette đã validate bằng skill `dataviz`; mọi mark kèm nhãn số trực tiếp (relief rule) |

## Ánh xạ query ↔ schema-contract (điểm QA cần đối chiếu)

- Đọc tasks: `.from('tasks').select('id, title, status, priority, due_date, project_id, recurrence_group_id, projects(name)')` — dùng đúng snake_case, embed FK `projects(name)`. Thêm `recurrence_group_id` để nhận diện task thuộc chuỗi lặp.
- Task lặp lại (tạo chuỗi): sinh 1 `crypto.randomUUID()` làm `recurrence_group_id`, insert 1 row cho mỗi ngày hợp lệ (mảng rows), mỗi row set `user_id: user.id` để thỏa RLS. Tính ngày hợp lệ hoàn toàn ở client (loại theo thứ + ngày cụ thể).
- Xóa cả chuỗi: `.from('tasks').delete().eq('recurrence_group_id', groupId)`; xóa 1 ngày: `.delete().eq('id', id)`. RLS tự giới hạn theo user.
- Đọc events: `.from('schedule_events').select('id, title, start_time, end_time, task_id, tasks(title)')`.
- INSERT task/project/event: LUÔN set `user_id: user.id` (lấy từ `useAuth()` → Supabase Auth) để thỏa RLS `with check`.
- UPDATE task: gửi kèm `updated_at: new Date().toISOString()` (DB chưa có trigger tự động — theo contract).
- SELECT không lọc `.eq('user_id', ...)` — RLS `to authenticated` tự lọc theo `auth.uid()`.
- `due_date` kiểu `date` → gửi/nhận chuỗi `YYYY-MM-DD` (input type=date).
- `start_time`/`end_time` kiểu `timestamptz` → gửi ISO string (`new Date(datetimeLocal).toISOString()`).
- `/reports`: `.from('tasks').select('id, status, due_date, updated_at, project_id, projects(name)')` — thống kê tính hoàn toàn ở client từ dữ liệu `tasks` (KHÔNG đổi schema). Quá hạn = `status != 'done' && due_date < today`. Xu hướng hoàn thành = đếm task `status = 'done'` theo tuần dựa vào `updated_at`. Breakdown project gộp `project_id = null` thành "Chưa phân nhóm".

## Ghi chú phụ thuộc

- App yêu cầu ĐĂNG NHẬP mới truy cập dữ liệu (RLS `to authenticated`). Đã thêm auth gate tối thiểu (Supabase Auth email/password) — không phải tính năng ngoài phạm vi mà là điều kiện cần để tầng dữ liệu hoạt động.
- Migration schema CHƯA chạy thật trên Supabase (theo db-architect). Người dùng cần chạy `supabase/migrations/20260709120000_init_schema.sql` trong SQL Editor trước khi app đọc/ghi được dữ liệu.

## Trạng thái verify

- `npx tsc --noEmit`: PASS (không lỗi type, không `any` né lỗi).
- `npm run build`: PASS — 8 route build thành công (thêm `/reports`).
- Logic tính ngày lặp (`computeRecurringDates`) test độc lập: khoảng 1/8→31/8, loại Chủ nhật + 2 ngày cụ thể → 24 task đúng (31 − 5 CN − 2), không sót Chủ nhật/ngày loại trừ.
- Lưu ý verify: UI form lặp + modal xóa chuỗi nằm sau `RequireAuth` (cần đăng nhập Supabase) nên không drive end-to-end trong môi trường agent; đã xác thực qua build + tsc + unit logic. QA nên kiểm thực tế sau khi migration `20260709160000` đã chạy.
- Render kiểm tra thực tế qua dev server: `/login` hiển thị đúng design mới; các chart (`DonutChart`/`VBars`/`HBars`) render đúng màu (`#2a78d6` xác thực trực tiếp) + nhãn số. Console không lỗi.
