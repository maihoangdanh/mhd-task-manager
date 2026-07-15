import { createClient } from '@supabase/supabase-js'

// Chỉ dùng anon (publishable) key ở client — an toàn vì RLS giới hạn theo auth.uid().
// KHÔNG bao giờ đưa service_role key vào code chạy ở browser.
// persistSession: false (chủ động, theo yêu cầu) — không lưu phiên đăng nhập vào localStorage,
// nên mở lại trang/mở link mới đều bắt buộc đăng nhập lại, không tự động vào thẳng.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
)
