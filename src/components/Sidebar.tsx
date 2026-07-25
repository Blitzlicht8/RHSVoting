'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserCircle,
  Newspaper,
  Vote,
  ShieldCheck,
  Users,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

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
    href: '/users',
    label: 'Members',
    adminOnly: false,
    icon: <Users className="w-5 h-5" />,
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const generalItems = NAV_ITEMS.filter((item) => !item.adminOnly)

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
          <span className="text-white font-bold text-lg">Rizal High School Elections</span>
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

        {user && !user.id_verified && user.email_verified && (
          <Link
            href="/verify-id"
            onClick={onClose}
            className={
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ' +
              (isActive('/verify-id')
                ? 'bg-[#84050C]/20 text-[#F87171] font-medium'
                : 'text-amber-400 hover:bg-gray-800 hover:text-amber-300')
            }
          >
            <ShieldCheck className="w-5 h-5" />
            Verify Identity
          </Link>
        )}
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-9 h-9 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name}
                  fill
                  sizes="36px"
                  className="object-cover"
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
