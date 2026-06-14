'use client'

import { useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

type ElectionStatus = 'draft' | 'active' | 'ended'

export interface Election {
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
  thumbnail_url?: string | null
  share_token?: string | null
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

interface ElectionListProps {
  elections: Election[]
  deletingId: number | null
  userRole: string
  onEdit: (e: Election) => void
  onConfirmStatus: (e: Election, nextStatus: ElectionStatus) => void
  onConfirmDelete: (e: Election) => void
}

export default function ElectionList({
  elections,
  deletingId,
  userRole,
  onEdit,
  onConfirmStatus,
  onConfirmDelete,
}: ElectionListProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const copyShareLink = (el: Election) => {
    if (!el.share_token) return
    const url = `${window.location.origin}/elections/join/${el.share_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(el.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const canDelete = (el: Election): boolean => {
    if (el.status === 'draft') return ['master_admin', 'admin', 'moderator'].includes(userRole)
    if (el.status === 'active') return ['master_admin', 'admin'].includes(userRole)
    if (el.status === 'ended') return userRole === 'master_admin'
    return false
  }
  if (elections.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        No elections yet. Create one to get started.
      </div>
    )
  }

  return (
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
                    onClick={() => onEdit(el)}
                  >
                    Edit
                  </Button>

                  {el.share_token && (
                    <button
                      type="button"
                      onClick={() => copyShareLink(el)}
                      title="Copy share link"
                      className="p-1.5 rounded text-gray-400 hover:text-[#84050C] hover:bg-[#FEE2E2] transition-colors relative"
                    >
                      {copiedId === el.id ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      )}
                    </button>
                  )}

                  {el.status === 'draft' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onConfirmStatus(el, 'active')}
                    >
                      Start
                    </Button>
                  )}

                  {el.status === 'active' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onConfirmStatus(el, 'ended')}
                    >
                      End
                    </Button>
                  )}

                  {canDelete(el) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === el.id}
                      onClick={() => onConfirmDelete(el)}
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
  )
}
