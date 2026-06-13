'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Newspaper, Vote, UserCircle, Shield } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

function isAdmin(role: string) {
  return ['master_admin', 'admin', 'moderator'].includes(role)
}

export default function BottomNav({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/feed', label: 'Feed', icon: Newspaper },
    { href: '/elections', label: 'Elections', icon: Vote },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 flex items-center md:hidden z-30">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium transition-colors ${
            isActive(href) ? 'text-[#84050C]' : 'text-gray-400'
          }`}
        >
          <Icon className="w-5 h-5" />
          {label}
        </Link>
      ))}
      {user && isAdmin(user.role) ? (
        <Link
          href="/admin/users"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium transition-colors ${
            pathname.startsWith('/admin') ? 'text-[#84050C]' : 'text-gray-400'
          }`}
        >
          <Shield className="w-5 h-5" />
          Admin
        </Link>
      ) : (
        <Link
          href="/profile"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium transition-colors ${
            isActive('/profile') ? 'text-[#84050C]' : 'text-gray-400'
          }`}
        >
          <UserCircle className="w-5 h-5" />
          Profile
        </Link>
      )}
    </nav>
  )
}
