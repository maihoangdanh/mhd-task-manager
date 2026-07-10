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
| `/dashboard` | `app/dashboard/page.tsx` | Trang tổng quan (rebuild 2026-07-09, Task #12) — 8 khối: (1) header chào theo buổi + thứ/ngày tiếng Việt; (2) 3 stat card: task hôm nay x/y, freelance đang chạy, % tiến độ mục tiêu TB; (3) "Lịch trình hôm nay" dạng BẢNG (Giờ/Việc/Nguồn/Trạng thái) — checkbox tick `completed` optimistic; (4) "Công việc" nhóm theo project + tag priority/status; (5) "Freelance" list + modal thêm/sửa/xoá; (6) "Mục tiêu" progress bar + slider sửa % tức thì + thêm/xoá goal; (7) "Theo dõi thói quen" lưới T2→CN tuần hiện tại (nhóm `recurrence_group_id`); (8) "Ghi chú nhanh" sticky-note nền màu + thêm/xoá. Freelance/goal/note CRUD nằm INLINE trong trang (modal + form nhỏ), KHÔNG tạo route riêng. **Task #17:** query tasks chính thêm `.is('parent_task_id', null)` (ẩn subtask khỏi stat/Công việc/Thói quen); khối "Công việc" hiện badge `☑ x/y` cạnh tiêu đề nếu task cha có subtask (query đếm riêng) | cần đăng nhập |
| `/tasks` | `app/tasks/page.tsx` | Danh sách task NHÓM THEO PROJECT (redesign Task #14): mỗi project 1 khối `.card` — header tên project (hoặc "Chưa phân nhóm", luôn xếp cuối; các project khác sắp A-Z) + "x/y hoàn thành" + progress bar % (done/total tính trên TOÀN BỘ task của project, KHÔNG bị ảnh hưởng bởi bộ lọc). Bộ lọc status (Tất cả/Cần làm/Đang làm/Hoàn thành) chỉ áp cho danh sách task hiển thị trong mỗi nhóm; nhóm rỗng sau lọc vẫn hiện header + progress bar kèm "Không có việc nào khớp bộ lọc". Mỗi dòng task giữ nguyên: checkbox toggle hoàn thành (optimistic), badge "🔁 Lặp", nút Sửa/Xóa, modal xóa "Xóa chỉ ngày này"/"Xóa cả chuỗi (N task)" cho task chuỗi lặp. Progress bar dùng cùng style progress bar "Mục tiêu" ở `/dashboard` (gradient indigo→violet trên track `bg-slate-100`). **Task #17:** query chính thêm `.is('parent_task_id', null)` (ẩn subtask); query phụ đếm subtask theo task cha → mỗi dòng task cha có subtask hiện badge `☑ x/y việc con` cạnh tiêu đề | cần đăng nhập |
| `/tasks/new` | `app/tasks/new/page.tsx` | Form tạo task mới | cần đăng nhập |
| `/tasks/[id]` | `app/tasks/[id]/page.tsx` | Form sửa task theo id + khu **"Việc con"** (Task #17). Khu Việc con CHỈ hiện khi task đang xem là task gốc (`parent_task_id === null`); subtask không có subtask con (1 cấp, UI enforce). Bên trong: query `tasks` where `parent_task_id = id task cha` (select `id,title,status`), mỗi subtask có checkbox toggle done↔todo (optimistic + rollback), nút Xóa. Form thêm nhanh (chỉ input title) → INSERT 1 row `tasks`: `status='todo'`, `priority='medium'`, `project_id`=project_id task cha, `user_id`=user hiện tại, `parent_task_id`=id task cha | cần đăng nhập |
| `/timeline` | `app/timeline/page.tsx` | **Timeline view (Task #17)** — dòng thời gian dạng thanh ngang (Gantt) theo THÁNG. Query `tasks` có `due_date` không null (bỏ task không có ngày), select `id,title,status,priority,due_date,start_date,project_id,projects(name)`. Nút ← / → chuyển tháng + "Hôm nay". Task có `start_date`+`due_date` → thanh trải start→due (cắt bớt phần ngoài tháng, góc bo phẳng khi tràn); chỉ `due_date` → thanh 1 ngày. Màu thanh theo status (indigo=todo / amber=đang làm / emerald=done, cùng hệ màu `/tasks` + legend). Nhóm hàng theo project (A-Z, "Chưa phân nhóm" cuối). Click thanh → `/tasks/{id}`. Lưới ngày: header số ngày (cuối tuần màu amber, hôm nay đậm indigo). Không kéo-thả. Layout/màu thiết kế theo skill `dataviz` (nhận diện KHÔNG chỉ bằng màu: có nhãn tiêu đề ở cột trái + legend) | cần đăng nhập |
| `/schedule` | `app/schedule/page.tsx` | View lịch (agenda nhóm theo ngày), thêm/xóa sự kiện, liên kết task | cần đăng nhập |
| `/reports` | `app/reports/page.tsx` | Thống kê/báo cáo: tỷ lệ hoàn thành %, task quá hạn, phân bố theo trạng thái (donut), breakdown theo project (thanh ngang), xu hướng hoàn thành 8 tuần (cột dọc) | cần đăng nhập |

## Component & lib dùng chung

| File | Vai trò |
|------|---------|
| `lib/supabase.ts` | Khởi tạo Supabase client (anon key, RLS bảo vệ) |
| `types/database.ts` | Type khớp schema-contract: `Project`, `Task` (+`parent_task_id`,`start_date` — Task #17), `TaskWithProject`, `ScheduleEvent` (+`completed`,`project_id`), `ScheduleEventWithTask`, `ScheduleEventWithProject`, `Note`, `Goal`/`GoalPeriod`, `FreelanceProject`/`FreelanceStatus` (snake_case). Lưu ý `FreelanceProject.revenue` kiểu `string` (numeric → string), phải `Number()` khi tính/hiển thị |
| `components/AuthProvider.tsx` | Context session Supabase Auth (`useAuth`), bọc toàn app ở `app/layout.tsx` |
| `components/RequireAuth.tsx` | Route guard: chưa đăng nhập → redirect `/login` |
| `components/Nav.tsx` | Thanh điều hướng (sticky, logo gradient) + nút đăng xuất (ẩn ở `/login`); có link `/reports` |
| `components/TaskForm.tsx` | Form dùng chung cho tạo/sửa task; hỗ trợ chọn/tạo nhanh project. Khi TẠO mới có toggle "🔁 Lặp lại hàng ngày": chọn khoảng ngày, loại trừ theo thứ trong tuần + theo ngày cụ thể, preview số task sẽ tạo, insert hàng loạt cùng `recurrence_group_id`. **Task #17:** thêm field "Ngày bắt đầu" (`start_date`, optional, input type=date, dùng cho Timeline) — hiện trong nhánh `!recurring` (tức chế độ tạo THƯỜNG + chế độ sửa), KHÔNG hiện khi bật "Lặp lại". State đặt tên `taskStartDate` để tránh trùng `startDate` của khoảng lặp. KHÔNG thêm field `parent_task_id` vào form (subtask chỉ tạo qua form nhanh ở `/tasks/[id]`) |
| `components/Loading.tsx` | Spinner tải dùng chung |
| `components/Charts.tsx` | Biểu đồ tự vẽ (SVG/CSS, không thêm dependency): `DonutChart`, `VBars`, `HBars`. Màu theo palette đã validate bằng skill `dataviz`; mọi mark kèm nhãn số trực tiếp (relief rule) |

## Ánh xạ query ↔ schema-contract (điểm QA cần đối chiếu)

- Đọc tasks: `.from('tasks').select('id, title, status, priority, due_date, project_id, recurrence_group_id, projects(name)')` — dùng đúng snake_case, embed FK `projects(name)`. Thêm `recurrence_group_id` để nhận diện task thuộc chuỗi lặp.
- **Subtask (Task #17):** danh sách cấp cao (`/tasks`, dashboard) lọc `.is('parent_task_id', null)` để ẩn subtask. Đếm subtask cho badge: query phụ `.from('tasks').select('parent_task_id, status').not('parent_task_id', 'is', null)` rồi gộp `Map<parent_id,{done,total}>` ở client. INSERT subtask ở `/tasks/[id]`: set `parent_task_id`=id task cha, `project_id`=project_id task cha, `user_id`=user hiện tại, `status='todo'`, `priority='medium'`. Toggle subtask: `.update({ status, updated_at }).eq('id', subId)`. Contract chỉ hỗ trợ 1 cấp — UI chỉ render form thêm subtask khi task đang xem là gốc (`parent_task_id === null`).
- **Timeline (Task #17):** `.from('tasks').select('id, title, status, priority, due_date, start_date, project_id, projects(name)').not('due_date', 'is', null).order('due_date')`. Dùng `start_date`+`due_date` vẽ thanh (so sánh chuỗi `YYYY-MM-DD` trực tiếp — hợp lệ vì ISO date). Không đổi schema; `start_date` là cột migration `20260710120000`.
- **`start_date` (Task #17):** TaskForm gửi `start_date: taskStartDate || null` ở nhánh tạo THƯỜNG + sửa; chuỗi date `YYYY-MM-DD` (input type=date). Chuỗi lặp KHÔNG set `start_date`.
- Task lặp lại (tạo chuỗi): sinh 1 `crypto.randomUUID()` làm `recurrence_group_id`, insert 1 row cho mỗi ngày hợp lệ (mảng rows), mỗi row set `user_id: user.id` để thỏa RLS. Tính ngày hợp lệ hoàn toàn ở client (loại theo thứ + ngày cụ thể).
- Xóa cả chuỗi: `.from('tasks').delete().eq('recurrence_group_id', groupId)`; xóa 1 ngày: `.delete().eq('id', id)`. RLS tự giới hạn theo user.
- Đọc events: `.from('schedule_events').select('id, title, start_time, end_time, task_id, tasks(title)')`.
- INSERT task/project/event: LUÔN set `user_id: user.id` (lấy từ `useAuth()` → Supabase Auth) để thỏa RLS `with check`.
- UPDATE task: gửi kèm `updated_at: new Date().toISOString()` (DB chưa có trigger tự động — theo contract).
- SELECT không lọc `.eq('user_id', ...)` — RLS `to authenticated` tự lọc theo `auth.uid()`.
- `due_date` kiểu `date` → gửi/nhận chuỗi `YYYY-MM-DD` (input type=date).
- `start_time`/`end_time` kiểu `timestamptz` → gửi ISO string (`new Date(datetimeLocal).toISOString()`).
- `/reports`: `.from('tasks').select('id, status, due_date, updated_at, project_id, projects(name)')` — thống kê tính hoàn toàn ở client từ dữ liệu `tasks` (KHÔNG đổi schema). Quá hạn = `status != 'done' && due_date < today`. Xu hướng hoàn thành = đếm task `status = 'done'` theo tuần dựa vào `updated_at`. Breakdown project gộp `project_id = null` thành "Chưa phân nhóm".
- `/dashboard` (rebuild Task #12) — 5 query song song:
  - tasks: `.select('id, title, status, priority, due_date, project_id, recurrence_group_id, projects(name)')` — dùng cho stat "task hôm nay" (`due_date === today`), khối "Công việc" (`status != 'done'`, nhóm theo `project_id`), khối "Thói quen" (`recurrence_group_id != null` + `due_date` trong tuần T2→CN, tính ngày ở client bằng giờ ĐỊA PHƯƠNG).
  - schedule_events: `.select('id, title, start_time, end_time, completed, project_id, projects(name)').gte('start_time', đầu ngày).lte('start_time', cuối ngày)` — "Nguồn" = `projects.name` hoặc "Cá nhân" nếu null. Toggle `completed`: `.update({ completed }).eq('id', id)` (bảng KHÔNG có `updated_at` → không set).
  - freelance_projects: `.select('*')`. Hiển thị `Number(revenue).toLocaleString('vi-VN')+'đ'`. INSERT set `user_id`; UPDATE gửi kèm `updated_at`.
  - goals: `.select('*')`. Slider sửa `progress_percent` → `.update({ progress_percent, updated_at })`. Stat "% mục tiêu TB" = TB `progress_percent` của goals có `progress_percent < 100` (định nghĩa "active").
  - notes: `.select('*')`. INSERT set `user_id` + `color` (key màu: amber/indigo/emerald/rose/sky, KHÔNG ràng buộc CHECK ở DB). Chỉ thêm/xoá (không sửa).
  - Mọi INSERT (goals/notes/freelance) đều set `user_id: user.id` để thỏa RLS `with check`.

## Ghi chú phụ thuộc

- App yêu cầu ĐĂNG NHẬP mới truy cập dữ liệu (RLS `to authenticated`). Đã thêm auth gate tối thiểu (Supabase Auth email/password) — không phải tính năng ngoài phạm vi mà là điều kiện cần để tầng dữ liệu hoạt động.
- Migration schema CHƯA chạy thật trên Supabase (theo db-architect). Người dùng cần chạy `supabase/migrations/20260709120000_init_schema.sql` trong SQL Editor trước khi app đọc/ghi được dữ liệu.

## Trạng thái verify

- `npx tsc --noEmit`: PASS (không lỗi type, không `any` né lỗi).
- `npm run build`: PASS — 8 route build thành công (thêm `/reports`). Rebuild `/dashboard` (Task #12): `npx tsc --noEmit` PASS + `npm run build` PASS, không `any` né lỗi.
- Logic tính ngày lặp (`computeRecurringDates`) test độc lập: khoảng 1/8→31/8, loại Chủ nhật + 2 ngày cụ thể → 24 task đúng (31 − 5 CN − 2), không sót Chủ nhật/ngày loại trừ.
- Lưu ý verify: UI form lặp + modal xóa chuỗi nằm sau `RequireAuth` (cần đăng nhập Supabase) nên không drive end-to-end trong môi trường agent; đã xác thực qua build + tsc + unit logic. QA nên kiểm thực tế sau khi migration `20260709160000` đã chạy.
- Render kiểm tra thực tế qua dev server: `/login` hiển thị đúng design mới; các chart (`DonutChart`/`VBars`/`HBars`) render đúng màu (`#2a78d6` xác thực trực tiếp) + nhãn số. Console không lỗi.
- `/tasks` redesign nhóm theo project (Task #14): `npx tsc --noEmit` PASS + `npm run build` PASS (10 route), không `any`. KHÔNG đổi schema/query (dùng lại `project_id`/`projects(name)` sẵn có). Grouping tính ở client bằng `useMemo`; progress bar dựa trên `group.all` (toàn bộ task của nhóm) nên độc lập với bộ lọc status. Dev server `/tasks` HTTP 200, redirect `/login` khi chưa đăng nhập, console KHÔNG lỗi — không drive được nội dung nhóm end-to-end vì cần đăng nhập Supabase (giới hạn agent đã biết). QA cần đăng nhập để kiểm: (1) đúng thứ tự nhóm A-Z + "Chưa phân nhóm" cuối; (2) % progress bar KHÔNG đổi khi bấm lọc; (3) nhóm rỗng sau lọc hiện "Không có việc nào khớp bộ lọc"; (4) modal xóa chuỗi + toggle vẫn hoạt động.
- `/dashboard` rebuild (Task #12): dev server điều hướng `/dashboard` → redirect `/login` đúng (RequireAuth), console KHÔNG lỗi. Không drive được nội dung dashboard end-to-end vì cần đăng nhập Supabase (không có credential trong môi trường agent) — cùng giới hạn đã biết. QA cần đăng nhập + đảm bảo migration `20260709170000` đã chạy để kiểm 8 khối thực tế (đặc biệt: `completed`/`project_id` trên `schedule_events`, 3 bảng `notes`/`goals`/`freelance_projects`, và `revenue` numeric→string).
- **Task #17 (Subtask + Timeline + `start_date`):** `npx tsc --noEmit` PASS + `npm run build` PASS — **11 route** (thêm `/timeline`), KHÔNG dùng `any` né lỗi (dùng `as unknown as` giống pattern sẵn có + type hẹp cho query đếm subtask). Dev server: `/timeline` HTTP 200, redirect `/login` khi chưa đăng nhập, console KHÔNG lỗi. **Phụ thuộc migration `20260710120000`** (cột `parent_task_id`, `start_date` + partial index) — QA/người dùng CẦN chạy migration này trong Supabase SQL Editor trước khi kiểm, nếu không query `.is('parent_task_id', null)` / `.not('due_date','is',null)` và INSERT subtask sẽ lỗi cột không tồn tại. Không drive được luồng có dữ liệu end-to-end vì cần đăng nhập Supabase (giới hạn agent đã biết). QA cần đăng nhập để kiểm: (1) khu "Việc con" chỉ hiện với task gốc, thêm/toggle/xóa subtask hoạt động + optimistic; (2) subtask bị ẩn khỏi `/tasks` và dashboard; badge `☑ x/y việc con` đúng số; (3) TaskForm field "Ngày bắt đầu" lưu `start_date`, KHÔNG hiện khi bật "Lặp lại"; (4) `/timeline`: thanh trải đúng start→due, cắt biên tháng đúng, màu theo status, nhóm theo project, chuyển tháng + click thanh → `/tasks/{id}`; (5) task chỉ có `due_date` → thanh 1 ngày; task không có ngày nào bị bỏ.
