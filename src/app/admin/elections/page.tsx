'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'

type ElectionStatus = 'draft' | 'active' | 'ended'

interface CandidateForm {
  id?: number
  name: string
  bio: string
}

interface PositionForm {
  id?: number
  name: string
  max_votes: number
  candidates: CandidateForm[]
}

interface ElectionForm {
  title: string
  description: string
  start_date: string
  end_date: string
  status: ElectionStatus
  positions: PositionForm[]
}

interface Election {
  id: number
  title: string
  description: string | null
  start_date: string
  end_date: string
  status: ElectionStatus
  position_count: number
  candidate_count: number
  vote_count: number
  created_at: string
}

const STATUS_BADGE: Record<ElectionStatus, 'warning' | 'success' | 'default'> = {
  draft: 'warning',
  active: 'success',
  ended: 'default',
}

const STATUS_LABELS: Record<ElectionStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  ended: 'Ended',
}

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

const EMPTY_FORM: ElectionForm = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  status: 'draft',
  positions: [],
}

export default function ElectionsPage() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingElection, setEditingElection] = useState<Election | null>(null)
  const [formData, setFormData] = useState<ElectionForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<{ election: Election; nextStatus: ElectionStatus } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Election | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const isAdmin =
    user?.role === 'master_admin' ||
    user?.role === 'teacher_admin' ||
    user?.role === 'student_admin'

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

  const openNew = () => {
    setEditingElection(null)
    setFormData(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = async (el: Election) => {
    setEditingElection(el)
    // Fetch full election with positions/candidates
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
          positions: (full.positions || []).map((p: { id: number; name: string; max_votes: number; candidates: { id: number; name: string; bio: string }[] }) => ({
            id: p.id,
            name: p.name,
            max_votes: p.max_votes ?? 1,
            candidates: (p.candidates || []).map((c: { id: number; name: string; bio: string }) => ({
              id: c.id,
              name: c.name,
              bio: c.bio || '',
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

  const closeModal = () => {
    setShowModal(false)
    setEditingElection(null)
    setFormData(EMPTY_FORM)
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
    setSaving(true)
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        status: formData.status,
        positions: formData.positions,
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
    try {
      const res = await fetch(`/api/elections/${el.id}`, {
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
        i === pi ? { ...p, candidates: [...p.candidates, { name: '', bio: '' }] } : p
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

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-1">You do not have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
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
            {elections.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                No elections yet. Create one to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-6 py-3 font-semibold text-gray-700">Title</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Dates</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Positions</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Votes</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {elections.map((el) => (
                      <tr key={el.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{el.title}</div>
                          <Badge variant={STATUS_BADGE[el.status]} size="sm" className="mt-1">
                            {STATUS_LABELS[el.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-600">
                          <div>Start: {new Date(el.start_date).toLocaleString()}</div>
                          <div>End: {new Date(el.end_date).toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-600">
                          {el.position_count}
                        </td>
                        <td className="px-4 py-4 text-center text-gray-600">
                          {el.vote_count}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEdit(el)}
                            >
                              Edit
                            </Button>

                            {el.status === 'draft' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setConfirmStatus({ election: el, nextStatus: 'active' })}
                              >
                                Start
                              </Button>
                            )}

                            {el.status === 'active' && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setConfirmStatus({ election: el, nextStatus: 'ended' })}
                              >
                                End
                              </Button>
                            )}

                            {el.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deletingId === el.id}
                                onClick={() => setConfirmDelete(el)}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingElection ? 'Edit Election' : 'New Election'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingElection ? 'Save Changes' : 'Create Election'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              Basic Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Student Council Election 2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date &amp; Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date &amp; Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as ElectionStatus }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Positions */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Positions</h3>
              <Button variant="secondary" size="sm" onClick={addPosition}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Position
              </Button>
            </div>

            {formData.positions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No positions yet. Add one above.</p>
            )}

            <div className="space-y-4">
              {formData.positions.map((pos, pi) => (
                <div key={pi} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  {/* Position row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={pos.name}
                          onChange={(e) => updatePosition(pi, { name: e.target.value })}
                          placeholder="Position name (e.g. President)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 whitespace-nowrap">Max votes</label>
                        <input
                          type="number"
                          min={1}
                          value={pos.max_votes}
                          onChange={(e) => updatePosition(pi, { max_votes: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removePosition(pi)}
                      className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                      title="Remove position"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Candidates */}
                  <div className="ml-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Candidates</span>
                      <button
                        onClick={() => addCandidate(pi)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Candidate
                      </button>
                    </div>

                    {pos.candidates.length === 0 && (
                      <p className="text-xs text-gray-400 pl-1">No candidates yet.</p>
                    )}

                    {pos.candidates.map((cand, ci) => (
                      <div key={ci} className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={cand.name}
                            onChange={(e) => updateCandidate(pi, ci, { name: e.target.value })}
                            placeholder="Candidate name"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <textarea
                            value={cand.bio}
                            onChange={(e) => updateCandidate(pi, ci, { bio: e.target.value })}
                            placeholder="Short bio (optional)"
                            rows={1}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <button
                          onClick={() => removeCandidate(pi, ci)}
                          className="text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0 mt-0.5"
                          title="Remove candidate"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

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
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm text-gray-600">
            Are you sure you want to permanently delete <strong>"{confirmDelete.title}"</strong>? This cannot be undone.
          </p>
        )}
      </Modal>
    </Layout>
  )
}
