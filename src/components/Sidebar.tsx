'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import Badge from '@/components/ui/Badge'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  adminOnlyRole?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    adminOnly: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/elections',
    label: 'Elections',
    adminOnly: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18V9l9-6 9 6v9" />
        <path d="M9 18V12h6v6" />
        <path d="M3 18h18" />
        <path d="M7 9h.01M17 9h.01" />
      </svg>
    ),
  },
  {
    href: '/admin/verifications',
    label: 'Verifications',
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Users',
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/elections',
    label: 'Manage Elections',
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
        <path d="M7.76 7.76a6 6 0 0 0 0 8.49" />
      </svg>
    ),
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    adminOnly: true,
    adminOnlyRole: 'master_admin',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
        <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

function isAdmin(role: string) {
  return ['master_admin', 'teacher_admin', 'student_admin'].includes(role)
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user || !isAdmin(user.role)) return
    fetch('/api/verifications?status=pending')
      .then((r) => r.json())
      .then((res) => {
        const count = Array.isArray(res.data) ? res.data.length : (res.data?.total ?? 0)
        setPendingCount(count)
      })
      .catch(() => {})
  }, [user])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const generalItems = NAV_ITEMS.filter((item) => !item.adminOnly)
  const adminItems = NAV_ITEMS.filter((item) => item.adminOnly).filter((item) => {
    if (item.adminOnlyRole) return user?.role === item.adminOnlyRole
    return true
  })

  return (
    <aside
      className={
        'fixed top-0 left-0 h-full w-64 bg-gray-900 z-40 flex flex-col transition-transform duration-300 ' +
        (isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
      }
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 flex-shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
            <path d="M7 9v6" strokeWidth="2" />
          </svg>
          <span className="text-white font-bold text-lg">SchoolVoting</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {generalItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ' +
              (isActive(item.href)
                ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white')
            }
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        {user && isAdmin(user.role) && (
          <>
            <div className="pt-4 pb-1">
              <span className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Administration
              </span>
            </div>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ' +
                  (isActive(item.href)
                    ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white')
                }
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.href === '/admin/verifications' && pendingCount > 0 && (
                  <Badge variant="warning" size="sm">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
