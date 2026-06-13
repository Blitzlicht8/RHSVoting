'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { APP_VERSION } from '@/lib/version'

interface Requirement {
  id: number
  name: string
  description: string | null
  required: 0 | 1
  order_index: number
}

interface ToggleRowProps {
  label: string
  description: string
  isOn: boolean
  disabled?: boolean
  onToggle: () => void
}

function ToggleRow({ label, description, isOn, disabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <div className="text-sm text-gray-500 mt-0.5">{description}</div>
      </div>
      <button
        disabled={disabled}
        onClick={onToggle}
        className={[
          'relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mt-0.5',
          isOn ? 'bg-[#84050C]' : 'bg-gray-300',
        ].join(' ')}
        aria-label={label}
        role="switch"
        aria-checked={isOn}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform m-0.5',
            isOn ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

interface SectionCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

function SectionCard({ title, children, className = '' }: SectionCardProps) {
  return (
    <div className={['bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className].join(' ')}>
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-4 divide-y divide-gray-100">{children}</div>
    </div>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 font-mono">{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const [appName, setAppName] = useState('Community Hub')
  const [orgType, setOrgType] = useState('community')
  const [l1, setL1] = useState('Group')
  const [l2, setL2] = useState('Subgroup')
  const [l3, setL3] = useState('Unit')
  const [docTypes, setDocTypes] = useState<string[]>([])
  const [newDoc, setNewDoc] = useState('')

  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  // Verification requirements
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [reqsLoading, setReqsLoading] = useState(true)
  const [newReqName, setNewReqName] = useState('')
  const [newReqDesc, setNewReqDesc] = useState('')
  const [newReqRequired, setNewReqRequired] = useState(true)
  const [addingReq, setAddingReq] = useState(false)
  const [deletingReqId, setDeletingReqId] = useState<number | null>(null)
  const [showAddReq, setShowAddReq] = useState(false)
  const addReqRef = useRef<HTMLInputElement>(null)

  const canEditSettings = ['master_admin', 'admin'].includes(user?.role ?? '')

  useEffect(() => {
    if (!authLoading && user && !canEditSettings) {
      router.replace('/dashboard')
    }
  }, [authLoading, user, canEditSettings, router])

  const fetchReqs = useCallback(async () => {
    setReqsLoading(true)
    try {
      const res = await fetch('/api/admin/verification-requirements', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) setReqs(json.data ?? [])
    } catch { /* ignore */ }
    finally { setReqsLoading(false) }
  }, [])

  useEffect(() => { if (canEditSettings) fetchReqs() }, [fetchReqs, canEditSettings])

  const handleAddReq = async () => {
    if (!newReqName.trim()) return
    setAddingReq(true)
    try {
      const res = await fetch('/api/admin/verification-requirements', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newReqName.trim(), description: newReqDesc.trim() || null, required: newReqRequired }),
      })
      const json = await res.json()
      if (res.ok) {
        await fetchReqs()
        setNewReqName(''); setNewReqDesc(''); setNewReqRequired(true); setShowAddReq(false)
        addToast('Requirement added', 'success')
      } else { addToast(json.error || 'Failed', 'error') }
    } catch { addToast('Network error', 'error') }
    finally { setAddingReq(false) }
  }

  const handleDeleteReq = async (id: number) => {
    setDeletingReqId(id)
    try {
      const res = await fetch(`/api/admin/verification-requirements/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) { setReqs(rs => rs.filter(r => r.id !== id)); addToast('Requirement removed', 'success') }
      else { const json = await res.json(); addToast(json.error || 'Failed', 'error') }
    } catch { addToast('Network error', 'error') }
    finally { setDeletingReqId(null) }
  }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setSettings(json.data ?? {})
        const s = json.data ?? {}
        setAppName(s.app_name ?? 'Community Hub')
        setOrgType(s.org_type ?? 'community')
        setL1(s.group_label_l1 ?? 'Group')
        setL2(s.group_label_l2 ?? 'Subgroup')
        setL3(s.group_label_l3 ?? 'Unit')
        try { setDocTypes(JSON.parse(s.doc_type_labels ?? '[]')) } catch { setDocTypes([]) }
      } else {
        addToast(json.error || 'Failed to load settings', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const toggleSetting = async (key: string) => {
    const current = settings[key]
    const next = current === 'true' ? 'false' : 'true'
    setTogglingKey(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: next }),
      })
      const json = await res.json()
      if (res.ok) {
        setSettings((s) => ({ ...s, [key]: next }))
        addToast('Setting updated', 'success')
      } else {
        addToast(json.error || 'Update failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setTogglingKey(null)
    }
  }

  const save = async (key: string, value: string) => {
    setTogglingKey(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const json = await res.json()
      if (res.ok) addToast('Saved', 'success')
      else addToast(json.error ?? 'Failed to save', 'error')
    } catch { addToast('Network error', 'error') }
    finally { setTogglingKey(null) }
  }

  const saveDocTypes = (types: string[]) => {
    setDocTypes(types)
    save('doc_type_labels', JSON.stringify(types))
  }

  const handleResetConfirm = () => {
    setShowResetModal(false)
    setResetConfirmText('')
    addToast('This feature is not yet implemented', 'info')
  }

  if (authLoading || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </AdminLayout>
    )
  }

  if (!user || !canEditSettings) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-1">Admin or above required.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const isMaster = user.role === 'master_admin'
  const canToggle = ['master_admin', 'admin'].includes(user.role)
  const autoVerifyOn = settings['auto_verify_id'] === 'true'
  const otpRequiredOn = settings['otp_required_login'] === 'true'

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <div className="space-y-4">
          {/* App Identity section */}
          {canEditSettings && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">App Identity</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">App Name</label>
                  <div className="flex gap-2 items-center">
                    <input
                      value={appName}
                      onChange={e => setAppName(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none flex-1"
                      onBlur={e => save('app_name', e.target.value)}
                    />
                    {togglingKey === 'app_name' && <span className="text-xs text-gray-400">Saving…</span>}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Organization Type</label>
                  <div className="flex gap-4 flex-wrap">
                    {['community', 'school', 'corporate', 'nonprofit'].map(type => (
                      <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="org_type" value={type} checked={orgType === type}
                          onChange={() => { setOrgType(type); save('org_type', type) }}
                          className="text-[#84050C]" />
                        <span className="capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group Labels section */}
          {canEditSettings && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Group Labels</h2>
                <p className="text-xs text-gray-500 mt-0.5">Labels used throughout the app for group hierarchy. Blur to save.</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                {([
                  ['group_label_l1', 'Level 1 (e.g. Group, Grade, Department)', l1, setL1],
                  ['group_label_l2', 'Level 2 (e.g. Subgroup, Track, Strand)', l2, setL2],
                  ['group_label_l3', 'Level 3 (e.g. Unit, Section, Team)', l3, setL3],
                ] as [string, string, string, (v: string) => void][]).map(([key, placeholder, val, setter]) => (
                  <div key={key} className="flex gap-2 items-center">
                    <label className="text-xs text-gray-500 w-8 shrink-0 font-mono">
                      {key === 'group_label_l1' ? 'L1' : key === 'group_label_l2' ? 'L2' : 'L3'}
                    </label>
                    <input
                      value={val}
                      onChange={e => setter(e.target.value)}
                      placeholder={placeholder}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none flex-1"
                      onBlur={e => save(key, e.target.value)}
                    />
                    {togglingKey === key && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Document Types section */}
          {canEditSettings && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Verification Document Types</h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
                  {docTypes.length === 0
                    ? <p className="text-xs text-gray-400">No document types yet.</p>
                    : docTypes.map((t, i) => (
                      <span key={i} className="flex items-center gap-1 bg-[#FEE2E2] text-[#84050C] rounded-full px-3 py-1 text-xs font-medium">
                        {t}
                        <button onClick={() => saveDocTypes(docTypes.filter((_, j) => j !== i))} className="hover:opacity-70 ml-0.5 text-[#84050C]">×</button>
                      </span>
                    ))
                  }
                </div>
                <div className="flex gap-2">
                  <input
                    value={newDoc}
                    onChange={e => setNewDoc(e.target.value)}
                    placeholder="Add document type…"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none flex-1"
                    onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { saveDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') } }}
                  />
                  <button
                    onClick={() => { if (newDoc.trim()) { saveDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') } }}
                    className="bg-[#84050C] text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-[#6b0409] transition-colors shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Verification Requirements — visible to admin+ */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Verification Requirements</h2>
              <button onClick={() => { setShowAddReq(v => !v); setTimeout(() => addReqRef.current?.focus(), 50) }}
                className="text-sm font-medium text-[#84050C] hover:text-[#6B0409]">
                + Add
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-gray-500 mb-3">Documents users must provide when submitting for verification.</p>
              {showAddReq && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <input ref={addReqRef} type="text" value={newReqName} onChange={e => setNewReqName(e.target.value)}
                    placeholder="Requirement name (e.g. School ID, Birth Certificate)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]" />
                  <input type="text" value={newReqDesc} onChange={e => setNewReqDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]" />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={newReqRequired} onChange={e => setNewReqRequired(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C]" />
                      Required
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddReq(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                      <button onClick={handleAddReq} disabled={addingReq || !newReqName.trim()}
                        className="px-3 py-1.5 text-sm bg-[#84050C] text-white rounded-lg hover:bg-[#6B0409] disabled:opacity-50">
                        {addingReq ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {reqsLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : reqs.length === 0 ? (
                <p className="text-sm text-gray-400">No requirements set. Users can submit any document.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {reqs.map(r => (
                    <li key={r.id} className="flex items-start justify-between py-3 first:pt-0 last:pb-0 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{r.name}</span>
                          {r.required ? (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Required</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Optional</span>
                          )}
                        </div>
                        {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                      </div>
                      <button onClick={() => handleDeleteReq(r.id)} disabled={deletingReqId === r.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 flex-shrink-0">
                        {deletingReqId === r.id ? '…' : 'Remove'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* canToggle-only below */}
          {canToggle && (
            <>
              <SectionCard title="Verification Settings">
                <ToggleRow
                  label="Auto-Approve Document Submissions"
                  description="Automatically verify accounts when they upload documents. If disabled, admins must manually approve each submission."
                  isOn={autoVerifyOn}
                  disabled={togglingKey === 'auto_verify_id'}
                  onToggle={() => toggleSetting('auto_verify_id')}
                />
              </SectionCard>

              <SectionCard title="Login & Security">
                <ToggleRow
                  label="Require OTP on Login"
                  description="Users receive an OTP email each time they sign in. Adds an extra layer of security."
                  isOn={otpRequiredOn}
                  disabled={togglingKey === 'otp_required_login'}
                  onToggle={() => toggleSetting('otp_required_login')}
                />
              </SectionCard>

              <SectionCard title="System Information">
                <InfoRow label="App Version" value={`v${APP_VERSION}`} />
                <InfoRow label="Default Admin" value="(configured in .env)" />
                <InfoRow label="Environment" value={process.env.NODE_ENV || 'unknown'} />
                <div className="pt-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-blue-700">To change admin credentials, modify the database directly or contact your system administrator.</p>
                  </div>
                </div>
              </SectionCard>

              <div className="bg-red-50/30 rounded-xl border border-red-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-red-200">
                  <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Reset All Elections</div>
                      <div className="text-sm text-gray-500 mt-0.5">Permanently delete all elections and voting data. Cannot be undone.</div>
                    </div>
                    <Button variant="danger" size="sm" className="flex-shrink-0"
                      onClick={() => { setResetConfirmText(''); setShowResetModal(true) }}>
                      Reset All Elections
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => { setShowResetModal(false); setResetConfirmText('') }}
        title="Reset All Elections"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setShowResetModal(false); setResetConfirmText('') }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetConfirmText !== 'RESET'}
              onClick={handleResetConfirm}
            >
              Reset All Elections
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700 font-medium">
              This action will permanently delete ALL elections, positions, candidates, and votes. This cannot be undone.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <strong>RESET</strong> to confirm
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
