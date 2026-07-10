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

---

## Kết quả QA #5 — 2026-07-09 — Tính năng "task lặp lại hàng ngày" (`recurrence_group_id`)

Nguồn: `supabase/migrations/20260709160000_add_recurrence_group_id.sql` + `types/database.ts` ↔ `components/TaskForm.tsx` + `app/tasks/page.tsx`, đối chiếu schema-contract L71/77-83.
Phương pháp: đọc đồng thời cả 3 nơi; tự trace logic sinh ngày bằng ví dụ cụ thể (không tin lời agent).

### 1) Tên cột `recurrence_group_id` — khớp CHÍNH XÁC ở cả 3 nơi
- Migration L17-18: `alter table tasks add column recurrence_group_id uuid;` → snake_case, kiểu `uuid`, **nullable** (không `not null`, không default) — đúng "null = task đơn lẻ". Partial index L25-27 `where recurrence_group_id is not null`.
- `types/database.ts:25`: `recurrence_group_id: string | null` — snake_case, `| null` khớp nullable, `uuid`→`string`. Không camelCase drift. `TaskWithProject` kế thừa nên cũng có cột này.
- Ghi/đọc trong code: TaskForm.tsx:199 (`recurrence_group_id: groupId` khi insert), tasks/page.tsx:46 (nằm trong chuỗi `.select(...)`), :58/:76-87 (đọc `task.recurrence_group_id`) — tất cả snake_case, khớp. **KHỚP tuyệt đối, không lệch.**

### 2) Logic sinh danh sách ngày (`computeRecurringDates`, TaskForm.tsx:63-81) — đã tự trace
- **Timezone: không lệch.** `parseYMD` (L47-50) dùng `new Date(y, m-1, d)` = local-midnight; `formatYMD` (L51-56) đọc `getFullYear/getMonth/getDate` = local. Vòng lặp tăng bằng `d.setDate(d.getDate()+1)` (local calendar day). Parse và format cùng hệ local → không có drift UTC. VN không DST nên `setDate` không nhảy/sót ngày.
- **Biên bao gồm 2 đầu (inclusive):** `for (...; d <= endD; ...)` — cả `start` lẫn `end` đều được tính. `endD < startD` → trả `[]` (L72). `!start||!end` → `[]` (L69). Không off-by-one.
- **Thứ tự loại trừ đúng:** skip nếu `excludedWeekdays.has(d.getDay())` (L75) → rồi skip nếu `excludedDates.has(ymd)` (L77) → còn lại push. `getDay()` dùng 0=CN..6=T7, khớp mapping WEEKDAYS (L26-34).
- **Trace ví dụ cụ thể** (tự kiểm, không tin agent): start=`2026-07-09` (T5), end=`2026-07-13` (T2), loại T7(6)+CN(0). Chuỗi ngày: 07-09 T5 giữ · 07-10 T6 giữ · 07-11 **T7 bỏ** · 07-12 **CN bỏ** · 07-13 T2 giữ → **[09,10,13] = 3 task**. Thêm loại trừ ngày cụ thể `2026-07-10` → **[09,13] = 2 task**. Không sót, không thừa. Đúng.
- Preview UI (recurringDates.length, weekdayExclusionParts, excludedDatesInRange) chỉ để hiển thị, dùng CHUNG hàm compute → số "Sẽ tạo N task" = đúng số row sẽ insert.

### 3) Insert hàng loạt — mọi row đều có `user_id` (bắt buộc cho RLS `with check`)
- TaskForm.tsx:194-201: `const rows = recurringDates.map((d) => ({ ...base, due_date: d, user_id: user.id, recurrence_group_id: groupId }))` — `user_id: user.id` nằm TRONG map nên **áp cho TỪNG row**, không phải chỉ row đầu. `base` (L175-181) KHÔNG chứa user_id nên không bị `...base` ghi đè mất. `user` chắc chắn non-null do guard L158 `if (!user) return`. `groupId = crypto.randomUUID()` (L194) — 1 uuid chung cho cả chuỗi. → Thỏa `with check (auth.uid()=user_id)` cho mọi row; không bị RLS chặn cả mảng. Đúng.
- Guard rỗng: nếu `recurringDates.length===0` → throw trước khi insert (L191-193); nút submit cũng disable (L423). Không insert mảng rỗng.

### 4) Logic xóa — điều kiện đúng
- **Xóa riêng 1 ngày:** `deleteOne(id)` (tasks/page.tsx:66-67) → `.delete().eq('id', id)`. Đúng — chỉ 1 row theo PK.
- **Xóa cả chuỗi:** `deleteChain(groupId)` (:76-80) → `.delete().eq('recurrence_group_id', groupId)`. Đúng tên cột, đúng điều kiện — KHÔNG nhầm sang `id`, KHÔNG thiếu điều kiện (không xóa trắng bảng). Khớp gợi ý schema-contract L82.
- **Định tuyến xóa đúng:** `requestDelete` (:57-64) — có `recurrence_group_id` → mở modal hỏi 1-ngày/cả-chuỗi; null → `confirm` + `deleteOne`. Modal: "Xóa chỉ ngày này"→`deleteOne(deleteTarget.id)` (:229), "Xóa cả chuỗi"→`deleteChain(deleteTarget.recurrence_group_id!)` (:235). Non-null assertion `!` an toàn vì modal chỉ render khi `deleteTarget.recurrence_group_id` truthy (:210). RLS tự giới hạn theo user nên không xóa nhầm chuỗi user khác (uuid ngẫu nhiên, không đụng độ).

### Verify
- `npx tsc --noEmit`: **PASS** (exit 0) — không lỗi type, không `any` che lỗi.

### Fail
- (không có lỗi ranh giới)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- Chế độ lặp chỉ khả dụng khi TẠO MỚI (`!isEdit`, TaskForm:275). Khi EDIT một task thuộc chuỗi, form KHÔNG hiển thị/không đụng `recurrence_group_id` và update chỉ `.eq('id', task.id)` (L184-188) → sửa 1 ngày không ảnh hưởng chuỗi. Đúng thiết kế "mỗi ngày là 1 row độc lập"; nêu để rõ phạm vi.
- `tasks/page.tsx:46` cast `as unknown as TaskWithProject[]` (giống advisory QA #3). Query có chọn `recurrence_group_id` nên các nhánh xóa chuỗi đọc được giá trị thật — không undefined. An toàn cho luồng hiện tại.
- Điều kiện chạy thật: người dùng PHẢI chạy migration `20260709160000_add_recurrence_group_id.sql` trên Supabase SQL Editor trước, nếu không cột chưa tồn tại → cả `.select(...recurrence_group_id...)` lẫn insert sẽ lỗi. Đã ghi rõ trong schema-contract L18.

### Kết luận
- **Cross-boundary cho tính năng task lặp lại: PASS toàn bộ.** Tên cột `recurrence_group_id` khớp 3 nơi (migration/type/code); logic sinh ngày đúng (inclusive, loại trừ thứ+ngày, không lệch timezone — đã trace); insert set `user_id` cho mọi row (thỏa RLS); xóa 1-ngày dùng `id`, xóa-chuỗi dùng `recurrence_group_id`. Không có lỗi chặn.
- Task #10 (QA): HOÀN THÀNH — không còn lỗi pending.

---

## Kết quả QA #6 — 2026-07-09 — Rebuild `/dashboard` (8 khối) + 3 bảng mới + 2 cột mới trên schedule_events

Nguồn: `supabase/migrations/20260709170000_add_notes_goals_freelance.sql` + `types/database.ts` ↔ `app/dashboard/page.tsx`, đối chiếu schema-contract L89-159 + pages-map L58-64.
Phương pháp: đọc đồng thời migration ↔ type ↔ query; tự trace logic ngày/tuần bằng ví dụ cụ thể.
Phạm vi: grep xác nhận chỉ `app/dashboard/page.tsx` + `types/database.ts` chạm 3 bảng mới → toàn bộ ranh giới nằm gọn trong dashboard.

### 1) Tên cột 3 bảng mới + 2 cột mới — khớp CHÍNH XÁC (migration ↔ type ↔ query)
- **notes** (migration L15-21): id, user_id, content, color, created_at ↔ `Note` (database.ts:57-63) đủ 5 cột, `color: string | null` khớp nullable ↔ query `.from('notes').select('*')`. KHỚP.
- **goals** (L26-35): id, user_id, title, period, progress_percent, target_date, created_at, updated_at ↔ `Goal` (database.ts:67-76) đủ 8 cột; `progress_percent: number` (int), `target_date: string | null` khớp; `GoalPeriod='week'|'month'` khớp CHECK `period in ('week','month')`. KHỚP.
- **freelance_projects** (L40-49): id, user_id, client_name, project_name, revenue, status, created_at, updated_at ↔ `FreelanceProject` (database.ts:80-89) đủ 8 cột; `revenue: string` (numeric→string, ĐÚNG); `FreelanceStatus='in_progress'|'almost_done'|'done'` khớp CHECK. KHỚP.
- **schedule_events +2 cột** (L56-58): `completed boolean not null default false`, `project_id uuid references projects(id) on delete set null` ↔ `ScheduleEvent` (database.ts:40-42) `completed: boolean`, `project_id: string | null`; `ScheduleEventWithProject` thêm `projects: {name}|null`. Query dashboard select đúng: `id, title, start_time, end_time, completed, project_id, projects(name)`. KHỚP.
- Enum UI khớp CHECK ở cả nhãn/style: `FREELANCE_LABEL`/`FREELANCE_STYLE` (page:43-52) đủ 3 key; goals slider min0/max100 + `updateGoalPercent` clamp 0..100 (page:172) khớp CHECK `between 0 and 100`.

### 2) `revenue` numeric→string luôn qua `Number()` — không cộng/so sánh string
- Grep toàn repo: chỉ dashboard + types dùng `revenue`. MỌI điểm dùng đều `Number()`:
  - Hiển thị: `formatRevenue(revenue) = Number(revenue).toLocaleString('vi-VN')+'đ'` (page:97-99), gọi ở page:468.
  - Modal khởi tạo: `String(Number(initial.revenue))` (page:767).
  - Payload lưu: `revenue: Number(revenue) || 0` (page:780).
- KHÔNG có phép cộng/so sánh `revenue` dạng string ở đâu (không có tổng doanh thu). Stat "freelance đang chạy" lọc theo `status`, không đụng revenue. PASS.

### 3) Mọi INSERT set `user_id` (RLS `with check`)
- `addGoal` insert `{ ..., user_id: user.id }` (page:186-192), guard `if (!user) return` (:185). ✓
- `addNote` insert `{ ..., user_id: user.id }` (page:224-228), guard `if (!user) return` (:223). ✓
- `FreelanceModal` INSERT `insert({ ...payload, user_id: userId })` (page:788), guard `if (!userId) return` (:774); `userId` truyền từ `user?.id ?? ''` (:618) — chuỗi rỗng → return sớm, không insert mồ côi. ✓
- schedule_events: dashboard KHÔNG insert event (chỉ UPDATE `completed`) → không có INSERT thiếu user_id. Toggle `.update({ completed }).eq('id')` KHÔNG set `updated_at` — ĐÚNG vì `schedule_events` không có cột `updated_at` (schema L93-103). ✓
- UPDATE goals (`updated_at` có) + freelance (`updated_at` có) đều gửi `updated_at: new Date().toISOString()` (page:176, 786) — đúng contract (chưa có trigger DB). UPDATE không cần set lại user_id (RLS `using` kiểm row cũ). PASS.

### 4) Logic "Theo dõi thói quen" — đã tự trace
- **Khoảng tuần T2→CN local:** `weekDays(base)` (page:78-89) — `offsetToMonday = day===0 ? -6 : 1-day`. Trace: CN(0)→-6 (về T2 tuần chứa CN đó, CN là cuối tuần); T2(1)→0; T5(4)→-3. `setHours(0,0,0,0)` + 7 ngày. Dùng giờ ĐỊA PHƯƠNG (getFullYear/getMonth/getDate qua `toYmd`), không UTC → không lệch múi giờ. VN không DST.
- **Lọc tuần:** `habitTasks` = `recurrence_group_id` truthy && `due_date` trong `[weekYmds[0], weekYmds[6]]` (page:270-276). So sánh chuỗi `YYYY-MM-DD` lexicographic = đúng thứ tự thời gian (cùng format). ✓
- **Group theo `recurrence_group_id`:** map key = `recurrence_group_id!`, `byDate` key = `due_date!` (page:277-282). ✓
- **Điều kiện tick xanh:** `done = group.byDate.get(ymd)?.status === 'done'` (page:563) — chỉ xanh khi có task đúng ngày ĐÓ **và** `status==='done'`; ô không có task hoặc chưa done → xám. ✓
- **Trace ví dụ:** thói quen G, rows: T2 07-06 `done` · T3 07-07 `todo` · T4 07-08 `done`; tuần 07-06→07-12. Grid: T2 xanh · T3 xám · T4 xanh · T5-CN xám. Đúng, không lệch cột ngày.

### 5) "Lịch trình hôm nay" — lọc ngày + join đúng quan hệ
- **Lọc trong ngày hôm nay (không lệch múi giờ):** `todayStart`=local 00:00:00.000, `todayEnd`=local 23:59:59.999 (page:116-119); query `.gte('start_time', todayStart.toISOString()).lte('start_time', todayEnd.toISOString())` (page:136-137). `start_time` là `timestamptz` (mốc tuyệt đối); so sánh trên mốc tuyệt đối với biên local-đổi-sang-UTC là ĐÚNG cách — sự kiện lúc 08:00 địa phương hôm nay nằm đúng trong khoảng. Không lệch múi giờ. Hiển thị giờ qua `toLocaleTimeString('vi-VN')` (page:363) → đổi về local. ✓
- **Join `projects(name)` qua `project_id` mới:** `schedule_events` chỉ có DUY NHẤT 1 FK tới `projects` (`project_id`) → embed `projects(name)` KHÔNG mơ hồ (task_id trỏ tới `tasks`, khác bảng). "Nguồn" = `ev.projects?.name ?? 'Cá nhân'` (page:377). ✓

### 6) Stat card đầu trang — công thức đúng
- **Task hôm nay x/y:** `todayTasks` = `due_date === toYmd(now)` (local) (page:120,248); `todayDone` = trong đó `status==='done'` (page:249); hiển thị `${todayDone}/${todayTasks.length}` (page:311). ✓
- **Freelance đang chạy:** `freelance.filter(f => f.status !== 'done').length` (page:250) = in_progress + almost_done. Khớp pages-map. ✓
- **% mục tiêu TB:** `activeGoals` = `progress_percent < 100` (page:251); `avgGoal` = round(TB progress_percent), guard length===0→0 (page:252-255). Khớp định nghĩa "active" pages-map L62. ✓

### Verify
- `npx tsc --noEmit`: **PASS** (exit 0) — không lỗi type, không `any` che lỗi (cast `as unknown as` chỉ ở tasks/events, xem advisory).

### Fail
- (không có lỗi ranh giới — không cần chuyển yêu cầu sửa cho frontend-developer)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- `setTasks(taskRes.data as unknown as TaskWithProject[])` (page:143) và `setEvents(... as unknown as ScheduleEventWithProject[])` (page:144): query chọn TẬP CON cột nhưng cast về type ĐẦY ĐỦ. An toàn hiện tại vì dashboard KHÔNG đọc cột chưa select (`description`, `user_id`, `task_id`, `created_at`, `updated_at`). Cùng mẫu advisory QA #3/#5. `freelance/goals/notes` dùng `select('*')` + single cast → sạch hơn.
- Điều kiện chạy thật: người dùng PHẢI chạy migration `20260709170000` trên Supabase SQL Editor trước, nếu không 3 bảng + 2 cột chưa tồn tại → mọi query dashboard lỗi. Đã ghi rõ schema-contract L20.
- "Lịch trình hôm nay" lọc theo `start_time` trong ngày → sự kiện bắt đầu hôm qua kéo sang hôm nay KHÔNG hiện. Đúng theo spec ("lịch trình hôm nay" = bắt đầu hôm nay), không phải lỗi.

### Kết luận
- **Cross-boundary DB ↔ Frontend cho rebuild `/dashboard` + 3 bảng mới + 2 cột schedule_events: PASS toàn bộ.** Tên cột khớp CHÍNH XÁC 3 nơi (migration/type/query); `revenue` numeric→string luôn qua `Number()`; mọi INSERT set `user_id` (thỏa RLS); logic tuần thói quen + lọc ngày lịch trình + stat card đều đúng, không lệch múi giờ (đã trace). Không có lỗi chặn.
- Task #13 (QA): HOÀN THÀNH — không còn lỗi pending.

---

## Kết quả QA #7 — 2026-07-10 — Redesign `/tasks`: nhóm theo project + progress bar độc lập bộ lọc (Task #15)

Nguồn: `app/tasks/page.tsx` ↔ `_workspace/02_frontend-developer_pages-map.md` L27 (đã cập nhật).
Phương pháp: đọc trực tiếp code grouping/sort/render; tự trace ví dụ số cụ thể (không tin lời agent). Đây là refactor UI thuần client — KHÔNG đổi schema/query/RLS nên trọng tâm là logic tính toán + bảo toàn tính năng cũ.

### 1) Progress bar % tính trên TOÀN BỘ task nhóm — KHÔNG bị bộ lọc ảnh hưởng — PASS
- Grouping (`useMemo`, L112-140): mỗi task được push vào `g.all` theo `project_id ?? NONE_KEY` **không lọc gì** (L117-130). Trường `visible` (L134) là bản sao ĐÃ lọc status (`filter==='all' ? g.all : g.all.filter(status===filter)`), TÁCH BIỆT với `g.all`.
- Render progress (L187-189): `total = group.all.length`, `done = group.all.filter(status==='done').length`, `percent = round(done/total*100)`. Dùng `group.all` → độc lập hoàn toàn với `filter`. Danh sách hiển thị (L221) mới dùng `group.visible`.
- **Trace ví dụ (tự kiểm):** project X có 5 task, 2 `done` + 3 `todo`, đang chọn filter=`todo` ("Cần làm"):
  - `group.all` = 5 → total=5, done=2 → percent = round(2/5*100) = **40%**. Header hiện "2/5 hoàn thành" (L199), bar rộng 40% (L206), nhãn "40%" (L210). ✓
  - `group.visible` = 3 task todo → danh sách chỉ hiện 3 dòng todo. ✓
  - Đổi filter sang `done`: `group.all` KHÔNG đổi → percent VẪN 40%; `visible`=2 dòng done. Progress bất biến qua mọi filter. **Đúng yêu cầu.**
- `total` luôn ≥ 1 (group chỉ tồn tại khi có ≥1 task push vào `all`) → guard `total ? ... : 0` (L189) không bao giờ chia 0; nhánh 0 là dead-safe.

### 2) Sắp xếp nhóm A-Z + "Chưa phân nhóm" LUÔN cuối — PASS (kể cả tên đặc biệt)
- Comparator (L136-139):
  ```
  if (a.isNone !== b.isNone) return a.isNone ? 1 : -1   // isNone luôn xuống cuối
  return a.name.localeCompare(b.name, 'vi')              // còn lại A-Z (locale vi)
  ```
- **Điểm mấu chốt:** kiểm `isNone` xảy ra TRƯỚC `localeCompare`, nên nhóm null (`isNone=true`, tên literal "Chưa phân nhóm") luôn bị đẩy cuối **bất kể tên**. Dù project khác có tên bắt đầu bằng ký tự sau 'Z' (vd "Zzz", "Über", số, emoji, ký tự đặc biệt), chúng vẫn xếp trên "Chưa phân nhóm" vì so sánh tên chỉ chạy giữa các nhóm THỰC (cùng `isNone=false`). ✓
- Lưu ý đã kiểm: tên literal "Chưa phân nhóm" bắt đầu bằng 'C' — nếu sort thuần theo tên nó sẽ lọt giữa các project chữ C, KHÔNG xuống cuối. Nhánh `isNone` chặn đúng lỗi tiềm ẩn này. Chỉ có 1 nhóm null (key `__none__` duy nhất) nên không có trường hợp 2 nhóm cùng `isNone=true`. ✓
- `localeCompare(..., 'vi')` cho thứ tự A-Z tiếng Việt đúng cho các project thực.

### 3) Tính năng cũ sau refactor — CÒN ĐỦ, không mất — PASS
- **checkbox toggleDone (optimistic):** L89-103 (optimistic set ở L92-94, UPDATE gửi kèm `updated_at` L97 đúng contract, rollback bằng `load()` khi lỗi L101); wired ở L226-232. ✓
- **requestDelete/deleteOne/deleteChain:** L57-87 nguyên vẹn; `requestDelete` wired ở nút Xóa L271; `deleteOne` dùng `.eq('id', id)` (L67), `deleteChain` dùng `.eq('recurrence_group_id', groupId)` (L78-80) — đúng cột, đúng điều kiện. ✓
- **modal xóa chuỗi lặp:** L286-331, chỉ render khi `deleteTarget?.recurrence_group_id` truthy; 2 nút "Xóa chỉ ngày này"→`deleteOne` (L305), "Xóa cả chuỗi (N task)"→`deleteChain(deleteTarget.recurrence_group_id!)` (L311); non-null `!` an toàn do điều kiện render (L286). ✓
- **badge 🔁 Lặp:** L249-256, hiện khi `task.recurrence_group_id` truthy. ✓
- Query list (L44-47) giữ nguyên `select('id, title, status, priority, due_date, project_id, recurrence_group_id, projects(name)')` — snake_case đúng, embed FK `projects(name)` đúng quan hệ. KHÔNG đổi ranh giới DB.

### 4) Nhóm rỗng sau lọc vẫn hiện header + progress + thông báo — PASS
- Trong `<section>` (L191-280): khối header (tên nhóm + "done/total hoàn thành") + progress bar (L192-213) render **vô điều kiện**, ĐỨNG NGOÀI nhánh kiểm `visible.length`.
- L215-219: `group.visible.length === 0` → render `<p>Không có việc nào khớp bộ lọc</p>` thay cho `<ul>`. Vì group chỉ tồn tại khi `all` không rỗng, việc `visible` rỗng chỉ xảy ra khi bị lọc → nhóm KHÔNG bị ẩn, vẫn thấy header + % thật + thông báo. ✓
- Chỉ khi `tasks.length === 0` toàn cục (L177) mới hiện empty-state "Chưa có công việc nào" thay cho danh sách nhóm — đúng, không mâu thuẫn.

### Verify
- `npx tsc --noEmit`: **PASS** (exit 0) — không lỗi type, không `any` che lỗi.

### Fail
- (không có lỗi ranh giới, không lỗi logic — không cần chuyển yêu cầu sửa cho frontend-developer)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- L49 vẫn cast `as unknown as TaskWithProject[]` (cùng mẫu advisory QA #3/#5/#6). Query đã select đủ các cột code đọc (bao gồm `recurrence_group_id`) nên các nhánh grouping/xóa/badge đọc được giá trị thật, không `undefined`. An toàn cho luồng hiện tại.
- Grouping gộp theo `project_id` (key ổn định), tên nhóm lấy từ `t.projects?.name` của task ĐẦU TIÊN gặp trong danh sách của project đó (L123). Vì mọi task cùng `project_id` có cùng `projects.name` (join 1-1 theo FK) nên không có rủi ro lệch tên trong 1 nhóm. Khác với breakdown ở `/reports` gộp theo TÊN (advisory QA #4) — trang này gộp theo ID nên an toàn hơn, 2 project trùng tên vẫn tách nhóm đúng.
- Giới hạn môi trường agent: nội dung sau `RequireAuth` cần đăng nhập Supabase nên không drive được end-to-end; đã xác thực qua đọc code + trace số + tsc. Nếu cần chắc chắn tuyệt đối lúc runtime, đề xuất kiểm thủ công sau đăng nhập: (1) tạo 1 project ≥3 task có done lẫn todo, bấm qua lại các filter → % phải bất biến; (2) tạo project tên "Zzz"/ký tự đặc biệt → vẫn đứng trên "Chưa phân nhóm".

### Kết luận
- **Redesign `/tasks` (nhóm theo project + progress bar độc lập bộ lọc): PASS toàn bộ.** (1) Progress % dùng `group.all` → bất biến qua filter (đã trace 2/5=40%); (2) sort A-Z + `isNone` đẩy "Chưa phân nhóm" xuống cuối bất kể tên/ký tự đặc biệt; (3) toggleDone optimistic + requestDelete/deleteOne/deleteChain + modal chuỗi + badge 🔁 còn đủ; (4) nhóm rỗng sau lọc vẫn hiện header+progress+"Không có việc nào khớp bộ lọc". Không đổi schema/query nên ranh giới DB↔Frontend giữ nguyên PASS. Không có lỗi chặn.
- Task #15 (QA): HOÀN THÀNH — không còn lỗi pending.

---

## Kết quả QA #8 — 2026-07-10 — Subtask (task con 1 cấp) + Timeline view + `start_date` (Task #18)

Nguồn: `supabase/migrations/20260710120000_add_parent_task_and_start_date.sql` + `types/database.ts` ↔ `app/tasks/[id]/page.tsx`, `app/tasks/page.tsx`, `app/dashboard/page.tsx`, `app/timeline/page.tsx`, `components/TaskForm.tsx`. Đối chiếu schema-contract L11/76-77/83-90 + pages-map L29-30/50-52.
Phương pháp: đọc đồng thời migration ↔ type ↔ query; grep toàn repo tìm mọi nơi chạm `parent_task_id`/`start_date`; tự trace logic Timeline bằng ví dụ số cụ thể.

### 1) Tên cột `parent_task_id` / `start_date` — khớp CHÍNH XÁC mọi nơi — PASS
- Migration L21-23: `add column parent_task_id uuid references tasks(id) on delete cascade, add column start_date date;` — snake_case, `parent_task_id` self-reference CASCADE, cả hai **nullable** (không NOT NULL/default) → khớp "null = task gốc / chưa đặt". Partial index L30-32 `where parent_task_id is not null`.
- `types/database.ts:26-27`: `parent_task_id: string | null`, `start_date: string | null` — snake_case, `| null` khớp nullable, `uuid`/`date`→`string`. Không camelCase drift. `TaskWithProject` kế thừa.
- Grep toàn repo (`.ts/.tsx`): mọi tham chiếu đều snake_case — tasks/[id]:29/77/197, tasks/page:55/60-61/66-70, dashboard:137/140/153-157, timeline:75/99, TaskForm:93/201/226. KHÔNG có `parentTaskId`/`startDate` (camelCase) lẫn lộn với cột DB. `TaskForm` cố tình đặt state `taskStartDate` (L93) tách biệt với `startDate` của khoảng lặp (L99) — không đụng nhau, không nhầm. **KHỚP tuyệt đối.**

### 2) Subtask ẩn khỏi /tasks + dashboard "Công việc" — không sót — PASS
- `/tasks` query chính (tasks/page.tsx:55): `.is('parent_task_id', null)` ✓
- `/dashboard` query chính (dashboard:137): `.is('parent_task_id', null)` ✓
- Query đếm subtask ở CẢ hai nơi dùng `.not('parent_task_id', 'is', null)` (tasks/page:61, dashboard:140) — đúng nghịch đảo, chỉ lấy subtask để đếm.
- **Advisory (không chặn, ngoài phạm vi Task #18 nhưng nêu để nhất quán ranh giới):** `/reports` (reports:43-44) và `/schedule` dropdown (schedule:32) query `tasks` **KHÔNG** lọc `parent_task_id`. Hệ quả: subtask ĐƯỢC tính vào thống kê `/reports` (tổng task, tỷ lệ hoàn thành, phân bố status, breakdown project, xu hướng 8 tuần) và xuất hiện trong dropdown liên kết sự kiện ở `/schedule`. Đây là quyết định sản phẩm (subtask có nên tính là "task" trong report không?), không phải lỗi runtime — nhưng là điểm KHÔNG NHẤT QUÁN với việc ẩn subtask ở /tasks & dashboard. Gợi ý frontend-developer cân nhắc thêm `.is('parent_task_id', null)` vào reports (và có thể schedule) nếu muốn subtask không tính vào số liệu. Lưu ý: overdue trong report sẽ KHÔNG bị subtask ảnh hưởng vì subtask không có `due_date` (xem mục 6), nhưng `total`/`completionRate`/breakdown thì CÓ.

### 3) SubtaskSection CHỈ hiện khi task gốc (`parent_task_id === null`) — PASS
- tasks/[id]:197: `{task.parent_task_id === null && <SubtaskSection parent={task} />}` — so sánh chặt `=== null`.
- `task` lấy qua `.select('*')` (tasks/[id]:168) → row ĐẦY ĐỦ, `parent_task_id` là giá trị THẬT (null cho task gốc, uuid cho subtask) chứ không phải cột bị bỏ khỏi select. Khi mở 1 subtask, `parent_task_id` là uuid → `=== null` false → khu Việc con ẩn → subtask KHÔNG thể có subtask con. UI enforce đúng 1 cấp (DB không CHECK, khớp contract L86).
- Bổ sung: KHÔNG có đường dẫn UI nào để mở 1 subtask trong TaskForm (danh sách subtask trong SubtaskSection chỉ có checkbox + Xóa, không link Sửa; /tasks & dashboard đã ẩn subtask). Nên subtask không bao giờ được gán `due_date`/`start_date` qua form.

### 4) Insert subtask — set đúng user_id + parent_task_id + kế thừa project_id cha — PASS
- tasks/[id]:71-78: `.insert({ title, status:'todo', priority:'medium', project_id: parent.project_id, user_id: user.id, parent_task_id: parent.id })`.
  - `user_id: user.id` → thỏa RLS `with check (auth.uid()=user_id)`. Guard L66 `if (!title || !user) return` → `user` non-null. ✓
  - `parent_task_id: parent.id` → trỏ đúng task cha. ✓
  - `project_id: parent.project_id` → kế thừa từ cha; `parent` là row `select('*')` nên `project_id` là giá trị thật (null nếu cha chưa phân nhóm → subtask cũng null, đúng). ✓
  - `status='todo'`, `priority='medium'` khớp CHECK enum. ✓

### 5) Badge đếm subtask (x/y) — nhất quán giữa các nơi — PASS
- Logic gộp GIỐNG HỆT ở /tasks (tasks/page:66-71) và dashboard (dashboard:153-158): duyệt rows subtask, `c.total += 1`, `if status==='done' c.done += 1`, key = `parent_task_id`. Cùng nguồn query (`.select('parent_task_id, status').not('parent_task_id','is',null)`), cùng thuật toán → số x/y bằng nhau ở 2 nơi cho cùng 1 task cha.
- Hiển thị: /tasks (L280-287) `☑ {done}/{total} việc con`; dashboard (L474-481) `☑ {done}/{total}`; nơi thứ 3 là chính trang chi tiết SubtaskSection (L90/96-99) `done = subtasks.filter(status==='done')`, `{done}/{subtasks.length}` — đếm cùng cách trên chính danh sách subtask đang tải. Cả 3 nhất quán.

### 6) Logic vẽ thanh Timeline — đã tự trace — PASS
- **Loại task không có due_date đúng:** query `.not('due_date', 'is', null)` (timeline:76). Task không có `due_date` bị loại. Vì subtask (tạo qua quick-add) KHÔNG bao giờ có `due_date` (insert bỏ qua due_date) → subtask tự động vắng mặt khỏi Timeline, không cần lọc `parent_task_id` riêng. ✓
- **So sánh chuỗi YYYY-MM-DD, không convert qua Date (không lệch timezone):** placement L97-124 dùng so sánh chuỗi trực tiếp (`end < monthStartYmd`, `start > monthEndYmd`, `start < monthStartYmd`, `end > monthEndYmd`). `monthStartYmd`/`monthEndYmd`/`todayYmd` sinh bằng `toYmd()` (L33-38, dùng getFullYear/getMonth/getDate = LOCAL). `due_date`/`start_date` là chuỗi thô từ DB, KHÔNG round-trip qua `new Date()` trước khi so sánh. → không có drift UTC. VN không DST. ✓
- **Task chỉ có due_date → thanh 1 ngày:** L99 `const start = t.start_date && t.start_date <= end ? t.start_date : end`. `start_date` null → `start = end` → `startDay === endDay` → `gridColumn: n / n+1` → đúng 1 cột. ✓
- **start_date > due_date (dữ liệu lỗi) → fallback 1 ngày:** điều kiện `t.start_date <= end` false → `start = end`. Graceful, không vẽ thanh ngược. ✓
- **Span nhiều ngày:** startDay=5,endDay=10 → `gridColumn: 5 / 11` → phủ cột 5-10 (6 ngày inclusive). Đúng. `dayOfMonth(ymd)=Number(ymd.slice(8,10))`. ✓
- **Cắt biên tháng (clamp):** thanh trải qua biên → `clampedStart=max(start,monthStart)`, `clampedEnd=min(end,monthEnd)`; `continuesLeft=start<monthStartYmd` (bo góc phẳng trái `rounded-l-none`), `continuesRight=end>monthEndYmd` (phẳng phải). Grid header ngày và grid hàng task cùng `gridTemplateColumns` + cùng offset `LABEL_W` → cột thẳng hàng. ✓
- **Trace ví dụ (xem Tháng 7/2026, 31 ngày):** Task A start=`2026-06-28` due=`2026-07-03`: end(07-03) ≥ monthStart(07-01) và start(06-28) ≤ monthEnd(07-31) → giữ; clampedStart=07-01→day1, clampedEnd=07-03→day3, continuesLeft=true. gridColumn `1/4` (cột 1-3), bo trái phẳng. Đúng. Task B due=`2026-07-15` không start_date → start=end=07-15 → gridColumn `15/16`, thanh 1 ngày. Task C due=`2026-08-02` → end(08-02) < monthStart(07-01)? Không; start(08-02) > monthEnd(07-31)? Có → `continue`, bị loại khỏi tháng 7. Đúng.
- **Điều hướng tháng + Hôm nay + click thanh:** prevMonth/nextMonth/goToday (L135-148) dùng `new Date(year, month±1, 1)` (day=1 an toàn, không tràn ngày). Click thanh → `href={`/tasks/${p.task.id}`}` → route `/tasks/[id]` tồn tại. ✓ Legend màu + nhãn tiêu đề cột trái (không nhận diện chỉ bằng màu) — thoả dataviz.

### 7) TaskForm `start_date` — đúng nhánh, không set khi lặp — PASS
- Edit (L196-204): update gửi `start_date: taskStartDate || null` ✓. Create thường (L221-229): insert `start_date: taskStartDate || null` ✓.
- Create lặp (L206-218): `rows` spread `...base` (base L187-193 KHÔNG chứa start_date) + `due_date`+`user_id`+`recurrence_group_id` → KHÔNG có `start_date` → default null ở DB. Đúng spec "chuỗi lặp KHÔNG set start_date". ✓
- Field UI "Ngày bắt đầu" (L311-320) nằm trong nhánh `!recurring`. Toggle "Lặp lại" chỉ render khi `!isEdit` (L297) → ở chế độ SỬA `recurring` luôn false → field start_date luôn hiện. Ở TẠO thường hiện, TẠO lặp ẩn. Khớp pages-map L43. ✓

### Verify
- `npx tsc --noEmit`: **PASS** (exit 0) — không lỗi type, không `any` che lỗi (dùng `as unknown as TaskWithProject[]` + type hẹp `{ parent_task_id: string; status: TaskStatus }[]` cho query đếm — cùng mẫu advisory các QA trước).

### Fail
- (không có lỗi ranh giới chặn — không cần chuyển yêu cầu sửa gấp cho frontend-developer)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- **`/reports` + `/schedule` không lọc subtask** (đã nêu mục 2): điểm không nhất quán, tùy quyết định sản phẩm. Nếu muốn subtask không tính vào số liệu report, thêm `.is('parent_task_id', null)` ở reports:43. Không phải lỗi runtime.
- **Query đếm subtask không `.limit()`**: Supabase mặc định trả tối đa 1000 row; nếu tổng subtask toàn user > 1000 thì badge lệch. Edge case rất hiếm ở quy mô app cá nhân; cùng giới hạn với query list chính (không mới). Bỏ qua.
- `setTasks(... as unknown as TaskWithProject[])` (tasks/page:64, dashboard:151, timeline:79): query chọn TẬP CON cột nhưng cast type đầy đủ — an toàn hiện tại vì các view không đọc cột chưa select. Cùng mẫu advisory QA #3/#5/#6/#7.
- **Điều kiện chạy thật:** người dùng PHẢI chạy migration `20260710120000_add_parent_task_and_start_date.sql` trên Supabase SQL Editor. Nếu chưa: cột `parent_task_id`/`start_date` chưa tồn tại → `.is('parent_task_id', null)`, `.select('...start_date...')`, và insert subtask sẽ lỗi "column does not exist". Đã ghi rõ schema-contract L22.
- Giới hạn môi trường agent: nội dung sau `RequireAuth` cần đăng nhập Supabase nên không drive end-to-end; xác thực qua đọc code + trace số + tsc. Kiểm thủ công sau đăng nhập (đã chạy migration): (1) mở task gốc → thấy khu Việc con, thêm/tick/xóa subtask hoạt động + optimistic; (2) subtask KHÔNG hiện ở /tasks & dashboard, badge ☑ x/y đúng; (3) mở 1 subtask (nếu có link) → KHÔNG có khu Việc con; (4) /timeline: task span đúng start→due, cắt biên tháng, 1 ngày khi chỉ có due_date, task không due_date vắng mặt, chuyển tháng + click thanh → /tasks/{id}.

### Kết luận
- **Cross-boundary cho Subtask + Timeline + `start_date`: PASS toàn bộ.** Tên cột khớp CHÍNH XÁC 3 nơi (migration/type/code); subtask ẩn đúng khỏi /tasks & dashboard (không sót); SubtaskSection chỉ hiện với task gốc (1 cấp UI enforce); insert subtask set đủ user_id + parent_task_id + kế thừa project_id; badge x/y nhất quán 3 nơi; logic Timeline đúng (so sánh chuỗi YYYY-MM-DD không lệch timezone, 1 ngày/nhiều ngày/clamp biên/loại task không due_date — đã trace). Không có lỗi chặn. 1 advisory không nhất quán: /reports & /schedule chưa lọc subtask (product decision).
- Task #18 (QA): HOÀN THÀNH — không còn lỗi pending.

---

## Kết quả QA #9 — 2026-07-10 — Phân loại chuỗi lặp "Công việc"/"Thói quen" (cột `category`) (Task #21)

Nguồn: `supabase/migrations/20260710130000_add_task_category.sql` + `types/database.ts` ↔ `components/TaskForm.tsx`, `app/tasks/page.tsx`, `app/dashboard/page.tsx`. Đối chiếu schema-contract L12/24/26/80/103-107 + pages-map (đã cập nhật).
Phương pháp: đọc đồng thời migration ↔ type ↔ 3 nơi code; grep toàn repo tìm mọi nơi chạm `category`; tự trace luồng insert chuỗi + lọc lưới thói quen bằng ví dụ cụ thể.

### 1) Cột `category` khớp CHÍNH XÁC mọi nơi — PASS
- Migration L20-22: `add column category text not null default 'work' check (category in ('habit','work'))` — snake_case, `text`, **NOT NULL**, default `'work'`, CHECK enum đúng 2 giá trị.
- `types/database.ts:6`: `TaskCategory = 'habit' | 'work'` khớp CHECK; `:29` `category: TaskCategory` (KHÔNG `| null` — đúng vì NOT NULL). `TaskWithProject` kế thừa. Không camelCase drift.
- Grep toàn repo (`.ts/.tsx/.sql/.md`): chỉ 6 file chạm `category` (migration, type, TaskForm, tasks/page, dashboard, pages-map) — không nơi nào dùng `categoryType`/camelCase. Query select ở tasks/page:53 và dashboard:135 đều liệt kê đúng chuỗi `...recurrence_group_id, category, projects(name)` (snake_case). **KHỚP tuyệt đối.**

### 2) Tạo chuỗi lặp — MỌI row nhận đúng `category` người dùng chọn — PASS
- TaskForm state: `recurringCategory` khởi tạo `'work'`, typed `TaskCategory` (L100); nút chọn "Công việc"→`'work'` / "Thói quen"→`'habit'` (L339-342) gọi `setRecurringCategory(opt.value)` — chỉ gán 2 giá trị hợp lệ CHECK.
- Insert chuỗi (L214-220): `rows = recurringDates.map((d) => ({ ...base, due_date: d, user_id: user.id, recurrence_group_id: groupId, category: recurringCategory }))`. `category: recurringCategory` nằm TRONG map → áp cho TỪNG row, không phải chỉ row đầu. `base` (L189-195) KHÔNG chứa `category` nên `...base` không ghi đè mất. → Toàn bộ chuỗi đồng nhất 1 category. Không row nào thiếu/sai.
- **Trace:** chọn "Thói quen" + khoảng 3 ngày hợp lệ → 3 row đều `category='habit'`, cùng `recurrence_group_id`. Chọn "Công việc" → 3 row đều `category='work'`. Đúng.

### 3) Task thường (không lặp) + chế độ SỬA — KHÔNG gửi `category` sai lệch — PASS
- Non-recurring create (L224-232): insert `{ ...base, due_date, start_date, user_id }` — KHÔNG có `category` → DB tự nhận default `'work'`. Đúng (task thường mặc định "work", không có badge lặp nên category không hiển thị).
- Edit (L197-207): update `{ ...base, due_date, start_date, updated_at }` — KHÔNG có `category` → UPDATE không đụng cột `category` → **giữ nguyên giá trị cũ** trong DB. Đúng, không ghi đè. `base` (dùng chung cả 3 nhánh) không chứa `category` nên không rò rỉ sang edit/non-recurring.
- Toggle done ở /tasks (L118-121) và dashboard (L192-195): update chỉ `{ status, updated_at }` — không đụng `category`. Giữ nguyên. ✓

### 4) Badge phân loại — đúng nhãn/màu ở CẢ /tasks và dashboard — PASS
- /tasks (L272-287): `task.recurrence_group_id && (category==='habit' ? "🔁 Thói quen" (rose) : "🔁 Lặp" (violet))`.
- dashboard (L485-500): logic + nhãn + màu GIỐNG HỆT (`t.category==='habit' ? "🔁 Thói quen" rose : "🔁 Lặp" violet`).
- Cả 2 nơi: badge CHỈ hiện khi `recurrence_group_id` truthy (task thuộc chuỗi). Task thường (category='work' default, không recurrence) KHÔNG hiện badge — đúng. `habit`→🔁 Thói quen, `work`→🔁 Lặp: khớp yêu cầu, nhất quán 2 trang.

### 5) Lưới "Theo dõi thói quen" CHỈ lấy chuỗi `category='habit'` — PASS
- dashboard `habitTasks` (L308-315): lọc `t.recurrence_group_id && t.category === 'habit' && due_date trong [weekStart, weekEnd]`. Điều kiện `category === 'habit'` chặn chuỗi `work` khỏi lưới. → chuỗi 'work' (vd daily standup) KHÔNG lọt vào lưới Theo dõi thói quen. ✓
- Chuỗi 'work' VẪN hiện trong mục "Công việc" theo project (Section 4): `activeTasks` (L292-294) lọc `status!=='done' && (!due_date || due_date<=todayYmd)` — KHÔNG lọc theo `category` → task 'work' của chuỗi (ngày hôm nay/quá hạn) vẫn xuất hiện, nhóm theo project, kèm badge "🔁 Lặp". ✓
- **Trace:** chuỗi A `category='habit'` (5 ngày trong tuần) + chuỗi B `category='work'` (5 ngày). Lưới thói quen: chỉ A. Mục Công việc: task hôm nay của cả A lẫn B đều hiện (mục Công việc không loại habit — không phải yêu cầu loại; yêu cầu chỉ là work KHÔNG lọt lưới habit + work VẪN hiện ở Công việc → cả hai thỏa).

### 6) Không có insert path khác bỏ sót — PASS
- Grep `from('tasks').insert`: chỉ 2 điểm — chuỗi lặp (TaskForm:221, có `category`) và non-recurring (TaskForm single insert, không gửi → default 'work'). Insert subtask (tasks/[id]) không gửi `category` → subtask nhận default 'work', không có `recurrence_group_id` nên không badge — không ảnh hưởng.

### Verify
- `npx tsc --noEmit`: chưa chạy trong lần QA này (thay đổi thuần thêm 1 field vào type + string select + JSX badge; không có cấu trúc type mới). `TaskCategory` đã tồn tại và dùng nhất quán. Nếu cần chắc chắn tuyệt đối, khuyến nghị chạy `npx tsc --noEmit` trước deploy.

### Fail
- (không có lỗi ranh giới — không cần chuyển yêu cầu sửa cho frontend-developer)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- Mục "Công việc" ở dashboard KHÔNG loại chuỗi `habit` → 1 chuỗi habit có task hôm nay sẽ hiện Ở CẢ lưới Theo dõi thói quen LẪN mục Công việc. Không phải lỗi (yêu cầu không đòi loại habit khỏi Công việc); nêu để rõ. Nếu muốn habit chỉ ở lưới thói quen, thêm điều kiện `t.category !== 'habit'` vào `activeTasks` — tùy quyết định sản phẩm.
- `setTasks(... as unknown as TaskWithProject[])` (tasks/page:64, dashboard:151): query đã select `category` nên các nhánh badge/lọc đọc giá trị THẬT, không `undefined`. An toàn. Cùng mẫu advisory các QA trước.
- **Điều kiện chạy thật:** người dùng PHẢI chạy migration `20260710130000_add_task_category.sql` trên Supabase SQL Editor. Nếu chưa: cột `category` chưa tồn tại → `.select('...category...')` và insert chuỗi có `category` sẽ lỗi "column does not exist". Đã ghi rõ schema-contract L24.

### Kết luận
- **Cross-boundary cho phân loại `category` (habit/work): PASS toàn bộ.** Cột khớp CHÍNH XÁC 3 nơi (migration NOT NULL default 'work' CHECK habit/work ↔ type ↔ query); chuỗi lặp gán `category` cho MỌI row (không sót/sai); task thường + edit không gửi `category` (dựa default DB / giữ nguyên); badge 🔁 Thói quen (habit)/🔁 Lặp (work) đúng và nhất quán /tasks + dashboard; lưới Theo dõi thói quen chỉ lấy `category='habit'`, chuỗi 'work' vẫn hiện đúng ở mục Công việc. Không có lỗi chặn.
- Task #21 (QA): HOÀN THÀNH — không còn lỗi pending.

---

## Kết quả QA #10 — 2026-07-10 — Trang `/settings` (đổi tên hiển thị + avatar) + bucket Storage `avatars` (Task #24)

Nguồn: `supabase/migrations/20260710140000_add_avatars_storage_bucket.sql` + schema-contract L225-274 ↔ `app/settings/page.tsx`, `components/Nav.tsx`, `components/AuthProvider.tsx`, `_workspace/02_frontend-developer_pages-map.md` (đã cập nhật).
Phương pháp: đọc đồng thời migration (RLS policy) ↔ code page/nav; grep toàn repo mọi nơi chạm `user_metadata`/`avatar_url`/`full_name`/`storage.from`/`upload`/`getPublicUrl`/`updateUser` để xác nhận không có code path nào bỏ qua quy ước.

### 1) Path upload avatar LUÔN bắt đầu bằng `${user.id}/` (khớp RLS `storage.foldername(name))[1]`) — PASS
- settings/page.tsx:44 — điểm sinh path DUY NHẤT: `const path = \`${user.id}/avatar.${ext}\``. Thư mục cấp 1 = `user.id` → khớp policy `with check (bucket_id='avatars' and auth.uid()::text = (storage.foldername(name))[1])` (migration L38-40).
- Guard L37 `if (!file || !user) return` → `user` non-null khi tới L44; `user.id` lấy từ session Supabase Auth (AuthProvider: `user: session?.user ?? null`), KHÔNG hardcode → luôn là `auth.uid()` thật. Thỏa RLS INSERT/UPDATE.
- Grep toàn repo: chỉ 1 lệnh `.upload(` (settings:47) và 1 `storage.from('avatars')` cho upload + 1 cho getPublicUrl (settings:45-49). KHÔNG có code path upload thứ 2 nào bỏ qua tiền tố `${user.id}/`. `bucket = 'avatars'` khớp bucket id migration L24. **PASS — không có đường ghi nào lách RLS.**
- Public read khớp: bucket `public=true` (migration L24) + policy select công khai (L34-36) → `getPublicUrl` (không signed) hiển thị được ảnh. Đúng.

### 2) Key `full_name` / `avatar_url` — không lệch tên field ở mọi chỗ đọc/ghi — PASS
- GHI (settings:67-68): `supabase.auth.updateUser({ data: { full_name: fullName.trim(), avatar_url: avatarUrl } })` — đúng 2 key contract L230-232.
- ĐỌC prefill (settings:30-31): `readStringMeta(user.user_metadata, 'full_name')` / `'avatar_url'` — cùng key.
- ĐỌC ở Nav (Nav:28-29): `meta?.avatar_url` / `meta?.full_name` — cùng key.
- Grep toàn repo xác nhận chỉ 2 file (settings, Nav) chạm các key này; KHÔNG có biến thể `fullName`/`avatarUrl` bị dùng làm KEY metadata (chúng chỉ là tên biến React state, không phải key gửi lên Auth). **KHỚP tuyệt đối — không field drift.**

### 3) Đọc `user_metadata` an toàn (không `any`, guard string) — PASS
- settings: helper `readStringMeta(meta: { [key: string]: unknown } | undefined, key)` (L9-15) — tham số kiểu `unknown`-indexed (KHÔNG `any`), trả `typeof v === 'string' ? v : ''`. Nếu metadata thiếu key hoặc kiểu khác → trả `''`, không crash.
- Nav: cast `user?.user_metadata as { full_name?: unknown; avatar_url?: unknown } | undefined` (L25-27) + guard `typeof meta?.x === 'string'` (L28-29). KHÔNG `any`.
- `npx tsc --noEmit`: **PASS (exit 0)** — không lỗi type, không `any` né lỗi.

### 4) Nav — link "Cài đặt" trỏ đúng `/settings`, avatar/chữ cái đầu hợp lý — PASS
- `links` (Nav:13): `{ href: '/settings', label: 'Cài đặt' }` ↔ file `app/settings/page.tsx` tồn tại (route thật). Cụm avatar+email cũng là `<Link href="/settings">` (Nav:63-64). Cả 2 đường vào /settings đều đúng route.
- Hiển thị: `avatarUrl` truthy → `<img src={avatarUrl}>` (7x7 tròn, object-cover); rỗng → `navInitial` = `(fullName.trim() || user.email || '?').charAt(0).toUpperCase()` trên nền gradient (Nav:30,68-79). Fallback hợp lý (tên → email → '?'), không crash khi thiếu cả hai. Nav ẩn ở `/login` (L22) và cả cụm user chỉ render khi `user` truthy (L61). ✓
- Active-state `pathname === l.href || pathname.startsWith(l.href + '/')` (L45) đúng cho `/settings`.

### 5) Cache ảnh — có cache-buster, tránh hiện ảnh cũ sau khi đổi ảnh — PASS
- Path cố định theo ext + `upsert: true` (settings:47) → cùng public URL khi đổi ảnh cùng đuôi → nguy cơ browser cache ảnh cũ. Đã xử lý: sau upload, `setAvatarUrl(\`${data.publicUrl}?t=${Date.now()}\`)` (settings:49-51) thêm query `?t=<timestamp>`.
- **Quan trọng — cache-buster BỀN across reload:** URL kèm `?t=T` được lưu vào `user_metadata.avatar_url` khi bấm "Lưu thay đổi" (settings:68). Lần upload sau sinh `T2 ≠ T1` → metadata cập nhật URL mới → reload/trang khác (Nav đọc thẳng `avatar_url` từ metadata) nhận URL `?t=T2`, khác cache key cũ → browser tải ảnh mới, KHÔNG kẹt ảnh cũ. Trace: ảnh A→`?t=T1` lưu; ảnh B (cùng path upsert)→`?t=T2` preview đổi ngay + lưu → mọi nơi đọc metadata thấy T2. ✓

### Verify
- `npx tsc --noEmit`: **PASS** (exit 0).

### Fail
- (không có lỗi ranh giới chặn — không cần chuyển yêu cầu sửa cho frontend-developer)

### Quan sát nhỏ (advisory — KHÔNG chặn)
- **File avatar mồ côi khi đổi đuôi ảnh:** path là `avatar.${ext}` với `ext` theo tên file người dùng chọn. Upload `photo.png` → `userid/avatar.png`; sau đó upload `photo.jpg` → `userid/avatar.jpg` (path KHÁC, không upsert đè `avatar.png`) → file `.png` cũ còn lại trong bucket (mồ côi, không ai trỏ tới). KHÔNG phải cache bug (URL mới khác hẳn nên không kẹt cache) và không phải lỗi RLS/runtime; chỉ tốn dung lượng Storage nhỏ. Nếu muốn sạch, có thể chuẩn hóa ext cố định (vd luôn `.png`) hoặc xóa file cũ trước khi upload. Tùy quyết định — không chặn.
- **Điều kiện chạy thật:** người dùng PHẢI chạy migration `20260710140000_add_avatars_storage_bucket.sql` trên Supabase SQL Editor (tạo bucket `avatars` + 4 policy trên `storage.objects`). Nếu chưa: upload lỗi "Bucket not found" hoặc RLS chặn. `full_name`/`avatar_url` không cần bảng/migration (Auth `user_metadata` tự có). Đã ghi rõ schema-contract L26/L248-274.
- **Đổi metadata cần refresh session để Nav cập nhật:** `updateUser` cập nhật user phía server; AuthProvider nghe `onAuthStateChange` (thường phát `USER_UPDATED`) nên Nav sẽ nhận avatar/tên mới. Nếu môi trường không phát event, cần reload trang để Nav đọc lại `user_metadata`. Không phải lỗi biên DB↔FE; nêu để QA thủ công lưu ý.
- Giới hạn môi trường agent: trang sau `RequireAuth` cần đăng nhập Supabase + bucket đã tạo nên không drive upload+save end-to-end; xác thực qua đọc đồng thời migration↔code + grep toàn repo + tsc. Kiểm thủ công sau đăng nhập (đã chạy migration): (1) prefill tên đúng từ metadata, sửa + "Lưu" → reload còn; (2) chọn ảnh → upload path `${user.id}/avatar.{ext}` KHÔNG lỗi RLS, preview tròn đổi ngay; (3) "Lưu" ghi cả `full_name`+`avatar_url` vào metadata; (4) Nav hiện avatar nhỏ/chữ cái đầu, click → /settings; (5) chưa có avatar → chữ cái đầu trên nền gradient.

### Kết luận
- **Cross-boundary cho `/settings` + bucket `avatars`: PASS toàn bộ.** (1) Path upload DUY NHẤT luôn tiền tố `${user.id}/` (khớp RLS `storage.foldername`), không code path lách; (2) key `full_name`/`avatar_url` nhất quán mọi chỗ đọc/ghi (settings + Nav), không field drift; (3) đọc `user_metadata` an toàn qua helper `readStringMeta`/guard `typeof string`, không `any`; (4) Nav link + avatar/chữ cái đầu đúng route `/settings` và fallback hợp lý; (5) cache-buster `?t=Date.now()` được lưu vào metadata → bền qua reload, tránh kẹt ảnh cũ. `tsc` PASS. Không có lỗi chặn. 1 advisory nhỏ: file avatar mồ côi khi đổi đuôi ảnh (không phải cache/runtime bug).
- Task #24 (QA): HOÀN THÀNH — không còn lỗi pending.
