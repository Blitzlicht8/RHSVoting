'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import Sidebar from '@/components/Sidebar'
import Navbar from '@/components/Navbar'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/components/providers/ToastProvider'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Spinner size="xl" />
      </div>
    )
  }

  if (!user) return null

  async function resendVerification() {
    try {
      const res = await fetch('/api/auth/resend-otp', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        toast?.addToast(json.message ?? 'Verification email sent. Check your inbox.', 'success')
      } else {
        toast?.addToast(json.error ?? 'Failed to resend verification email.', 'error')
      }
    } catch {
      toast?.addToast('Something went wrong. Please try again.', 'error')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />

        {/* Email unverified banner */}
        {!user.email_verified && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <span>⚠️ Your email is not verified.</span>
            <button onClick={resendVerification} className="underline font-medium">
              Resend code
            </button>
          </div>
        )}

        {/* ID unverified banner */}
        {user.email_verified && !user.id_verified && !user.needs_academic_update && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
            <span>📋 Your school ID is pending verification. You cannot vote until approved.</span>
            <Link href="/verify-id" className="underline font-medium ml-1">
              Upload ID →
            </Link>
          </div>
        )}

        {/* Academic info needs update banner */}
        {user.needs_academic_update ? (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-600">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Your grade/section was updated by an administrator.</p>
                <p className="text-xs text-amber-600">Please update your school information and re-upload your verification documents.</p>
              </div>
            </div>
            <Link href="/profile" className="text-sm font-semibold text-amber-700 hover:underline">Update Info →</Link>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
