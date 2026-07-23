'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, User, Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Logo from '@/components/ui/Logo'
import { useToast } from '@/components/providers/ToastProvider'

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

      const params = new URLSearchParams({ email: email.trim().toLowerCase(), type: 'email_verify' })
      if (json.data?.devOtp) params.set('devOtp', json.data.devOtp)
      window.location.href = '/verify-otp?' + params.toString()
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FEE2E2] via-white to-[#FEE2E2]/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
            <p className="text-sm text-gray-500 mt-1">Join Rizal High School Elections today</p>
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
            leftIcon={<User className="w-4 h-4" />}
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
            leftIcon={<Mail className="w-4 h-4" />}
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
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
              {showConfirm ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C] cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-gray-600 leading-snug">
              I agree to the{' '}
              <Link
                href="/terms"
                className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors"
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
              className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
