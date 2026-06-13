'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/providers/ToastProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: number
  name: string
  email: string
  id_verified: boolean
  verification_status?: 'pending' | 'rejected' | null
  id_photo_url?: string | null
  verification_notes?: string | null
}

type UIState = 'loading' | 'verified' | 'pending' | 'rejected' | 'upload'
type VerifyStep = 'type_select' | 'student_info' | 'upload_photo'

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-16 h-16 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function UploadCloudIcon() {
  return (
    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.449 11.095H6.75z" />
    </svg>
  )
}

function LogoIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z"
        fill="#84050C"
        opacity="0.15"
      />
      <path
        d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z"
        stroke="#84050C"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="16" y="18" width="4" height="3" rx="1" fill="#84050C" />
      <rect x="22" y="19" width="10" height="1.5" rx="0.75" fill="#84050C" />
      <rect x="16" y="24" width="4" height="3" rx="1" fill="#84050C" opacity="0.5" />
      <rect x="22" y="25" width="10" height="1.5" rx="0.75" fill="#84050C" opacity="0.5" />
      <path d="M17 19.5l1.2 1.2 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf']
const MAX_FILES = 3

const DOC_TYPE_OPTIONS = ['School ID', 'Enrollment Form', 'Registration Form', 'Other Document'] as const
type DocType = typeof DOC_TYPE_OPTIONS[number]

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerifyIdPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [user, setUser]           = useState<User | null>(null)
  const [uiState, setUiState]     = useState<UIState>('loading')

  // Multi-step state (for uiState === 'upload')
  const [verifyStep, setVerifyStep]     = useState<VerifyStep>('type_select')
  const [intendedRole, setIntendedRole] = useState<'student' | 'teacher' | ''>('')
  const [stepError, setStepError]       = useState<string | null>(null)

  // Cascading dropdowns
  const [gradeLevels, setGradeLevels] = useState<Array<{id: number, name: string}>>([])
  const [subtypes, setSubtypes]       = useState<Array<{id: number, name: string}>>([])
  const [sections, setSections]       = useState<Array<{id: number, name: string}>>([])
  const [gradeLevelId, setGradeLevelId] = useState<string>('')
  const [subtypeId, setSubtypeId]       = useState<string>('')
  const [sectionId, setSectionId]       = useState<string>('')

  // Document type
  const [docType, setDocType] = useState<DocType>('School ID')

  // Upload form state
  const [files, setFiles]           = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [fileError, setFileError]   = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter  = useRef(0)

  // ── Fetch grade levels on mount ────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/academic/grade-levels').then(r => r.json()).then(j => setGradeLevels(j.data ?? []))
  }, [])

  // ── Cascade: grade level → subtypes ───────────────────────────────────────

  useEffect(() => {
    setSubtypeId('')
    setSectionId('')
    setSubtypes([])
    setSections([])
    if (!gradeLevelId) return
    fetch(`/api/academic/subtypes?gradeLevelId=${gradeLevelId}`)
      .then(r => r.json())
      .then(j => setSubtypes(j.data ?? []))
  }, [gradeLevelId])

  // ── Cascade: subtype → sections ────────────────────────────────────────────

  useEffect(() => {
    setSectionId('')
    setSections([])
    if (!gradeLevelId) return
    const url = subtypeId
      ? `/api/academic/sections?gradeLevelId=${gradeLevelId}&subtypeId=${subtypeId}`
      : `/api/academic/sections?gradeLevelId=${gradeLevelId}`
    fetch(url)
      .then(r => r.json())
      .then(j => setSections(j.data ?? []))
  }, [gradeLevelId, subtypeId])

  // ── Fetch current user ─────────────────────────────────────────────────────

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.status === 401) {
        router.push('/')
        return
      }
      const json = await res.json()
      if (!res.ok || !json.data) {
        addToast('Failed to load your profile.', 'error')
        return
      }
      const u: User = json.data
      setUser(u)
      deriveUiState(u)
    } catch {
      addToast('Network error while loading your profile.', 'error')
    }
  }, [router, addToast])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  function deriveUiState(u: User) {
    if (u.id_verified) {
      setUiState('verified')
      return
    }
    if (u.verification_status === 'pending') {
      setUiState('pending')
      return
    }
    if (u.verification_status === 'rejected') {
      setUiState('rejected')
      return
    }
    setUiState('upload')
  }

  // ── File selection logic ───────────────────────────────────────────────────

  const validateIncoming = (incoming: File[]): string | null => {
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        return `"${f.name}" is not a supported type. Use images or PDF.`
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        return `"${f.name}" exceeds the 5 MB limit.`
      }
    }
    return null
  }

  const addFiles = (incoming: File[]) => {
    setFileError(null)
    const combined = [...files, ...incoming]
    if (combined.length > MAX_FILES) {
      setFileError(`You can upload at most ${MAX_FILES} files.`)
      return
    }
    const err = validateIncoming(incoming)
    if (err) { setFileError(err); return }
    setFiles(combined)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) addFiles(picked)
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setFileError(null)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files ?? [])
    if (dropped.length) addFiles(dropped)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (files.length === 0) return

    const formData = new FormData()
    formData.append('intended_role', intendedRole || 'student')
    formData.append('doc_type', docType)
    if (intendedRole === 'student') {
      if (gradeLevelId) formData.append('grade_level_id', gradeLevelId)
      if (subtypeId)    formData.append('subtype_id', subtypeId)
      if (sectionId)    formData.append('section_id', sectionId)
    }
    for (const file of files) {
      formData.append('file', file)
    }

    setUploading(true)
    try {
      const res = await fetch('/api/verifications', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const json = await res.json()

      if (!res.ok) {
        addToast(json.error ?? 'Upload failed. Please try again.', 'error')
        return
      }

      addToast('Documents submitted successfully. We will review them shortly.', 'success')
      setFiles([])
      await fetchUser()
    } catch {
      addToast('Network error during upload.', 'error')
    } finally {
      setUploading(false)
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FEE2E2] via-white to-[#FEE2E2]/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <LogoIcon />
          <span className="text-lg font-bold text-gray-900">RHS E-Voting</span>
        </div>

        {/* ── Loading ── */}
        {uiState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Loading your profile…</p>
          </div>
        )}

        {/* ── Verified ── */}
        {uiState === 'verified' && (
          <div className="flex flex-col items-center text-center py-8 gap-6">
            <CheckCircleIcon />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Identity verified</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your identity has been confirmed. You have full access to RHS E-Voting.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        )}

        {/* ── Pending ── */}
        {uiState === 'pending' && (
          <div className="flex flex-col items-center text-center py-8 gap-6">
            <ClockIcon />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verification pending</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your documents are under review. This usually takes 1–2 business days.
              </p>
            </div>
            {user?.id_photo_url && (
              <div className="w-full">
                <p className="text-xs font-medium text-gray-500 mb-2 text-left">Submitted document</p>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.id_photo_url}
                    alt="Submitted document"
                    className="w-full h-40 object-cover"
                  />
                </div>
              </div>
            )}
            <div className="w-full rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700 text-left">
              <p className="font-medium mb-1">What happens next?</p>
              <p className="text-amber-600">
                An admin will review your submission. You will be notified by email once the review is complete.
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        )}

        {/* ── Rejected ── */}
        {uiState === 'rejected' && (
          <div className="flex flex-col items-center text-center py-4 gap-6">
            <XCircleIcon />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verification rejected</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your submission was not approved. Please re-upload your school documents.
              </p>
            </div>

            {user?.verification_notes && (
              <div className="w-full rounded-xl bg-red-50 border border-red-200 p-4 text-left">
                <p className="text-xs font-semibold text-red-700 mb-1">Reason from admin</p>
                <p className="text-sm text-red-600 whitespace-pre-wrap">{user.verification_notes}</p>
              </div>
            )}

            {/* Fall through to upload form */}
            <UploadForm
              files={files}
              docType={docType}
              setDocType={setDocType}
              isDragging={isDragging}
              fileError={fileError}
              uploading={uploading}
              fileInputRef={fileInputRef}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onOpenPicker={openFilePicker}
              onFileChange={handleFileChange}
              onRemoveFile={removeFile}
              onUpload={handleUpload}
              formatBytes={formatBytes}
              showSkip={false}
            />
          </div>
        )}

        {/* ── No submission yet — multi-step ── */}
        {uiState === 'upload' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verify your identity</h1>
              <p className="text-sm text-gray-500 mt-1">
                Complete the steps below to submit your documents for review.
              </p>
            </div>

            {/* Progress indicator */}
            {(() => {
              const stepNum = verifyStep === 'type_select' ? 1 : verifyStep === 'student_info' ? 2 : 3
              const totalSteps = intendedRole === 'teacher' ? 2 : 3
              return (
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <div key={i} className="flex items-center gap-2 flex-1">
                      <div
                        className={[
                          'h-1.5 rounded-full flex-1 transition-colors',
                          i < stepNum ? 'bg-[#84050C]' : 'bg-gray-200',
                        ].join(' ')}
                      />
                    </div>
                  ))}
                  <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                    Step {stepNum} of {totalSteps}
                  </span>
                </div>
              )
            })()}

            {/* Step 1: Type select */}
            {verifyStep === 'type_select' && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Are you a student or a teacher?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIntendedRole('student')
                      setStepError(null)
                      setVerifyStep('student_info')
                    }}
                    className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-[#BA4955] hover:bg-[#FEE2E2]/60/50 transition-all text-center focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                  >
                    <svg className="w-8 h-8 text-[#84050C]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-900">Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIntendedRole('teacher')
                      setStepError(null)
                      setVerifyStep('upload_photo')
                    }}
                    className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-[#BA4955] hover:bg-[#FEE2E2]/60/50 transition-all text-center focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                  >
                    <svg className="w-8 h-8 text-[#84050C]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-900">Teacher</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Student info — cascading dropdowns + doc type */}
            {verifyStep === 'student_info' && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Tell us about your grade and section.</p>

                {/* Grade Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={gradeLevelId}
                    onChange={(e) => { setGradeLevelId(e.target.value); setStepError(null) }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  >
                    <option value="">Select grade level…</option>
                    {gradeLevels.map(g => (
                      <option key={g.id} value={String(g.id)}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subtype — only shown when subtypes exist */}
                {subtypes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Track / Strand
                    </label>
                    <select
                      value={subtypeId}
                      onChange={(e) => { setSubtypeId(e.target.value); setStepError(null) }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                    >
                      <option value="">Select track / strand…</option>
                      {subtypes.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Section — only shown when sections exist */}
                {sections.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={sectionId}
                      onChange={(e) => { setSectionId(e.target.value); setStepError(null) }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                    >
                      <option value="">Select section…</option>
                      {sections.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Document Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  >
                    {DOC_TYPE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {stepError && (
                  <p className="text-sm text-red-600">{stepError}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setStepError(null); setVerifyStep('type_select') }}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!gradeLevelId) { setStepError('Please select a grade level.'); return }
                      if (subtypes.length > 0 && !subtypeId) { setStepError('Please select a track/strand.'); return }
                      if (sections.length === 0) { setStepError('No sections found for this grade. Contact admin.'); return }
                      if (!sectionId) { setStepError('Please select a section.'); return }
                      setStepError(null)
                      setVerifyStep('upload_photo')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#84050C] hover:bg-[#6B0409] text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Upload documents */}
            {verifyStep === 'upload_photo' && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null)
                      setVerifyStep(intendedRole === 'teacher' ? 'type_select' : 'student_info')
                    }}
                    className="text-sm text-[#84050C] hover:text-[#6B0409] font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                </div>

                {/* Doc type selector for teachers (students set it in step 2) */}
                {intendedRole === 'teacher' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as DocType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                    >
                      {DOC_TYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}

                <UploadForm
                  files={files}
                  docType={docType}
                  setDocType={setDocType}
                  isDragging={isDragging}
                  fileError={fileError}
                  uploading={uploading}
                  fileInputRef={fileInputRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenPicker={openFilePicker}
                  onFileChange={handleFileChange}
                  onRemoveFile={removeFile}
                  onUpload={handleUpload}
                  formatBytes={formatBytes}
                  showSkip={true}
                />
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

// ─── Upload form sub-component ─────────────────────────────────────────────────

interface UploadFormProps {
  files: File[]
  docType: DocType
  setDocType: (v: DocType) => void
  isDragging: boolean
  fileError: string | null
  uploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onOpenPicker: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
  onUpload: () => void
  formatBytes: (n: number) => string
  showSkip: boolean
}

function UploadForm({
  files,
  isDragging,
  fileError,
  uploading,
  fileInputRef,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onOpenPicker,
  onFileChange,
  onRemoveFile,
  onUpload,
  formatBytes,
  showSkip,
}: UploadFormProps) {
  return (
    <div className="space-y-4 w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        onChange={onFileChange}
        aria-label="Upload school documents"
      />

      {/* Drop zone */}
      <button
        type="button"
        onClick={onOpenPicker}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        disabled={uploading || files.length >= MAX_FILES}
        className={[
          'w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3',
          'transition-all duration-200 cursor-pointer outline-none',
          'focus-visible:ring-2 focus-visible:ring-[#84050C] focus-visible:ring-offset-2',
          isDragging
            ? 'border-[#BA4955] bg-[#FEE2E2]/60 scale-[1.01]'
            : 'border-gray-300 bg-gray-50 hover:border-[#BA4955] hover:bg-[#FEE2E2]/60/50',
          (uploading || files.length >= MAX_FILES) ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
        aria-label="Click or drag and drop to upload school documents"
      >
        <UploadCloudIcon />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? 'Drop your files here' : 'Click to upload or drag & drop'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Images or PDF — max 5 MB each, up to {MAX_FILES} files
          </p>
          {files.length > 0 && (
            <p className="text-xs text-[#84050C] mt-1 font-medium">
              {files.length}/{MAX_FILES} file{files.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </button>

      {/* File error */}
      {fileError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {fileError}
        </div>
      )}

      {/* Selected files list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {file.type === 'application/pdf' ? (
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-[#BA4955] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 3v18" />
                  </svg>
                )}
                <span className="truncate max-w-[180px] font-medium text-gray-700">{file.name}</span>
                <span className="text-gray-400 flex-shrink-0">{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(idx)}
                disabled={uploading}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label={`Remove ${file.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <Button
          variant="primary"
          size="lg"
          loading={uploading}
          disabled={files.length === 0 || !!fileError}
          onClick={onUpload}
          className="w-full"
        >
          {uploading ? 'Uploading…' : 'Submit Documents for Review'}
        </Button>
      )}

      {/* Skip link */}
      {showSkip && files.length === 0 && (
        <div className="text-center pt-2">
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now →
          </Link>
        </div>
      )}
    </div>
  )
}
