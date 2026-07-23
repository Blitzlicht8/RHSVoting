'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import Navbar from '@/components/Navbar'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  BookOpen,
  ListChecks,
  Flag,
  FileText,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react'

interface AdminNavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin/verifications', label: 'Verifications', icon: <ShieldCheck className="w-5 h-5" /> },
  { href: '/admin/users', label: 'Members', icon: <Users className="w-5 h-5" /> },
  { href: '/admin/academic', label: 'Group Structure', icon: <BookOpen className="w-5 h-5" /> },
  { href: '/admin/elections', label: 'Manage Elections', icon: <ListChecks className="w-5 h-5" /> },
  { href: '/admin/reports', label: 'Reports', icon: <Flag className="w-5 h-5" />, roles: ['master_admin', 'admin'] },
  { href: '/admin/logs', label: 'Activity Logs', icon: <FileText className="w-5 h-5" />, roles: ['master_admin', 'admin'] },
  { href: '/admin/settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, roles: ['master_admin', 'admin'] },
  { href: '/admin/roles', label: 'Roles & Permissions', icon: <Shield className="w-5 h-5" />, roles: ['master_admin'] },
]

function isAdminRole(role: string): boolean {
  return ['master_admin', 'admin', 'moderator'].includes(role)
}

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.push('/')
    if (!loading && user && !isAdminRole(user.role)) router.replace('/dashboard')
  }, [loading, user, router])

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return
    fetch('/api/verifications?status=pending', { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        const count = Array.isArray(res.data) ? res.data.length : (res.data?.total ?? 0)
        setPendingCount(count)
      })
      .catch(() => {})
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Spinner size="xl" />
      </div>
    )
  }

  if (!user || !isAdminRole(user.role)) return null

  const visibleNav = ADMIN_NAV.filter(item =>
    !item.roles || item.roles.includes(user.role)
  )

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={
          'fixed top-0 left-0 h-full w-64 bg-gray-900 z-40 flex flex-col transition-transform duration-300 ' +
          (sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
        }
      >
        {/* Logo/back */}
        <div className="px-6 py-5 border-b border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#D69A23] flex-shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 12h6M9 15h4" />
              <path d="M7 9v6" strokeWidth="2" />
            </svg>
            <div>
              <span className="text-white font-bold text-base block leading-tight">Rizal High School Elections</span>
              <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">← Back to app</span>
            </div>
          </Link>
        </div>

        {/* Admin label */}
        <div className="px-6 pt-4 pb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin">
          {visibleNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ' +
                (isActive(item.href)
                  ? 'bg-[#84050C]/20 text-[#F87171] font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white')
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.href === '/admin/verifications' && pendingCount > 0 && (
                <Badge variant="warning" size="sm">{pendingCount}</Badge>
              )}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span>{user.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        <Navbar onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
