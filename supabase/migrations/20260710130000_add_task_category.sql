-- Migration: add_task_category
-- Task Manager — thêm 1 cột mới vào bảng tasks:
--   category : phân biệt task lặp lại là "thói quen cá nhân" (habit, vd tập thể dục)
--              hay "công việc lặp lại" (work, vd daily standup công ty).
-- Project Supabase: wvudgvdrgoiocalthbsi (https://wvudgvdrgoiocalthbsi.supabase.co)
--
-- Cách áp dụng: Supabase Dashboard -> SQL Editor -> dán toàn bộ nội dung file này -> Run.
-- Migration độc lập; KHÔNG sửa các file migration đã áp dụng — đây là migration bổ sung.
-- Chạy SAU 20260710120000_add_parent_task_and_start_date.sql.

-- ============================================================
-- Thêm cột category vào bảng tasks
--   - Kiểu text, NOT NULL, default 'work'.
--   - CHECK enum: chỉ nhận 'habit' hoặc 'work'.
--   - 'habit' = thói quen cá nhân (vd tập thể dục), 'work' = công việc lặp lại
--     (vd daily standup công ty).
--   - Default 'work' để các row task đã tồn tại tự nhận giá trị hợp lệ, không vi
--     phạm NOT NULL/CHECK khi migration chạy.
-- ============================================================
alter table tasks
  add column category text not null default 'work'
    check (category in ('habit', 'work'));

-- Ghi chú: KHÔNG cần đổi RLS. Cột mới nằm trong bảng tasks vốn đã bật RLS
-- với policy auth.uid() = user_id, nên vẫn bị giới hạn theo user như các cột khác.
