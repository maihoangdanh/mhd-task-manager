-- Migration: add_parent_task_and_start_date
-- Task Manager — thêm 2 cột mới vào bảng tasks:
--   parent_task_id : hỗ trợ subtask (task con) — chỉ 1 cấp, không enforce bằng CHECK (xử lý ở UI).
--   start_date     : ngày bắt đầu, dùng cho Timeline view.
-- Project Supabase: wvudgvdrgoiocalthbsi (https://wvudgvdrgoiocalthbsi.supabase.co)
--
-- Cách áp dụng: Supabase Dashboard -> SQL Editor -> dán toàn bộ nội dung file này -> Run.
-- Migration độc lập; KHÔNG sửa các file migration đã áp dụng — đây là migration bổ sung.
-- Chạy SAU 20260709170000_add_notes_goals_freelance.sql.

-- ============================================================
-- Thêm cột parent_task_id vào bảng tasks (self-reference)
--   - Trỏ tới task cha trong cùng bảng tasks.
--   - ON DELETE CASCADE: xóa task cha thì xóa luôn các task con của nó.
--   - null = task gốc (không có cha).
--   - Chỉ 1 cấp lồng nhau: KHÔNG enforce bằng CHECK ở DB — frontend/UI
--     chịu trách nhiệm không cho tạo subtask của subtask.
-- Thêm cột start_date (ngày bắt đầu) — kiểu date, dùng cho Timeline view.
--   - null = chưa đặt ngày bắt đầu.
-- ============================================================
alter table tasks
  add column parent_task_id uuid references tasks(id) on delete cascade,
  add column start_date     date;

-- ============================================================
-- Index một phần (partial) — chỉ index các task con (parent_task_id not null).
-- Giúp query "lấy các subtask của một task cha" theo parent_task_id chạy nhanh,
-- đồng thời không tốn dung lượng index cho các task gốc (giá trị null).
-- ============================================================
create index idx_tasks_parent_task_id
  on tasks(parent_task_id)
  where parent_task_id is not null;

-- Ghi chú: KHÔNG cần đổi RLS. 2 cột mới nằm trong bảng tasks vốn đã bật RLS
-- với policy auth.uid() = user_id, nên subtask vẫn bị giới hạn theo user.
-- Lưu ý bảo mật: parent_task_id trỏ tới task khác của CHÍNH user (RLS chặn đọc
-- task người khác); khi INSERT subtask, vẫn phải set user_id = user hiện tại.
