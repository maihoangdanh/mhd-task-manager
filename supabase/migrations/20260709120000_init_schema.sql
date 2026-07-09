-- Migration: init_schema
-- Task Manager — schema khởi tạo cho tasks, projects, schedule_events
-- Project Supabase: wvudgvdrgoiocalthbsi (https://wvudgvdrgoiocalthbsi.supabase.co)
--
-- Cách áp dụng: Supabase Dashboard -> SQL Editor -> dán toàn bộ nội dung file này -> Run.
-- Migration độc lập; KHÔNG sửa file này sau khi đã áp dụng — tạo migration mới nếu cần thay đổi.

-- ID dùng gen_random_uuid() (built-in Postgres, Supabase khuyến nghị) — không cần extension.

-- ============================================================
-- Bảng: projects (nhóm task)
-- ============================================================
create table projects (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Bảng: tasks
-- ============================================================
create table tasks (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  project_id  uuid        references projects(id) on delete set null,
  title       text        not null,
  description text,
  status      text        not null default 'todo'   check (status   in ('todo', 'in_progress', 'done')),
  priority    text        not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- Bảng: schedule_events (sự kiện lịch, liên kết tùy chọn tới task)
-- ============================================================
create table schedule_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  task_id    uuid        references tasks(id) on delete cascade,
  title      text        not null,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Chỉ mục hỗ trợ truy vấn theo user và quan hệ khóa ngoại
-- ============================================================
create index idx_projects_user_id           on projects(user_id);
create index idx_tasks_user_id              on tasks(user_id);
create index idx_tasks_project_id           on tasks(project_id);
create index idx_schedule_events_user_id    on schedule_events(user_id);
create index idx_schedule_events_task_id    on schedule_events(task_id);

-- ============================================================
-- Row Level Security — BẮT BUỘC
-- Supabase mặc định cho phép truy cập công khai nếu quên bật RLS.
-- Mỗi user chỉ đọc/ghi/sửa/xóa được dữ liệu của chính mình.
-- ============================================================
alter table projects        enable row level security;
alter table tasks           enable row level security;
alter table schedule_events enable row level security;

create policy "Users can only access their own projects"
  on projects for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can only access their own tasks"
  on tasks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can only access their own schedule_events"
  on schedule_events for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
