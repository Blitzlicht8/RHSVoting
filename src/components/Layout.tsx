'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import Sidebar from '@/components/Sidebar'
import Navbar from '@/components/Navbar'
import Spinner from '@/components/ui/Spinner'
import BottomNav from '@/components/BottomNav'
import { useToast } from '@/components/providers/ToastProvider'
import FaceGate from '@/components/FaceGate'

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
    <FaceGate>
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

        {/* ID rejected banner */}
        {user.email_verified && !user.id_verified && !user.needs_academic_update && user.verification_status === 'rejected' && (
          <div className="bg-red-50 border-b border-red-300 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Your verification was denied.</span>
            <Link href="/verify-id" className="underline font-semibold ml-1">
              View reason &amp; resubmit →
            </Link>
          </div>
        )}

        {/* ID pending banner */}
        {user.email_verified && !user.id_verified && !user.needs_academic_update && user.verification_status === 'pending' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span>Your verification is under review. You&apos;ll be notified when it&apos;s approved.</span>
          </div>
        )}

        {/* ID not yet submitted banner */}
        {user.email_verified && !user.id_verified && !user.needs_academic_update && !user.verification_status && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Your identity is not yet verified. You cannot participate until approved.</span>
            <Link href="/verify-id" className="underline font-medium ml-1">
              Verify now →
            </Link>
          </div>
        )}

        {/* Academic info needs update banner */}
        {user.needs_academic_update ? (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-600">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Your group information was updated by an administrator.</p>
                <p className="text-xs text-amber-600">Please update your group information and re-upload your verification documents.</p>
              </div>
            </div>
            <Link href="/profile" className="text-sm font-semibold text-amber-700 hover:underline">Update Info →</Link>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <BottomNav onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
    </FaceGate>
  )
}
