'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/elections': 'Elections',
  '/feed': 'Feed',
  '/profile': 'Profile',
  '/users': 'Members',
  '/verify-id': 'Verify Identity',
  '/verify-otp': 'Verify Email',
  '/admin': 'Admin',
  '/admin/verifications': 'Verifications',
  '/admin/users': 'Members',
  '/admin/academic': 'Group Structure',
  '/admin/elections': 'Manage Elections',
  '/admin/reports': 'Reports',
  '/admin/logs': 'Activity Logs',
  '/admin/settings': 'Settings',
  '/admin/app-config': 'App Config',
  '/admin/roles': 'Roles & Permissions',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key + '/')) return title
  }
  const segment = pathname.split('/').filter(Boolean).pop() ?? ''
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

interface NavbarProps {
  onMenuToggle: () => void
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-20">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <h1 className="text-lg font-semibold text-gray-900">
        {getPageTitle(pathname)}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Admin pill — desktop only */}
        {user && ['master_admin', 'admin', 'moderator'].includes(user.role) && (
          <Link
            href="/admin/users"
            className="hidden md:flex items-center px-3 py-1.5 bg-[#84050C] text-white text-xs font-semibold rounded-full hover:bg-[#6B0409] transition-colors"
          >
            Admin
          </Link>
        )}

        {/* User avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown((v) => !v)}
            className="w-9 h-9 rounded-full bg-[#84050C] text-white text-sm font-semibold flex items-center justify-center hover:bg-[#6B0409] transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:ring-offset-2 overflow-hidden"
            aria-label="User menu"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <span className="text-sm font-semibold">{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-11 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setShowDropdown(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                My Profile
              </Link>
              {user && ['master_admin', 'admin', 'moderator'].includes(user.role) && (
                <Link
                  href="/admin/users"
                  onClick={() => setShowDropdown(false)}
                  className="md:hidden block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Admin Panel
                </Link>
              )}
              <div className="border-t border-gray-100 mt-1" />
              <button
                onClick={() => {
                  setShowDropdown(false)
                  logout()
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
