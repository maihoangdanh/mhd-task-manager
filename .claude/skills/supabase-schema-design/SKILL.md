---
name: supabase-schema-design
description: "Quy trình thiết kế schema Postgres trên Supabase cho ứng dụng quản lý công việc/lịch trình: đặt tên bảng/cột, thiết lập Row Level Security (RLS), quan hệ khóa ngoại, và viết migration. Dùng khi cần tạo bảng mới, sửa cấu trúc dữ liệu, hoặc thiết lập bảo mật truy cập dữ liệu trên Supabase."
---

# Thiết kế Schema Supabase cho Task Manager

## Mô hình dữ liệu cốt lõi (khởi điểm khuyến nghị)

Không tạo thêm bảng ngoài phạm vi được yêu cầu. Mô hình tối thiểu cho task + lịch trình cá nhân:

```sql
create extension if not exists "uuid-ossp";

create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table schedule_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz not null default now()
);
```

Mở rộng thêm bảng `tags`/`task_tags` (many-to-many) CHỈ khi người dùng yêu cầu gắn nhãn — đừng thêm trước.

## Row Level Security — bắt buộc cho mọi bảng chứa dữ liệu user

Supabase mặc định **KHÔNG** giới hạn truy cập nếu quên bật RLS — bất kỳ ai có anon key (vốn public trong code frontend) đều đọc được toàn bộ bảng. Đây là lỗi bảo mật số 1 khi mới dùng Supabase.

```sql
alter table tasks enable row level security;

create policy "Users can only access their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Áp dụng policy tương tự cho `projects` và `schedule_events`. Luôn dùng `for all` + cả `using` và `with check` để chặn cả đọc lẫn ghi/sửa.

## Quy ước đặt tên — điểm dễ gây lỗi ranh giới với frontend

Postgres/Supabase dùng **snake_case** cho tên cột (`due_date`, `project_id`). Supabase JS client (`@supabase/supabase-js`) trả về response **giữ nguyên snake_case, không tự động chuyển sang camelCase** như một số ORM khác. Vì vậy:
- Ghi rõ trong `schema-contract.md` rằng frontend sẽ nhận `due_date` chứ không phải `dueDate`
- Nếu frontend muốn dùng camelCase trong UI, tự chuyển đổi ở tầng gọi API (mapper), không đổi tên cột DB

## Viết schema-contract.md

Sau khi thiết kế xong, viết file liệt kê từng bảng theo format:

```markdown
### tasks
| Cột | Kiểu | Nullable | Default | Ghi chú |
|-----|------|----------|---------|---------|
| id | uuid | không | uuid_generate_v4() | PK |
| user_id | uuid | không | - | FK → auth.users |
| project_id | uuid | có | null | FK → projects, SET NULL khi xóa project |
| status | text | không | 'todo' | enum: todo/in_progress/done |
...

RLS: bật, policy `auth.uid() = user_id`
```

## Migration

Đặt file SQL trong `supabase/migrations/{YYYYMMDDHHMMSS}_{mô_tả}.sql`. Mỗi migration độc lập, không sửa migration cũ đã áp dụng — tạo migration mới để thay đổi tiếp.
