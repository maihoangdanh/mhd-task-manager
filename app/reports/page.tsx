'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import Loading from '@/components/Loading'
import { DonutChart, VBars, HBars, type Slice } from '@/components/Charts'
import type { Task, TaskStatus } from '@/types/database'

// Chỉ lấy các cột cần cho thống kê (đúng snake_case theo schema-contract).
type ReportTask = Pick<
  Task,
  'id' | 'status' | 'due_date' | 'updated_at' | 'project_id'
> & { projects: { name: string } | null }

// Màu chart đã validate (skill dataviz) — done=green mang nghĩa tích cực.
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: '#2a78d6', // blue
  in_progress: '#eda100', // amber
  done: '#1baf7a', // aqua/green
}
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
}

function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7 // 0 = Monday
  x.setDate(x.getDate() - day)
  return x
}

function ReportsInner() {
  const [tasks, setTasks] = useState<ReportTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('tasks')
      .select('id, status, due_date, updated_at, project_id, projects(name)')
      .is('parent_task_id', null)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTasks((data as unknown as ReportTask[]) ?? [])
        setLoading(false)
      })
  }, [])

  const stats = useMemo(() => {
    const total = tasks.length
    const counts: Record<TaskStatus, number> = {
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }
    const completionRate = total > 0 ? Math.round((counts.done / total) * 100) : 0

    const today = new Date().toISOString().slice(0, 10)
    const overdue = tasks.filter(
      (t) => t.status !== 'done' && t.due_date && t.due_date < today
    ).length

    // Xu hướng hoàn thành: 8 tuần gần nhất, đếm task done theo updated_at.
    const thisMonday = mondayOf(new Date())
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(thisMonday)
      start.setDate(start.getDate() - (7 - i) * 7)
      return {
        start: start.getTime(),
        label: `${start.getDate()}/${start.getMonth() + 1}`,
        value: 0,
      }
    })
    for (const t of tasks) {
      if (t.status !== 'done') continue
      const ws = mondayOf(new Date(t.updated_at)).getTime()
      const bucket = weeks.find((w) => w.start === ws)
      if (bucket) bucket.value += 1
    }

    // Breakdown theo project (task không có nhóm gộp vào "Chưa phân nhóm").
    const projMap = new Map<string, number>()
    for (const t of tasks) {
      const name = t.projects?.name ?? 'Chưa phân nhóm'
      projMap.set(name, (projMap.get(name) ?? 0) + 1)
    }
    const projects = Array.from(projMap, ([label, value]) => ({ label, value })).sort(
      (a, b) => b.value - a.value
    )

    return { total, counts, completionRate, overdue, weeks, projects }
  }, [tasks])

  if (loading) return <Loading />
  if (error)
    return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>

  const donutData: Slice[] = (['todo', 'in_progress', 'done'] as TaskStatus[]).map(
    (s) => ({ label: STATUS_LABEL[s], value: stats.counts[s], color: STATUS_COLOR[s] })
  )

  const tiles = [
    { label: 'Tổng số task', value: String(stats.total), accent: 'text-indigo-700', bg: 'from-indigo-50' },
    { label: 'Tỷ lệ hoàn thành', value: `${stats.completionRate}%`, accent: 'text-emerald-600', bg: 'from-emerald-50' },
    { label: 'Task quá hạn', value: String(stats.overdue), accent: 'text-rose-600', bg: 'from-rose-50' },
    { label: 'Số nhóm (project)', value: String(stats.projects.filter((p) => p.label !== 'Chưa phân nhóm').length), accent: 'text-amber-600', bg: 'from-amber-50' },
  ]

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-indigo-950">Thống kê</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tự đánh giá hiệu quả làm việc qua các chỉ số và biểu đồ.
        </p>
      </div>

      {stats.total === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">
          Chưa có dữ liệu task để thống kê.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className={`card bg-gradient-to-br ${t.bg} to-white p-5`}>
                <div className="text-sm font-medium text-slate-500">{t.label}</div>
                <div className={`mt-2 text-3xl font-bold ${t.accent}`}>{t.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Donut: phân bố trạng thái */}
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-indigo-950">
                Task theo trạng thái
              </h2>
              <DonutChart
                data={donutData}
                centerLabel={`${stats.completionRate}%`}
                centerSub="hoàn thành"
              />
            </section>

            {/* Breakdown theo project */}
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-indigo-950">Task theo nhóm</h2>
              <HBars data={stats.projects} color="#2a78d6" />
            </section>
          </div>

          {/* Xu hướng hoàn thành theo tuần */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-indigo-950">
                Xu hướng hoàn thành (8 tuần gần nhất)
              </h2>
              <span className="pill bg-emerald-100 text-emerald-700">
                Task hoàn thành / tuần
              </span>
            </div>
            <VBars data={stats.weeks} color="#1baf7a" unit=" task" />
          </section>
        </>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportsInner />
    </RequireAuth>
  )
}
