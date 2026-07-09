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

const inputClass = 'input'
const labelText = 'font-medium text-slate-600'

// Thứ trong tuần theo giá trị Date.getDay() (0 = Chủ nhật ... 6 = Thứ 7).
// Hiển thị theo thứ tự Thứ 2 -> Chủ nhật.
const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: 'T2' },
  { day: 2, label: 'T3' },
  { day: 3, label: 'T4' },
  { day: 4, label: 'T5' },
  { day: 5, label: 'T6' },
  { day: 6, label: 'T7' },
  { day: 0, label: 'CN' },
]

const WEEKDAY_NAME: Record<number, string> = {
  0: 'Chủ nhật',
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
}

// Parse/format 'YYYY-MM-DD' theo local time (tránh lệch timezone khi lặp qua ngày).
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function shortDate(s: string): string {
  const d = parseYMD(s)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// Danh sách ngày hợp lệ trong khoảng [start, end], loại thứ & ngày cụ thể bị bỏ qua.
function computeRecurringDates(
  start: string,
  end: string,
  excludedWeekdays: Set<number>,
  excludedDates: Set<string>
): string[] {
  if (!start || !end) return []
  const startD = parseYMD(start)
  const endD = parseYMD(end)
  if (endD < startD) return []
  const result: string[] = []
  for (const d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    if (excludedWeekdays.has(d.getDay())) continue
    const ymd = formatYMD(d)
    if (excludedDates.has(ymd)) continue
    result.push(ymd)
  }
  return result
}

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

  // --- Chế độ lặp lại hàng ngày (chỉ khi tạo mới) ---
  const [recurring, setRecurring] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [excludedWeekdays, setExcludedWeekdays] = useState<Set<number>>(new Set())
  const [excludedDates, setExcludedDates] = useState<string[]>([])
  const [excludeDateInput, setExcludeDateInput] = useState('')

  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Khi bật chế độ lặp lại lần đầu, gợi ý sẵn khoảng "hôm nay -> cuối tháng này"
  // thay vì để trống/autofill của trình duyệt gây nhầm lẫn ngày kết thúc trước ngày bắt đầu.
  useEffect(() => {
    if (recurring && !startDate && !endDate) {
      const today = new Date()
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setStartDate(formatYMD(today))
      setEndDate(formatYMD(endOfMonth))
    }
  }, [recurring, startDate, endDate])

  function toggleWeekday(day: number) {
    setExcludedWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  function addExcludeDate() {
    const d = excludeDateInput
    if (!d) return
    setExcludedDates((prev) => (prev.includes(d) ? prev : [...prev, d].sort()))
    setExcludeDateInput('')
  }

  // Preview số ngày sẽ tạo + mô tả loại trừ.
  const excludedDatesSet = new Set(excludedDates)
  const recurringDates = recurring
    ? computeRecurringDates(startDate, endDate, excludedWeekdays, excludedDatesSet)
    : []
  const excludedDatesInRange = excludedDates.filter(
    (d) => startDate && endDate && d >= startDate && d <= endDate
  ).length
  const weekdayExclusionParts = Array.from(excludedWeekdays)
    .map((day) => {
      let count = 0
      if (startDate && endDate) {
        const startD = parseYMD(startDate)
        const endD = parseYMD(endDate)
        for (const d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === day) count++
        }
      }
      return { day, count }
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => a.day - b.day)
    .map((x) => `${x.count} ${WEEKDAY_NAME[x.day]}`)

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

      const base = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        project_id: resolvedProjectId,
      }

      if (isEdit && task) {
        const { error } = await supabase
          .from('tasks')
          .update({ ...base, due_date: dueDate || null, updated_at: new Date().toISOString() })
          .eq('id', task.id)
        if (error) throw error
      } else if (recurring) {
        // Tạo chuỗi task lặp lại: mỗi ngày hợp lệ = 1 row, cùng recurrence_group_id.
        if (recurringDates.length === 0) {
          throw new Error('Không có ngày hợp lệ nào trong khoảng đã chọn.')
        }
        const groupId = crypto.randomUUID()
        const rows = recurringDates.map((d) => ({
          ...base,
          due_date: d,
          user_id: user.id,
          recurrence_group_id: groupId,
        }))
        const { error } = await supabase.from('tasks').insert(rows)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert({ ...base, due_date: dueDate || null, user_id: user.id })
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
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
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
          <span className={labelText}>Trạng thái</span>
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
          <span className={labelText}>Ưu tiên</span>
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

      {/* Toggle lặp lại — chỉ khi tạo task mới */}
      {!isEdit && (
        <label className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3.5 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          <span className="font-medium text-indigo-800">🔁 Lặp lại hàng ngày</span>
        </label>
      )}

      {!recurring ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Hạn chót</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-[var(--line)] p-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelText}>Ngày bắt đầu *</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelText}>Ngày kết thúc *</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className={labelText}>Bỏ qua các thứ trong tuần</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w) => {
                const active = excludedWeekdays.has(w.day)
                return (
                  <button
                    key={w.day}
                    type="button"
                    onClick={() => toggleWeekday(w.day)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                        : 'border border-[var(--line)] bg-white text-slate-600 hover:bg-indigo-50'
                    }`}
                  >
                    {w.label}
                  </button>
                )
              })}
            </div>
            <span className="text-xs text-slate-400">Chọn thứ để BỎ QUA (không tạo task vào các ngày đó).</span>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className={labelText}>Bỏ qua ngày cụ thể</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={excludeDateInput}
                onChange={(e) => setExcludeDateInput(e.target.value)}
                className={inputClass}
              />
              <button type="button" onClick={addExcludeDate} className="btn btn-ghost shrink-0">
                Thêm
              </button>
            </div>
            {excludedDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {excludedDates.map((d) => (
                  <span key={d} className="pill bg-rose-100 text-rose-700">
                    {shortDate(d)}
                    <button
                      type="button"
                      onClick={() => setExcludedDates((prev) => prev.filter((x) => x !== d))}
                      className="ml-0.5 font-bold text-rose-500 hover:text-rose-800"
                      aria-label="Bỏ ngày này khỏi danh sách loại trừ"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {startDate && endDate && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              {recurringDates.length > 0 ? (
                <>
                  Sẽ tạo <strong>{recurringDates.length} task</strong> từ {shortDate(startDate)} đến{' '}
                  {shortDate(endDate)}
                  {weekdayExclusionParts.length > 0 && <>, trừ {weekdayExclusionParts.join(', ')}</>}
                  {excludedDatesInRange > 0 && <>, và {excludedDatesInRange} ngày bạn chọn</>}.
                </>
              ) : endDate < startDate ? (
                'Ngày kết thúc phải sau ngày bắt đầu.'
              ) : (
                'Không có ngày hợp lệ nào trong khoảng đã chọn (đã bị loại trừ hết).'
              )}
            </p>
          )}
        </div>
      )}

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

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || (recurring && recurringDates.length === 0)}
          className="btn btn-primary"
        >
          {saving
            ? 'Đang lưu…'
            : isEdit
              ? 'Cập nhật'
              : recurring
                ? `Tạo ${recurringDates.length} task`
                : 'Tạo task'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/tasks')}
          className="btn btn-ghost"
        >
          Hủy
        </button>
      </div>
    </form>
  )
}
