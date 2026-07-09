'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Loading from '@/components/Loading'

// Trang gốc: điều hướng theo trạng thái đăng nhập.
export default function Home() {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(session ? '/dashboard' : '/login')
  }, [session, loading, router])

  return <Loading />
}
