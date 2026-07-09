# Schema Contract — Task Manager (Supabase)

Nguồn chuẩn (source of truth) cho frontend-developer và qa-inspector. Frontend PHẢI dùng đúng tên cột và kiểu dữ liệu ghi ở đây.

- Project ID: `wvudgvdrgoiocalthbsi`
- Project URL: `https://wvudgvdrgoiocalthbsi.supabase.co`
- Migration: `supabase/migrations/20260709120000_init_schema.sql`

## QUAN TRỌNG — cách áp dụng migration (người dùng tự chạy)

Môi trường agent này KHÔNG có network/CLI credentials tới Supabase, nên migration CHƯA được chạy thật. Người dùng cần tự áp dụng:

1. Vào Supabase Dashboard -> chọn project `wvudgvdrgoiocalthbsi`.
2. Mở **SQL Editor**.
3. Dán toàn bộ nội dung file `supabase/migrations/20260709120000_init_schema.sql`.
4. Bấm **Run**.
5. Kiểm tra tab **Authentication -> Policies** thấy RLS đã bật (enabled) cho cả 3 bảng.

## Quy ước đặt tên — điểm dễ gây lỗi ranh giới

- Tên bảng/cột dùng **snake_case** (chuẩn Postgres): `due_date`, `project_id`, `start_time`, `end_time`.
- Supabase JS client (`@supabase/supabase-js`) trả về response **giữ nguyên snake_case**, KHÔNG tự chuyển sang camelCase.
  - Frontend nhận `row.due_date`, `row.project_id` — KHÔNG phải `row.dueDate`, `row.projectId`.
  - Nếu UI muốn camelCase, tự viết mapper ở tầng gọi API; KHÔNG đổi tên cột DB.

## Giả định đã chọn (khi request mơ hồ)

- `status`: enum text `todo` / `in_progress` / `done`, mặc định `todo`.
- `priority`: enum text `low` / `medium` / `high`, mặc định `medium` (không dùng số).
- `due_date`: kiểu `date` (chỉ ngày, không giờ) — hạn chót theo ngày.
- `schedule_events.start_time` / `end_time`: kiểu `timestamptz` (có ngày + giờ + timezone).
- Không tạo bảng `users` riêng — dùng bảng hệ thống `auth.users` của Supabase Auth.
- Không tạo bảng `tags`/`categories` (ngoài phạm vi request).
- `id` PK sinh bằng `gen_random_uuid()` (built-in Postgres, không cần extension uuid-ossp).
- RLS policy giới hạn `to authenticated` (defense-in-depth) — anon (chưa đăng nhập) không match được row nào.

---

## Bảng: projects

Nhóm các task lại với nhau.

| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | `gen_random_uuid()` | PK |
| user_id | uuid | không | - | FK -> `auth.users(id)`, ON DELETE CASCADE |
| name | text | không | - | Tên project |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

---

## Bảng: tasks

| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | `gen_random_uuid()` | PK |
| user_id | uuid | không | - | FK -> `auth.users(id)`, ON DELETE CASCADE |
| project_id | uuid | có | null | FK -> `projects(id)`, ON DELETE SET NULL (xóa project thì task giữ lại, project_id thành null) |
| title | text | không | - | Tiêu đề task |
| description | text | có | null | Mô tả chi tiết |
| status | text | không | `'todo'` | CHECK enum: `todo` / `in_progress` / `done` |
| priority | text | không | `'medium'` | CHECK enum: `low` / `medium` / `high` |
| due_date | date | có | null | Hạn chót (chỉ ngày) |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |
| updated_at | timestamptz | không | `now()` | Cập nhật lần cuối (frontend tự set `now()` khi update; chưa có trigger tự động) |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

Lưu ý cho frontend: `updated_at` KHÔNG có trigger tự cập nhật ở DB. Khi update task, gửi kèm `updated_at: new Date().toISOString()` nếu muốn giá trị chính xác.

---

## Bảng: schedule_events

Sự kiện lịch, liên kết tùy chọn tới một task.

| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | `gen_random_uuid()` | PK |
| user_id | uuid | không | - | FK -> `auth.users(id)`, ON DELETE CASCADE |
| task_id | uuid | có | null | FK -> `tasks(id)`, ON DELETE CASCADE (xóa task thì xóa luôn event gắn với nó) |
| title | text | không | - | Tiêu đề sự kiện |
| start_time | timestamptz | không | - | Thời điểm bắt đầu |
| end_time | timestamptz | không | - | Thời điểm kết thúc |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

---

## Quan hệ khóa ngoại (tóm tắt)

- `projects.user_id` -> `auth.users.id` (CASCADE)
- `tasks.user_id` -> `auth.users.id` (CASCADE)
- `tasks.project_id` -> `projects.id` (SET NULL)
- `schedule_events.user_id` -> `auth.users.id` (CASCADE)
- `schedule_events.task_id` -> `tasks.id` (CASCADE)

## Gợi ý query quan hệ cho frontend (Supabase JS)

Lấy task kèm tên project (embed qua FK):

```js
const { data } = await supabase
  .from('tasks')
  .select('id, title, status, priority, due_date, project_id, projects(name)')
  .order('created_at', { ascending: false });
// data[i].projects?.name  (null nếu project_id = null)
```

Lấy event kèm task:

```js
const { data } = await supabase
  .from('schedule_events')
  .select('id, title, start_time, end_time, task_id, tasks(title)');
```

Lưu ý: KHÔNG cần lọc `.eq('user_id', ...)` để bảo mật — RLS đã tự chặn theo `auth.uid()`. Nhưng KHI INSERT vẫn phải set `user_id` = id user hiện tại (lấy từ `supabase.auth.getUser()`), nếu không `with check` sẽ chặn.
