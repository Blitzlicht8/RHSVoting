'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { useUnsavedGuard } from '@/lib/useUnsavedGuard'
import { APP_VERSION } from '@/lib/version'

// Flat key-value settings edited through the Save bar (staged, applied on Save).
interface SettingsDraft {
  app_name: string
  org_type: string
  doc_type_labels: string // JSON array string
  auto_verify_id: string  // 'true' | 'false'
  otp_required_login: string
}
const DRAFT_KEYS: (keyof SettingsDraft)[] = [
  'app_name', 'org_type', 'doc_type_labels', 'auto_verify_id', 'otp_required_login',
]
function draftFromSettings(s: Record<string, string>): SettingsDraft {
  return {
    app_name: s.app_name ?? 'Rizal High School Elections',
    org_type: s.org_type ?? 'school',
    doc_type_labels: s.doc_type_labels ?? '[]',
    auto_verify_id: s.auto_verify_id ?? 'false',
    otp_required_login: s.otp_required_login ?? 'false',
  }
}

interface Requirement {
  id: number
  name: string
  description: string | null
  required: 0 | 1
  order_index: number
}

interface GroupValue {
  id: number
  structure_id: number
  parent_value_id: number | null
  name: string
  order_index: number
  active: number
  user_count?: number
}

interface StructureWithValues {
  id: number
  name: string
  parent_structure_id: number | null
  is_required: number
  order_index: number
  active: number
  values: GroupValue[]
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

  // Staged draft + saved baseline for the Save bar
  const [draft, setDraft] = useState<SettingsDraft>(draftFromSettings({}))
  const [baseline, setBaseline] = useState<SettingsDraft>(draftFromSettings({}))
  const [saving, setSaving] = useState(false)
  const [newDoc, setNewDoc] = useState('')

  const dirtyKeys = DRAFT_KEYS.filter(k => draft[k] !== baseline[k])
  const isDirty = dirtyKeys.length > 0

  const docTypes: string[] = (() => {
    try { return JSON.parse(draft.doc_type_labels) } catch { return [] }
  })()
  const setDraftKey = (k: keyof SettingsDraft, v: string) => setDraft(d => ({ ...d, [k]: v }))
  const setDocTypes = (types: string[]) => setDraftKey('doc_type_labels', JSON.stringify(types))

  // Group Structures
  const [structures, setStructures] = useState<StructureWithValues[]>([])
  const [structuresLoading, setStructuresLoading] = useState(true)
  const [newStructName, setNewStructName] = useState('')
  const [newStructRequired, setNewStructRequired] = useState(true)
  const [newStructParentId, setNewStructParentId] = useState<number | null>(null)
  const [addingStruct, setAddingStruct] = useState(false)
  const [showAddStruct, setShowAddStruct] = useState(false)
  const [editingStructId, setEditingStructId] = useState<number | null>(null)
  const [editingStructName, setEditingStructName] = useState('')
  const [busyStructId, setBusyStructId] = useState<number | null>(null)
  const [structDeleteConfirm, setStructDeleteConfirm] = useState<{
    id: number; name: string; valueCount: number; userCount: number
  } | null>(null)

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

  const fetchStructures = useCallback(async () => {
    setStructuresLoading(true)
    try {
      const res = await fetch('/api/admin/groups?tree=1', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) setStructures(json.data ?? [])
    } catch { /* ignore */ }
    finally { setStructuresLoading(false) }
  }, [])

  useEffect(() => { if (canEditSettings) fetchStructures() }, [fetchStructures, canEditSettings])

  const structureName = (id: number | null): string =>
    structures.find(s => s.id === id)?.name ?? '—'

  const handleAddStructure = async () => {
    if (!newStructName.trim()) return
    setAddingStruct(true)
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStructName.trim(),
          parent_structure_id: newStructParentId,
          is_required: newStructRequired,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        await fetchStructures()
        setNewStructName(''); setNewStructRequired(true); setNewStructParentId(null); setShowAddStruct(false)
        addToast('Structure added', 'success')
      } else { addToast(json.error || 'Failed', 'error') }
    } catch { addToast('Network error', 'error') }
    finally { setAddingStruct(false) }
  }

  const updateStructure = async (id: number, patch: Record<string, unknown>, successMsg = 'Structure updated') => {
    setBusyStructId(id)
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (res.ok) { await fetchStructures(); addToast(successMsg, 'success') }
      else { addToast(json.error || 'Failed', 'error') }
    } catch { addToast('Network error', 'error') }
    finally { setBusyStructId(null) }
  }

  const handleRenameStructure = async (id: number) => {
    if (!editingStructName.trim()) { setEditingStructId(null); return }
    await updateStructure(id, { name: editingStructName.trim() }, 'Structure renamed')
    setEditingStructId(null)
  }

  const deleteStructure = async (id: number, force = false) => {
    setBusyStructId(id)
    try {
      const res = await fetch(`/api/admin/groups/${id}${force ? '?force=true' : ''}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (res.ok) {
        await fetchStructures()
        setStructDeleteConfirm(null)
        addToast('Structure deleted', 'success')
        return
      }
      const json = await res.json()
      if (res.status === 400 && json.error === 'last_structure') {
        addToast('At least one group structure must remain.', 'error')
      } else if (res.status === 409 && json.error === 'has_dependencies') {
        const st = structures.find(s => s.id === id)
        setStructDeleteConfirm({
          id, name: st?.name ?? 'structure',
          valueCount: Number(json.valueCount ?? 0), userCount: Number(json.userCount ?? 0),
        })
      } else {
        addToast(json.error || 'Failed', 'error')
      }
    } catch { addToast('Network error', 'error') }
    finally { setBusyStructId(null) }
  }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        const s = json.data ?? {}
        setSettings(s)
        const d = draftFromSettings(s)
        setDraft(d)
        setBaseline(d)
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

  const toggleDraft = (key: keyof SettingsDraft) =>
    setDraftKey(key, draft[key] === 'true' ? 'false' : 'true')

  // Apply all staged changes on Save (only the keys that actually changed).
  const handleSaveAll = async () => {
    if (!isDirty || saving) return
    setSaving(true)
    try {
      for (const key of dirtyKeys) {
        const res = await fetch('/api/settings', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: draft[key] }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          addToast(json.error ?? `Failed to save ${key}`, 'error')
          setSaving(false)
          return
        }
      }
      setSettings(s => ({ ...s, ...Object.fromEntries(dirtyKeys.map(k => [k, draft[k]])) }))
      setBaseline(draft)
      addToast('Changes saved', 'success')
    } catch {
      addToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => setDraft(baseline)

  useUnsavedGuard(isDirty)

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

  const canToggle = ['master_admin', 'admin'].includes(user.role)
  const autoVerifyOn = draft.auto_verify_id === 'true'
  const otpRequiredOn = draft.otp_required_login === 'true'

  return (
    <AdminLayout>
      {/* Persistent Save bar — applies staged changes on Save */}
      {isDirty && (
        <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 shadow-sm">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-amber-800 font-medium">
              You have unsaved changes.
            </span>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleDiscard} disabled={saving}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                Discard
              </button>
              <button onClick={handleSaveAll} disabled={saving}
                className="px-4 py-1.5 text-sm bg-[#84050C] text-white rounded-lg font-medium hover:bg-[#6B0409] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                      value={draft.app_name}
                      onChange={e => setDraftKey('app_name', e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Organization Type</label>
                  <div className="flex gap-4 flex-wrap">
                    {['community', 'school', 'corporate', 'nonprofit'].map(type => (
                      <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="org_type" value={type} checked={draft.org_type === type}
                          onChange={() => setDraftKey('org_type', type)}
                          className="text-[#84050C]" />
                        <span className="capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group Structures section */}
          {canEditSettings && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Group Structures</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Define how members are grouped (e.g. Grade Level, Section). Edit each structure&apos;s values on the{' '}
                    <Link href="/admin/academic" className="text-[#84050C] hover:text-[#6B0409] font-medium underline">Group Structure page</Link>.
                  </p>
                </div>
                <button onClick={() => setShowAddStruct(v => !v)}
                  className="text-sm font-medium text-[#84050C] hover:text-[#6B0409] shrink-0">
                  + Add
                </button>
              </div>
              <div className="px-6 py-4">
                {showAddStruct && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <input type="text" value={newStructName} onChange={e => setNewStructName(e.target.value)}
                      placeholder="Structure name (e.g. Grade Level, Section)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]" />
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" name="new_struct_type" checked={newStructParentId === null}
                          onChange={() => setNewStructParentId(null)}
                          className="text-[#84050C] focus:ring-[#84050C]" />
                        Standalone
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="new_struct_type" checked={newStructParentId !== null}
                          disabled={structures.length === 0}
                          onChange={() => setNewStructParentId(structures[0]?.id ?? null)}
                          className="text-[#84050C] focus:ring-[#84050C]" />
                        <span>Level under</span>
                        <select
                          disabled={newStructParentId === null}
                          value={newStructParentId ?? ''}
                          onChange={e => setNewStructParentId(e.target.value ? Number(e.target.value) : null)}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] disabled:opacity-50">
                          {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={newStructRequired} onChange={e => setNewStructRequired(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C]" />
                        Required
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddStruct(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                        <button onClick={handleAddStructure} disabled={addingStruct || !newStructName.trim()}
                          className="px-3 py-1.5 text-sm bg-[#84050C] text-white rounded-lg hover:bg-[#6B0409] disabled:opacity-50">
                          {addingStruct ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {structuresLoading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : structures.length === 0 ? (
                  <p className="text-sm text-gray-400">No group structures yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {structures.map(s => (
                      <li key={s.id} className="flex items-start justify-between py-3 first:pt-0 last:pb-0 gap-3">
                        <div className="flex-1 min-w-0">
                          {editingStructId === s.id ? (
                            <div className="flex items-center gap-2">
                              <input value={editingStructName} autoFocus
                                onChange={e => setEditingStructName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleRenameStructure(s.id); if (e.key === 'Escape') setEditingStructId(null) }}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]" />
                              <button onClick={() => handleRenameStructure(s.id)} disabled={busyStructId === s.id}
                                className="text-xs text-[#84050C] hover:text-[#6B0409] font-medium">Save</button>
                              <button onClick={() => setEditingStructId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{s.name}</span>
                                {s.is_required ? (
                                  <span className="text-xs bg-[#FEE2E2] text-[#84050C] px-1.5 py-0.5 rounded font-medium">Required</span>
                                ) : (
                                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Optional</span>
                                )}
                                {!s.active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {s.parent_structure_id === null
                                  ? 'Standalone'
                                  : `Level under ${structureName(s.parent_structure_id)}`}
                                {' · '}{s.values.length} value{s.values.length !== 1 ? 's' : ''}
                              </p>
                            </>
                          )}
                        </div>
                        {editingStructId !== s.id && (
                          <div className="flex items-center gap-2 shrink-0 text-xs">
                            <button onClick={() => { setEditingStructId(s.id); setEditingStructName(s.name) }}
                              className="text-gray-500 hover:text-gray-800">Rename</button>
                            <button onClick={() => updateStructure(s.id, { is_required: !s.is_required })} disabled={busyStructId === s.id}
                              className="text-gray-500 hover:text-gray-800 disabled:opacity-50">{s.is_required ? 'Make optional' : 'Make required'}</button>
                            <button onClick={() => updateStructure(s.id, { active: !s.active })} disabled={busyStructId === s.id}
                              className="text-gray-500 hover:text-gray-800 disabled:opacity-50">{s.active ? 'Deactivate' : 'Activate'}</button>
                            <button onClick={() => deleteStructure(s.id)} disabled={busyStructId === s.id}
                              className="text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
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
                        <button onClick={() => setDocTypes(docTypes.filter((_, j) => j !== i))} className="hover:opacity-70 ml-0.5 text-[#84050C]">×</button>
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
                    onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { setDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') } }}
                  />
                  <button
                    onClick={() => { if (newDoc.trim()) { setDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') } }}
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
                  onToggle={() => toggleDraft('auto_verify_id')}
                />
              </SectionCard>

              <SectionCard title="Login & Security">
                <ToggleRow
                  label="Require OTP on Login"
                  description="Users receive an OTP email each time they sign in. Adds an extra layer of security."
                  isOn={otpRequiredOn}
                  onToggle={() => toggleDraft('otp_required_login')}
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

      {/* Structure force-delete confirmation */}
      <Modal
        isOpen={structDeleteConfirm !== null}
        onClose={() => setStructDeleteConfirm(null)}
        title={`Delete ${structDeleteConfirm?.name ?? ''}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStructDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger"
              disabled={busyStructId === structDeleteConfirm?.id}
              onClick={() => { if (structDeleteConfirm) deleteStructure(structDeleteConfirm.id, true) }}>
              Delete anyway
            </Button>
          </>
        }
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">
            {structDeleteConfirm
              ? `${structDeleteConfirm.valueCount} value${structDeleteConfirm.valueCount !== 1 ? 's' : ''} and ${structDeleteConfirm.userCount} user${structDeleteConfirm.userCount !== 1 ? 's' : ''} will be affected. Affected users will need to re-verify.`
              : ''}
          </p>
        </div>
      </Modal>

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
