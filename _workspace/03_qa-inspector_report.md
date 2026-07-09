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

---

## Kết quả QA #4 — 2026-07-09 — Redesign UI (light mode) + trang mới `/reports`

Nguồn: `app/reports/page.tsx`, `components/Charts.tsx`, `components/Nav.tsx` + re-check `app/{login,dashboard,tasks,schedule}/page.tsx` ↔ schema-contract + pages-map (đã cập nhật).
Phương pháp: đọc đồng thời cả hai bên; suy luận lại logic thống kê (không tin đọc 1 lần).

### Pass — trang `/reports` (điểm chính lần này)
- **Tên cột trong query khớp CHÍNH XÁC snake_case**: `.from('tasks').select('id, status, due_date, updated_at, project_id, projects(name)')` (reports:44) — mọi cột tồn tại trong bảng `tasks`, embed FK `projects(name)` khớp quan hệ `project_id→projects`.
- **Type an toàn, KHÔNG `any`**: `ReportTask = Pick<Task, 'id'|'status'|'due_date'|'updated_at'|'project_id'> & { projects: {name:string}|null }` (reports:11-14) — dùng `Pick` HẸP đúng bằng tập cột select (khắc phục đúng advisory type-precision ở QA #3: type khớp shape query, không rộng hơn). Truy cập field đều snake_case (`t.due_date`, `t.project_id`, `t.updated_at`, `t.projects?.name`).
- **Logic tỷ lệ hoàn thành đúng**: `completionRate = round(counts.done / total * 100)`, guard `total>0` tránh chia 0 (reports:59).
- **Logic quá hạn đúng**: `t.status !== 'done' && t.due_date && t.due_date < today` với `today = new Date().toISOString().slice(0,10)` (reports:61-64). So sánh chuỗi `YYYY-MM-DD` lexicographic hợp lệ; task đến hạn hôm nay KHÔNG tính quá hạn (dùng `<` chặt). Khớp định nghĩa pages-map.
- **Logic xu hướng 8 tuần đúng**: `mondayOf` chuẩn hóa về Thứ Hai (local midnight, công thức `(getDay()+6)%7`). Mảng 8 tuần i=0..7 = từ 7 tuần trước đến tuần hiện tại (đủ 8 mốc Thứ Hai). Bucket task done theo `mondayOf(updated_at).getTime() === week.start` — cả hai cùng anchor local-midnight-Monday nên khớp chính xác (VN không DST). Chỉ đếm `status==='done'` (reports:77-82). Đúng.
- **Breakdown theo project đúng**: gộp theo `t.projects?.name ?? 'Chưa phân nhóm'`, đếm TỔNG task/nhóm, sort giảm dần (reports:84-92). Tile "Số nhóm" loại trừ nhóm "Chưa phân nhóm" (reports:109). Khớp pages-map.
- **Props chart khớp chữ ký**: `DonutChart(data:Slice[], centerLabel, centerSub)`, `HBars(data:{label,value}[], color)`, `VBars(data:{label,value}[], color, unit)` — reports truyền đúng kiểu; `stats.weeks` có thừa field `start` nhưng structural-compatible (không lỗi). `Charts.tsx` không dùng `any`, không chạm Supabase (thuần trình bày).

### Pass — routing
- **Nav `/reports` trỏ đúng route thực tế**: `links` trong Nav.tsx:11 có `{href:'/reports'}` ↔ file `app/reports/page.tsx` tồn tại. Các link còn lại `/dashboard`,`/tasks`,`/schedule` đều có page. Logo `href="/dashboard"` hợp lệ. Active-state `pathname.startsWith(l.href+'/')` đúng cho sub-route.

### Pass — các trang redesign khác (xác nhận CHỈ đổi UI, KHÔNG đổi logic query)
- `dashboard`: query `tasks.select('*')` + `schedule_events.select('id,title,start_time,end_time,task_id,tasks(title)').gte('start_time', todayIso).order().limit(5)` — snake_case đúng, embed `tasks(title)` đúng FK. Logic `dueSoon` (chưa done & due_date>=today) và `counts` giữ nguyên.
- `tasks`: query list + `toggleDone` UPDATE gửi kèm `updated_at: new Date().toISOString()` (tasks:73) — đúng contract (DB không có trigger). Delete theo id. Không đổi logic.
- `schedule`: INSERT event set `user_id: user.id` (schedule:59) thỏa RLS `with check`; `task_id: taskId || null`; `start_time/end_time` gửi ISO (`new Date(...).toISOString()`) đúng timestamptz. Validate end>start. Không đổi logic.
- `login`: dùng Supabase Auth (`signInWithPassword`/`signUp`), không chạm bảng dữ liệu — không có ranh giới cột để lệch.

### Verify
- `npx tsc --noEmit`: **PASS** (exit 0) — không lỗi type, không `any` né lỗi.

### Fail
- (không có lỗi ranh giới — không cần chuyển yêu cầu sửa cho frontend-developer)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- `reports:47` còn dùng `data as unknown as ReportTask[]` (double-cast). Chấp nhận được vì Supabase suy luận kiểu embed relation có thể là mảng; type đích `ReportTask` đã HẸP đúng cột select nên rủi ro thấp hơn nhiều so với cast về type đầy đủ. Runtime embed to-one (`project_id→projects`) trả object|null — khớp `{name:string}|null`.
- Breakdown project gộp theo **tên** (không theo `project_id`): 2 project trùng tên sẽ bị gộp. Edge case hiếm, không phải lỗi runtime hiện tại.
- `today` tính theo UTC (`toISOString`) — lệch múi giờ có thể khiến ranh giới "quá hạn/đến hạn hôm nay" lệch 1 ngày ở rìa nửa đêm. Không chặn; nhất quán với cách dashboard tính `today`.

### Kết luận
- **Cross-boundary DB ↔ Frontend cho `/reports` + toàn bộ trang redesign: PASS.** Naming/type/enum/FK-join/routing/RLS-insert/updated_at đều khớp. Redesign chỉ đổi class/JSX — logic query bảo toàn. Không có lỗi chặn.
- Task #7 (QA): HOÀN THÀNH — không còn lỗi pending.
