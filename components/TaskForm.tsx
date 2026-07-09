'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import type { Project, Task, TaskPriority, TaskStatus } from '@/types/database'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Cần làm' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'done', label: 'Hoàn thành' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
]

const inputClass =
  'rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent'

export default function TaskForm({ task }: { task?: Task }) {
  const router = useRouter()
  const { user } = useAuth()
  const isEdit = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [projectId, setProjectId] = useState<string>(task?.project_id ?? '')
  const [newProject, setNewProject] = useState('')

  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => setProjects((data as Project[]) ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSaving(true)
    try {
      // Nếu người dùng nhập nhóm mới -> tạo project trước rồi lấy id
      let resolvedProjectId: string | null = projectId || null
      const trimmedNew = newProject.trim()
      if (trimmedNew) {
        const { data, error } = await supabase
          .from('projects')
          .insert({ name: trimmedNew, user_id: user.id })
          .select('id')
          .single()
        if (error) throw error
        resolvedProjectId = (data as { id: string }).id
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate || null,
        project_id: resolvedProjectId,
      }

      if (isEdit && task) {
        const { error } = await supabase
          .from('tasks')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', task.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert({ ...payload, user_id: user.id })
        if (error) throw error
      }

      router.push('/tasks')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Tiêu đề *</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Ví dụ: Hoàn thành báo cáo tuần"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mô tả</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Trạng thái</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ưu tiên</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={inputClass}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Hạn chót</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nhóm (project)</span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={inputClass}
          disabled={!!newProject.trim()}
        >
          <option value="">Không có</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="Hoặc tạo nhóm mới…"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Tạo task'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/tasks')}
          className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Hủy
        </button>
      </div>
    </form>
  )
}
