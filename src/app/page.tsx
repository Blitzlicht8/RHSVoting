'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
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
      {/* Shield body */}
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
      {/* Ballot lines */}
      <rect x="16" y="18" width="4" height="3" rx="1" fill="#4f46e5" />
      <rect x="22" y="19" width="10" height="1.5" rx="0.75" fill="#4f46e5" />
      <rect x="16" y="24" width="4" height="3" rx="1" fill="#4f46e5" opacity="0.5" />
      <rect x="22" y="25" width="10" height="1.5" rx="0.75" fill="#4f46e5" opacity="0.5" />
      {/* Checkmark on first ballot */}
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

function EnvelopeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 'creds' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const { addToast } = useToast()

  // Step state
  const [step, setStep] = useState<Step>('creds')

  // Credentials form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // OTP step
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)

  // Shared
  const [loading, setLoading] = useState(false)

  // Countdown for resend
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCountdown = () => {
    setCountdown(60)
  }

  useEffect(() => {
    if (countdown <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      return
    }
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
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [countdown])

  // ── Step 1: login ──────────────────────────────────────────────────────────

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe }),
      })
      const json = await res.json()

      if (!res.ok) {
        addToast(json.error ?? 'Login failed. Please try again.', 'error')
        return
      }

      if (json.data?.requiresOTP) {
        if (json.data?.devOtp) setDevOtp(json.data.devOtp)
        setStep('otp')
        startCountdown()
        return
      }

      if (json.data?.requiresEmailVerification) {
        const params = new URLSearchParams({ email: email.trim().toLowerCase(), type: 'email_verify' })
        window.location.href = '/verify-otp?' + params.toString()
        return
      }

      if (json.data?.redirectTo) {
        window.location.href = json.data.redirectTo
        return
      }

      // Fully authenticated (fallback)
      window.location.href = '/dashboard'
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: OTP verify ─────────────────────────────────────────────────────

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6) {
      addToast('Please enter the complete 6-digit code.', 'error')
      return
    }

    setLoading(true)
    try {
      // redirect:'follow' (default) — browser stores the Set-Cookie from the
      // 303 BEFORE following the redirect, so the cookie is in the jar when
      // we navigate to /dashboard below.
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp, type: 'login', rememberMe }),
      })

      if (!res.ok) {
        try {
          const json = await res.json()
          addToast(json.error ?? 'Invalid code. Please try again.', 'error')
        } catch {
          addToast('Invalid code. Please try again.', 'error')
        }
        return
      }

      window.location.href = '/dashboard'
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), type: 'login' }),
      })
      const json = await res.json()
      if (!res.ok) {
        addToast(json.error ?? 'Failed to resend code.', 'error')
        return
      }
      setOtp('')
      startCountdown()
      addToast('A new code has been sent to your email.', 'success')
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FEE2E2] via-white to-[#FEE2E2]/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <LogoIcon />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">RHS E-Voting</h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'creds' ? 'Sign in to your account' : 'Two-factor authentication'}
            </p>
          </div>
        </div>

        {/* ── Step 1: Credentials ── */}
        {step === 'creds' && (
          <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
              leftIcon={<EnvelopeIcon />}
            />

            <div>
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C] cursor-pointer"
              />
              <span className="text-sm text-gray-600">Remember me for 30 days</span>
            </label>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!email.trim() || !password}
              className="w-full mt-2"
            >
              Sign in
            </Button>

            <p className="text-center text-sm text-gray-500 pt-2">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors"
              >
                Create one
              </Link>
            </p>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleOtpVerify} noValidate className="space-y-6">
            <button
              type="button"
              onClick={() => { setStep('creds'); setOtp('') }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors -mt-2"
            >
              <ArrowLeftIcon />
              Back
            </button>

            <div className="text-center space-y-1">
              <p className="text-sm text-gray-500">
                Code sent to <span className="font-medium text-gray-700">{email}</span>
              </p>
              {devOtp && (
                <div className="mt-2 rounded-lg bg-yellow-50 border border-yellow-300 px-4 py-2 text-sm text-yellow-800">
                  <span className="font-semibold">No email configured — dev code: </span>
                  <span className="font-mono font-bold tracking-widest">{devOtp}</span>
                </div>
              )}
            </div>

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
                  Resend in <span className="font-medium tabular-nums">{countdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-sm text-[#84050C] hover:text-[#6B0409] font-medium transition-colors"
                >
                  Resend code
                </button>
              )}
            </div>

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
        )}
      </div>
    </main>
  )
}
