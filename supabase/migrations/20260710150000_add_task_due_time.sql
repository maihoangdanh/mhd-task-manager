-- Thêm giờ cụ thể (tùy chọn) cho task — dùng để hiển thị đúng giờ trong bảng
-- "Lịch trình hôm nay" (task category='habit' có giờ) thay vì chỉ "Cả ngày",
-- và hiển thị thêm thông tin giờ cho task công việc (category='work') nếu có.
alter table tasks
  add column due_time time null;
