'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import TaskForm from '@/components/TaskForm'
import type { Task } from '@/types/database'

function EditTaskInner() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTask(data as Task)
        setLoading(false)
      })
  }, [id])

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <Link href="/tasks" className="text-sm text-zinc-500 hover:underline">
          ← Quay lại danh sách
        </Link>
      </div>
      <h1 className="mb-4 text-xl font-semibold">Sửa task</h1>
      {loading ? (
        <p className="text-sm text-zinc-500">Đang tải…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : task ? (
        <TaskForm task={task} />
      ) : (
        <p className="text-sm text-zinc-500">Không tìm thấy task.</p>
      )}
    </div>
  )
}

export default function EditTaskPage() {
  return (
    <RequireAuth>
      <EditTaskInner />
    </RequireAuth>
  )
}
