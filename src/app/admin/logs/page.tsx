'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
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

  const allowed = ['master_admin', 'teacher_admin']

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
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (!user || !allowed.includes(user.role)) {
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

  const totalPages = data?.totalPages ?? 1

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          {data && (
            <span className="bg-indigo-100 text-indigo-700 text-sm font-semibold px-3 py-1 rounded-full">
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    </Layout>
  )
}
