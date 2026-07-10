'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import Loading from '@/components/Loading'
import type { TaskStatus, TaskWithProject } from '@/types/database'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
}

const PRIORITY_STYLE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
}

function TasksInner() {
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  // Task thuộc chuỗi lặp đang chờ xác nhận cách xóa (null = không mở modal).
  const [deleteTarget, setDeleteTarget] = useState<TaskWithProject | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, project_id, recurrence_group_id, projects(name)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTasks((data as unknown as TaskWithProject[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function requestDelete(task: TaskWithProject) {
    if (task.recurrence_group_id) {
      // Task thuộc chuỗi -> mở modal hỏi xóa 1 ngày hay cả chuỗi.
      setDeleteTarget(task)
      return
    }
    if (confirm('Xóa task này?')) deleteOne(task.id)
  }

  async function deleteOne(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setDeleteTarget(null)
  }

  async function deleteChain(groupId: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('recurrence_group_id', groupId)
    if (error) {
      alert(error.message)
      return
    }
    setTasks((prev) => prev.filter((t) => t.recurrence_group_id !== groupId))
    setDeleteTarget(null)
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

  const counts = {
    done: tasks.filter((t) => t.status === 'done').length,
  }

  // Nhóm task theo project. Progress bar tính trên TOÀN BỘ task của nhóm
  // (không lọc theo status); danh sách hiển thị mới áp dụng bộ lọc trạng thái.
  const NONE_KEY = '__none__'
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; isNone: boolean; all: TaskWithProject[] }
    >()
    for (const t of tasks) {
      const key = t.project_id ?? NONE_KEY
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          name: t.project_id ? t.projects?.name ?? 'Không tên' : 'Chưa phân nhóm',
          isNone: !t.project_id,
          all: [],
        }
        map.set(key, g)
      }
      g.all.push(t)
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        visible: filter === 'all' ? g.all : g.all.filter((t) => t.status === filter),
      }))
      .sort((a, b) => {
        if (a.isNone !== b.isNone) return a.isNone ? 1 : -1
        return a.name.localeCompare(b.name, 'vi')
      })
  }, [tasks, filter])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-indigo-950">Công việc</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tasks.length} công việc · {counts.done} đã hoàn thành
          </p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          + Tạo task
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {(['all', 'todo', 'in_progress', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'border border-[var(--line)] bg-white text-slate-600 hover:bg-indigo-50'
            }`}
          >
            {f === 'all' ? 'Tất cả' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}
      {loading ? (
        <Loading />
      ) : tasks.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-slate-400">Chưa có công việc nào.</p>
          <Link href="/tasks/new" className="btn btn-primary mt-4">
            + Tạo task đầu tiên
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => {
            const total = group.all.length
            const done = group.all.filter((t) => t.status === 'done').length
            const percent = total ? Math.round((done / total) * 100) : 0
            return (
              <section key={group.key} className="card p-5">
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate text-base font-semibold text-indigo-950">
                      {group.isNone ? '📥 ' : '📁 '}
                      {group.name}
                    </h2>
                    <span className="shrink-0 text-sm font-medium text-slate-500">
                      {done}/{total} hoàn thành
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-500">
                      {percent}%
                    </span>
                  </div>
                </div>

                {group.visible.length === 0 ? (
                  <p className="py-2 text-sm text-slate-400">
                    Không có việc nào khớp bộ lọc
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {group.visible.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3.5 transition-shadow hover:shadow-md"
                      >
                        <input
                          type="checkbox"
                          checked={task.status === 'done'}
                          onChange={() => toggleDone(task)}
                          className="h-5 w-5 shrink-0 accent-indigo-600"
                          aria-label="Đánh dấu hoàn thành"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/tasks/${task.id}`}
                              className={`truncate font-semibold text-slate-800 hover:text-indigo-700 ${
                                task.status === 'done' ? 'text-slate-400 line-through' : ''
                              }`}
                            >
                              {task.title}
                            </Link>
                            <span className={`pill ${STATUS_STYLE[task.status]}`}>
                              {STATUS_LABEL[task.status]}
                            </span>
                            <span className={`pill ${PRIORITY_STYLE[task.priority]}`}>
                              {PRIORITY_LABEL[task.priority]}
                            </span>
                            {task.recurrence_group_id && (
                              <span
                                className="pill bg-violet-100 text-violet-700"
                                title="Task lặp lại"
                              >
                                🔁 Lặp
                              </span>
                            )}
                          </div>
                          {task.due_date && (
                            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                              <span>📅 Hạn: {task.due_date}</span>
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          Sửa
                        </Link>
                        <button
                          onClick={() => requestDelete(task)}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {deleteTarget && deleteTarget.recurrence_group_id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-indigo-950">Xóa task lặp lại</h2>
            <p className="mt-2 text-sm text-slate-500">
              Task “{deleteTarget.title}” thuộc một chuỗi lặp lại{' '}
              (
              {
                tasks.filter(
                  (t) => t.recurrence_group_id === deleteTarget.recurrence_group_id
                ).length
              }{' '}
              task). Bạn muốn xóa như thế nào?
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                onClick={() => deleteOne(deleteTarget.id)}
                className="btn btn-ghost w-full"
              >
                Xóa chỉ ngày này
              </button>
              <button
                onClick={() => deleteChain(deleteTarget.recurrence_group_id!)}
                className="btn btn-danger w-full"
              >
                Xóa cả chuỗi (
                {
                  tasks.filter(
                    (t) => t.recurrence_group_id === deleteTarget.recurrence_group_id
                  ).length
                }{' '}
                task)
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
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
