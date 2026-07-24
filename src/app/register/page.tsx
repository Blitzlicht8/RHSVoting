'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Mail, User, Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Logo from '@/components/ui/Logo'
import { useToast } from '@/components/providers/ToastProvider'
import GroupSelects, { useGroupSelections } from '@/components/GroupSelects'
import { scanFaceFromFile, FACE_SCAN_MESSAGES } from '@/lib/faceApi'
import FaceCapture from '@/components/FaceCapture'

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

// ─── Step indicator ─────────────────────────────────────────────────────────────

type Step = 'credentials' | 'otp' | 'profile'
const STEP_ORDER: Step[] = ['credentials', 'otp', 'profile']
const STEP_TITLES: Record<Step, string> = {
  credentials: 'Create account',
  otp: 'Verify your email',
  profile: 'Complete your profile',
}

function StepDots({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step)
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={[
            'h-1.5 rounded-full transition-all',
            i <= idx ? 'bg-[#84050C] w-8' : 'bg-gray-200 w-4',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf']
const MAX_FILES = 3

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { addToast } = useToast()

  const [step, setStep] = useState<Step>('credentials')

  // Credentials
  const [fullName, setFullName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms]     = useState(false)
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [loading, setLoading]           = useState(false)

  // OTP
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  // Profile — settings + group structures
  const { structures, selected, setValue, assignments, optionsFor, firstMissingRequired } = useGroupSelections()
  const [docTypeOptions, setDocTypeOptions] = useState<string[]>([])
  const [docType, setDocType] = useState('')
  const docsRequired = docTypeOptions.length > 0
  const [faceEnabled, setFaceEnabled] = useState(false)
  const [faceStatus, setFaceStatus] = useState<'idle' | 'scanning' | 'ok' | 'fail'>('idle')
  const [faceMsg, setFaceMsg] = useState<string | null>(null)
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null)
  const [liveDone, setLiveDone] = useState(false)
  const [liveSkipped, setLiveSkipped] = useState(false)

  const [lrn, setLrn] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)

  const passwordStrength = calcStrength(password)
  const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const isCredsValid =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    passwordStrength >= 2 &&
    password === confirmPassword &&
    confirmPassword.length > 0 &&
    agreedToTerms

  // Load settings (doc types) when reaching profile step.
  useEffect(() => {
    if (step !== 'profile') return
    fetch('/api/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        const s = j.data ?? {}
        setFaceEnabled(s.enable_face_verification === 'true')
        if (s.doc_type_labels) {
          try {
            const arr = JSON.parse(s.doc_type_labels)
            if (Array.isArray(arr) && arr.length > 0) { setDocTypeOptions(arr); setDocType(arr[0]) }
          } catch {}
        }
      })
      .catch(() => {})
  }, [step])

  // ── Step 1: credentials → register (sends OTP) ──────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCredsValid) return
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
      if (!res.ok) { addToast(json.error ?? 'Registration failed. Please try again.', 'error'); return }
      if (json.data?.devOtp) setDevOtp(json.data.devOtp)
      addToast('Verification code sent to your email.', 'success')
      setStep('otp')
    } catch {
      addToast('Network error. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: OTP → verify-otp (auto-login) ───────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.trim().length < 6) { addToast('Enter the 6-digit code.', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp.trim(), type: 'email_verify' }),
      })
      const json = await res.json()
      if (!res.ok) { addToast(json.error ?? 'Verification failed.', 'error'); return }
      addToast('Email verified!', 'success')
      setStep('profile')
    } catch {
      addToast('Network error.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), type: 'email_verify' }),
      })
      const json = await res.json()
      if (res.ok) {
        if (json.data?.devOtp) setDevOtp(json.data.devOtp)
        addToast('New code sent.', 'success')
      } else {
        addToast(json.error ?? 'Failed to resend.', 'error')
      }
    } catch {
      addToast('Network error.', 'error')
    } finally {
      setResending(false)
    }
  }

  // ── Step 3: profile inputs ──────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setFormError('Profile photo must be a JPEG, PNG, or WebP image.'); return
    }
    if (f.size < 3 * 1024) { setFormError('That photo looks empty or too small — use a clear photo of your face.'); return }
    if (f.size > MAX_FILE_SIZE_BYTES) { setFormError('Profile photo exceeds the 5 MB limit.'); return }
    setProfilePhoto(f)
    setProfilePreview(URL.createObjectURL(f))
    // Session 10: when face verification is on, scan the photo immediately and
    // show a visible status so the check is observable (not silent-at-submit).
    setFaceDescriptor(null)
    if (faceEnabled) {
      setFaceStatus('scanning'); setFaceMsg('Checking for a face…')
      scanFaceFromFile(f).then(scan => {
        if (scan.ok) { setFaceDescriptor(scan.descriptor); setFaceStatus('ok'); setFaceMsg('Face detected ✓') }
        else { setFaceStatus('fail'); setFaceMsg(FACE_SCAN_MESSAGES[scan.reason]) }
      })
    } else {
      setFaceStatus('idle'); setFaceMsg(null)
    }
  }

  const addFiles = (incoming: File[]) => {
    setFormError(null)
    const combined = [...files, ...incoming]
    if (combined.length > MAX_FILES) { setFormError(`You can upload at most ${MAX_FILES} files.`); return }
    for (const f of incoming) {
      if (!ALLOWED_DOC_TYPES.includes(f.type)) { setFormError(`"${f.name}" is not a supported type.`); return }
      if (f.size > MAX_FILE_SIZE_BYTES) { setFormError(`"${f.name}" exceeds the 5 MB limit.`); return }
    }
    setFiles(combined)
  }

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) addFiles(picked)
    e.target.value = ''
  }

  // ── Step 3: submit profile + verification ─────────────────────────────────────
  const handleSubmitProfile = async () => {
    setFormError(null)
    if (!/^\d{12}$/.test(lrn.trim())) { setFormError('LRN must be exactly 12 digits.'); return }
    const missing = firstMissingRequired()
    if (missing) { setFormError(`Please select your ${missing.name.toLowerCase()}.`); return }
    if (!profilePhoto) { setFormError('Please upload a profile photo of your face.'); return }
    if (docsRequired && files.length === 0) { setFormError('Please attach at least one document.'); return }

    // Session 10 (experimental): client-side face check on the profile photo.
    // Descriptor was computed on photo-select (faceStatus). Re-scan here only if
    // it's still pending (e.g. slow model load).
    let descriptor = faceDescriptor
    if (faceEnabled) {
      if (!liveDone && !liveSkipped) {
        setFormError('Please complete the live face scan (or skip it to use your photo).'); return
      }
      if (faceStatus === 'scanning' || (faceStatus !== 'ok' && !descriptor)) {
        setFaceStatus('scanning'); setFaceMsg('Checking for a face…')
        const scan = await scanFaceFromFile(profilePhoto)
        if (!scan.ok) { setFaceStatus('fail'); setFaceMsg(FACE_SCAN_MESSAGES[scan.reason]); setFormError(FACE_SCAN_MESSAGES[scan.reason]); return }
        descriptor = scan.descriptor
        setFaceDescriptor(descriptor); setFaceStatus('ok'); setFaceMsg('Face detected ✓')
      }
    }

    const formData = new FormData()
    formData.append('assignments', JSON.stringify(assignments))
    formData.append('lrn', lrn.trim())
    if (docsRequired) formData.append('doc_type', docType)
    if (profilePhoto) formData.append('profile_photo', profilePhoto)
    if (descriptor) formData.append('face_descriptor', JSON.stringify(descriptor))
    for (const file of files) formData.append('file', file)

    setLoading(true)
    try {
      const res = await fetch('/api/verifications', { method: 'POST', credentials: 'include', body: formData })
      const json = await res.json()
      if (!res.ok) { addToast(json.error ?? 'Submission failed.', 'error'); return }
      addToast('Account created and submitted for verification.', 'success')
      // Hard navigation so AuthProvider remounts and re-fetches the now-authed
      // session (client-side router.push keeps the stale null user → stuck spinner).
      window.location.href = '/dashboard'
    } catch {
      addToast('Network error during submission.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FEE2E2] via-white to-[#FEE2E2]/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{STEP_TITLES[step]}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'credentials' && 'Join Rizal High School Elections today'}
              {step === 'otp' && `Enter the code sent to ${email}`}
              {step === 'profile' && 'Last step — this is submitted for verification'}
            </p>
          </div>
        </div>

        <StepDots step={step} />

        {/* ── Step 1: credentials ── */}
        {step === 'credentials' && (
          <form onSubmit={handleCreateAccount} noValidate className="space-y-4">
            <Input
              label="Full name" type="text" placeholder="Juan dela Cruz"
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              autoComplete="name" required disabled={loading}
              leftIcon={<User className="w-4 h-4" />}
            />
            <Input
              label="Email address" type="email" placeholder="you@school.edu"
              value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" required disabled={loading}
              leftIcon={<Mail className="w-4 h-4" />}
            />
            <div>
              <div className="relative">
                <Input
                  label="Password" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" required disabled={loading} className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}>
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && <PasswordStrengthBar strength={passwordStrength} />}
            </div>
            <div className="relative">
              <Input
                label="Confirm password" type={showConfirm ? 'text' : 'password'} placeholder="Re-enter your password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password" required disabled={loading} className="pr-10"
                error={confirmMismatch ? 'Passwords do not match' : undefined}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} tabIndex={-1}>
                {showConfirm ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C] cursor-pointer flex-shrink-0" />
              <span className="text-sm text-gray-600 leading-snug">
                I agree to the{' '}
                <Link href="/terms" className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors">Terms of Service</Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors">Privacy Policy</Link>
              </span>
            </label>
            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!isCredsValid} className="w-full mt-2">
              Continue
            </Button>
            <p className="text-center text-sm text-gray-500 pt-2">
              Already have an account?{' '}
              <Link href="/" className="text-[#84050C] hover:text-[#6B0409] font-medium transition-colors">Sign in</Link>
            </p>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {devOtp && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500 text-center">
                Dev code: <span className="font-mono font-semibold text-gray-700">{devOtp}</span>
              </div>
            )}
            <Input
              label="Verification code" type="text" inputMode="numeric" placeholder="123456"
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required disabled={loading} className="text-center tracking-[0.5em] text-lg"
            />
            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={otp.length < 6} className="w-full">
              Verify email
            </Button>
            <div className="text-center">
              <button type="button" onClick={handleResend} disabled={resending}
                className="text-sm text-[#84050C] hover:text-[#6B0409] font-medium transition-colors disabled:opacity-50">
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: profile + verification ── */}
        {step === 'profile' && (
          <div className="space-y-5">
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={handlePhotoChange} aria-label="Upload profile photo" />
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="sr-only"
              onChange={handleDocChange} aria-label="Upload verification documents" />

            {/* Profile photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Photo <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  {profilePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePreview} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" /></svg>
                  )}
                </div>
                <div>
                  <Button variant="secondary" size="sm" type="button" onClick={() => photoInputRef.current?.click()} disabled={loading}>
                    {profilePreview ? 'Change photo' : 'Upload photo'}
                  </Button>
                  <p className="text-xs text-gray-400 mt-1">Clear photo of your face. JPEG/PNG/WebP, max 5 MB.</p>
                </div>
              </div>
              {faceEnabled && faceMsg && (
                <p className={`mt-2 text-xs font-medium ${
                  faceStatus === 'ok' ? 'text-green-700'
                  : faceStatus === 'fail' ? 'text-amber-700'
                  : 'text-gray-500'
                }`}>
                  {faceStatus === 'scanning' && '⏳ '}{faceMsg}
                </p>
              )}
            </div>

            {/* Live face enrollment (blink + head-turn liveness) */}
            {faceEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Face Scan (Camera) <span className="text-red-500">*</span>
                </label>
                {liveDone ? (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    Face captured ✓ — this will be matched at login.
                  </p>
                ) : liveSkipped ? (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Camera scan skipped — your uploaded photo will be used instead.
                    </p>
                    <button type="button" onClick={() => { setLiveSkipped(false) }}
                      className="text-sm text-[#84050C] hover:text-[#6B0409] font-medium">
                      Use camera instead
                    </button>
                  </div>
                ) : (
                  <FaceCapture
                    onCaptured={(desc) => {
                      setFaceDescriptor(desc); setLiveDone(true)
                      setFaceStatus('ok'); setFaceMsg('Face captured ✓')
                    }}
                    onSkip={() => setLiveSkipped(true)}
                  />
                )}
              </div>
            )}

            {/* LRN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LRN (Learner&apos;s Reference Number) <span className="text-red-500">*</span>
              </label>
              <input type="text" inputMode="numeric" value={lrn} disabled={loading}
                onChange={e => { setLrn(e.target.value.replace(/\D/g, '').slice(0, 12)); setFormError(null) }}
                placeholder="12-digit LRN"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white disabled:opacity-60" />
            </div>

            {/* Group structures */}
            <GroupSelects structures={structures} selected={selected} setValue={setValue}
              optionsFor={optionsFor} onChangeSide={() => setFormError(null)} />

            {/* Document type + upload */}
            {docsRequired && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select value={docType} onChange={e => setDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white">
                    {docTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || files.length >= MAX_FILES}
                  className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-[#BA4955] hover:bg-[#FEE2E2]/30 p-5 flex flex-col items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.449 11.095H6.75z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Click to upload documents</span>
                  <span className="text-xs text-gray-400">Images or PDF — max 5 MB, up to {MAX_FILES}</span>
                  {files.length > 0 && <span className="text-xs text-[#84050C] font-medium">{files.length}/{MAX_FILES} selected</span>}
                </button>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((file, idx) => (
                      <li key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <span className="truncate max-w-[220px] text-gray-700">{file.name}</span>
                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500" aria-label={`Remove ${file.name}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {formError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {formError}
              </div>
            )}

            <Button variant="primary" size="lg" loading={loading} onClick={handleSubmitProfile} className="w-full">
              {loading ? 'Submitting…' : 'Finish & submit for verification'}
            </Button>
          </div>
        )}

      </div>
    </main>
  )
}
