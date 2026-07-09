'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Loading from '@/components/Loading'

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
    return <Loading />
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
