'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import RequireAuth from '@/components/RequireAuth'
import Loading from '@/components/Loading'
import type {
  FreelanceProject,
  FreelanceStatus,
  Goal,
  GoalPeriod,
  Note,
  ScheduleEventWithProject,
  TaskStatus,
  TaskWithProject,
} from '@/types/database'

/* --- Nhãn & màu tag (đồng bộ với /tasks) --------------------------------- */

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

const FREELANCE_LABEL: Record<FreelanceStatus, string> = {
  in_progress: 'Đang làm',
  almost_done: 'Sắp xong',
  done: 'Hoàn thành',
}
const FREELANCE_STYLE: Record<FreelanceStatus, string> = {
  in_progress: 'bg-amber-100 text-amber-700',
  almost_done: 'bg-indigo-100 text-indigo-700',
  done: 'bg-emerald-100 text-emerald-700',
}

// Bảng màu sticky-note (nền đặc, như giấy note dán thật) — người dùng chọn khi tạo note.
const NOTE_COLORS: { key: string; label: string; bg: string; dot: string }[] = [
  { key: 'amber', label: 'Vàng', bg: 'bg-amber-200', dot: 'bg-amber-400' },
  { key: 'indigo', label: 'Chàm', bg: 'bg-indigo-200', dot: 'bg-indigo-400' },
  { key: 'emerald', label: 'Lục', bg: 'bg-emerald-200', dot: 'bg-emerald-400' },
  { key: 'rose', label: 'Hồng', bg: 'bg-rose-200', dot: 'bg-rose-400' },
  { key: 'sky', label: 'Xanh', bg: 'bg-sky-200', dot: 'bg-sky-400' },
]
function noteColorClass(color: string | null): string {
  return NOTE_COLORS.find((c) => c.key === color)?.bg ?? 'bg-slate-200'
}

// Xoay nhẹ luân phiên từng note để trông như giấy dán thật, không thẳng hàng cứng nhắc.
const NOTE_ROTATIONS = ['-2deg', '1.5deg', '-1deg', '2deg', '-1.5deg', '1deg']

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/* --- Helper ngày (dùng giờ ĐỊA PHƯƠNG, không UTC) ------------------------ */

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 7 ngày của tuần hiện tại, Thứ 2 -> Chủ nhật.
function weekDays(base: Date): Date[] {
  const day = base.getDay() // 0=CN..6=T7
  const offsetToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + offsetToMonday)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function greeting(hour: number): string {
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

function formatRevenue(revenue: string): string {
  return Number(revenue).toLocaleString('vi-VN') + 'đ'
}

/* ========================================================================= */

function DashboardInner() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [events, setEvents] = useState<ScheduleEventWithProject[]>([])
  const [freelance, setFreelance] = useState<FreelanceProject[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, { done: number; total: number }>>({})
  const [loading, setLoading] = useState(true)

  // Modal freelance (thêm/sửa). null = đóng.
  const [freelanceModal, setFreelanceModal] = useState<FreelanceProject | 'new' | null>(null)
  // Form thêm mục tiêu ẩn mặc định, chỉ hiện khi bấm nút "+" ở header.
  const [showGoalForm, setShowGoalForm] = useState(false)

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const todayYmd = toYmd(now)
  const days = weekDays(now)
  const weekYmds = days.map(toYmd)

  const load = useCallback(async () => {
    setLoading(true)
    const [taskRes, subRes, evRes, flRes, goalRes, noteRes] = await Promise.all([
      // Chỉ lấy task gốc (parent_task_id is null); subtask ẩn khỏi các khối cấp cao.
      supabase
        .from('tasks')
        .select(
          'id, title, status, priority, due_date, due_time, project_id, recurrence_group_id, category, projects(name)'
        )
        .is('parent_task_id', null)
        .order('created_at', { ascending: false }),
      // Đếm subtask theo từng task cha.
      supabase.from('tasks').select('parent_task_id, status').not('parent_task_id', 'is', null),
      supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, completed, project_id, projects(name)')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true }),
      supabase.from('freelance_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('goals').select('*').order('created_at', { ascending: false }),
      supabase.from('notes').select('*').order('created_at', { ascending: false }),
    ])
    setTasks((taskRes.data as unknown as TaskWithProject[]) ?? [])
    const counts: Record<string, { done: number; total: number }> = {}
    for (const s of (subRes.data as { parent_task_id: string; status: TaskStatus }[]) ?? []) {
      const c = counts[s.parent_task_id] ?? { done: 0, total: 0 }
      c.total += 1
      if (s.status === 'done') c.done += 1
      counts[s.parent_task_id] = c
    }
    setSubtaskCounts(counts)
    setEvents((evRes.data as unknown as ScheduleEventWithProject[]) ?? [])
    setFreelance((flRes.data as FreelanceProject[]) ?? [])
    setGoals((goalRes.data as Goal[]) ?? [])
    setNotes((noteRes.data as Note[]) ?? [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* --- Section 3: toggle completed sự kiện (optimistic) ------------------- */
  async function toggleEvent(ev: ScheduleEventWithProject) {
    const next = !ev.completed
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, completed: next } : e)))
    const { error } = await supabase
      .from('schedule_events')
      .update({ completed: next })
      .eq('id', ev.id)
    if (error) {
      alert(error.message)
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, completed: ev.completed } : e)))
    }
  }

  /* --- Section 4: tick/bỏ tick hoàn thành trực tiếp (optimistic) ---------- */
  async function toggleTaskDone(t: TaskWithProject) {
    const prevStatus = t.status
    const next: TaskStatus = t.status === 'done' ? 'todo' : 'done'
    setTasks((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, status: next, updated_at: new Date().toISOString() } : x))
    )
    const { error } = await supabase
      .from('tasks')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', t.id)
    if (error) {
      alert(error.message)
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: prevStatus } : x)))
    }
  }

  /* --- Section 6: cập nhật % goal (optimistic) --------------------------- */
  async function updateGoalPercent(goal: Goal, percent: number) {
    const clamped = Math.max(0, Math.min(100, percent))
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, progress_percent: clamped } : g)))
    const { error } = await supabase
      .from('goals')
      .update({ progress_percent: clamped, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
    if (error) {
      alert(error.message)
      load()
    }
  }

  async function addGoal(title: string, period: GoalPeriod, targetDate: string) {
    if (!user) return
    const { error } = await supabase.from('goals').insert({
      title: title.trim(),
      period,
      progress_percent: 0,
      target_date: targetDate || null,
      user_id: user.id,
    })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function deleteGoal(id: string) {
    if (!confirm('Xóa mục tiêu này?')) return
    setGoals((prev) => prev.filter((g) => g.id !== id))
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) {
      alert(error.message)
      load()
    }
  }

  /* --- Section 5: freelance CRUD ---------------------------------------- */
  async function deleteFreelance(id: string) {
    if (!confirm('Xóa dự án freelance này?')) return
    setFreelance((prev) => prev.filter((f) => f.id !== id))
    const { error } = await supabase.from('freelance_projects').delete().eq('id', id)
    if (error) {
      alert(error.message)
      load()
    }
  }

  /* --- Section 8: notes CRUD -------------------------------------------- */
  async function addNote(content: string, color: string) {
    if (!user) return
    const { error } = await supabase.from('notes').insert({
      content: content.trim(),
      color,
      user_id: user.id,
    })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) {
      alert(error.message)
      load()
    }
  }

  if (loading) return <Loading />

  /* --- Dữ liệu dẫn xuất -------------------------------------------------- */
  const todayTasks = tasks.filter((t) => t.due_date === todayYmd)
  const todayDone = todayTasks.filter((t) => t.status === 'done').length
  const freelanceActive = freelance.filter((f) => f.status !== 'done').length
  const activeGoals = goals.filter((g) => g.progress_percent < 100)
  const avgGoal =
    activeGoals.length === 0
      ? 0
      : Math.round(activeGoals.reduce((s, g) => s + g.progress_percent, 0) / activeGoals.length)

  // Section 4: CHỈ 3 loại — (1) việc có hạn đúng hôm nay (mọi trạng thái, done thì gạch ngang thay vì
  // ẩn, để thấy tiến độ trong ngày); (2) việc quá hạn (due_date < hôm nay) NHƯNG CHƯA hoàn thành (quá
  // hạn mà đã done thì ẩn luôn); và (3) việc đang trong khoảng xử lý — start_date <= hôm nay <= due_date
  // (hoặc chưa có due_date) — vd task bắt đầu hôm nay nhưng hạn tuần sau vẫn cần hiện ra để biết đang
  // làm. Task category='habit' KHÔNG hiện ở đây — chuyển hẳn sang khối "Lịch trình hôm nay" (section 3).
  const activeTasks = tasks.filter((t) => {
    if (t.category === 'habit') return false
    const dueToday = t.due_date === todayYmd
    const overdueUnfinished = !!t.due_date && t.due_date < todayYmd && t.status !== 'done'
    const inProgressWindow =
      !!t.start_date && t.start_date <= todayYmd && (!t.due_date || t.due_date > todayYmd)
    return dueToday || overdueUnfinished || inProgressWindow
  })
  const taskGroups = new Map<string, { name: string; items: TaskWithProject[] }>()
  for (const t of activeTasks) {
    const key = t.project_id ?? '__none__'
    const name = t.projects?.name ?? 'Cá nhân'
    if (!taskGroups.has(key)) taskGroups.set(key, { name, items: [] })
    taskGroups.get(key)!.items.push(t)
  }

  // Section 3: "Lịch trình hôm nay" gộp 2 nguồn — schedule_events (có giờ cụ thể) VÀ task
  // category='habit' đến hạn hôm nay (không có giờ cụ thể, xem như "cả ngày"). Sắp xếp: mục
  // không giờ ("cả ngày") lên đầu giống lịch Google Calendar, còn lại theo giờ tăng dần.
  type TodayRow = {
    key: string
    timeLabel: string
    sortKey: string
    title: string
    source: string
    done: boolean
    onToggle: () => void
  }
  const habitTodayTasks = tasks.filter((t) => t.category === 'habit' && t.due_date === todayYmd)
  const eventRows: TodayRow[] = events.map((ev) => {
    const hhmm = new Date(ev.start_time).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return {
      key: `ev-${ev.id}`,
      timeLabel: hhmm,
      sortKey: `1-${hhmm}`,
      title: ev.title,
      source: ev.projects?.name ?? 'Cá nhân',
      done: ev.completed,
      onToggle: () => toggleEvent(ev),
    }
  })
  const habitRows: TodayRow[] = habitTodayTasks.map((t) => {
    // due_time dạng 'HH:MM:SS' -> chỉ lấy 'HH:MM'. Có giờ thì sort như event thường; không thì "Cả ngày".
    const hhmm = t.due_time?.slice(0, 5)
    return {
      key: `task-${t.id}`,
      timeLabel: hhmm ?? 'Cả ngày',
      sortKey: hhmm ? `1-${hhmm}` : `0-${t.title}`,
      title: t.title,
      source: t.projects?.name ?? 'Cá nhân',
      done: t.status === 'done',
      onToggle: () => toggleTaskDone(t),
    }
  })
  const todayRows = [...eventRows, ...habitRows].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  // Section 7: chuỗi lặp có due_date trong tuần hiện tại, nhóm theo recurrence_group_id.
  const weekStart = weekYmds[0]
  const weekEnd = weekYmds[6]
  // Chỉ lấy chuỗi lặp là THÓI QUEN (category === 'habit'); chuỗi 'work'
  // (vd daily standup công ty) không hiện ở lưới này — vẫn hiện trong mục Công việc.
  const habitTasks = tasks.filter(
    (t) =>
      t.recurrence_group_id &&
      t.category === 'habit' &&
      t.due_date &&
      t.due_date >= weekStart &&
      t.due_date <= weekEnd
  )
  const habitGroups = new Map<string, { title: string; byDate: Map<string, TaskWithProject> }>()
  for (const t of habitTasks) {
    const key = t.recurrence_group_id!
    if (!habitGroups.has(key)) habitGroups.set(key, { title: t.title, byDate: new Map() })
    habitGroups.get(key)!.byDate.set(t.due_date!, t)
  }

  const fullDate = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-7">
      {/* 1. Header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-indigo-950">
            {greeting(now.getHours())}
            {user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
          </h1>
          <p className="mt-1 text-sm capitalize text-slate-500">{fullDate}</p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          + Tạo task
        </Link>
      </div>

      {/* 2. Stat cards -------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Task hôm nay"
          value={`${todayDone}/${todayTasks.length}`}
          icon="✅"
          gradient="from-emerald-50 to-white"
          chip="bg-emerald-100 text-emerald-600"
          num="text-emerald-600"
        />
        <StatCard
          label="Freelance đang chạy"
          value={String(freelanceActive)}
          icon="💼"
          gradient="from-indigo-50 to-white"
          chip="bg-indigo-100 text-indigo-600"
          num="text-indigo-700"
        />
        <StatCard
          label="Tiến độ mục tiêu"
          value={`${avgGoal}%`}
          icon="🎯"
          gradient="from-amber-50 to-white"
          chip="bg-amber-100 text-amber-600"
          num="text-amber-600"
        />
      </div>

      {/* 3. Lịch trình hôm nay (bảng) ----------------------------------- */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-indigo-950">Lịch trình hôm nay</h2>
          <Link
            href="/schedule"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Xem lịch →
          </Link>
        </div>
        {todayRows.length === 0 ? (
          <p className="text-sm text-slate-400">Hôm nay không có lịch trình nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Giờ</th>
                  <th className="py-2 pr-3 font-medium">Việc</th>
                  <th className="py-2 pr-3 font-medium">Nguồn</th>
                  <th className="py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((row) => (
                  <tr key={row.key} className="border-b border-[var(--line)] last:border-0">
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-slate-600">
                      {row.timeLabel}
                    </td>
                    <td
                      className={`py-2.5 pr-3 font-medium ${
                        row.done ? 'text-slate-400 line-through' : 'text-slate-800'
                      }`}
                    >
                      {row.title}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="pill bg-slate-100 text-slate-600">{row.source}</span>
                    </td>
                    <td className="py-2.5">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.done}
                          onChange={row.onToggle}
                          className="h-4.5 w-4.5 accent-indigo-600"
                        />
                        <span className={`text-xs ${row.done ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {row.done ? 'Xong' : 'Chưa'}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Công việc (nhóm theo project) -------------------------------- */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-indigo-950">Công việc</h2>
          <Link href="/tasks" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Xem tất cả →
          </Link>
        </div>
        {taskGroups.size === 0 ? (
          <p className="text-sm text-slate-400">Không còn công việc nào chưa hoàn thành. 🎉</p>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(taskGroups.values()).map((group) => (
              <div key={group.name}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="pill bg-indigo-100 text-indigo-700">📁 {group.name}</span>
                  <span className="text-xs text-slate-400">{group.items.length} việc</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {group.items.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={() => toggleTaskDone(t)}
                        title="Đánh dấu hoàn thành"
                        className="h-4 w-4 shrink-0 accent-indigo-600"
                      />
                      <Link
                        href={`/tasks/${t.id}`}
                        className={`mr-auto font-medium hover:text-indigo-700 ${
                          t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'
                        }`}
                      >
                        {t.title}
                      </Link>
                      {subtaskCounts[t.id] && (
                        <span
                          className="pill bg-sky-100 text-sky-700"
                          title="Việc con đã hoàn thành / tổng số"
                        >
                          ☑ {subtaskCounts[t.id].done}/{subtaskCounts[t.id].total}
                        </span>
                      )}
                      {t.recurrence_group_id &&
                        (t.category === 'habit' ? (
                          <span
                            className="pill bg-rose-100 text-rose-700"
                            title="Thói quen lặp lại"
                          >
                            🔁 Thói quen
                          </span>
                        ) : (
                          <span
                            className="pill bg-violet-100 text-violet-700"
                            title="Công việc lặp lại"
                          >
                            🔁 Lặp
                          </span>
                        ))}
                      <span className={`pill ${PRIORITY_STYLE[t.priority]}`}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                      <span className={`pill ${STATUS_STYLE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Làm thêm / Freelance ---------------------------------------- */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-indigo-950">Làm thêm / Freelance</h2>
          <button onClick={() => setFreelanceModal('new')} className="btn btn-ghost text-sm">
            + Thêm dự án
          </button>
        </div>
        {freelance.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có dự án freelance nào.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {freelance.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-slate-50 px-4 py-3"
              >
                <div className="mr-auto min-w-0">
                  <div className="font-semibold text-slate-800">{f.project_name}</div>
                  <div className="text-xs text-slate-500">👤 {f.client_name}</div>
                </div>
                <span className="font-semibold tabular-nums text-indigo-700">
                  {formatRevenue(f.revenue)}
                </span>
                <span className={`pill ${FREELANCE_STYLE[f.status]}`}>
                  {FREELANCE_LABEL[f.status]}
                </span>
                <button
                  onClick={() => setFreelanceModal(f)}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  Sửa
                </button>
                <button
                  onClick={() => deleteFreelance(f.id)}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. Mục tiêu tuần/tháng ----------------------------------------- */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-indigo-950">Mục tiêu tuần/tháng</h2>
          <button
            type="button"
            onClick={() => setShowGoalForm((v) => !v)}
            className="btn btn-ghost !px-2.5 !py-1 text-sm"
            aria-expanded={showGoalForm}
          >
            {showGoalForm ? '✕ Đóng' : '+ Thêm mục tiêu'}
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {goals.map((g) => (
            <div key={g.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-medium text-slate-800">{g.title}</span>
                <span className="pill bg-violet-100 text-violet-700">
                  {g.period === 'week' ? 'Tuần' : 'Tháng'}
                </span>
                <span className="ml-auto text-sm font-semibold tabular-nums text-indigo-700">
                  {g.progress_percent}%
                </span>
                <button
                  onClick={() => deleteGoal(g.id)}
                  className="rounded-lg px-2 py-0.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Xóa
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                    style={{ width: `${g.progress_percent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={g.progress_percent}
                  onChange={(e) => updateGoalPercent(g, Number(e.target.value))}
                  className="w-28 accent-indigo-600"
                  aria-label={`Tiến độ ${g.title}`}
                />
              </div>
            </div>
          ))}
          {showGoalForm && (
            <GoalAddForm onAdd={addGoal} onDone={() => setShowGoalForm(false)} />
          )}
        </div>
      </section>

      {/* 7. Theo dõi thói quen ------------------------------------------ */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-indigo-950">Theo dõi thói quen</h2>
        {habitGroups.size === 0 ? (
          <p className="text-sm text-slate-400">
            Chưa có chuỗi task lặp lại nào trong tuần này.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-1.5 pr-3 font-medium">Thói quen</th>
                  {days.map((d, i) => (
                    <th key={i} className="px-1 py-1.5 text-center font-medium">
                      <div>{WEEKDAY_LABELS[i]}</div>
                      <div className="text-[10px] text-slate-300">{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(habitGroups.values()).map((group, gi) => (
                  <tr key={gi} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-3 font-medium text-slate-700">{group.title}</td>
                    {weekYmds.map((ymd) => {
                      const task = group.byDate.get(ymd)
                      const done = task?.status === 'done'
                      return (
                        <td key={ymd} className="px-1 py-2 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs ${
                              done
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 8. Ghi chú nhanh ----------------------------------------------- */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-indigo-950">Ghi chú nhanh</h2>
        <NoteAddForm onAdd={addNote} />
        {notes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Chưa có ghi chú nào.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((n, i) => (
              <div
                key={n.id}
                style={{ transform: `rotate(${NOTE_ROTATIONS[i % NOTE_ROTATIONS.length]})` }}
                className={`sticky-note group relative p-4 text-base text-slate-800 ${noteColorClass(
                  n.color
                )}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    onChange={() => deleteNote(n.id)}
                    title="Đánh dấu hoàn thành"
                    aria-label="Đánh dấu hoàn thành"
                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-700"
                  />
                  <p className="font-caveat whitespace-pre-wrap break-words pr-4 pl-0.5 text-xl leading-snug">
                    {n.content}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="absolute right-1.5 top-1.5 rounded-md px-1.5 text-slate-500/70 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                  aria-label="Xóa ghi chú"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {freelanceModal && (
        <FreelanceModal
          initial={freelanceModal === 'new' ? null : freelanceModal}
          userId={user?.id ?? ''}
          onClose={() => setFreelanceModal(null)}
          onSaved={() => {
            setFreelanceModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/* --- Sub-component: Stat card -------------------------------------------- */
function StatCard({
  label,
  value,
  icon,
  gradient,
  chip,
  num,
}: {
  label: string
  value: string
  icon: string
  gradient: string
  chip: string
  num: string
}) {
  return (
    <div className={`card bg-gradient-to-br ${gradient} p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${chip}`}>
          {icon}
        </span>
      </div>
      <div className={`mt-3 text-4xl font-bold tabular-nums ${num}`}>{value}</div>
    </div>
  )
}

/* --- Sub-component: form thêm goal --------------------------------------- */
function GoalAddForm({
  onAdd,
  onDone,
}: {
  onAdd: (title: string, period: GoalPeriod, targetDate: string) => Promise<void>
  onDone?: () => void
}) {
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState<GoalPeriod>('week')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title, period, targetDate)
    setTitle('')
    setTargetDate('')
    setPeriod('week')
    setSaving(false)
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Mục tiêu mới…"
        className="input flex-1 min-w-[160px]"
      />
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
        className="input w-auto"
      >
        <option value="week">Tuần</option>
        <option value="month">Tháng</option>
      </select>
      <input
        type="date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        className="input w-auto"
      />
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? '…' : '+ Thêm'}
      </button>
    </form>
  )
}

/* --- Sub-component: form thêm note --------------------------------------- */
function NoteAddForm({ onAdd }: { onAdd: (content: string, color: string) => Promise<void> }) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState(NOTE_COLORS[0].key)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    await onAdd(content, color)
    setContent('')
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ghi chú nhanh…"
        className="input flex-1 min-w-[160px]"
      />
      <div className="flex items-center gap-1.5">
        {NOTE_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setColor(c.key)}
            className={`h-6 w-6 rounded-full ${c.dot} ${
              color === c.key ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
            }`}
            aria-label={`Màu ${c.label}`}
          />
        ))}
      </div>
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? '…' : '+ Thêm'}
      </button>
    </form>
  )
}

/* --- Sub-component: modal freelance (thêm/sửa) --------------------------- */
function FreelanceModal({
  initial,
  userId,
  onClose,
  onSaved,
}: {
  initial: FreelanceProject | null
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [clientName, setClientName] = useState(initial?.client_name ?? '')
  const [projectName, setProjectName] = useState(initial?.project_name ?? '')
  const [revenue, setRevenue] = useState(initial ? String(Number(initial.revenue)) : '')
  const [status, setStatus] = useState<FreelanceStatus>(initial?.status ?? 'in_progress')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setError(null)
    const payload = {
      client_name: clientName.trim(),
      project_name: projectName.trim(),
      revenue: Number(revenue) || 0,
      status,
    }
    const { error } = initial
      ? await supabase
          .from('freelance_projects')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', initial.id)
      : await supabase.from('freelance_projects').insert({ ...payload, user_id: userId })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card flex w-full max-w-sm flex-col gap-3 p-6"
      >
        <h2 className="text-lg font-bold text-indigo-950">
          {initial ? 'Sửa dự án freelance' : 'Thêm dự án freelance'}
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          <span>Tên khách hàng</span>
          <input
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Tên dự án</span>
          <input
            required
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Doanh thu (đ)</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FreelanceStatus)}
            className="input"
          >
            <option value="in_progress">Đang làm</option>
            <option value="almost_done">Sắp xong</option>
            <option value="done">Hoàn thành</option>
          </select>
        </label>
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Hủy
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
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
