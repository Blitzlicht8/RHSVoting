'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { useUnsavedGuard } from '@/lib/useUnsavedGuard'

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

interface VerifierAssignmentRow {
  id: number
  structure_id: number
  structure_name: string
  value_id: number
  value_name: string
}

interface VerifierUser {
  id: number
  name: string
  email: string
  role: string
  assignments: { structure_id: number; structure_name: string; value_id: number; value_name: string }[]
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    master_admin: 'Master Admin', admin: 'Admin',
    moderator: 'Moderator', staff: 'Staff', member: 'Member',
  }
  return labels[role] ?? role
}

function requireAdmin(role?: string) {
  return role === 'master_admin' || role === 'admin'
}

export default function GroupStructurePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [structures, setStructures] = useState<StructureWithValues[]>([])
  const [loadingStructures, setLoadingStructures] = useState(true)
  const [selectedStructureId, setSelectedStructureId] = useState<number | null>(null)

  // Values for the selected structure (scoped by parent value if leveled)
  const [values, setValues] = useState<GroupValue[]>([])
  const [loadingValues, setLoadingValues] = useState(false)
  const [selectedParentValueId, setSelectedParentValueId] = useState<number | null>(null)
  const [parentValues, setParentValues] = useState<GroupValue[]>([])

  const [newValueName, setNewValueName] = useState('')
  const [editingValue, setEditingValue] = useState<{ id: number; name: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [pendingSimpleDelete, setPendingSimpleDelete] = useState<{
    name: string; onConfirm: () => void
  } | null>(null)
  const [valueForceDelete, setValueForceDelete] = useState<{ id: number; name: string; userCount: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Verifier panel state
  const [verifierSearch, setVerifierSearch] = useState('')
  const [verifierSearchResults, setVerifierSearchResults] = useState<VerifierUser[]>([])
  const [searchingVerifiers, setSearchingVerifiers] = useState(false)
  const [selectedVerifier, setSelectedVerifier] = useState<VerifierUser | null>(null)
  const [verifierAssignments, setVerifierAssignments] = useState<VerifierAssignmentRow[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignStructureId, setAssignStructureId] = useState<number | null>(null)
  const [assignValueId, setAssignValueId] = useState<number | null>(null)
  const [assignValues, setAssignValues] = useState<GroupValue[]>([])
  const [assigning, setAssigning] = useState(false)
  const [allVerifiers, setAllVerifiers] = useState<VerifierUser[]>([])
  const [loadingAllVerifiers, setLoadingAllVerifiers] = useState(true)

  useEffect(() => {
    if (user && !requireAdmin(user.role)) router.replace('/dashboard')
  }, [user, router])

  // Guard against navigating away mid-edit (unsaved value rename or typed-but-unadded value)
  const hasPendingEdit = editingValue !== null || newValueName.trim() !== ''
  useUnsavedGuard(hasPendingEdit)

  const selectedStructure = structures.find(s => s.id === selectedStructureId) ?? null
  const parentStructure = selectedStructure?.parent_structure_id != null
    ? structures.find(s => s.id === selectedStructure.parent_structure_id) ?? null
    : null

  const fetchStructures = useCallback(async () => {
    setLoadingStructures(true)
    try {
      const res = await fetch('/api/admin/groups?tree=1', { credentials: 'include' })
      const json = await res.json()
      const data: StructureWithValues[] = json.data ?? []
      setStructures(data)
      setSelectedStructureId(prev => prev != null && data.some(s => s.id === prev) ? prev : (data[0]?.id ?? null))
    } finally {
      setLoadingStructures(false)
    }
  }, [])

  useEffect(() => { fetchStructures() }, [fetchStructures])

  // Load values for the selected structure, scoped by parent value if leveled
  const fetchValues = useCallback(async (structureId: number, parentValueId: number | null) => {
    setLoadingValues(true)
    try {
      const qs = parentValueId != null ? `?parentValueId=${parentValueId}` : ''
      const res = await fetch(`/api/admin/groups/${structureId}/values${qs}`, { credentials: 'include' })
      const json = await res.json()
      setValues(json.data ?? [])
    } finally {
      setLoadingValues(false)
    }
  }, [])

  // When selection changes: reset parent value, load parent options if leveled
  useEffect(() => {
    if (selectedStructureId == null) { setValues([]); setParentValues([]); setSelectedParentValueId(null); return }
    const struct = structures.find(s => s.id === selectedStructureId)
    if (!struct) return
    setEditingValue(null)
    setNewValueName('')
    if (struct.parent_structure_id != null) {
      const parent = structures.find(s => s.id === struct.parent_structure_id)
      setParentValues(parent?.values ?? [])
      setSelectedParentValueId(null)
      setValues([]) // wait for parent value selection
    } else {
      setParentValues([])
      setSelectedParentValueId(null)
      fetchValues(selectedStructureId, null)
    }
  }, [selectedStructureId, structures, fetchValues])

  // Leveled: reload values when parent value chosen
  useEffect(() => {
    if (selectedStructureId == null || parentStructure == null) return
    if (selectedParentValueId != null) fetchValues(selectedStructureId, selectedParentValueId)
    else setValues([])
  }, [selectedParentValueId, selectedStructureId, parentStructure, fetchValues])

  // --- Value CRUD ---
  const addValue = async () => {
    if (!newValueName.trim() || selectedStructureId == null || saving) return
    if (parentStructure != null && selectedParentValueId == null) return
    setSaving(true)
    try {
      await fetch(`/api/admin/groups/${selectedStructureId}/values`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: newValueName.trim(), parent_value_id: selectedParentValueId }),
      })
      setNewValueName('')
      await fetchValues(selectedStructureId, selectedParentValueId)
      await fetchStructures()
    } finally { setSaving(false) }
  }

  const saveValue = async () => {
    if (!editingValue || selectedStructureId == null || saving) return
    setSaving(true)
    try {
      await fetch(`/api/admin/groups/values/${editingValue.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: editingValue.name }),
      })
      setEditingValue(null)
      await fetchValues(selectedStructureId, selectedParentValueId)
      await fetchStructures()
    } finally { setSaving(false) }
  }

  const toggleValueActive = async (v: GroupValue) => {
    if (selectedStructureId == null) return
    await fetch(`/api/admin/groups/values/${v.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ active: !v.active }),
    })
    await fetchValues(selectedStructureId, selectedParentValueId)
  }

  const deleteValue = async (v: GroupValue, force = false) => {
    if (selectedStructureId == null) return
    const res = await fetch(`/api/admin/groups/values/${v.id}${force ? '?force=true' : ''}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (res.status === 409) {
      const json = await res.json()
      setValueForceDelete({ id: v.id, name: v.name, userCount: Number(json.userCount ?? 0) })
      return
    }
    setValueForceDelete(null)
    await fetchValues(selectedStructureId, selectedParentValueId)
    await fetchStructures()
  }

  const confirmForceDeleteValue = async () => {
    if (!valueForceDelete || selectedStructureId == null) return
    setDeleting(true)
    try {
      await fetch(`/api/admin/groups/values/${valueForceDelete.id}?force=true`, { method: 'DELETE', credentials: 'include' })
      setValueForceDelete(null)
      await fetchValues(selectedStructureId, selectedParentValueId)
      await fetchStructures()
    } finally { setDeleting(false) }
  }

  // --- Verifiers ---
  const fetchAllVerifiers = useCallback(async () => {
    setLoadingAllVerifiers(true)
    try {
      // Empty search returns moderator+ users with their assignments
      const res = await fetch('/api/admin/verifiers?search=', { credentials: 'include' })
      const json = await res.json()
      const data: VerifierUser[] = json.data ?? []
      setAllVerifiers(data.filter(u => u.assignments.length > 0))
    } finally {
      setLoadingAllVerifiers(false)
    }
  }, [])

  useEffect(() => { fetchAllVerifiers() }, [fetchAllVerifiers])

  useEffect(() => {
    if (verifierSearch.trim() === '') { setVerifierSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingVerifiers(true)
      try {
        const res = await fetch(`/api/admin/verifiers?search=${encodeURIComponent(verifierSearch.trim())}`, { credentials: 'include' })
        const json = await res.json()
        setVerifierSearchResults(json.data ?? [])
      } finally {
        setSearchingVerifiers(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [verifierSearch])

  const loadUserAssignments = useCallback(async (userId: number) => {
    setLoadingAssignments(true)
    try {
      const res = await fetch(`/api/admin/verifiers?userId=${userId}`, { credentials: 'include' })
      const json = await res.json()
      const data: VerifierAssignmentRow[] = (json.data ?? []).map((r: VerifierAssignmentRow) => ({
        id: Number(r.id),
        structure_id: Number(r.structure_id),
        structure_name: r.structure_name,
        value_id: Number(r.value_id),
        value_name: r.value_name,
      }))
      setVerifierAssignments(data)
    } finally {
      setLoadingAssignments(false)
    }
  }, [])

  const selectVerifier = async (u: VerifierUser) => {
    setSelectedVerifier(u)
    setVerifierSearch('')
    setVerifierSearchResults([])
    setAssignStructureId(null)
    setAssignValueId(null)
    setAssignValues([])
    await loadUserAssignments(u.id)
  }

  const clearVerifier = () => {
    setSelectedVerifier(null)
    setVerifierAssignments([])
    setAssignStructureId(null)
    setAssignValueId(null)
    setAssignValues([])
  }

  // Load values for the structure chosen in the assign row (flat: all values of that structure)
  useEffect(() => {
    if (assignStructureId == null) { setAssignValues([]); setAssignValueId(null); return }
    const struct = structures.find(s => s.id === assignStructureId)
    setAssignValues(struct?.values.filter(v => v.active) ?? [])
    setAssignValueId(null)
  }, [assignStructureId, structures])

  const addVerifierAssignment = async () => {
    if (!selectedVerifier || assignStructureId == null || assignValueId == null || assigning) return
    setAssigning(true)
    try {
      await fetch('/api/admin/verifiers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ user_id: selectedVerifier.id, structure_id: assignStructureId, value_id: assignValueId }),
      })
      setAssignValueId(null)
      await loadUserAssignments(selectedVerifier.id)
      await fetchAllVerifiers()
    } finally { setAssigning(false) }
  }

  const removeVerifierAssignment = async (assignmentId: number) => {
    await fetch(`/api/admin/verifiers/${assignmentId}`, { method: 'DELETE', credentials: 'include' })
    if (selectedVerifier) await loadUserAssignments(selectedVerifier.id)
    await fetchAllVerifiers()
  }

  if (!user || !requireAdmin(user.role)) return null

  const canAddValue = selectedStructureId != null && newValueName.trim() !== '' &&
    (parentStructure == null || selectedParentValueId != null)

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Group Structure</h1>
        <p className="text-gray-500 text-sm mb-6">Manage the values within each group structure and assign verifiers.</p>

        {/* Structure tabs */}
        {loadingStructures ? (
          <div className="text-gray-500 text-sm">Loading structures…</div>
        ) : structures.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-gray-500 text-sm">
            No group structures defined. Create one in Settings → Group Structures.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {structures.map(s => (
                <button key={s.id}
                  onClick={() => setSelectedStructureId(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    selectedStructureId === s.id
                      ? 'bg-[#84050C] text-white border-[#84050C]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  {s.name}
                  {!s.active && <span className="ml-1.5 text-xs opacity-70">(inactive)</span>}
                </button>
              ))}
            </div>

            {/* Values editor */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">
                  {selectedStructure?.name} — Values
                  {parentStructure && (
                    <span className="ml-1 text-gray-500 font-normal">(under {parentStructure.name})</span>
                  )}
                </h2>
              </div>

              {/* Parent value selector for leveled structures */}
              {parentStructure && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <label className="text-sm text-gray-600">{parentStructure.name}:</label>
                  <select
                    value={selectedParentValueId ?? ''}
                    onChange={e => setSelectedParentValueId(e.target.value ? Number(e.target.value) : null)}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C]">
                    <option value="">Select {parentStructure.name.toLowerCase()}…</option>
                    {parentValues.map(pv => <option key={pv.id} value={pv.id}>{pv.name}</option>)}
                  </select>
                </div>
              )}

              <div className="p-4">
                {parentStructure && selectedParentValueId == null ? (
                  <div className="text-center text-gray-500 text-sm py-6">
                    Select a {parentStructure.name.toLowerCase()} above to view and manage its {selectedStructure?.name.toLowerCase()} values.
                  </div>
                ) : loadingValues ? (
                  <div className="text-center text-gray-500 text-sm py-4">Loading…</div>
                ) : values.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-4">No values yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {values.map(v => (
                      <div key={v.id} className="group relative">
                        {editingValue?.id === v.id ? (
                          <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-full px-2 py-1">
                            <input className="bg-transparent text-sm text-gray-900 focus:outline-none w-28"
                              value={editingValue.name} autoFocus
                              onChange={e => setEditingValue({ ...editingValue, name: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveValue(); if (e.key === 'Escape') setEditingValue(null) }} />
                            <button onClick={saveValue} disabled={saving} className="text-xs text-green-600 hover:text-green-700">✓</button>
                            <button onClick={() => setEditingValue(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-1 border rounded-full px-3 py-1 text-sm transition-colors ${
                            v.active ? 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}>
                            <span>{v.name}</span>
                            {typeof v.user_count === 'number' && v.user_count > 0 && (
                              <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{v.user_count}</span>
                            )}
                            {!v.active && <span className="text-xs text-gray-400">(inactive)</span>}
                            <button onClick={() => setEditingValue({ id: v.id, name: v.name })}
                              className="opacity-0 group-hover:opacity-100 ml-1 text-gray-400 hover:text-gray-700 transition-opacity" title="Rename">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.293-9.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L9 13z" /></svg>
                            </button>
                            <button onClick={() => toggleValueActive(v)}
                              className="opacity-0 group-hover:opacity-100 ml-0.5 text-gray-400 hover:text-amber-600 transition-opacity" title={v.active ? 'Deactivate' : 'Activate'}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            </button>
                            <button onClick={() => setPendingSimpleDelete({ name: v.name, onConfirm: () => deleteValue(v) })}
                              className="opacity-0 group-hover:opacity-100 ml-0.5 text-gray-400 hover:text-red-600 transition-opacity" title="Delete">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add value */}
                {(!parentStructure || selectedParentValueId != null) && (
                  <div className="mt-4 flex gap-2">
                    <input className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C]"
                      placeholder={`New ${selectedStructure?.name.toLowerCase()} value…`} value={newValueName}
                      onChange={e => setNewValueName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addValue() }} />
                    <button onClick={addValue} disabled={!canAddValue || saving}
                      className="px-3 py-1.5 bg-[#84050C] text-white text-sm rounded-lg hover:bg-[#6B0409] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Add</button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Verifier Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Verifiers</h2>
              <p className="text-xs text-gray-500 mt-0.5">Assign which group value(s) each verifier covers.</p>
            </div>
            {!selectedVerifier && (
              <button onClick={() => setVerifierSearch(' ')}
                className="shrink-0 px-3 py-1.5 bg-[#84050C] hover:bg-[#6B0409] text-white text-xs font-medium rounded-lg transition-colors">
                + Assign Verifier
              </button>
            )}
          </div>

          {/* Current verifiers list */}
          {!selectedVerifier && (
            <div className="divide-y divide-gray-100">
              {loadingAllVerifiers ? (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">Loading…</div>
              ) : allVerifiers.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">No verifiers assigned yet.</div>
              ) : allVerifiers.map(u => (
                <div key={u.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#84050C] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-xs font-medium select-none">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-900 font-medium">{u.name}</span>
                      <span className="text-xs text-gray-500">{getRoleLabel(u.role)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {u.assignments.map(a => (
                        <span key={`${a.structure_id}:${a.value_id}`} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5">
                          {a.structure_name}: {a.value_name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => selectVerifier(u)}
                    className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 mt-0.5">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-gray-100">
            {!selectedVerifier ? (
              /* Search state */
              <div className="max-w-md">
                <input
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] transition-colors"
                  placeholder="Search moderators & above by name or email…"
                  value={verifierSearch}
                  onChange={e => setVerifierSearch(e.target.value)}
                />
                {verifierSearch.trim().length > 0 && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    {searchingVerifiers ? (
                      <div className="p-3 text-center text-gray-500 text-sm">Searching…</div>
                    ) : verifierSearchResults.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 text-sm">No eligible users found.</div>
                    ) : verifierSearchResults.map(u => (
                      <button key={u.id} onClick={() => selectVerifier(u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-100 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-[#84050C] flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-medium select-none">{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-500">{getRoleLabel(u.role)} · {u.email}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Assignment editor */
              <div>
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-9 h-9 rounded-full bg-[#84050C] flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-medium select-none">{selectedVerifier.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">{selectedVerifier.name}</p>
                    <p className="text-xs text-gray-500">{getRoleLabel(selectedVerifier.role)}</p>
                  </div>
                  <button onClick={clearVerifier} className="text-xs text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 shrink-0">
                    Done
                  </button>
                </div>

                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Covers these group values</p>

                {loadingAssignments ? (
                  <div className="text-center text-gray-500 text-sm py-4">Loading…</div>
                ) : verifierAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-3">No group values assigned yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {verifierAssignments.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-full pl-3 pr-1.5 py-1">
                        {a.structure_name}: {a.value_name}
                        <button onClick={() => removeVerifierAssignment(a.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors" title="Remove">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add assignment row */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                  <select
                    value={assignStructureId ?? ''}
                    onChange={e => setAssignStructureId(e.target.value ? Number(e.target.value) : null)}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C]">
                    <option value="">Structure…</option>
                    {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select
                    value={assignValueId ?? ''}
                    disabled={assignStructureId == null}
                    onChange={e => setAssignValueId(e.target.value ? Number(e.target.value) : null)}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] disabled:opacity-50">
                    <option value="">Value…</option>
                    {assignValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <button onClick={addVerifierAssignment} disabled={assignStructureId == null || assignValueId == null || assigning}
                    className="px-3 py-1.5 bg-[#84050C] hover:bg-[#6B0409] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors">
                    {assigning ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simple delete confirmation */}
      {pendingSimpleDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Delete &ldquo;{pendingSimpleDelete.name}&rdquo;?</h3>
            <p className="text-sm text-gray-600">This value will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { const fn = pendingSimpleDelete.onConfirm; setPendingSimpleDelete(null); fn() }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors">Delete</button>
              <button onClick={() => setPendingSimpleDelete(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Force-delete (value has users) confirmation */}
      {valueForceDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Cannot delete &ldquo;{valueForceDelete.name}&rdquo;</h3>
            <p className="text-sm text-gray-600">
              This value has <strong className="text-gray-900">{valueForceDelete.userCount} user(s)</strong> assigned.
              Force-deleting will clear their assignment and flag them for re-verification. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={confirmForceDeleteValue} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                {deleting ? 'Deleting…' : 'Delete and reset users'}
              </button>
              <button onClick={() => setValueForceDelete(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
