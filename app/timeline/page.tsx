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

// Màu thanh theo status — cùng hệ màu status ở /tasks (indigo / amber / emerald),
// dùng bản đặc để đọc rõ trên lưới. Nhận diện KHÔNG chỉ bằng màu: có nhãn tiêu đề ở
// cột trái + chú thích (legend), thoả yêu cầu tiếp cận của skill dataviz.
const STATUS_BAR: Record<TaskStatus, string> = {
  todo: 'bg-indigo-500',
  in_progress: 'bg-amber-500',
  done: 'bg-emerald-500',
}

const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

const LABEL_W = 176 // px — bề rộng cột nhãn (khớp giữa header và các hàng)
const DAY_MIN_W = 28 // px — bề rộng tối thiểu mỗi cột ngày (để cuộn ngang khi hẹp)

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dayOfMonth(ymd: string): number {
  return Number(ymd.slice(8, 10))
}
function shortRange(start: string, end: string): string {
  const s = `${dayOfMonth(start)}/${Number(start.slice(5, 7))}`
  if (start === end) return s
  return `${s} → ${dayOfMonth(end)}/${Number(end.slice(5, 7))}`
}

// Thanh đã tính vị trí trong tháng đang xem.
type PlacedTask = {
  task: TaskWithProject
  startDay: number
  endDay: number
  continuesLeft: boolean
  continuesRight: boolean
  fullStart: string
  fullEnd: string
}

const NONE_KEY = '__none__'

function TimelineInner() {
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  const load = useCallback(async () => {
    setLoading(true)
    // Chỉ lấy task có due_date (bỏ task không có ngày nào).
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, start_date, project_id, projects(name)')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
    if (error) setError(error.message)
    else setTasks((data as unknown as TaskWithProject[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const monthStartYmd = toYmd(new Date(viewYear, viewMonth, 1))
  const monthEndYmd = toYmd(new Date(viewYear, viewMonth, daysInMonth))
  const todayYmd = toYmd(today)

  // Nhóm theo project, chỉ giữ task có thanh trong tháng đang xem.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; isNone: boolean; items: PlacedTask[] }>()
    for (const t of tasks) {
      if (!t.due_date) continue
      const end = t.due_date
      // start hợp lệ: có start_date và <= due_date, nếu không thì thanh 1 ngày tại due_date.
      const start = t.start_date && t.start_date <= end ? t.start_date : end
      // Bỏ task không giao với tháng đang xem (so sánh chuỗi YYYY-MM-DD là hợp lệ).
      if (end < monthStartYmd || start > monthEndYmd) continue
      const clampedStart = start < monthStartYmd ? monthStartYmd : start
      const clampedEnd = end > monthEndYmd ? monthEndYmd : end
      const key = t.project_id ?? NONE_KEY
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          name: t.project_id ? t.projects?.name ?? 'Không tên' : 'Chưa phân nhóm',
          isNone: !t.project_id,
          items: [],
        }
        map.set(key, g)
      }
      g.items.push({
        task: t,
        startDay: dayOfMonth(clampedStart),
        endDay: dayOfMonth(clampedEnd),
        continuesLeft: start < monthStartYmd,
        continuesRight: end > monthEndYmd,
        fullStart: start,
        fullEnd: end,
      })
    }
    return [...map.values()].sort((a, b) => {
      if (a.isNone !== b.isNone) return a.isNone ? 1 : -1
      return a.name.localeCompare(b.name, 'vi')
    })
  }, [tasks, monthStartYmd, monthEndYmd])

  const hasBars = groups.some((g) => g.items.length > 0)
  const gridTemplate = `repeat(${daysInMonth}, minmax(0, 1fr))`
  const contentMinWidth = LABEL_W + daysInMonth * DAY_MIN_W

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-indigo-950">Timeline</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dòng thời gian công việc theo tháng — thanh trải từ ngày bắt đầu đến hạn chót.
          </p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          + Tạo task
        </Link>
      </div>

      {/* Điều hướng tháng + chú thích màu */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn btn-ghost px-3" aria-label="Tháng trước">
            ←
          </button>
          <span className="min-w-[140px] text-center text-base font-semibold text-indigo-950">
            {MONTHS[viewMonth]}, {viewYear}
          </span>
          <button onClick={nextMonth} className="btn btn-ghost px-3" aria-label="Tháng sau">
            →
          </button>
          <button onClick={goToday} className="btn btn-ghost text-sm">
            Hôm nay
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${STATUS_BAR[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}

      {loading ? (
        <Loading />
      ) : !hasBars ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-slate-400">
            Không có công việc nào có hạn trong {MONTHS[viewMonth].toLowerCase()}, {viewYear}.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-4">
          <div style={{ minWidth: contentMinWidth }}>
            {/* Hàng tiêu đề ngày */}
            <div className="mb-2 flex items-end">
              <div className="shrink-0" style={{ width: LABEL_W }} />
              <div className="grid flex-1" style={{ gridTemplateColumns: gridTemplate }}>
                {dayNums.map((n) => {
                  const ymd = toYmd(new Date(viewYear, viewMonth, n))
                  const dow = new Date(viewYear, viewMonth, n).getDay() // 0=CN,6=T7
                  const weekend = dow === 0 || dow === 6
                  const isToday = ymd === todayYmd
                  return (
                    <div
                      key={n}
                      className={`text-center text-[11px] tabular-nums ${
                        isToday
                          ? 'font-bold text-indigo-600'
                          : weekend
                            ? 'text-amber-500'
                            : 'text-slate-400'
                      }`}
                    >
                      {n}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Các nhóm project */}
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="pill bg-indigo-100 text-indigo-700">
                      {group.isNone ? '📥 ' : '📁 '}
                      {group.name}
                    </span>
                    <span className="text-xs text-slate-400">{group.items.length} việc</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.items.map((p) => (
                      <div key={p.task.id} className="flex items-center">
                        <div
                          className="shrink-0 truncate pr-3 text-sm font-medium text-slate-700"
                          style={{ width: LABEL_W }}
                          title={p.task.title}
                        >
                          {p.task.title}
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            {shortRange(p.fullStart, p.fullEnd)}
                          </span>
                        </div>
                        <div
                          className="grid flex-1 rounded-md bg-slate-50 py-1"
                          style={{ gridTemplateColumns: gridTemplate }}
                        >
                          <Link
                            href={`/tasks/${p.task.id}`}
                            title={`${p.task.title} · ${shortRange(p.fullStart, p.fullEnd)} · ${STATUS_LABEL[p.task.status]}`}
                            aria-label={`${p.task.title}, ${STATUS_LABEL[p.task.status]}, ${shortRange(p.fullStart, p.fullEnd)}`}
                            className={`h-6 min-w-[6px] transition-opacity hover:opacity-80 ${STATUS_BAR[p.task.status]} ${
                              p.continuesLeft ? 'rounded-l-none' : 'rounded-l-md'
                            } ${p.continuesRight ? 'rounded-r-none' : 'rounded-r-md'}`}
                            style={{ gridColumn: `${p.startDay} / ${p.endDay + 1}` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TimelinePage() {
  return (
    <RequireAuth>
      <TimelineInner />
    </RequireAuth>
  )
}
