'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/providers/ToastProvider'
import { useAuth } from '@/components/providers/AuthProvider'
import GroupSelects, { useGroupSelections } from '@/components/GroupSelects'

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
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z" fill="#84050C" opacity="0.15" />
      <path d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z" stroke="#84050C" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="16" y="18" width="4" height="3" rx="1" fill="#84050C" />
      <rect x="22" y="19" width="10" height="1.5" rx="0.75" fill="#84050C" />
      <rect x="16" y="24" width="4" height="3" rx="1" fill="#84050C" opacity="0.5" />
      <rect x="22" y="25" width="10" height="1.5" rx="0.75" fill="#84050C" opacity="0.5" />
      <path d="M17 19.5l1.2 1.2 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf']
const MAX_FILES = 3

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerifyIdPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { refetch: refetchAuth } = useAuth()

  const [user, setUser]       = useState<User | null>(null)
  const [uiState, setUiState] = useState<UIState>('loading')

  // Settings
  const [appName, setAppName]     = useState('Rizal High School Elections')
  const [docTypeOptions, setDocTypeOptions] = useState<string[]>([])
  const [docType, setDocType]     = useState('')

  // Configurable group structures (dynamic cascade)
  const { structures, selected, setValue, assignments, optionsFor, firstMissingRequired } = useGroupSelections()

  // Upload
  const [files, setFiles]           = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [fileError, setFileError]   = useState<string | null>(null)
  const [formError, setFormError]   = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter  = useRef(0)

  // Whether doc upload section is shown (driven by settings)
  const docsRequired = docTypeOptions.length > 0

  // ── Settings + grade levels on mount ──────────────────────────────────────────

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(j => {
        const s = j.data ?? {}
        if (s.app_name)        setAppName(s.app_name)
        if (s.doc_type_labels) {
          try {
            const arr = JSON.parse(s.doc_type_labels)
            if (Array.isArray(arr) && arr.length > 0) {
              setDocTypeOptions(arr)
              setDocType(arr[0])
            }
          } catch {}
        }
      })
      .catch(() => {})
  }, [])

  // ── Fetch current user ────────────────────────────────────────────────────────

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.status === 401) { router.push('/'); return }
      const json = await res.json()
      if (!res.ok || !json.data) { addToast('Failed to load your profile.', 'error'); return }
      const u: User = json.data
      setUser(u)
      deriveUiState(u)
    } catch {
      addToast('Network error while loading your profile.', 'error')
    }
  }, [router, addToast])

  useEffect(() => { fetchUser() }, [fetchUser])

  function deriveUiState(u: User) {
    if (u.id_verified)                        { setUiState('verified'); return }
    if (u.verification_status === 'pending')  { setUiState('pending');  return }
    if (u.verification_status === 'rejected') { setUiState('rejected'); return }
    setUiState('upload')
  }

  // ── File logic ────────────────────────────────────────────────────────────────

  const validateIncoming = (incoming: File[]): string | null => {
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) return `"${f.name}" is not a supported type. Use images or PDF.`
      if (f.size > MAX_FILE_SIZE_BYTES)    return `"${f.name}" exceeds the 5 MB limit.`
    }
    return null
  }

  const addFiles = (incoming: File[]) => {
    setFileError(null)
    const combined = [...files, ...incoming]
    if (combined.length > MAX_FILES) { setFileError(`You can upload at most ${MAX_FILES} files.`); return }
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
    e.preventDefault(); dragCounter.current++; setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files ?? [])
    if (dropped.length) addFiles(dropped)
  }

  // ── Validate + submit ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setFormError(null)

    const missing = firstMissingRequired()
    if (missing) {
      setFormError(`Please select your ${missing.name.toLowerCase()}.`)
      return
    }
    if (docsRequired && files.length === 0) {
      setFormError('Please attach at least one document.')
      return
    }

    const formData = new FormData()
    formData.append('assignments', JSON.stringify(assignments))
    if (docsRequired) formData.append('doc_type', docType)
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
        addToast(json.error ?? 'Submission failed. Please try again.', 'error')
        return
      }
      addToast('Verification request submitted successfully.', 'success')
      setFiles([])
      await Promise.all([fetchUser(), refetchAuth()])
    } catch {
      addToast('Network error during submission.', 'error')
    } finally {
      setUploading(false)
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function resetUploadState() {
    setFiles([])
    setFileError(null)
    setFormError(null)
    setUiState('upload')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FEE2E2] via-white to-[#FEE2E2]/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <LogoIcon />
          <span className="text-lg font-bold text-gray-900">{appName}</span>
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
                Your identity has been confirmed. You have full access to {appName}.
              </p>
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={() => router.push('/dashboard')}>
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
                Your request is under review. This usually takes 1–2 business days.
              </p>
            </div>
            {user?.id_photo_url && user.id_photo_url !== 'none' && (
              <div className="w-full">
                <p className="text-xs font-medium text-gray-500 mb-2 text-left">Submitted document</p>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user.id_photo_url} alt="Submitted document" className="w-full h-40 object-cover" />
                </div>
              </div>
            )}
            <div className="w-full rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700 text-left">
              <p className="font-medium mb-1">What happens next?</p>
              <p className="text-amber-600">
                An admin will review your submission. You will be notified by email once the review is complete.
              </p>
            </div>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
            <div className="text-center">
              <button
                type="button"
                disabled={uploading}
                onClick={async () => {
                  if (!confirm('Cancel your verification request? You can resubmit later.')) return
                  setUploading(true)
                  try {
                    const res = await fetch('/api/verifications', { method: 'DELETE', credentials: 'include' })
                    const json = await res.json()
                    if (res.ok) {
                      addToast('Verification request cancelled.', 'success')
                    } else {
                      addToast(json.error ?? 'Failed to cancel.', 'error')
                    }
                    // Always re-fetch — clears stale state even on error
                    await fetchUser()
                  } catch {
                    addToast('Network error.', 'error')
                  } finally {
                    setUploading(false)
                  }
                }}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Cancel verification request
              </button>
            </div>
          </div>
        )}

        {/* ── Rejected ── */}
        {uiState === 'rejected' && (
          <div className="flex flex-col items-center text-center py-4 gap-6">
            <XCircleIcon />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verification Denied</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your submission was not approved. You can try again below.
              </p>
            </div>

            {user?.verification_notes && (
              <div className="w-full rounded-xl bg-red-50 border border-red-200 p-4 text-left">
                <p className="text-xs font-semibold text-red-700 mb-1">Reason</p>
                <p className="text-sm text-red-600 whitespace-pre-wrap">{user.verification_notes}</p>
              </div>
            )}

            <Button variant="primary" size="lg" className="w-full" onClick={resetUploadState}>
              Try Again
            </Button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ── Upload ── */}
        {uiState === 'upload' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verify your identity</h1>
              <p className="text-sm text-gray-500 mt-1">
                Fill in your details below to submit a verification request.
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload verification documents"
            />

            {/* ── Dynamic configurable group structures ── */}
            <GroupSelects
              structures={structures}
              selected={selected}
              setValue={setValue}
              optionsFor={optionsFor}
              onChangeSide={() => setFormError(null)}
            />

            {/* ── Document upload — only when doc types configured ── */}
            {docsRequired && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={docType}
                    onChange={e => setDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  >
                    {docTypeOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Drop zone */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  disabled={uploading || files.length >= MAX_FILES}
                  className={[
                    'w-full rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3',
                    'transition-all duration-200 cursor-pointer outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[#84050C] focus-visible:ring-offset-2',
                    isDragging
                      ? 'border-[#BA4955] bg-[#FEE2E2]/60 scale-[1.01]'
                      : 'border-gray-300 bg-gray-50 hover:border-[#BA4955] hover:bg-[#FEE2E2]/30',
                    (uploading || files.length >= MAX_FILES) ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                  aria-label="Click or drag and drop to upload verification documents"
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
                          onClick={() => removeFile(idx)}
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
              </div>
            )}

            {/* Form error */}
            {formError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {formError}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              loading={uploading}
              onClick={handleSubmit}
              className="w-full"
            >
              {uploading ? 'Submitting…' : 'Submit for Verification'}
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
