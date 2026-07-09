'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

// Bọc nội dung trang cần đăng nhập. Chưa có session -> chuyển sang /login.
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [loading, session, router])

  if (loading) {
    return <p className="text-sm text-zinc-500">Đang tải…</p>
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
