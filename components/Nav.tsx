'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

const links = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/tasks', label: 'Công việc' },
  { href: '/schedule', label: 'Lịch trình' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  // Không hiện nav ở trang login
  if (pathname === '/login') return null

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="mr-3 font-semibold">Task Manager</span>
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/')
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{user.email}</span>
            <button
              onClick={async () => {
                await signOut()
                router.push('/login')
              }}
              className="rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
