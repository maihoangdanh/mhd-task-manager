-- Migration: add_notes_goals_freelance
-- Task Manager — thêm 3 bảng mới (notes, goals, freelance_projects)
--   và 2 cột mới cho bảng schedule_events (completed, project_id).
-- Project Supabase: wvudgvdrgoiocalthbsi (https://wvudgvdrgoiocalthbsi.supabase.co)
--
-- Cách áp dụng: Supabase Dashboard -> SQL Editor -> dán toàn bộ nội dung file này -> Run.
-- Migration độc lập; KHÔNG sửa các file migration đã áp dụng — đây là migration bổ sung.
-- Chạy SAU 20260709160000_add_recurrence_group_id.sql.

-- ID dùng gen_random_uuid() (built-in Postgres) — không cần extension.

-- ============================================================
-- Bảng: notes (ghi chú nhanh)
-- ============================================================
create table notes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  content    text        not null,
  color      text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Bảng: goals (mục tiêu theo tuần/tháng)
-- ============================================================
create table goals (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  title            text        not null,
  period           text        not null check (period in ('week', 'month')),
  progress_percent int         not null default 0 check (progress_percent between 0 and 100),
  target_date      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- Bảng: freelance_projects (dự án freelance / doanh thu)
-- ============================================================
create table freelance_projects (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  client_name  text        not null,
  project_name text        not null,
  revenue      numeric     not null default 0,
  status       text        not null default 'in_progress' check (status in ('in_progress', 'almost_done', 'done')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- ALTER schedule_events — thêm 2 cột mới
--   completed : đánh dấu sự kiện đã hoàn thành hay chưa.
--   project_id: liên kết tùy chọn tới một project (xóa project thì giữ event, set null).
-- ============================================================
alter table schedule_events
  add column completed  boolean not null default false,
  add column project_id uuid references projects(id) on delete set null;

-- ============================================================
-- Chỉ mục hỗ trợ truy vấn theo user và quan hệ khóa ngoại
-- ============================================================
create index idx_notes_user_id                on notes(user_id);
create index idx_goals_user_id                on goals(user_id);
create index idx_freelance_projects_user_id   on freelance_projects(user_id);
create index idx_schedule_events_project_id   on schedule_events(project_id);

-- ============================================================
-- Row Level Security — BẮT BUỘC cho mọi bảng dữ liệu người dùng.
-- Supabase mặc định cho phép truy cập công khai nếu quên bật RLS.
-- Mỗi user chỉ đọc/ghi/sửa/xóa được dữ liệu của chính mình.
-- ============================================================
alter table notes              enable row level security;
alter table goals              enable row level security;
alter table freelance_projects enable row level security;

create policy "Users can only access their own notes"
  on notes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can only access their own goals"
  on goals for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can only access their own freelance_projects"
  on freelance_projects for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Ghi chú: KHÔNG cần đổi RLS cho schedule_events. 2 cột mới nằm trong bảng
-- vốn đã bật RLS với policy auth.uid() = user_id, nên vẫn bị giới hạn theo user.
