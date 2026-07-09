# Yêu cầu xây dựng lần đầu — Task Manager

## Phạm vi tính năng (mặc định đã thống nhất với người dùng)
- **tasks**: title, description, status (todo/in_progress/done), priority (low/medium/high), due_date
- **projects**: name, dùng để nhóm task
- **schedule_events**: title, start_time, end_time, liên kết tùy chọn tới task
- RLS: mỗi user chỉ truy cập dữ liệu của chính mình (auth.uid() = user_id)

## Stack
- Frontend: Next.js (App Router) + Supabase JS client
- Database: Supabase (Postgres, free tier)
- Deploy: AWS Amplify Hosting

## Thông tin Supabase đã có
- Project ID: wvudgvdrgoiocalthbsi
- Project URL: https://wvudgvdrgoiocalthbsi.supabase.co
- Publishable (anon) key: sb_publishable_KNW25n5ia06r411ZJvEFqw_5Z6Jzorc

## Trạng thái dự án
- Thư mục: D:\Quan Lieu\Task Manager
- Chưa có code, chưa có git repo, chưa có package.json — đây là lần chạy đầu tiên.
