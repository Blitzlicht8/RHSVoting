'use client'

// Session 10 — app-wide face-verification gate for regular user pages.
// Enforces the two HARD blocks server-truth can require:
//   • mustEnroll  → must complete a liveness face registration before using the app
//   • reportPending → blocked; a reported face problem awaits admin review
// Everything else renders children. Not applied in AdminLayout so admins can
// always reach the controls to clear these states.

import React, { useEffect, useState } from 'react'
import LivenessCapture from '@/components/LivenessCapture'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/providers/ToastProvider'

type Status = { mustEnroll: boolean; reportPending: boolean } | null

export default function FaceGate({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast()
  const [status, setStatus] = useState<Status>(null)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/face/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setStatus(j?.data ? { mustEnroll: !!j.data.mustEnroll, reportPending: !!j.data.reportPending } : { mustEnroll: false, reportPending: false }))
      .catch(() => setStatus({ mustEnroll: false, reportPending: false }))
      .finally(() => setChecked(true))
  }, [])

  const handleEnroll = async (descriptor: number[]) => {
    setSaving(true)
    try {
      const res = await fetch('/api/face/enroll', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
      })
      if (!res.ok) { addToast('Could not save your face. Try again.', 'error'); setSaving(false); return }
      addToast('Face registered.', 'success')
      window.location.reload()
    } catch {
      addToast('Network error.', 'error'); setSaving(false)
    }
  }

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
    window.location.href = '/'
  }

  if (!checked) return <>{children}</>

  if (status?.reportPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Face verification under review</h1>
          <p className="text-sm text-gray-600">
            You reported a problem verifying your face. An admin has been notified and must review your account before you can continue.
          </p>
          <Button variant="secondary" size="lg" onClick={logout} className="w-full">Sign out</Button>
        </div>
      </div>
    )
  }

  if (status?.mustEnroll) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Register your face</h1>
            <p className="text-sm text-gray-500 mt-1">Face verification is required for your account. Follow the prompts to register.</p>
          </div>
          {saving
            ? <p className="text-center text-sm text-gray-500 py-8">Saving…</p>
            : <LivenessCapture onComplete={handleEnroll} />}
          <button type="button" onClick={logout} className="w-full text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
