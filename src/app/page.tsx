'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OTPInput from '@/components/ui/OTPInput'
import Logo from '@/components/ui/Logo'
import { useToast } from '@/components/providers/ToastProvider'
import FaceCapture from '@/components/FaceCapture'
import LivenessCapture from '@/components/LivenessCapture'
import { faceDistance, isFaceMatch } from '@/lib/faceApi'

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 'creds' | 'otp' | 'face'

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

  // Face verification (experimental, additive factor after credential auth)
  const [storedDescriptor, setStoredDescriptor] = useState<number[] | null>(null)
  const [pendingRedirect, setPendingRedirect] = useState('/dashboard')
  const [faceError, setFaceError] = useState<string | null>(null)
  const [faceMatching, setFaceMatching] = useState(false)
  const [faceAttempt, setFaceAttempt] = useState(0)
  const [faceMode, setFaceMode] = useState<'enroll' | 'verify' | 'blocked'>('verify')
  const [faceFails, setFaceFails] = useState(0)
  const MAX_FACE_FAILS = 3

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

  // ── Post-auth: face verification gate ────────────────────────────────────────
  // Credentials (and OTP) already succeeded. Query the server for this account's
  // face state and branch: enroll (register face), verify (match), or blocked.
  const finishLogin = async (redirect: string) => {
    setPendingRedirect(redirect)
    try {
      const res = await fetch('/api/face/status', { credentials: 'include' })
      const d = (await res.json())?.data
      if (d && d.enabled && !d.skip) {
        if (d.reportPending) { setFaceMode('blocked'); setStep('face'); return }
        if (d.mustEnroll) { setFaceMode('enroll'); setStep('face'); return }
        if (Array.isArray(d.descriptor) && d.descriptor.length === 128) {
          setStoredDescriptor(d.descriptor); setFaceMode('verify'); setStep('face'); return
        }
      }
    } catch {}
    window.location.href = redirect
  }

  const recordFace = async (payload: { matched?: boolean; distance?: number }) => {
    try {
      await fetch('/api/auth/face-verify', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {}
  }

  // Enrollment (register-face-at-login) — store descriptor, then continue.
  const handleEnrollComplete = async (descriptor: number[]) => {
    setFaceMatching(true)
    try {
      const res = await fetch('/api/face/enroll', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
      })
      if (!res.ok) { addToast('Could not save your face. Try again.', 'error'); setFaceMatching(false); setFaceAttempt((n) => n + 1); return }
      addToast('Face registered.', 'success')
      window.location.href = pendingRedirect
    } catch {
      addToast('Network error.', 'error'); setFaceMatching(false); setFaceAttempt((n) => n + 1)
    }
  }

  // Verify — compare live capture to the stored descriptor.
  const handleFaceCaptured = async (descriptor: number[]) => {
    if (!storedDescriptor) return
    setFaceMatching(true); setFaceError(null)
    const dist = faceDistance(descriptor, storedDescriptor)
    const matched = isFaceMatch(descriptor, storedDescriptor)
    await recordFace({ matched, distance: dist })
    setFaceMatching(false)
    if (matched) {
      addToast('Face verified.', 'success')
      window.location.href = pendingRedirect
    } else {
      const fails = faceFails + 1
      setFaceFails(fails)
      setFaceError(`That doesn't match your registered face (${fails}/${MAX_FACE_FAILS}). Try again.`)
      setFaceAttempt((n) => n + 1)
    }
  }

  const handleReport = async () => {
    try { await fetch('/api/face/report', { method: 'POST', credentials: 'include' }) } catch {}
    setFaceMode('blocked')
  }

  const signOut = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
    window.location.href = '/'
  }

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
        await finishLogin(json.data.redirectTo)
        return
      }

      // Fully authenticated (fallback)
      await finishLogin('/dashboard')
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

      await finishLogin('/dashboard')
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
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Rizal High School Elections</h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'creds' ? 'Sign in to your account' : step === 'face' ? 'Face verification' : 'Two-factor authentication'}
            </p>
          </div>
        </div>

        {/* ── Step 1: Credentials ── */}
        {step === 'creds' && (
          <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
              leftIcon={<Mail className="w-4 h-4" />}
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
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
              <ArrowLeft className="w-4 h-4" />
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

        {/* ── Step 3: Face verification (experimental, additive) ── */}
        {step === 'face' && (
          <div className="space-y-4">
            {faceMode === 'blocked' ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  Your face verification problem has been reported. An admin must review your account before you can sign in.
                </p>
                <Button variant="secondary" size="lg" onClick={signOut} className="w-full">Back to sign in</Button>
              </div>
            ) : faceMode === 'enroll' ? (
              <>
                <p className="text-center text-sm text-gray-500">
                  Register your face — follow the prompts. This is required for your account.
                </p>
                <LivenessCapture key={faceAttempt} onComplete={handleEnrollComplete} />
              </>
            ) : (
              <>
                <p className="text-center text-sm text-gray-500">
                  Extra security check — look at your camera and verify it&apos;s you.
                </p>
                <FaceCapture
                  key={faceAttempt}
                  onCaptured={handleFaceCaptured}
                  matching={faceMatching}
                  error={faceError}
                />
                {faceFails >= MAX_FACE_FAILS && (
                  <div className="space-y-2 text-center">
                    <p className="text-sm text-gray-600">Still not working?</p>
                    <Button variant="secondary" size="lg" onClick={handleReport} className="w-full">
                      Report a problem to admins
                    </Button>
                  </div>
                )}
                <button type="button" onClick={signOut} className="w-full text-sm text-gray-500 hover:text-gray-700">
                  Cancel and sign out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
