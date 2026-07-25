'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'

interface LogEntry {
  id: number
  action: string
  details: string | null
  ip: string | null
  created_at: string
  email: string | null
  name: string | null
  role: string | null
}

interface LogsResponse {
  logs: LogEntry[]
  total: number
  page: number
  totalPages: number
}

const ACTION_BADGE: Record<string, { label: string; className: string }> = {
  login_success: {
    label: 'Login Success',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  login_failed: {
    label: 'Login Failed',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  otp_failed: {
    label: 'OTP Failed',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  login_otp_sent: {
    label: 'OTP Sent',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  user_deleted: {
    label: 'User Deleted',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  user_role_changed: {
    label: 'Role Changed',
    className: 'bg-purple-100 text-purple-700 border border-purple-200',
  },
  user_activated: {
    label: 'User Activated',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  user_deactivated: {
    label: 'User Deactivated',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  email_verified_admin: {
    label: 'Email Approved',
    className: 'bg-teal-100 text-teal-700 border border-teal-200',
  },
  id_verified_admin: {
    label: 'ID Approved',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  },
  user_created: {
    label: 'User Created',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  student_academic_removed: {
    label: 'Academic Removed',
    className: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  },
  // Session 8 — new event types
  group_structure_created: {
    label: 'Group Structure Created',
    className: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  },
  group_structure_deleted: {
    label: 'Group Structure Removed',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  group_value_created: {
    label: 'Group Value Created',
    className: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  },
  group_value_deleted: {
    label: 'Group Value Removed',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  verification_submitted: {
    label: 'Verification Submitted',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  verification_reverified: {
    label: 'Reverification Submitted',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
  },
  verification_approved: {
    label: 'Verification Approved',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  verification_rejected: {
    label: 'Verification Denied',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  election_visibility_changed: {
    label: 'Election Visibility Changed',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
  },
  user_timeout: {
    label: 'User Timed Out',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  post_approved: {
    label: 'Post Approved',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  post_rejected: {
    label: 'Post Rejected',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  settings_changed: {
    label: 'Settings Changed',
    className: 'bg-purple-100 text-purple-700 border border-purple-200',
  },
  // Session 13 — activity-log coverage audit
  logout: {
    label: 'Logout',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  password_changed: {
    label: 'Password Changed',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  password_reset_admin: {
    label: 'Password Reset (Admin)',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  election_created: {
    label: 'Election Created',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  election_deleted: {
    label: 'Election Deleted',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  candidate_added: {
    label: 'Candidate Added',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  candidate_removed: {
    label: 'Candidate Removed',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  vote_cast: {
    label: 'Vote Cast',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  verifier_assigned: {
    label: 'Verifier Assigned',
    className: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  },
  verifier_removed: {
    label: 'Verifier Removed',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  role_created: {
    label: 'Role Created',
    className: 'bg-purple-100 text-purple-700 border border-purple-200',
  },
  role_updated: {
    label: 'Role Updated',
    className: 'bg-purple-100 text-purple-700 border border-purple-200',
  },
  role_deleted: {
    label: 'Role Deleted',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  post_created: {
    label: 'Post Created',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  post_deleted: {
    label: 'Post Deleted',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  post_reported: {
    label: 'Post Reported',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  comment_created: {
    label: 'Comment Created',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  comment_deleted: {
    label: 'Comment Deleted',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  comment_reported: {
    label: 'Comment Reported',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  report_resolved: {
    label: 'Report Resolved',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  report_dismissed: {
    label: 'Report Dismissed',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  profile_updated: {
    label: 'Profile Updated',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
  },
  face_enrolled: {
    label: 'Face Enrolled',
    className: 'bg-teal-100 text-teal-700 border border-teal-200',
  },
  face_verify_reported: {
    label: 'Face Verify Reported',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  face_admin_action: {
    label: 'Face Admin Action',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  },
  verification_cancelled: {
    label: 'Verification Cancelled',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  admin_verified_user: {
    label: 'Admin Verified User',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  },
}

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_BADGE[action]
  if (config) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      {action}
    </span>
  )
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z')
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return ts
  }
}

export default function LogsPage() {
  const { user, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const allowed = ['master_admin', 'admin']

  useEffect(() => {
    if (!authLoading && user && !allowed.includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [authLoading, user, router])

  const fetchLogs = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q) params.set('q', q)
      const res = await fetch(`/api/admin/logs?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setData(json.data)
      } else {
        addToast(json.error || 'Failed to load logs', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  useEffect(() => {
    if (!authLoading && user && allowed.includes(user.role)) {
      fetchLogs(page, debouncedSearch)
    }
  }, [page, debouncedSearch, authLoading, user, fetchLogs])

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </AdminLayout>
    )
  }

  if (!user || !allowed.includes(user.role)) {
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

  const totalPages = data?.totalPages ?? 1

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          {data && (
            <span className="bg-[#FEE2E2] text-[#6B0409] text-sm font-semibold px-3 py-1 rounded-full">
              {data.total.toLocaleString()} entries
            </span>
          )}
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by action, email, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
            />
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner />
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <svg className="w-10 h-10 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium">No logs found</p>
              {search && <p className="text-xs mt-1">Try a different search term</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Timestamp
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      User
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Action
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap text-gray-500 font-mono text-xs">
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {log.email ? (
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{log.name ?? '—'}</div>
                            <div className="text-xs text-gray-500">{log.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Unknown / Guest</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-sm max-w-xs truncate">
                        {log.details ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap font-mono text-xs text-gray-500">
                        {log.ip ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-sm text-gray-500">
                Page {data.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
