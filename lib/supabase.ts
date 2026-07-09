import { createClient } from '@supabase/supabase-js'

// Chỉ dùng anon (publishable) key ở client — an toàn vì RLS giới hạn theo auth.uid().
// KHÔNG bao giờ đưa service_role key vào code chạy ở browser.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
