'use client'

import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'
import TaskForm from '@/components/TaskForm'

export default function NewTaskPage() {
  return (
    <RequireAuth>
      <div className="max-w-lg">
        <div className="mb-4">
          <Link
            href="/tasks"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Quay lại danh sách
          </Link>
        </div>
        <h1 className="mb-5 text-2xl font-bold tracking-tight text-indigo-950">
          Tạo task mới
        </h1>
        <TaskForm />
      </div>
    </RequireAuth>
  )
}
