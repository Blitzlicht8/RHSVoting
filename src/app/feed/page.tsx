'use client'
import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Skeleton } from '@/components/ui/Skeleton'

export default function FeedPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/posts?page=1', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { setPosts(j.data?.posts ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handlePost = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    const body = JSON.stringify([{ type: 'text', content: content.trim() }])
    const res = await fetch('/api/posts', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: body, is_public: isPublic }),
    })
    const json = await res.json()
    if (res.ok) {
      setContent('')
      fetch('/api/posts?page=1', { credentials: 'include' })
        .then(r => r.json()).then(j => setPosts(j.data?.posts ?? []))
    } else {
      addToast(json.error || 'Failed to post', 'error')
    }
    setSubmitting(false)
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Feed</h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="Share something with the community…"
            className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#84050C] resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-[#84050C]" />
              Public post
            </label>
            <button
              onClick={handlePost}
              disabled={submitting || !content.trim()}
              className="px-4 py-2 bg-[#84050C] text-white text-sm font-medium rounded-lg hover:bg-[#6B0409] disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No posts yet. Be the first!</div>
        ) : (
          posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              currentUserId={user?.id ?? 0}
              onDelete={id => setPosts(ps => ps.filter(x => x.id !== id))}
            />
          ))
        )}
      </div>
    </Layout>
  )
}
