'use client'

// Biểu đồ nhẹ, tự vẽ (SVG/CSS) — không thêm dependency.
// Màu lấy từ palette đã validate (skill dataviz): blue #2a78d6, aqua #1baf7a,
// amber #eda100. Vì contrast của aqua/amber < 3:1 trên nền sáng, MỌI mark đều
// kèm nhãn số trực tiếp (relief rule) — giá trị không bao giờ chỉ dựa vào màu.

export type Slice = { label: string; value: number; color: string }

// --- Donut: phân bố theo nhóm (categorical) --------------------------------
export function DonutChart({
  data,
  centerLabel,
  centerSub,
}: {
  data: Slice[]
  centerLabel: string
  centerSub?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 52
  const stroke = 20
  const C = 2 * Math.PI * r
  const gap = total > 0 ? 6 : 0 // khe 2px-surface giữa các mảnh (theo mark spec)

  let offset = 0
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = d.value / total
      const len = Math.max(frac * C - gap, 0)
      const seg = {
        color: d.color,
        dash: `${len} ${C - len}`,
        dashoffset: -offset,
      }
      offset += frac * C
      return seg
    })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0">
        {/* track nền */}
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#eef0f4"
          strokeWidth={stroke}
        />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={s.dash}
            strokeDashoffset={s.dashoffset}
            strokeLinecap="butt"
            transform="rotate(-90 70 70)"
          />
        ))}
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-slate-900"
          style={{ fontSize: 22, fontWeight: 700 }}
        >
          {centerLabel}
        </text>
        {centerSub && (
          <text
            x="70"
            y="86"
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: 10 }}
          >
            {centerSub}
          </text>
        )}
      </svg>

      {/* Legend + nhãn số trực tiếp (relief rule) */}
      <ul className="flex w-full flex-col gap-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-[3px]"
              style={{ background: d.color }}
            />
            <span className="flex-1 text-slate-600">{d.label}</span>
            <span className="font-semibold tabular-nums text-slate-800">{d.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-400">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- Cột dọc: xu hướng theo thời gian (một series, một hue) -----------------
export function VBars({
  data,
  color,
  unit = '',
}: {
  data: { label: string; value: number }[]
  color: string
  unit?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div>
      <div className="flex h-44 items-end gap-2 border-b border-[var(--line)] pb-0">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex flex-1 flex-col items-center justify-end gap-1"
            title={`${d.label}: ${d.value}${unit}`}
          >
            <span className="text-xs font-semibold tabular-nums text-slate-500">
              {d.value}
            </span>
            <div
              className="w-full max-w-[38px] rounded-t-md transition-all"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 4 : 0,
                background: color,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 text-center text-[10px] leading-tight text-slate-400"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Thanh ngang: breakdown theo hạng mục (một series, một hue) -------------
export function HBars({
  data,
  color,
}: {
  data: { label: string; value: number }[]
  color: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-slate-600" title={d.label}>
            {d.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div
              className="flex h-full items-center justify-end rounded-md pr-2 text-xs font-semibold text-white"
              style={{
                width: `${Math.max((d.value / max) * 100, 8)}%`,
                background: color,
              }}
            >
              {d.value}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
