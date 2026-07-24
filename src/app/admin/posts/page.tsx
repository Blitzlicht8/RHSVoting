'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import AdminLayout from '@/components/AdminLayout'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/providers/ToastProvider'

interface ModPost {
  id: number
  content: string
  status: string
  created_at: string
  author_name: string
  author_avatar: string | null
  election_title: string | null
}

// Post content is stored as a JSON block array; render a plain-text preview and
// note any media block so a moderator can read what they're approving.
function excerpt(raw: string): string {
  try {
    const blocks = JSON.parse(raw) as Array<{ type: string; content: string }>
    if (!Array.isArray(blocks)) return raw
    const text = blocks.filter(b => b.type === 'text').map(b => b.content).join(' ').trim()
    const media = blocks.filter(b => b.type === 'image' || b.type === 'video' || b.type === 'embed')
    const mediaTag = media.length ? ` [${media.map(m => m.type).join(', ')}]` : ''
    return (text + mediaTag).trim() || '(no text)'
  } catch {
    return raw
  }
}

type Tab = 'pending' | 'approved' | 'rejected'

export default function AdminPostsPage() {
  const { addToast } = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [posts, setPosts] = useState<ModPost[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/posts?status=${tab}&page=1`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) setPosts(json.data?.posts ?? [])
      else addToast(json.error || 'Failed to load posts', 'error')
    } catch { addToast('Network error', 'error') }
    finally { setLoading(false) }
  }, [tab, addToast])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const moderate = async (id: number, status: 'approved' | 'rejected') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setPosts(ps => ps.filter(p => p.id !== id))
        addToast(status === 'approved' ? 'Post approved' : 'Post rejected', 'success')
      } else {
        const json = await res.json().catch(() => ({}))
        addToast(json.error || 'Failed', 'error')
      }
    } catch { addToast('Network error', 'error') }
    finally { setBusyId(null) }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Post Approvals</h1>
        <p className="text-sm text-gray-500 mb-6">Review member posts. Pending posts stay hidden from the feed until approved.</p>

        <div className="flex gap-2 mb-4">
          {(['pending', 'approved', 'rejected'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={[
                'px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors',
                tab === t ? 'bg-[#84050C] text-white' : 'text-gray-600 border border-gray-300 hover:bg-gray-50',
              ].join(' ')}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Spinner /></div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">No {tab} posts.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map(p => (
              <li key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#84050C] text-white text-xs font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.author_avatar
                      ? <Image src={p.author_avatar} alt={p.author_name} width={32} height={32} className="rounded-full object-cover" />
                      : <span>{p.author_name?.charAt(0)?.toUpperCase() || '?'}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.author_name}</p>
                    <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleString()}</p>
                  </div>
                  {p.election_title && <Badge variant="default" size="sm">{p.election_title}</Badge>}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-3">{excerpt(p.content)}</p>
                {tab === 'pending' && (
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => moderate(p.id, 'rejected')} disabled={busyId === p.id}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
                      Reject
                    </button>
                    <button onClick={() => moderate(p.id, 'approved')} disabled={busyId === p.id}
                      className="px-4 py-1.5 text-sm bg-[#84050C] text-white rounded-lg font-medium hover:bg-[#6B0409] disabled:opacity-50">
                      Approve
                    </button>
                  </div>
                )}
                {tab === 'rejected' && (
                  <div className="flex justify-end">
                    <button onClick={() => moderate(p.id, 'approved')} disabled={busyId === p.id}
                      className="px-4 py-1.5 text-sm bg-[#84050C] text-white rounded-lg font-medium hover:bg-[#6B0409] disabled:opacity-50">
                      Approve
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  )
}
