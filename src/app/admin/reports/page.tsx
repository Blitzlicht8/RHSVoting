'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'

interface Report {
  id: number
  type: 'post' | 'comment'
  target_id: number
  target_content: string
  reporter_name: string
  author_name: string
  reason: string | null
  created_at: string
}

export default function ReportsPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  const allowed = ['master_admin', 'teacher_admin']

  useEffect(() => {
    if (!user || !allowed.includes(user.role)) return
    fetch('/api/admin/reports', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { setReports(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  const action = async (report: Report, act: 'dismiss' | 'delete_post') => {
    const url = report.type === 'comment'
      ? `/api/admin/comment-reports/${report.id}`
      : `/api/admin/reports/${report.id}`
    const body = act === 'delete_post' && report.type === 'comment'
      ? { action: 'delete_comment' }
      : { action: act }
    const res = await fetch(url, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setReports(r => r.filter(x => x.id !== report.id))
      addToast(act === 'delete_post' ? `${report.type === 'comment' ? 'Comment' : 'Post'} deleted` : 'Report dismissed', 'success')
    } else addToast('Failed', 'error')
  }

  if (!user || !allowed.includes(user.role)) {
    return <AdminLayout><div className="flex items-center justify-center h-64 text-gray-500">Access Denied</div></AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          {reports.length > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">{reports.length}</span>
          )}
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No pending reports.</div>
        ) : (
          <div className="space-y-4">
            {reports.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'comment' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{r.type}</span>
                      <span className="text-xs text-gray-400">
                        Reported by <span className="font-medium text-gray-600">{r.reporter_name}</span>
                        {r.reason && <> · <span className="italic">"{r.reason}"</span></>}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-1">By <span className="font-medium text-gray-700">{r.author_name}</span></div>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 line-clamp-3">
                      {(() => { try { return JSON.parse(r.target_content).map((b: any) => b.content).join(' ') } catch { return r.target_content } })()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => action(r, 'dismiss')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Dismiss</button>
                    <button onClick={() => action(r, 'delete_post')} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                      {r.type === 'comment' ? 'Delete Comment' : 'Delete Post'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
