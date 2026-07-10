-- Migration: add_avatars_storage_bucket
-- Task Manager — tạo Supabase Storage bucket "avatars" (public read) + RLS policies
--   trên storage.objects để mỗi user chỉ upload/sửa/xóa ảnh của chính mình.
-- Project Supabase: wvudgvdrgoiocalthbsi (https://wvudgvdrgoiocalthbsi.supabase.co)
--
-- Cách áp dụng: Supabase Dashboard -> SQL Editor -> dán toàn bộ nội dung file này -> Run.
--   SQL Editor chạy được DDL trên schema `storage` bình thường như schema `public`.
-- Migration độc lập; KHÔNG sửa các file migration đã áp dụng — đây là migration bổ sung.
-- Chạy SAU 20260710130000_add_task_category.sql.
--
-- Ghi chú thiết kế:
--   - KHÔNG tạo bảng `profiles`. Tên hiển thị (full_name) và avatar_url lưu trực tiếp
--     vào user_metadata của Supabase Auth qua supabase.auth.updateUser() ở frontend.
--     Không cần bảng/RLS riêng cho việc này.
--   - Quy ước path file: `{user_id}/avatar.{ext}` — thư mục cấp 1 của object name
--     PHẢI là user_id. storage.foldername(name))[1] lấy phần thư mục đầu tiên và so
--     với auth.uid() để chặn user ghi đè ảnh của người khác.

-- ============================================================
-- 1. Tạo bucket "avatars" (public read).
--    public = true -> ai cũng đọc/xem được ảnh qua public URL (getPublicUrl).
--    on conflict do nothing -> chạy lại migration không lỗi nếu bucket đã tồn tại.
-- ============================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ============================================================
-- 2. RLS policies trên storage.objects.
--    RLS trên storage.objects đã được Supabase bật sẵn mặc định.
--    - SELECT: công khai (bất kỳ ai) đọc được ảnh trong bucket avatars.
--    - INSERT/UPDATE/DELETE: chỉ authenticated user, và chỉ với file nằm trong
--      thư mục trùng user_id của họ (auth.uid()::text = (storage.foldername(name))[1]).
-- ============================================================
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
