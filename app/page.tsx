'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

// Trang gốc: điều hướng theo trạng thái đăng nhập.
export default function Home() {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(session ? '/dashboard' : '/login')
  }, [session, loading, router])

  return <p className="text-sm text-zinc-500">Đang tải…</p>
}
