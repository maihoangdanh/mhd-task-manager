'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import RequireAuth from '@/components/RequireAuth'
import TaskForm from '@/components/TaskForm'
import Loading from '@/components/Loading'
import type { Task, TaskStatus } from '@/types/database'

// Subtask hiển thị trong khu "Việc con" — chỉ cần vài cột.
type Subtask = { id: string; title: string; status: TaskStatus }

function SubtaskSection({ parent }: { parent: Task }) {
  const { user } = useAuth()
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('parent_task_id', parent.id)
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setSubtasks((data as Subtask[]) ?? [])
    setLoading(false)
  }, [parent.id])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(sub: Subtask) {
    const next: TaskStatus = sub.status === 'done' ? 'todo' : 'done'
    // optimistic
    setSubtasks((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: next } : s)))
    const { error } = await supabase
      .from('tasks')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', sub.id)
    if (error) {
      alert(error.message)
      setSubtasks((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: sub.status } : s)))
    }
  }

  async function remove(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      alert(error.message)
      load()
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title || !user) return
    setAdding(true)
    setError(null)
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        status: 'todo',
        priority: 'medium',
        project_id: parent.project_id,
        user_id: user.id,
        parent_task_id: parent.id,
      })
      .select('id, title, status')
      .single()
    setAdding(false)
    if (error) {
      setError(error.message)
      return
    }
    setSubtasks((prev) => [...prev, data as Subtask])
    setNewTitle('')
  }

  const done = subtasks.filter((s) => s.status === 'done').length

  return (
    <section className="card mt-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-indigo-950">Việc con</h2>
        {subtasks.length > 0 && (
          <span className="pill bg-sky-100 text-sky-700">
            ☑ {done}/{subtasks.length} hoàn thành
          </span>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : subtasks.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Chưa có việc con nào.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5"
            >
              <input
                type="checkbox"
                checked={s.status === 'done'}
                onChange={() => toggle(s)}
                className="h-4.5 w-4.5 shrink-0 accent-indigo-600"
                aria-label="Đánh dấu việc con hoàn thành"
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm font-medium ${
                  s.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'
                }`}
              >
                {s.title}
              </span>
              <button
                onClick={() => remove(s.id)}
                className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Thêm việc con nhanh…"
          className="input flex-1"
        />
        <button type="submit" disabled={adding || !newTitle.trim()} className="btn btn-primary shrink-0">
          {adding ? '…' : '+ Thêm'}
        </button>
      </form>
      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}
    </section>
  )
}

function EditTaskInner() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTask(data as Task)
        setLoading(false)
      })
  }, [id])

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <Link
          href="/tasks"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Quay lại danh sách
        </Link>
      </div>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-indigo-950">Sửa task</h1>
      {loading ? (
        <Loading />
      ) : error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      ) : task ? (
        <>
          <TaskForm task={task} />
          {/* Khu Việc con chỉ hiện với task gốc (không phải subtask) — chỉ hỗ trợ 1 cấp. */}
          {task.parent_task_id === null && <SubtaskSection parent={task} />}
        </>
      ) : (
        <p className="text-sm text-slate-400">Không tìm thấy task.</p>
      )}
    </div>
  )
}

export default function EditTaskPage() {
  return (
    <RequireAuth>
      <EditTaskInner />
    </RequireAuth>
  )
}
