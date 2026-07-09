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
  completed: boolean // migration 20260709170000
  project_id: string | null // migration 20260709170000; FK -> projects(id)
  created_at: string
}

// ScheduleEvent kèm title task khi embed: .select('..., tasks(title)')
export type ScheduleEventWithTask = ScheduleEvent & {
  tasks: { title: string } | null
}

// ScheduleEvent kèm tên project (Nguồn) khi embed: .select('..., projects(name)')
export type ScheduleEventWithProject = ScheduleEvent & {
  projects: { name: string } | null
}

// --- Bảng notes / goals / freelance_projects (migration 20260709170000) ------

export type Note = {
  id: string
  user_id: string
  content: string
  color: string | null
  created_at: string
}

export type GoalPeriod = 'week' | 'month'

export type Goal = {
  id: string
  user_id: string
  title: string
  period: GoalPeriod
  progress_percent: number // 0..100
  target_date: string | null // kiểu date -> 'YYYY-MM-DD'
  created_at: string
  updated_at: string
}

export type FreelanceStatus = 'in_progress' | 'almost_done' | 'done'

export type FreelanceProject = {
  id: string
  user_id: string
  client_name: string
  project_name: string
  revenue: string // numeric -> Supabase JS trả về STRING, cần Number() khi tính
  status: FreelanceStatus
  created_at: string
  updated_at: string
}
