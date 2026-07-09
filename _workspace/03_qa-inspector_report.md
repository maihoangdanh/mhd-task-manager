# Báo cáo QA — qa-inspector

Vai trò: Xác thực nhất quán ranh giới DB (Supabase) ↔ Frontend (Next.js).
Phương pháp: So sánh chéo (đọc đồng thời cả hai bên), không chỉ kiểm tra tồn tại.

---

## Kết quả QA #1 — 2026-07-09 — Xác thực DB (schema-contract ↔ migration)

Nguồn: `_workspace/01_db-architect_schema-contract.md` + `supabase/migrations/20260709120000_init_schema.sql`

### Pass
- **RLS bật đủ 3 bảng**: `projects`, `tasks`, `schedule_events` đều `enable row level security` (migration L63-65).
- **Policy đúng logic**: cả 3 bảng dùng policy `for all` có ĐỦ cả `using (auth.uid()=user_id)` lẫn `with check (auth.uid()=user_id)` (L67-80) → chặn cả đọc lẫn ghi/sửa của user khác.
- **user_id NOT NULL** trên cả 3 bảng → không tạo được row mồ côi vượt RLS.
- **Naming snake_case nhất quán**: `due_date`, `project_id`, `start_time`, `end_time`, `created_at`, `updated_at` — contract khớp CHÍNH XÁC migration, không lệch cột nào.
- **Enum khớp**: `status` CHECK `todo/in_progress/done` (default `todo`); `priority` CHECK `low/medium/high` (default `medium`).
- **Kiểu dữ liệu khớp**: `due_date` = `date`; `start_time`/`end_time` = `timestamptz`; `created_at`/`updated_at` = `timestamptz`.
- **FK behavior khớp contract**: `tasks.project_id→projects(id) SET NULL` (L26); `schedule_events.task_id→tasks(id) CASCADE` (L42); mọi `user_id→auth.users(id) CASCADE`.
- **Index** trên user_id + các FK (L52-56) — tốt cho query lọc theo user.

### Fail
- (không có)

### Quan sát nhỏ (không chặn — tùy db-architect quyết định)
- Policy không giới hạn `to authenticated`. Về mặt bảo mật vẫn an toàn (`auth.uid()` = null với anon → không match row nào), chỉ là gợi ý defense-in-depth/rõ ràng hơn nếu thêm `to authenticated`.
- Dùng `uuid_generate_v4()` (extension uuid-ossp). Chạy tốt trên Supabase; Supabase khuyến nghị `gen_random_uuid()` (built-in, không cần extension) nhưng hiện tại KHÔNG phải lỗi.

### Lưu ý bắc cầu sang frontend (sẽ kiểm khi có code)
- Supabase JS trả **snake_case nguyên bản** → frontend PHẢI đọc `row.due_date`, `row.project_id`, KHÔNG phải `dueDate`/`projectId`.
- `updated_at` KHÔNG có trigger DB → khi UPDATE task, frontend phải tự set `updated_at: new Date().toISOString()`.
- Khi INSERT, frontend PHẢI set `user_id` = user hiện tại (`supabase.auth.getUser()`), nếu không `with check` sẽ chặn.
- Join embed: `tasks` ↔ `projects(name)` (qua project_id), `schedule_events` ↔ `tasks(title)` (qua task_id) — kiểm tên quan hệ trong `.select()` khi có code.

### Chưa xác thực được (đang chờ)
- **Frontend**: chưa có code Next.js (`app/`, `lib/supabase.ts`, `types/`) và `_workspace/02_frontend-developer_pages-map.md` → chưa đối chiếu được tên cột/kiểu/join/routing. Đang chờ frontend-developer báo từng trang.

### Re-verify sau khi db-architect áp dụng 2 gợi ý (cùng ngày)
- `to authenticated` đã thêm vào cả 3 policy: contract L50/69/89 ↔ migration L69/75/81 — KHỚP.
- `gen_random_uuid()` làm PK default cả 3 bảng: contract L45/58/81 ↔ migration L14/24/40 — KHỚP; đã bỏ uuid-ossp, không còn tham chiếu `uuid_generate_v4`/`uuid-ossp` sót lại.
- Tên cột/kiểu/FK/CHECK enum KHÔNG đổi → không ảnh hưởng cross-boundary. DB layer vẫn **PASS**.

### Trạng thái
- DB layer: **PASS** (đã re-verify sau chỉnh sửa).

---

## Kết quả QA #2 — 2026-07-09 — Frontend foundation (types + supabase client)

Nguồn: `types/database.ts`, `lib/supabase.ts` ↔ `_workspace/01_db-architect_schema-contract.md`

### Pass
- **types/database.ts khớp CHÍNH XÁC schema-contract** (bề mặt dễ lệch nhất — sạch):
  - `Project` (4 cột), `Task` (10 cột), `ScheduleEvent` (7 cột): đủ cột, snake_case, không thừa/thiếu.
  - Nullable đúng `| null`: `project_id`, `description`, `due_date`, `task_id`.
  - Enum khớp CHECK: `TaskStatus=todo|in_progress|done`, `TaskPriority=low|medium|high`.
  - Kiểu: `date`→`string` (YYYY-MM-DD), `timestamptz`→`string`. KHÔNG có camelCase drift.
  - Type join dùng đúng tên quan hệ: `TaskWithProject.projects`, `ScheduleEventWithTask.tasks` — khớp embed `projects(name)`/`tasks(title)`.
- **lib/supabase.ts**: chỉ dùng anon key ở client (đúng — RLS đảm bảo cô lập dữ liệu); không lộ service_role.

### Cho deploy-engineer (biến môi trường frontend cần)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://wvudgvdrgoiocalthbsi.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable key (`sb_publishable_...` trong request.md)

### Chưa xác thực được (đang chờ frontend hoàn thiện các trang)
- Chưa kiểm được **query thực tế** `.from().select('...')` (tên cột trong chuỗi select, tên quan hệ join), **INSERT set user_id**, **UPDATE set updated_at**, và **routing** (`href`/`router.push` ↔ page thực tế trong `app/`). Các file trang đang được ghi liên tục — sẽ xác thực khi frontend-developer báo trang hoàn thành hoặc file ổn định.

### Trạng thái
- DB: PASS. Frontend foundation (types + client): PASS.

---

## Kết quả QA #3 — 2026-07-09 — Full cross-boundary (7 route + toàn bộ query/insert/update/routing)

Nguồn: toàn bộ `app/**`, `components/**` ↔ `_workspace/01_db-architect_schema-contract.md` + `_workspace/02_frontend-developer_pages-map.md`

### Pass
- **Tên cột trong query khớp snake_case CHÍNH XÁC**:
  - `tasks`: `.select('id, title, status, priority, due_date, project_id, projects(name)')` (app/tasks/page.tsx:43). Edit dùng `select('*')` (tasks/[id]:22).
  - `schedule_events`: `.select('id, title, start_time, end_time, task_id, tasks(title)')` (dashboard:26, schedule:30).
  - Mọi truy cập field đọc snake_case: `due_date`, `project_id`, `start_time`, `end_time`, `task_id`, `updated_at`. KHÔNG có camelCase drift.
- **RLS compliance — INSERT luôn set `user_id`**: task (TaskForm:86), project (TaskForm:61), event (schedule:59) đều `user_id: user.id` → thỏa `with check`. SELECT không `.eq('user_id')` → dựa RLS `to authenticated` (đúng). Auth gate (AuthProvider + RequireAuth) có mặt nên session tồn tại.
- **UPDATE set `updated_at`**: toggleDone (tasks:72) và TaskForm update (:80) đều gửi `updated_at: new Date().toISOString()` — đúng contract (DB chưa có trigger).
- **Tên quan hệ join khớp FK**: `projects(name)` ↔ `project_id→projects`; `tasks(title)` ↔ `task_id→tasks`. Type để to-one object `| null`, khớp runtime embed.
- **Kiểu dữ liệu biên**: `due_date` gửi/nhận `YYYY-MM-DD`; `start_time`/`end_time` gửi ISO qua `new Date(datetimeLocal).toISOString()` (timestamptz).
- **Routing khớp page thực tế**: mọi `href`/`router.push`/`router.replace` trỏ route có page: `/`, `/login`, `/dashboard`, `/tasks`, `/tasks/new`, `/tasks/[id]`, `/schedule`.
- **Enum UI khớp CHECK**: todo/in_progress/done, low/medium/high (TaskForm).
- **Env var nhất quán**: `lib/supabase.ts` dùng `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, khớp pages-map.

### Fail
- (không có lỗi ranh giới)

### Quan sát nhỏ (advisory — KHÔNG chặn, không phải lỗi runtime hiện tại)
- Query list/dashboard/schedule chọn TẬP CON cột nhưng cast `as unknown as TaskWithProject[]` / `as Task[]` về type ĐẦY ĐỦ. Hiện an toàn vì các view đó KHÔNG đọc cột bị bỏ (`description`, `user_id`, `created_at`, `updated_at`) — nhưng type rộng hơn shape thật. Đúng mẫu "generic cast che runtime≠type" QA cảnh báo: nếu sau này đọc field chưa select trên các view này sẽ nhận `undefined` mà TS không báo. Gợi ý (tùy chọn): dùng `Pick<...>` hẹp hoặc select đủ cột. Không cần sửa để chạy đúng hiện tại.

### Kết luận
- **Cross-boundary DB ↔ Frontend: PASS toàn bộ.** RLS đúng, naming/type/enum/FK-join/routing đều khớp. Không có lỗi chặn. Chỉ 1 advisory type-precision không ảnh hưởng runtime.
- Điều kiện chạy thật: (1) người dùng chạy migration `20260709120000_init_schema.sql` trên Supabase SQL Editor; (2) deploy-engineer khai báo `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` ở AWS Amplify.
- Task #3 (QA): HOÀN THÀNH — không còn lỗi pending.
