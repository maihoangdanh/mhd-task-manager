'use client'

import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'
import TaskForm from '@/components/TaskForm'

export default function NewTaskPage() {
  return (
    <RequireAuth>
      <div className="max-w-lg">
        <div className="mb-4">
          <Link href="/tasks" className="text-sm text-zinc-500 hover:underline">
            ← Quay lại danh sách
          </Link>
        </div>
        <h1 className="mb-4 text-xl font-semibold">Tạo task mới</h1>
        <TaskForm />
      </div>
    </RequireAuth>
  )
}
