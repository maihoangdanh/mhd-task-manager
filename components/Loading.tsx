// Spinner tải dùng chung — style nhất quán toàn app.
export default function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
        aria-hidden
      />
      {label}
    </div>
  )
}
