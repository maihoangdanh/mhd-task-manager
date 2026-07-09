'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import type { TaskStatus, TaskWithProject } from '@/types/database'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  done: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
}

const PRIORITY_STYLE: Record<string, string> = {
  low: 'text-zinc-500',
  medium: 'text-amber-600',
  high: 'text-red-600 font-semibold',
}

function TasksInner() {
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, project_id, projects(name)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTasks((data as unknown as TaskWithProject[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Xóa task này?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function toggleDone(task: TaskWithProject) {
    const next: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    // optimistic
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
    )
    const { error } = await supabase
      .from('tasks')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) {
      alert(error.message)
      load() // rollback bằng cách tải lại
    }
  }

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Công việc</h1>
        <Link
          href="/tasks/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          + Tạo task
        </Link>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {(['all', 'todo', 'in_progress', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 ${
              filter === f
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'border border-black/15 dark:border-white/20'
            }`}
          >
            {f === 'all' ? 'Tất cả' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Đang tải…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-zinc-500">Chưa có công việc nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
            >
              <input
                type="checkbox"
                checked={task.status === 'done'}
                onChange={() => toggleDone(task)}
                className="h-4 w-4"
                aria-label="Đánh dấu hoàn thành"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tasks/${task.id}`}
                    className={`truncate font-medium hover:underline ${
                      task.status === 'done' ? 'line-through text-zinc-400' : ''
                    }`}
                  >
                    {task.title}
                  </Link>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[task.status]}`}
                  >
                    {STATUS_LABEL[task.status]}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                  <span className={PRIORITY_STYLE[task.priority]}>
                    Ưu tiên: {PRIORITY_LABEL[task.priority]}
                  </span>
                  {task.due_date && <span>Hạn: {task.due_date}</span>}
                  {task.projects?.name && <span>Nhóm: {task.projects.name}</span>}
                </div>
              </div>
              <Link
                href={`/tasks/${task.id}`}
                className="shrink-0 text-sm text-zinc-500 hover:underline"
              >
                Sửa
              </Link>
              <button
                onClick={() => handleDelete(task.id)}
                className="shrink-0 text-sm text-red-600 hover:underline"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function TasksPage() {
  return (
    <RequireAuth>
      <TasksInner />
    </RequireAuth>
  )
}
