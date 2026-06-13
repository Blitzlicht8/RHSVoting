'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import LightboxModal from '@/components/ui/LightboxModal'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'

type VerifStatus = 'pending' | 'approved' | 'rejected'
type TabKey = 'pending' | 'approved' | 'rejected' | 'all'

interface VerifDocument {
  id: number
  file_path: string
}

interface VerifRequest {
  id: number
  user_id: number
  user_name: string
  user_email: string
  user_role: string
  user_avatar_url: string | null
  id_image: string
  status: VerifStatus
  notes: string | null
  created_at: string
  updated_at: string
  intended_role: string | null
  grade_level: string | null
  section: string | null
  doc_type: string | null
  documents: VerifDocument[]
}

const TAB_LABELS: Record<TabKey, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
}

const STATUS_BADGE: Record<VerifStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const ROLE_LABELS: Record<string, string> = {
  master_admin: 'Master Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  staff: 'Staff',
  member: 'Member',
}

const AVATAR_COLORS = [
  'bg-[#84050C]', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500',
  'bg-teal-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500',
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function VerificationsPage() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [verifications, setVerifications] = useState<VerifRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [togglingAuto, setTogglingAuto] = useState(false)

  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageRequest, setSelectedImageRequest] = useState<VerifRequest | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRejectRequest, setSelectedRejectRequest] = useState<VerifRequest | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [actioning, setActioning] = useState<number | null>(null)

  const isAdmin = ['master_admin', 'admin', 'moderator'].includes(user?.role ?? '')

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) setSettings(json.data)
    } catch {
      // silent
    } finally {
      setLoadingSettings(false)
    }
  }, [])

  const fetchVerifications = useCallback(async (tab: TabKey) => {
    setLoadingList(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (tab !== 'all') params.set('status', tab)
      const res = await fetch(`/api/verifications?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setVerifications(json.data.requests)
      } else {
        addToast(json.error || 'Failed to load verifications', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setLoadingList(false)
    }
  }, [addToast])

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/verifications?status=pending&limit=1', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) setPendingCount(json.data.total ?? 0)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchPendingCount()
  }, [fetchSettings, fetchPendingCount])

  useEffect(() => {
    fetchVerifications(activeTab)
  }, [activeTab, fetchVerifications])

  const toggleSetting = async (key: string) => {
    const current = settings[key]
    const next = current === '1' ? '0' : '1'
    setTogglingAuto(true)
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
      setTogglingAuto(false)
    }
  }

  const handleApprove = async (req: VerifRequest) => {
    setActioning(req.id)
    try {
      const res = await fetch(`/api/verifications/${req.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const json = await res.json()
      if (res.ok) {
        addToast('Verification approved', 'success')
        fetchVerifications(activeTab)
        fetchPendingCount()
      } else {
        addToast(json.error || 'Approve failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setActioning(null)
    }
  }

  const openRejectModal = (req: VerifRequest) => {
    setSelectedRejectRequest(req)
    setRejectNotes('')
    setShowRejectModal(true)
  }

  const handleReject = async () => {
    if (!selectedRejectRequest) return
    const req = selectedRejectRequest
    setShowRejectModal(false)
    setActioning(req.id)
    try {
      const res = await fetch(`/api/verifications/${req.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', notes: rejectNotes }),
      })
      const json = await res.json()
      if (res.ok) {
        addToast('Verification rejected', 'success')
        fetchVerifications(activeTab)
        fetchPendingCount()
      } else {
        addToast(json.error || 'Reject failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setActioning(null)
    }
  }

  const autoVerifyOn = settings['auto_verify_id'] === '1'

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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">ID Verifications</h1>

        {/* Staff-scoped note */}
        {user?.role === 'staff' && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-blue-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            Showing requests for your assigned grades and sections only.
          </div>
        )}

        {/* Auto-verify toggle card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900 text-sm">Auto-Approve Submissions</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Automatically verify accounts when they upload an ID document
              </div>
            </div>
            <button
              disabled={loadingSettings || togglingAuto}
              onClick={() => toggleSetting('auto_verify_id')}
              className={[
                'relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0',
                autoVerifyOn ? 'bg-[#84050C]' : 'bg-gray-300',
              ].join(' ')}
              aria-label="Toggle auto-approve"
            >
              <span
                className={[
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform m-0.5',
                  autoVerifyOn ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {autoVerifyOn && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-amber-700 font-medium">
                Auto-approve is active — all new submissions will be immediately verified
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {(['pending', 'approved', 'rejected', 'all'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
              {tab === 'pending' && pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loadingList ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : verifications.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
            </svg>
            No {activeTab !== 'all' ? activeTab : ''} verifications found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {verifications.map((req) => (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* User info */}
                <div className="p-4 flex items-center gap-3">
                  <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden ${avatarColor(req.user_id)}`}>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{getInitials(req.user_name)}</span>
                    {req.user_avatar_url && (
                      <img
                        src={req.user_avatar_url}
                        alt={req.user_name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{req.user_name}</div>
                    <div className="text-xs text-gray-500 truncate">{req.user_email}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge variant="info" size="sm">
                        {ROLE_LABELS[req.user_role] || req.user_role}
                      </Badge>
                      {req.intended_role === 'member' && (
                        <>
                          <Badge variant="default" size="sm">Member</Badge>
                          {(req as any).grade_level_name ? (
                            <span className="text-xs text-gray-500">
                              {(req as any).grade_level_name}{(req as any).section_name ? ` · ${(req as any).section_name}` : ''}
                            </span>
                          ) : req.grade_level ? (
                            <>
                              <span className="text-xs text-gray-500">Grade {req.grade_level}</span>
                              {req.section && (
                                <span className="text-xs text-gray-500">&middot; {req.section}</span>
                              )}
                            </>
                          ) : null}
                        </>
                      )}
                      {req.intended_role === 'staff' && (
                        <Badge variant="default" size="sm">Staff</Badge>
                      )}
                      {req.doc_type && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#FEE2E2]/60 text-[#6B0409] border border-[#FEE2E2]">
                          {req.doc_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Document thumbnails */}
                {(() => {
                  const photoUrls = req.documents?.length > 0
                    ? req.documents.map((d: VerifDocument) => d.file_path)
                    : req.id_image ? [req.id_image] : []
                  if (photoUrls.length === 0) return null
                  return (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                      {photoUrls.map((url: string, i: number) => (
                        <img
                          key={i}
                          src={url}
                          alt="Document"
                          className="w-16 h-16 object-cover rounded-lg cursor-pointer border border-gray-200 hover:opacity-80 transition"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          onClick={() => setLightbox({ urls: photoUrls, index: i })}
                        />
                      ))}
                    </div>
                  )
                })()}

                {/* Meta + status */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <Badge variant={STATUS_BADGE[req.status]} size="sm">
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </Badge>
                </div>

                {/* Actions (pending only) */}
                {req.status === 'pending' && (
                  <div className="px-4 pb-4 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 focus:ring-green-500"
                      loading={actioning === req.id}
                      disabled={actioning === req.id}
                      onClick={() => handleApprove(req)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      disabled={actioning === req.id}
                      onClick={() => openRejectModal(req)}
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {/* Rejection notes */}
                {req.status === 'rejected' && req.notes && (
                  <div className="px-4 pb-4">
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <span className="font-medium text-gray-700">Reason: </span>
                      {req.notes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Modal */}
      <Modal
        isOpen={showImageModal}
        onClose={() => { setShowImageModal(false); setSelectedImageRequest(null) }}
        title={selectedImageRequest ? `${selectedImageRequest.user_name}'s ID Document` : ''}
        size="xl"
      >
        {selectedImageRequest && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`relative w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden ${avatarColor(selectedImageRequest.user_id)}`}>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{getInitials(selectedImageRequest.user_name)}</span>
                {selectedImageRequest.user_avatar_url && (
                  <img
                    src={selectedImageRequest.user_avatar_url}
                    alt={selectedImageRequest.user_name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{selectedImageRequest.user_name}</div>
                <div className="text-xs text-gray-500">{selectedImageRequest.user_email}</div>
                {selectedImageRequest.intended_role === 'student' && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <Badge variant="default" size="sm">Member</Badge>
                    {selectedImageRequest.grade_level && (
                      <span className="text-xs text-gray-500">Grade {selectedImageRequest.grade_level}</span>
                    )}
                    {selectedImageRequest.section && (
                      <span className="text-xs text-gray-500">&middot; {selectedImageRequest.section}</span>
                    )}
                  </div>
                )}
                {selectedImageRequest.intended_role === 'teacher' && (
                  <div className="mt-0.5">
                    <Badge variant="default" size="sm">Staff</Badge>
                  </div>
                )}
              </div>
              <Badge variant={STATUS_BADGE[selectedImageRequest.status]} size="sm" className="ml-auto">
                {selectedImageRequest.status}
              </Badge>
            </div>
            {(selectedImageRequest.documents && selectedImageRequest.documents.length > 0) ? (
              <div className="space-y-3">
                {selectedImageRequest.documents.map((doc, i) => (
                  doc.file_path.toLowerCase().endsWith('.pdf') ? (
                    <a
                      key={doc.id}
                      href={doc.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-[#84050C] underline">Document {i + 1} (PDF)</span>
                    </a>
                  ) : (
                    <img
                      key={doc.id}
                      src={doc.file_path}
                      alt={`Document ${i + 1}`}
                      className="w-full rounded-lg object-contain border border-gray-200 max-h-[40vh]"
                    />
                  )
                ))}
              </div>
            ) : (
              <img
                src={selectedImageRequest.id_image}
                alt="Full size ID document"
                className="w-full rounded-lg object-contain border border-gray-200 max-h-[65vh]"
              />
            )}
          </div>
        )}
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <LightboxModal
          urls={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Verification"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleReject}>Reject</Button>
          </>
        }
      >
        <div className="space-y-3">
          {selectedRejectRequest && (
            <p className="text-sm text-gray-600">
              Rejecting ID verification for <strong>{selectedRejectRequest.user_name}</strong>.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes</label>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              placeholder="Optional: provide a reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
