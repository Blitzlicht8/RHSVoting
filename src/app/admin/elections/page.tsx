'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import ElectionList, { Election } from '@/components/admin/elections/ElectionList'
import ElectionFormModal, { ElectionForm, ElectionStatus, EligibilityRule } from '@/components/admin/elections/ElectionFormModal'
import { PositionForm } from '@/components/admin/elections/PositionManager'
import { CandidateForm, StudentResult } from '@/components/admin/elections/CandidateManager'

function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

const STATUS_LABELS: Record<ElectionStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  ended: 'Ended',
}

const EMPTY_FORM: ElectionForm = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  status: 'draft',
  positions: [],
  is_global: false,
  allow_teacher_vote: false,
  eligibility: [],
}

export default function ElectionsPage() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingElection, setEditingElection] = useState<Election | null>(null)
  const [formData, setFormData] = useState<ElectionForm>(EMPTY_FORM)
  const [newDraft, setNewDraft] = useState<ElectionForm>(EMPTY_FORM)
  const editingElectionRef = useRef<Election | null>(null)
  const showModalRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<{ election: Election; nextStatus: ElectionStatus } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Election | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [studentSearches, setStudentSearches] = useState<Record<string, string>>({})
  const [studentDropdowns, setStudentDropdowns] = useState<Record<string, StudentResult[]>>({})

  const isAdmin =
    user?.role === 'master_admin' ||
    user?.role === 'admin' ||
    user?.role === 'moderator'

  const fetchElections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/elections', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setElections(json.data.elections)
      } else {
        addToast(json.error || 'Failed to load elections', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchElections()
  }, [fetchElections])

  // Keep refs in sync so the auto-save effect can read them without stale closures
  useEffect(() => { editingElectionRef.current = editingElection }, [editingElection])
  useEffect(() => { showModalRef.current = showModal }, [showModal])

  // Auto-save formData to newDraft while creating a new election
  useEffect(() => {
    if (showModalRef.current && !editingElectionRef.current) {
      setNewDraft(formData)
    }
  }, [formData])

  const openNew = () => {
    setEditingElection(null)
    setFormData(newDraft)
    setShowModal(true)
  }

  const openEdit = async (el: Election) => {
    setEditingElection(el)
    try {
      const res = await fetch(`/api/elections/${el.id}`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        const full = json.data.election
        setFormData({
          title: full.title,
          description: full.description || '',
          start_date: toDatetimeLocal(full.start_date),
          end_date: toDatetimeLocal(full.end_date),
          status: full.status,
          is_global: !!full.is_global,
          allow_teacher_vote: !!full.allow_teacher_vote,
          eligibility: (full.eligibility || []).map((r: { grade_level_id: number | null; subtype_id: number | null; section_id: number | null; is_all_grade: number | boolean; is_all_subtype: number | boolean; is_all_section: number | boolean; is_exclude: number | boolean }) => ({
            grade_level_id: r.grade_level_id,
            subtype_id: r.subtype_id,
            section_id: r.section_id,
            is_all_grade: !!r.is_all_grade,
            is_all_subtype: !!r.is_all_subtype,
            is_all_section: !!r.is_all_section,
            is_exclude: !!r.is_exclude,
          })),
          thumbnail_url: full.thumbnail_url ?? null,
          positions: (full.positions || []).map((p: { id: number; name: string; max_votes: number; candidates: { id: number; name: string; bio: string; platform?: string | null; qualifications?: string | null; grade_level?: string; subtype?: string; section?: string; student_user_id?: number | null; photo_url?: string | null }[] }) => ({
            id: p.id,
            name: p.name,
            max_votes: p.max_votes ?? 1,
            collapsed: true,
            candidates: (p.candidates || []).map((c: { id: number; name: string; bio: string; platform?: string | null; qualifications?: string | null; grade_level?: string; subtype?: string; section?: string; student_user_id?: number | null; photo_url?: string | null }) => ({
              id: c.id,
              name: c.name,
              bio: c.bio || '',
              platform: c.platform ?? '',
              qualifications: c.qualifications ?? '',
              grade_level: c.grade_level ?? '',
              subtype: c.subtype ?? '',
              section: c.section ?? '',
              student_user_id: c.student_user_id ?? null,
              photo_url: c.photo_url ?? null,
              mode: c.student_user_id ? 'existing' as const : 'manual' as const,
              collapsed: true,
            })),
          })),
        })
      } else {
        addToast(json.error || 'Failed to load election', 'error')
        return
      }
    } catch {
      addToast('Network error', 'error')
      return
    }
    setShowModal(true)
  }

  // After successful save — clears everything including draft
  const closeModal = () => {
    setShowModal(false)
    setEditingElection(null)
    setFormData(EMPTY_FORM)
    setNewDraft(EMPTY_FORM)
  }

  // Backdrop/X on new election — just hide, preserve draft in state
  const closeSoftNew = () => {
    setShowModal(false)
  }

  // Backdrop/X or Cancel on edit — close without touching new draft
  const closeEdit = () => {
    setShowModal(false)
    setEditingElection(null)
    setFormData(EMPTY_FORM)
  }

  // Explicit Discard Draft button — clears everything
  const discardNew = () => {
    setShowModal(false)
    setEditingElection(null)
    setFormData(EMPTY_FORM)
    setNewDraft(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      addToast('Title is required', 'error')
      return
    }
    if (!formData.start_date || !formData.end_date) {
      addToast('Start and end dates are required', 'error')
      return
    }
    for (const pos of formData.positions) {
      for (const cand of pos.candidates) {
        if (cand.mode === 'existing' && !cand.student_user_id) {
          addToast('Please select a member for all "From Member Account" candidates, or switch to manual entry.', 'error')
          return
        }
        if (cand.mode === 'manual' && !cand.grade_level_id && !cand.grade_level?.trim()) {
          addToast('All manual candidates require a group level.', 'error')
          return
        }
        if (cand.mode === 'manual' && cand.subtype_required && !cand.subtype_id && !cand.subtype?.trim()) {
          addToast('All manual candidates require a subgroup selection.', 'error')
          return
        }
        if (cand.mode === 'manual' && cand.section_required && !cand.section_id && !cand.section?.trim()) {
          addToast('All manual candidates require a unit selection.', 'error')
          return
        }
      }
    }

    setSaving(true)
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        is_global: formData.is_global,
        allow_teacher_vote: formData.allow_teacher_vote,
        eligibility: formData.is_global ? [] : formData.eligibility,
        thumbnail_url: formData.thumbnail_url ?? null,
        positions: formData.positions.map((p) => ({
          ...p,
          candidates: p.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            bio: c.bio,
            platform: c.platform ?? null,
            qualifications: c.qualifications ?? null,
            grade_level: c.grade_level || null,
            subtype: c.subtype || null,
            section: c.section || null,
            student_user_id: c.student_user_id ?? null,
            photo_url: c.photo_url ?? null,
          })),
        })),
      }

      let res: Response
      if (editingElection) {
        res = await fetch(`/api/elections/${editingElection.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/elections', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json()
      if (res.ok) {
        addToast(editingElection ? 'Election updated' : 'Election created', 'success')
        closeModal()
        fetchElections()
      } else {
        addToast(json.error || 'Save failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async () => {
    if (!confirmStatus) return
    const { election, nextStatus } = confirmStatus
    setConfirmStatus(null)
    if (nextStatus === 'active') {
      if ((election.position_count ?? 0) === 0) {
        addToast('Cannot start — election has no positions.', 'error')
        return
      }
      if ((election.candidate_count ?? 0) === 0) {
        addToast('Cannot start — no candidates have been added.', 'error')
        return
      }
    }
    try {
      const res = await fetch(`/api/elections/${election.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (res.ok) {
        addToast(`Election status changed to ${STATUS_LABELS[nextStatus]}`, 'success')
        fetchElections()
      } else {
        addToast(json.error || 'Status change failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    const el = confirmDelete
    setConfirmDelete(null)
    setDeletingId(el.id)
    const needsConfirm = el.status === 'active' || el.status === 'ended'
    const url = needsConfirm
      ? `/api/elections/${el.id}?confirm=true`
      : `/api/elections/${el.id}`
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (res.ok) {
        addToast('Election deleted', 'success')
        fetchElections()
      } else {
        addToast(json.error || 'Delete failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  // Position helpers
  const addPosition = () => {
    setFormData((f) => ({
      ...f,
      positions: [...f.positions, { name: '', max_votes: 1, candidates: [] }],
    }))
  }

  const updatePosition = (pi: number, updates: Partial<PositionForm>) => {
    setFormData((f) => ({
      ...f,
      positions: f.positions.map((p, i) => (i === pi ? { ...p, ...updates } : p)),
    }))
  }

  const removePosition = (pi: number) => {
    setFormData((f) => ({ ...f, positions: f.positions.filter((_, i) => i !== pi) }))
  }

  const addCandidate = (pi: number) => {
    setFormData((f) => ({
      ...f,
      positions: f.positions.map((p, i) =>
        i === pi ? { ...p, candidates: [...p.candidates, { name: '', bio: '', mode: 'manual' as const }] } : p
      ),
    }))
  }

  const updateCandidate = (pi: number, ci: number, updates: Partial<CandidateForm>) => {
    setFormData((f) => ({
      ...f,
      positions: f.positions.map((p, i) =>
        i === pi
          ? { ...p, candidates: p.candidates.map((c, j) => (j === ci ? { ...c, ...updates } : c)) }
          : p
      ),
    }))
  }

  const removeCandidate = (pi: number, ci: number) => {
    setFormData((f) => ({
      ...f,
      positions: f.positions.map((p, i) =>
        i === pi ? { ...p, candidates: p.candidates.filter((_, j) => j !== ci) } : p
      ),
    }))
  }

  const searchStudents = async (key: string, q: string) => {
    setStudentSearches((s) => ({ ...s, [key]: q }))
    if (!q.trim()) {
      setStudentDropdowns((d) => ({ ...d, [key]: [] }))
      return
    }
    try {
      const params = new URLSearchParams({ q, is_global: String(formData.is_global) })
      if (!formData.is_global && formData.eligibility.length > 0) {
        params.set('filter', JSON.stringify(formData.eligibility))
      }
      const res = await fetch(`/api/admin/members/search?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setStudentDropdowns((d) => ({ ...d, [key]: json.data.members || [] }))
      }
    } catch {
      // silent
    }
  }

  const clearStudentSearch = (key: string) => {
    setStudentSearches((s) => ({ ...s, [key]: '' }))
    setStudentDropdowns((d) => ({ ...d, [key]: [] }))
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-1">You do not have permission to view this page.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Election Management</h1>
          <Button onClick={openNew}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Election
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <ElectionList
              elections={elections}
              deletingId={deletingId}
              userRole={user?.role ?? ''}
              onEdit={openEdit}
              onConfirmStatus={(el, nextStatus) => setConfirmStatus({ election: el, nextStatus })}
              onConfirmDelete={setConfirmDelete}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <ElectionFormModal
        open={showModal}
        election={editingElection}
        formData={formData}
        saving={saving}
        studentSearches={studentSearches}
        studentDropdowns={studentDropdowns}
        onClose={editingElection ? closeEdit : closeSoftNew}
        onDiscard={discardNew}
        onSave={handleSave}
        onFormChange={(updates) => setFormData((f) => ({ ...f, ...updates }))}
        onAddPosition={addPosition}
        onUpdatePosition={updatePosition}
        onRemovePosition={removePosition}
        onAddCandidate={addCandidate}
        onUpdateCandidate={updateCandidate}
        onRemoveCandidate={removeCandidate}
        onSearchStudents={searchStudents}
        onClearStudentSearch={clearStudentSearch}
      />

      {/* Status Change Confirm Modal */}
      <Modal
        isOpen={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        title="Confirm Status Change"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmStatus(null)}>Cancel</Button>
            <Button
              variant={confirmStatus?.nextStatus === 'active' ? 'primary' : 'danger'}
              onClick={handleStatusChange}
            >
              {confirmStatus?.nextStatus === 'active' ? 'Start Election' : 'End Election'}
            </Button>
          </>
        }
      >
        {confirmStatus && (
          <p className="text-sm text-gray-600">
            Are you sure you want to{' '}
            <strong>{confirmStatus.nextStatus === 'active' ? 'start' : 'end'}</strong>{' '}
            the election <strong>"{confirmStatus.election.title}"</strong>? This action cannot be easily undone.
          </p>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Election"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Permanently</Button>
          </>
        }
      >
        {confirmDelete && confirmDelete.status === 'draft' && (
          <p className="text-sm text-gray-600">
            Are you sure you want to permanently delete <strong>"{confirmDelete.title}"</strong>? This cannot be undone.
          </p>
        )}
        {confirmDelete && (confirmDelete.status === 'active' || confirmDelete.status === 'ended') && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">This cannot be undone.</p>
            </div>
            <p className="text-sm text-gray-600">
              You are about to permanently delete the <strong>{confirmDelete.status}</strong> election{' '}
              <strong>"{confirmDelete.title}"</strong>
              {confirmDelete.vote_count > 0 && (
                <span> with <strong className="text-red-600">{confirmDelete.vote_count} vote{confirmDelete.vote_count !== 1 ? 's' : ''} cast</strong></span>
              )}
              . All votes, candidates, and positions will be permanently lost.
            </p>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
