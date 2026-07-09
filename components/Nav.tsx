'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

const links = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/tasks', label: 'Công việc' },
  { href: '/schedule', label: 'Lịch trình' },
  { href: '/reports', label: 'Thống kê' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  // Không hiện nav ở trang login
  if (pathname === '/login') return null

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1.5">
          <Link href="/dashboard" className="mr-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">
              T
            </span>
            <span className="hidden font-bold tracking-tight text-indigo-950 sm:inline">
              Task Manager
            </span>
          </Link>
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/')
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[16ch] truncate text-slate-400 md:inline">
              {user.email}
            </span>
            <button
              onClick={async () => {
                await signOut()
                router.push('/login')
              }}
              className="btn btn-ghost"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
