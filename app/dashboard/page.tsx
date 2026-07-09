'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import Loading from '@/components/Loading'
import type { ScheduleEventWithTask, Task, TaskStatus } from '@/types/database'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
}

const STATUS_CARD: Record<
  TaskStatus,
  { ring: string; chip: string; icon: string; num: string }
> = {
  todo: {
    ring: 'from-indigo-50 to-white',
    chip: 'bg-indigo-100 text-indigo-600',
    icon: '📋',
    num: 'text-indigo-700',
  },
  in_progress: {
    ring: 'from-amber-50 to-white',
    chip: 'bg-amber-100 text-amber-600',
    icon: '⚡',
    num: 'text-amber-600',
  },
  done: {
    ring: 'from-emerald-50 to-white',
    chip: 'bg-emerald-100 text-emerald-600',
    icon: '✅',
    num: 'text-emerald-600',
  },
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
    return <Loading />
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-indigo-950">
            Tổng quan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Nhìn nhanh tình hình công việc và lịch trình của bạn.
          </p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          + Tạo task
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => {
          const c = STATUS_CARD[s]
          return (
            <div
              key={s}
              className={`card bg-gradient-to-br ${c.ring} p-5`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  {STATUS_LABEL[s]}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${c.chip}`}
                >
                  {c.icon}
                </span>
              </div>
              <div className={`mt-3 text-4xl font-bold ${c.num}`}>{counts[s]}</div>
            </div>
          )
        })}
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-indigo-950">Sắp đến hạn</h2>
          <Link
            href="/tasks"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Xem tất cả →
          </Link>
        </div>
        {dueSoon.length === 0 ? (
          <p className="text-sm text-slate-400">Không có task nào sắp đến hạn.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dueSoon.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm transition-colors hover:bg-indigo-50"
              >
                <Link
                  href={`/tasks/${t.id}`}
                  className="font-medium text-slate-700 hover:text-indigo-700"
                >
                  {t.title}
                </Link>
                <span className="pill bg-amber-100 text-amber-700">Hạn: {t.due_date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-indigo-950">Sự kiện sắp tới</h2>
          <Link
            href="/schedule"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Xem lịch →
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có sự kiện nào sắp tới.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-slate-700">{ev.title}</span>
                <span className="text-slate-500">
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
