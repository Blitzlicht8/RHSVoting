'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserCircle,
  Newspaper,
  Vote,
  ShieldCheck,
  Users,
  BookOpen,
  ListChecks,
  Flag,
  FileText,
  Settings,
  Settings2,
  Shield,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import Badge from '@/components/ui/Badge'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  adminRoles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    adminOnly: false,
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    href: '/profile',
    label: 'Profile',
    adminOnly: false,
    icon: <UserCircle className="w-5 h-5" />,
  },
  {
    href: '/feed',
    label: 'Feed',
    adminOnly: false,
    icon: <Newspaper className="w-5 h-5" />,
  },
  {
    href: '/elections',
    label: 'Elections',
    adminOnly: false,
    icon: <Vote className="w-5 h-5" />,
  },
  {
    href: '/admin/verifications',
    label: 'Verifications',
    adminOnly: true,
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  {
    href: '/admin/users',
    label: 'Members',
    adminOnly: true,
    icon: <Users className="w-5 h-5" />,
  },
  {
    href: '/admin/academic',
    label: 'Academic Structure',
    adminOnly: true,
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    href: '/admin/elections',
    label: 'Manage Elections',
    adminOnly: true,
    icon: <ListChecks className="w-5 h-5" />,
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    adminOnly: true,
    adminRoles: ['master_admin', 'teacher_admin'],
    icon: <Flag className="w-5 h-5" />,
  },
  {
    href: '/admin/logs',
    label: 'Activity Logs',
    adminOnly: true,
    adminRoles: ['master_admin', 'teacher_admin'],
    icon: <FileText className="w-5 h-5" />,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    adminOnly: true,
    adminRoles: ['master_admin', 'teacher_admin'],
    icon: <Settings className="w-5 h-5" />,
  },
  {
    href: '/admin/app-config',
    label: 'App Config',
    adminOnly: true,
    adminRoles: ['master_admin'],
    icon: <Settings2 className="w-5 h-5" />,
  },
  {
    href: '/admin/roles',
    label: 'Roles & Permissions',
    adminOnly: true,
    adminRoles: ['master_admin'],
    icon: <Shield className="w-5 h-5" />,
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
    if (item.adminRoles) return item.adminRoles.includes(user?.role ?? '')
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#D69A23] flex-shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
            <path d="M7 9v6" strokeWidth="2" />
          </svg>
          <span className="text-white font-bold text-lg">Community Hub</span>
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
                ? 'bg-[#84050C]/20 text-[#F87171] font-medium'
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
                    ? 'bg-[#84050C]/20 text-[#F87171] font-medium'
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
            <div className="w-9 h-9 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-9 h-9 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="text-sm font-bold">{user.name.charAt(0).toUpperCase()}</span>
              )}
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
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
