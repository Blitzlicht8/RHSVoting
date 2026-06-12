'use client'

import React, { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import OTPInput from '@/components/ui/OTPInput'
import { useToast } from '@/components/providers/ToastProvider'

// ─── Icons ────────────────────────────────────────────────────────────────────

function LogoIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z"
        fill="#4f46e5"
        opacity="0.15"
      />
      <path
        d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z"
        stroke="#4f46e5"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="16" y="18" width="4" height="3" rx="1" fill="#4f46e5" />
      <rect x="22" y="19" width="10" height="1.5" rx="0.75" fill="#4f46e5" />
      <rect x="16" y="24" width="4" height="3" rx="1" fill="#4f46e5" opacity="0.5" />
      <rect x="22" y="25" width="10" height="1.5" rx="0.75" fill="#4f46e5" opacity="0.5" />
      <path
        d="M17 19.5l1.2 1.2 2-2"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EnvelopeOpenIcon() {
  return (
    <svg
      className="w-16 h-16 text-indigo-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839-2.51l-4.66 2.51m0 0l-1.023.55a2.25 2.25 0 01-2.134 0l-1.022-.55m0 0l-4.661-2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z"
      />
    </svg>
  )
}

// ─── Type label helpers ────────────────────────────────────────────────────────

function getTitleForType(type: string): string {
  switch (type) {
    case 'email_verify':
      return 'Verify your email'
    case 'login':
      return 'Two-factor authentication'
    case 'password_reset':
      return 'Reset your password'
    default:
      return 'Enter verification code'
  }
}

function getSubtitleForType(type: string): string {
  switch (type) {
    case 'email_verify':
      return 'We sent a 6-digit verification code to'
    case 'login':
      return 'Your two-factor code was sent to'
    case 'password_reset':
      return 'Your password reset code was sent to'
    default:
      return 'Your verification code was sent to'
  }
}

// ─── Inner component (uses useSearchParams) ────────────────────────────────────

function VerifyOtpInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()

  const email  = searchParams.get('email')  ?? ''
  const type   = searchParams.get('type')   ?? 'email_verify'
  const devOtp = searchParams.get('devOtp') ?? null

  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start countdown on mount
  useEffect(() => {
    startCountdown()
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(60)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6) {
      addToast('Please enter the complete 6-digit code.', 'error')
      return
    }
    if (!email) {
      addToast('Missing email address. Please start over.', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp, type }),
      })
      const json = await res.json()

      if (!res.ok) {
        addToast(json.error ?? 'Invalid or expired code. Please try again.', 'error')
        return
      }

      // Full page navigation so the browser sends the newly set cookie
      if (type === 'email_verify') {
        window.location.href = '/verify-id'
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type }),
      })
      const json = await res.json()

      if (!res.ok) {
        addToast(json.error ?? 'Failed to resend code.', 'error')
        return
      }

      setOtp('')
      startCountdown()
      addToast('A new verification code has been sent.', 'success')
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Branding */}
        <div className="flex justify-center mb-6">
          <LogoIcon />
        </div>

        {/* Envelope icon + title */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <EnvelopeOpenIcon />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-gray-900">
              {getTitleForType(type)}
            </h1>
            <p className="text-sm text-gray-500">
              {getSubtitleForType(type)}
            </p>
            {email && (
              <p className="text-sm font-semibold text-gray-800 break-all">{email}</p>
            )}
            {devOtp && (
              <div className="mt-2 rounded-lg bg-yellow-50 border border-yellow-300 px-4 py-2 text-sm text-yellow-800">
                <span className="font-semibold">No email configured — dev code: </span>
                <span className="font-mono font-bold tracking-widest">{devOtp}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleVerify} noValidate className="space-y-6">
          {/* OTP input */}
          <div className="flex justify-center">
            <OTPInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
              length={6}
            />
          </div>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-gray-400">
                Resend code in{' '}
                <span className="font-medium tabular-nums text-gray-600">{countdown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Resend code
              </button>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={otp.length < 6}
            className="w-full"
          >
            Verify code
          </Button>
        </form>
      </div>
    </main>
  )
}

// ─── Export wrapped in Suspense (required for useSearchParams) ─────────────────

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md flex items-center justify-center min-h-[320px]">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm">Loading…</p>
            </div>
          </div>
        </main>
      }
    >
      <VerifyOtpInner />
    </Suspense>
  )
}
