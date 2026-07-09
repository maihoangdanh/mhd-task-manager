'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import type { ScheduleEventWithTask, Task, TaskStatus } from '@/types/database'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
}

function DashboardInner() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<ScheduleEventWithTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const todayIso = new Date().toISOString()
    Promise.all([
      supabase.from('tasks').select('*'),
      supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, task_id, tasks(title)')
        .gte('start_time', todayIso)
        .order('start_time', { ascending: true })
        .limit(5),
    ]).then(([taskRes, eventRes]) => {
      setTasks((taskRes.data as Task[]) ?? [])
      setEvents((eventRes.data as unknown as ScheduleEventWithTask[]) ?? [])
      setLoading(false)
    })
  }, [])

  const counts: Record<TaskStatus, number> = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  const today = new Date().toISOString().slice(0, 10)
  const dueSoon = tasks
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date >= today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5)

  if (loading) {
    return <p className="text-sm text-zinc-500">Đang tải…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Tổng quan</h1>

      <div className="grid grid-cols-3 gap-3">
        {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => (
          <div
            key={s}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="text-2xl font-semibold">{counts[s]}</div>
            <div className="text-sm text-zinc-500">{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Sắp đến hạn</h2>
          <Link href="/tasks" className="text-sm text-zinc-500 hover:underline">
            Xem tất cả →
          </Link>
        </div>
        {dueSoon.length === 0 ? (
          <p className="text-sm text-zinc-500">Không có task nào sắp đến hạn.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {dueSoon.map((t) => (
              <li
                key={t.id}
                className="flex justify-between rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15"
              >
                <Link href={`/tasks/${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
                <span className="text-zinc-500">Hạn: {t.due_date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Sự kiện sắp tới</h2>
          <Link href="/schedule" className="text-sm text-zinc-500 hover:underline">
            Xem lịch →
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">Chưa có sự kiện nào sắp tới.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex justify-between rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15"
              >
                <span>{ev.title}</span>
                <span className="text-zinc-500">
                  {new Date(ev.start_time).toLocaleString('vi-VN')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  )
}
