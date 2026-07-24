'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/providers/ToastProvider'

interface FaceUser {
  id: number
  name: string
  email: string
  role: string
  avatar_url: string | null
  has_face: boolean
  skip: boolean
  reverify_required: boolean
  enroll_required: boolean
  report_pending: boolean
  reported_at: string | null
}

type Tab = 'all' | 'registered' | 'none' | 'reported' | 'skipped'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'registered', label: 'Registered' },
  { key: 'none', label: 'No face' },
  { key: 'reported', label: 'Reported problem' },
  { key: 'skipped', label: 'Skipping' },
]

type Action = 'prompt' | 'reverify' | 'skip_on' | 'skip_off' | 'clear_report' | 'clear_face'

export default function FaceVerificationAdminPage() {
  const { addToast } = useToast()
  const [users, setUsers] = useState<FaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/face-verification', { credentials: 'include' })
      const json = await res.json()
      setUsers(json.data?.users ?? [])
    } catch {
      addToast('Failed to load face verification data.', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const act = async (userId: number, action: Action) => {
    setBusyId(userId)
    try {
      const res = await fetch('/api/admin/face-verification', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); addToast(j.error ?? 'Action failed.', 'error'); return }
      addToast('Done.', 'success')
      await load()
    } catch {
      addToast('Network error.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    all: users.length,
    registered: users.filter(u => u.has_face).length,
    none: users.filter(u => !u.has_face).length,
    reported: users.filter(u => u.report_pending).length,
    skipped: users.filter(u => u.skip).length,
  }
  const filtered = users.filter(u =>
    tab === 'all' ? true
    : tab === 'registered' ? u.has_face
    : tab === 'none' ? !u.has_face
    : tab === 'reported' ? u.report_pending
    : u.skip
  )

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Face Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage members&apos; face registration and login problems. Controls take effect the next time the member signs in.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-[#84050C] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t.label} <span className="opacity-70">({counts[t.key]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-10 text-center">No members in this view.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {u.avatar_url ? <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 truncate">{u.name}</span>
                      {u.report_pending && <Badge variant="danger">Reported</Badge>}
                      {u.has_face ? <Badge variant="success">Face registered</Badge> : <Badge variant="warning">No face</Badge>}
                      {u.reverify_required && <Badge variant="warning">Re-verify pending</Badge>}
                      {u.enroll_required && <Badge variant="warning">Prompt pending</Badge>}
                      {u.skip && <Badge>Skipping</Badge>}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{u.email} · {u.role}</div>
                    {u.reported_at && <div className="text-xs text-red-600 mt-0.5">Reported {new Date(u.reported_at).toLocaleString()}</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {u.report_pending && (
                    <Button size="sm" variant="secondary" loading={busyId === u.id} onClick={() => act(u.id, 'clear_report')}>Clear report</Button>
                  )}
                  {!u.has_face && !u.enroll_required && (
                    <Button size="sm" variant="secondary" loading={busyId === u.id} onClick={() => act(u.id, 'prompt')}>Prompt face registration</Button>
                  )}
                  {u.has_face && (
                    <Button size="sm" variant="secondary" loading={busyId === u.id} onClick={() => act(u.id, 'reverify')}>Re-verify face</Button>
                  )}
                  {u.has_face && (
                    <Button size="sm" variant="danger" loading={busyId === u.id} onClick={() => act(u.id, 'clear_face')}>Remove face</Button>
                  )}
                  <Button size="sm" variant={u.skip ? 'primary' : 'ghost'} loading={busyId === u.id} onClick={() => act(u.id, u.skip ? 'skip_off' : 'skip_on')}>
                    {u.skip ? 'Skipping login check' : 'Skip on login'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
