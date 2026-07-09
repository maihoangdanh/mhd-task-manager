'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import RequireAuth from '@/components/RequireAuth'
import type { ScheduleEventWithTask, Task } from '@/types/database'

const inputClass =
  'rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent'

function ScheduleInner() {
  const { user } = useAuth()
  const [events, setEvents] = useState<ScheduleEventWithTask[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [taskId, setTaskId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [evRes, taskRes] = await Promise.all([
      supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, task_id, tasks(title)')
        .order('start_time', { ascending: true }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    ])
    if (evRes.error) setError(evRes.error.message)
    else setEvents((evRes.data as unknown as ScheduleEventWithTask[]) ?? [])
    setTasks((taskRes.data as Task[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    if (new Date(end) <= new Date(start)) {
      setError('Thời điểm kết thúc phải sau thời điểm bắt đầu.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('schedule_events').insert({
        title: title.trim(),
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        task_id: taskId || null,
        user_id: user.id,
      })
      if (error) throw error
      setTitle('')
      setStart('')
      setEnd('')
      setTaskId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được sự kiện')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa sự kiện này?')) return
    const { error } = await supabase.from('schedule_events').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setEvents((prev) => prev.filter((ev) => ev.id !== id))
  }

  // Nhóm sự kiện theo ngày (agenda view)
  const grouped = events.reduce<Record<string, ScheduleEventWithTask[]>>((acc, ev) => {
    const day = new Date(ev.start_time).toLocaleDateString('vi-VN')
    ;(acc[day] ??= []).push(ev)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Lịch trình</h1>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <h2 className="font-medium">Thêm sự kiện</h2>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề sự kiện"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Bắt đầu</span>
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Kết thúc</span>
            <input
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>Liên kết task (tùy chọn)</span>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className={inputClass}
          >
            <option value="">Không liên kết</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? 'Đang lưu…' : 'Thêm sự kiện'}
        </button>
      </form>

      <section>
        <h2 className="mb-2 font-medium">Danh sách sự kiện</h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Đang tải…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">Chưa có sự kiện nào.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                <div className="mb-1 text-sm font-medium text-zinc-500">{day}</div>
                <ul className="flex flex-col gap-2">
                  {dayEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
                    >
                      <div>
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-xs text-zinc-500">
                          {new Date(ev.start_time).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(ev.end_time).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {ev.tasks?.title && ` · Task: ${ev.tasks.title}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <RequireAuth>
      <ScheduleInner />
    </RequireAuth>
  )
}
