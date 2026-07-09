'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import RequireAuth from '@/components/RequireAuth'
import Loading from '@/components/Loading'
import type { ScheduleEventWithTask, Task } from '@/types/database'

const inputClass = 'input'

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
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-indigo-950">Lịch trình</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lên lịch sự kiện và liên kết với công việc của bạn.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card flex flex-col gap-3 p-5">
        <h2 className="font-semibold text-indigo-950">Thêm sự kiện</h2>
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
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}
        <button type="submit" disabled={saving} className="btn btn-primary self-start">
          {saving ? 'Đang lưu…' : '+ Thêm sự kiện'}
        </button>
      </form>

      <section>
        <h2 className="mb-3 font-semibold text-indigo-950">Danh sách sự kiện</h2>
        {loading ? (
          <Loading />
        ) : events.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-400">
            Chưa có sự kiện nào.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="pill bg-indigo-100 text-indigo-700">{day}</span>
                  <span className="text-xs text-slate-400">
                    {dayEvents.length} sự kiện
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {dayEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="card flex items-center justify-between px-4 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800">
                            {ev.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            🕑{' '}
                            {new Date(ev.start_time).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            –{' '}
                            {new Date(ev.end_time).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {ev.tasks?.title && ` · 📋 ${ev.tasks.title}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium text-rose-600 hover:bg-rose-50"
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
