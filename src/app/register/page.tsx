'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
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

function EnvelopeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
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

// ─── Password strength ─────────────────────────────────────────────────────────

function calcStrength(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*]/.test(password)) score++
  return score
}

const STRENGTH_CONFIG: Array<{ label: string; color: string; barColor: string }> = [
  { label: 'Too short', color: 'text-gray-400', barColor: 'bg-gray-200' },
  { label: 'Weak',      color: 'text-red-500',    barColor: 'bg-red-400' },
  { label: 'Fair',      color: 'text-orange-500',  barColor: 'bg-orange-400' },
  { label: 'Good',      color: 'text-yellow-500',  barColor: 'bg-yellow-400' },
  { label: 'Strong',    color: 'text-green-600',   barColor: 'bg-green-500' },
]

function PasswordStrengthBar({ strength }: { strength: number }) {
  const cfg = STRENGTH_CONFIG[strength]
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={[
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              strength >= seg ? cfg.barColor : 'bg-gray-200',
            ].join(' ')}
          />
        ))}
      </div>
      {strength > 0 && (
        <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [fullName, setFullName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms]     = useState(false)
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [loading, setLoading]           = useState(false)

  const passwordStrength = calcStrength(password)

  // Confirm password mismatch — only show after user has typed something
  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  const isFormValid =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    passwordStrength >= 2 &&
    password === confirmPassword &&
    confirmPassword.length > 0 &&
    agreedToTerms

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error')
      return
    }
    if (passwordStrength < 2) {
      addToast('Please choose a stronger password.', 'error')
      return
    }
    if (!agreedToTerms) {
      addToast('You must agree to the terms to register.', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        addToast(json.error ?? 'Registration failed. Please try again.', 'error')
        return
      }

      router.push(
        '/verify-otp?email=' + encodeURIComponent(email.trim().toLowerCase()) + '&type=email_verify'
      )
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <LogoIcon />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
            <p className="text-sm text-gray-500 mt-1">Join SchoolVoting today</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Full name */}
          <Input
            label="Full name"
            type="text"
            placeholder="Juan dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
            disabled={loading}
            leftIcon={<UserIcon />}
          />

          {/* Email */}
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

          {/* Password + strength */}
          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            {password.length > 0 && (
              <PasswordStrengthBar strength={passwordStrength} />
            )}
          </div>

          {/* Confirm password */}
          <div className="relative">
            <Input
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={loading}
              className="pr-10"
              error={confirmMismatch ? 'Passwords do not match' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className={[
                'absolute right-3 text-gray-400 hover:text-gray-600 transition-colors',
                confirmMismatch ? 'top-[38px]' : 'top-[38px]',
              ].join(' ')}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              tabIndex={-1}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-gray-600 leading-snug">
              I agree to the{' '}
              <Link
                href="/terms"
                className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!isFormValid}
            className="w-full mt-2"
          >
            Create account
          </Button>

          <p className="text-center text-sm text-gray-500 pt-2">
            Already have an account?{' '}
            <Link
              href="/"
              className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
