---
name: nextjs-task-ui
description: "Quy trình xây dựng UI Next.js (App Router) tích hợp Supabase client cho ứng dụng quản lý task và lịch trình: cấu trúc trang, gọi dữ liệu, realtime, và xử lý form CRUD. Dùng khi code trang danh sách task, form tạo/sửa task, view lịch, hoặc kết nối Supabase vào component React."
---

# Next.js UI cho Task Manager (tích hợp Supabase)

## Cấu trúc thư mục khuyến nghị (App Router)

```
app/
  dashboard/page.tsx     -- tổng quan
  tasks/
    page.tsx             -- danh sách task
    [id]/page.tsx        -- chi tiết/sửa task
    new/page.tsx         -- tạo task mới
  schedule/page.tsx       -- view lịch/calendar
lib/
  supabase.ts            -- khởi tạo client
types/
  database.ts             -- type khớp schema-contract
```

Không tạo route/trang ngoài phạm vi được yêu cầu — mỗi trang thêm vào là một điểm cần QA xác thực routing.

## Khởi tạo Supabase client

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Chỉ dùng anon key ở phía client — key này được thiết kế để public, an toàn vì bị giới hạn bởi RLS. Không bao giờ đưa `service_role` key vào code chạy ở browser.

## Gọi dữ liệu — luôn đối chiếu schema-contract trước khi viết query

Trước khi viết bất kỳ `.select()` nào, đọc `_workspace/01_db-architect_schema-contract.md` để lấy đúng tên cột. Supabase client trả nguyên tên cột snake_case:

```ts
const { data, error } = await supabase
  .from('tasks')
  .select('*, projects(name)')
  .order('due_date', { ascending: true })

// data[0].due_date  -- KHÔNG PHẢI data[0].dueDate
```

## Định nghĩa type khớp schema

```ts
// types/database.ts
export type Task = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
  updated_at: string
}
```

Không dùng `any` để né lỗi type — nếu type không khớp response thực tế, sửa type theo schema-contract chứ không ép kiểu.

## Form CRUD — pattern tối thiểu

Với quy mô cá nhân, dùng React state cục bộ (`useState`) + Server Action hoặc gọi trực tiếp Supabase client từ Client Component là đủ — không cần Redux/Zustand.

```ts
async function createTask(formData: { title: string; due_date?: string }) {
  const { error } = await supabase.from('tasks').insert(formData)
  if (error) throw error
}
```

## Realtime (tùy chọn, chỉ khi được yêu cầu)

```ts
supabase
  .channel('tasks-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, callback)
  .subscribe()
```

Chỉ thêm nếu yêu cầu có "cập nhật real-time" — mặc định fetch lại sau mỗi thao tác là đủ đơn giản cho app cá nhân.

## Sau khi hoàn thành mỗi trang

Ghi lại route ↔ file ↔ chức năng vào `_workspace/02_frontend-developer_pages-map.md` để qa-inspector đối chiếu routing và deploy-engineer biết cấu trúc build.
