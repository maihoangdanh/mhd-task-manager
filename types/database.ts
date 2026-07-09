// Type khớp CHÍNH XÁC với _workspace/01_db-architect_schema-contract.md
// Supabase JS trả nguyên snake_case — KHÔNG camelCase.

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export type Project = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type Task = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null // kiểu date -> chuỗi 'YYYY-MM-DD'
  created_at: string
  updated_at: string
  recurrence_group_id: string | null // nhóm task cùng chuỗi lặp lại; null = task đơn lẻ
}

// Task kèm tên project khi embed qua FK: .select('..., projects(name)')
export type TaskWithProject = Task & {
  projects: { name: string } | null
}

export type ScheduleEvent = {
  id: string
  user_id: string
  task_id: string | null
  title: string
  start_time: string // timestamptz -> ISO string
  end_time: string
  created_at: string
}

// ScheduleEvent kèm title task khi embed: .select('..., tasks(title)')
export type ScheduleEventWithTask = ScheduleEvent & {
  tasks: { title: string } | null
}
