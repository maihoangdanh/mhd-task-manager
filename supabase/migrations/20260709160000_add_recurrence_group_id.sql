-- Migration: add_recurrence_group_id
-- Task Manager — thêm cột nhóm chuỗi task lặp lại vào bảng tasks
-- Project Supabase: wvudgvdrgoiocalthbsi (https://wvudgvdrgoiocalthbsi.supabase.co)
--
-- Mục đích: hỗ trợ tính năng "task lặp lại hàng ngày trong khoảng thời gian".
--   Mỗi ngày vẫn là 1 row task riêng (không phải recurrence rule động).
--   Cột recurrence_group_id chỉ để NHÓM các row cùng một chuỗi lặp, nhằm
--   hỗ trợ xóa / nhận diện cả chuỗi sau này (vd: xóa toàn bộ task của chuỗi).
--   null = task đơn lẻ (không thuộc chuỗi lặp nào).
--
-- Cách áp dụng: Supabase Dashboard -> SQL Editor -> dán toàn bộ nội dung file này -> Run.
-- Migration độc lập; KHÔNG sửa file init_schema đã áp dụng — đây là migration bổ sung.

-- ============================================================
-- Thêm cột recurrence_group_id vào bảng tasks
-- ============================================================
alter table tasks
  add column recurrence_group_id uuid;

-- ============================================================
-- Index một phần (partial) — chỉ index các row thực sự thuộc một chuỗi.
-- Giúp query "lấy/xóa cả chuỗi" theo recurrence_group_id chạy nhanh,
-- đồng thời không tốn dung lượng index cho các task đơn lẻ (giá trị null).
-- ============================================================
create index idx_tasks_recurrence_group_id
  on tasks(recurrence_group_id)
  where recurrence_group_id is not null;

-- Ghi chú: KHÔNG cần đổi RLS. Cột mới nằm trong bảng tasks vốn đã bật RLS
-- với policy auth.uid() = user_id, nên chuỗi lặp vẫn bị giới hạn theo user.
