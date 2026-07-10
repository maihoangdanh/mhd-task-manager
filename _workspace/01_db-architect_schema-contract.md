# Schema Contract — Task Manager (Supabase)

Nguồn chuẩn (source of truth) cho frontend-developer và qa-inspector. Frontend PHẢI dùng đúng tên cột và kiểu dữ liệu ghi ở đây.

- Project ID: `wvudgvdrgoiocalthbsi`
- Project URL: `https://wvudgvdrgoiocalthbsi.supabase.co`
- Migrations (chạy theo thứ tự timestamp):
  1. `supabase/migrations/20260709120000_init_schema.sql` — khởi tạo 3 bảng + RLS.
  2. `supabase/migrations/20260709160000_add_recurrence_group_id.sql` — thêm cột `recurrence_group_id` vào `tasks` (tính năng task lặp lại).
  3. `supabase/migrations/20260709170000_add_notes_goals_freelance.sql` — thêm 3 bảng `notes`, `goals`, `freelance_projects` (+ RLS) và 2 cột `completed`, `project_id` vào `schedule_events`.
  4. `supabase/migrations/20260710120000_add_parent_task_and_start_date.sql` — thêm 2 cột `parent_task_id` (subtask, self-reference) và `start_date` (Timeline view) vào `tasks` + partial index cho `parent_task_id`.

## QUAN TRỌNG — cách áp dụng migration (người dùng tự chạy)

Môi trường agent này KHÔNG có network/CLI credentials tới Supabase, nên migration CHƯA được chạy thật. Người dùng cần tự áp dụng, theo thứ tự:

1. Vào Supabase Dashboard -> chọn project `wvudgvdrgoiocalthbsi`.
2. Mở **SQL Editor**.
3. Dán toàn bộ nội dung file `supabase/migrations/20260709120000_init_schema.sql` -> **Run** (nếu đã chạy trước đó thì bỏ qua).
4. Dán toàn bộ nội dung file `supabase/migrations/20260709160000_add_recurrence_group_id.sql` -> **Run** (migration cho task lặp lại — CẦN chạy để cột `recurrence_group_id` tồn tại).
5. Dán toàn bộ nội dung file `supabase/migrations/20260709170000_add_notes_goals_freelance.sql` -> **Run** (migration MỚI NHẤT — tạo 3 bảng `notes`/`goals`/`freelance_projects` và thêm 2 cột `completed`/`project_id` vào `schedule_events`). **CHƯA chạy thật** trong môi trường agent (không có network) — người dùng CẦN tự chạy trong SQL Editor.
6. Dán toàn bộ nội dung file `supabase/migrations/20260710120000_add_parent_task_and_start_date.sql` -> **Run** (migration MỚI NHẤT — thêm 2 cột `parent_task_id`, `start_date` vào `tasks` và partial index). **CHƯA chạy thật** trong môi trường agent (không có network) — người dùng CẦN tự chạy trong SQL Editor.
7. Kiểm tra tab **Authentication -> Policies** thấy RLS đã bật (enabled) cho cả 6 bảng (`projects`, `tasks`, `schedule_events`, `notes`, `goals`, `freelance_projects`).
8. Kiểm tra bảng `tasks` đã có các cột `recurrence_group_id`, `parent_task_id`, `start_date`, và bảng `schedule_events` đã có 2 cột `completed`, `project_id`.

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
| recurrence_group_id | uuid | có | null | Nhóm các task cùng một chuỗi lặp lại. `null` = task đơn lẻ. Thêm bởi migration `20260709160000`. Có partial index `where recurrence_group_id is not null`. |
| parent_task_id | uuid | có | null | FK -> `tasks(id)` (self-reference), ON DELETE CASCADE (xóa task cha thì xóa luôn subtask). `null` = task gốc. Chỉ 1 cấp lồng — KHÔNG enforce bằng CHECK ở DB, UI chịu trách nhiệm không tạo subtask của subtask. Thêm bởi migration `20260710120000`. Có partial index `where parent_task_id is not null`. |
| start_date | date | có | null | Ngày bắt đầu (chỉ ngày, không giờ), dùng cho Timeline view. `null` = chưa đặt. Thêm bởi migration `20260710120000`. |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

Lưu ý cho frontend: `updated_at` KHÔNG có trigger tự cập nhật ở DB. Khi update task, gửi kèm `updated_at: new Date().toISOString()` nếu muốn giá trị chính xác.

### Cách dùng `parent_task_id` (subtask — task con, chỉ 1 cấp)

- Task cha: `parent_task_id = null` (task gốc). Subtask: `parent_task_id` = `id` của task cha.
- Chỉ hỗ trợ **1 cấp**: subtask KHÔNG được có subtask riêng. DB không chặn việc này (không CHECK) — frontend/UI phải đảm bảo chỉ cho tạo subtask dưới task gốc.
- Xóa task cha sẽ tự động xóa hết subtask (ON DELETE CASCADE). RLS vẫn giới hạn theo user.
- Khi INSERT subtask, vẫn phải set `user_id` = user hiện tại (giống mọi row khác), nếu không `with check` sẽ chặn.
- Lấy subtask của một task cha: `supabase.from('tasks').select('*').eq('parent_task_id', parentId)` — partial index giúp query nhanh.
- `start_date` dùng cho Timeline view; kết hợp với `due_date` để vẽ thanh thời gian (start_date -> due_date). Cả hai đều nullable, UI cần xử lý trường hợp thiếu.

### Cách dùng `recurrence_group_id` (task lặp lại hàng ngày trong khoảng thời gian)

- Mỗi ngày trong khoảng vẫn là **1 row task riêng** (mỗi row có `due_date` của ngày đó). Đây KHÔNG phải recurrence rule động — không tự sinh row theo thời gian.
- Khi tạo một chuỗi lặp: frontend sinh **một** uuid mới (vd `crypto.randomUUID()`), rồi INSERT nhiều row task, tất cả cùng gán `recurrence_group_id` = uuid đó.
- Task đơn lẻ (tạo bình thường): để `recurrence_group_id` = `null` (không gửi field này khi insert cũng được, default là null).
- Xóa cả chuỗi: `supabase.from('tasks').delete().eq('recurrence_group_id', groupId)` — partial index giúp query này nhanh. RLS vẫn tự giới hạn theo user, không cần lọc thêm `user_id`.
- Nhận diện task thuộc chuỗi trong UI: `row.recurrence_group_id != null`.

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
| completed | boolean | không | `false` | Đánh dấu sự kiện đã hoàn thành. Thêm bởi migration `20260709170000`. |
| project_id | uuid | có | null | FK -> `projects(id)`, ON DELETE SET NULL (xóa project thì event giữ lại, `project_id` thành null). Thêm bởi migration `20260709170000`. Có index `idx_schedule_events_project_id`. |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Không đổi khi thêm 2 cột mới.

---

## Bảng: notes

Ghi chú nhanh của người dùng. Thêm bởi migration `20260709170000`.

| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | `gen_random_uuid()` | PK |
| user_id | uuid | không | - | FK -> `auth.users(id)`, ON DELETE CASCADE |
| content | text | không | - | Nội dung ghi chú |
| color | text | có | null | Màu ghi chú (tùy UI diễn giải, vd hex hoặc tên màu). Không có ràng buộc CHECK. |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

---

## Bảng: goals

Mục tiêu theo tuần/tháng, có phần trăm tiến độ. Thêm bởi migration `20260709170000`.

| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | `gen_random_uuid()` | PK |
| user_id | uuid | không | - | FK -> `auth.users(id)`, ON DELETE CASCADE |
| title | text | không | - | Tên mục tiêu |
| period | text | không | - | CHECK enum: `week` / `month` |
| progress_percent | int | không | `0` | CHECK: từ 0 đến 100 (`between 0 and 100`) |
| target_date | date | có | null | Ngày mục tiêu (chỉ ngày) |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |
| updated_at | timestamptz | không | `now()` | Cập nhật lần cuối (frontend tự set `now()` khi update; chưa có trigger tự động) |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

---

## Bảng: freelance_projects

Dự án freelance kèm doanh thu và trạng thái. Thêm bởi migration `20260709170000`.

| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | `gen_random_uuid()` | PK |
| user_id | uuid | không | - | FK -> `auth.users(id)`, ON DELETE CASCADE |
| client_name | text | không | - | Tên khách hàng |
| project_name | text | không | - | Tên dự án |
| revenue | numeric | không | `0` | Doanh thu. Kiểu `numeric` (không giới hạn precision/scale) — frontend nhận về dạng **string** qua Supabase JS, cần `Number(row.revenue)` khi tính toán. |
| status | text | không | `'in_progress'` | CHECK enum: `in_progress` / `almost_done` / `done` |
| created_at | timestamptz | không | `now()` | Thời điểm tạo |
| updated_at | timestamptz | không | `now()` | Cập nhật lần cuối (frontend tự set `now()` khi update; chưa có trigger tự động) |

RLS: bật. Policy `for all to authenticated` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

---

## Quan hệ khóa ngoại (tóm tắt)

- `projects.user_id` -> `auth.users.id` (CASCADE)
- `tasks.user_id` -> `auth.users.id` (CASCADE)
- `tasks.project_id` -> `projects.id` (SET NULL)
- `tasks.parent_task_id` -> `tasks.id` (self-reference, CASCADE)
- `schedule_events.user_id` -> `auth.users.id` (CASCADE)
- `schedule_events.task_id` -> `tasks.id` (CASCADE)
- `schedule_events.project_id` -> `projects.id` (SET NULL)
- `notes.user_id` -> `auth.users.id` (CASCADE)
- `goals.user_id` -> `auth.users.id` (CASCADE)
- `freelance_projects.user_id` -> `auth.users.id` (CASCADE)

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
