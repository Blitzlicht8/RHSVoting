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
      <path d="M17 19.5l1.2 1.2 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerifyIdPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [user, setUser]           = useState<User | null>(null)
  const [uiState, setUiState]     = useState<UIState>('loading')

  // Multi-step state (for uiState === 'upload')
  const [verifyStep, setVerifyStep]     = useState<VerifyStep>('type_select')
  const [intendedRole, setIntendedRole] = useState<'student' | 'teacher' | ''>('')
  const [gradeLevel, setGradeLevel]     = useState('')
  const [section, setSection]           = useState('')
  const [stepError, setStepError]       = useState<string | null>(null)

  // Upload form state
  const [selectedFile, setSelectedFile]   = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null)
  const [isDragging, setIsDragging]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [fileError, setFileError]         = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter  = useRef(0)

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

  const validateAndSetFile = (file: File) => {
    setFileError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('File must be a JPEG, PNG, WebP, or HEIC image.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File is too large. Maximum size is 5 MB.')
      return
    }

    // Revoke previous preview
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSetFile(file)
    // Reset input so same file can be re-selected after clearing
    e.target.value = ''
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
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSetFile(file)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    setFileError(null)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile) return

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('type', 'id_photo')
    formData.append('intended_role', intendedRole || 'student')
    if (intendedRole === 'student') {
      formData.append('grade_level', gradeLevel)
      formData.append('section', section)
    }

    setUploading(true)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (!res.ok) {
        addToast(json.error ?? 'Upload failed. Please try again.', 'error')
        return
      }

      addToast('ID submitted successfully. We will review it shortly.', 'success')
      clearSelection()
      // Re-fetch user to show updated state
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
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <LogoIcon />
          <span className="text-lg font-bold text-gray-900">SchoolVoting</span>
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
                Your identity has been confirmed. You have full access to SchoolVoting.
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
                Your ID is under review. This usually takes 1–2 business days.
              </p>
            </div>
            {user?.id_photo_url && (
              <div className="w-full">
                <p className="text-xs font-medium text-gray-500 mb-2 text-left">Submitted ID</p>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.id_photo_url}
                    alt="Submitted ID document"
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
                Your ID submission was not approved. Please re-upload a clearer photo.
              </p>
            </div>

            {user?.verification_notes && (
              <div className="w-full rounded-xl bg-red-50 border border-red-200 p-4 text-left">
                <p className="text-xs font-semibold text-red-700 mb-1">Reason from admin</p>
                <p className="text-sm text-red-600 whitespace-pre-wrap">{user.verification_notes}</p>
              </div>
            )}

            {/* Fall through to upload form below by rendering it directly */}
            <UploadForm
              selectedFile={selectedFile}
              previewUrl={previewUrl}
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
              onClear={clearSelection}
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
                Complete the steps below to submit your ID for review.
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
                          i < stepNum ? 'bg-indigo-500' : 'bg-gray-200',
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
                    className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
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
                    className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-900">Teacher</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Student info */}
            {verifyStep === 'student_info' && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Enter your grade level and section.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => { setGradeLevel(e.target.value); setStepError(null) }}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => { setSection(e.target.value); setStepError(null) }}
                    placeholder="e.g. Rizal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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
                      if (!gradeLevel.trim() || !section.trim()) {
                        setStepError('Both Grade Level and Section are required.')
                        return
                      }
                      setStepError(null)
                      setVerifyStep('upload_photo')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Upload photo */}
            {verifyStep === 'upload_photo' && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null)
                      setVerifyStep(intendedRole === 'teacher' ? 'type_select' : 'student_info')
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                </div>
                <UploadForm
                  selectedFile={selectedFile}
                  previewUrl={previewUrl}
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
                  onClear={clearSelection}
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
  selectedFile: File | null
  previewUrl: string | null
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
  onClear: () => void
  onUpload: () => void
  formatBytes: (n: number) => string
  showSkip: boolean
}

function UploadForm({
  selectedFile,
  previewUrl,
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
  onClear,
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
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={onFileChange}
        aria-label="Upload ID photo"
      />

      {/* Drop zone */}
      {!previewUrl && (
        <button
          type="button"
          onClick={onOpenPicker}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          disabled={uploading}
          className={[
            'w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3',
            'transition-all duration-200 cursor-pointer outline-none',
            'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
            isDragging
              ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
              : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50',
            uploading ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          aria-label="Click or drag and drop to upload your ID photo"
        >
          <UploadCloudIcon />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {isDragging ? 'Drop your file here' : 'Click to upload or drag & drop'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPEG, PNG, WebP or HEIC — max 5 MB
            </p>
          </div>
        </button>
      )}

      {/* File error */}
      {fileError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {fileError}
        </div>
      )}

      {/* Preview */}
      {previewUrl && selectedFile && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected ID preview"
              className="w-full h-48 object-cover"
            />
            {/* Overlay clear button */}
            <button
              type="button"
              onClick={onClear}
              disabled={uploading}
              className="absolute top-2 right-2 w-7 h-7 bg-gray-900/70 hover:bg-gray-900/90 text-white rounded-full flex items-center justify-center transition-colors"
              aria-label="Remove selected file"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="truncate max-w-[200px] font-medium text-gray-700">{selectedFile.name}</span>
            <span>{formatBytes(selectedFile.size)}</span>
          </div>
        </div>
      )}

      {/* Upload button */}
      {previewUrl && (
        <Button
          variant="primary"
          size="lg"
          loading={uploading}
          disabled={!selectedFile || !!fileError}
          onClick={onUpload}
          className="w-full"
        >
          {uploading ? 'Uploading…' : 'Submit ID for review'}
        </Button>
      )}

      {/* Change file link when preview is shown */}
      {previewUrl && !uploading && (
        <button
          type="button"
          onClick={onClear}
          className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Choose a different file
        </button>
      )}

      {/* Skip link */}
      {showSkip && !previewUrl && (
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
