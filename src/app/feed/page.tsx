'use client'
import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import PostEditor, { Block, emptyBlock } from '@/components/PostEditor'
import { uploadPostMedia } from '@/lib/uploadMedia'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'

interface Election { id: number; title: string; eligible?: number }

function hasContent(blocks: Block[]) {
  return blocks.some(b => b.content.trim().length > 0)
}

function ComposerCard({
  user,
  onPost,
}: {
  user: { id: number; name: string; avatar_url?: string | null } | null
  onPost: (blocks: Block[], isPublic: boolean, electionId: number | null) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [blocks, setBlocks] = useState<Block[]>([emptyBlock()])
  const [audience, setAudience] = useState<'public' | 'election'>('public')
  const [elections, setElections] = useState<Election[]>([])
  const [electionId, setElectionId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (audience === 'election' && elections.length === 0) {
      fetch('/api/elections', { credentials: 'include' })
        .then(r => r.json())
        .then(j => {
          // Only elections the user is eligible for / a candidate in can receive posts.
          const list: Election[] = (j.data?.elections ?? []).filter((e: Election) => e.eligible)
          setElections(list)
          if (list.length > 0) setElectionId(list[0].id)
        })
        .catch(() => {})
    }
  }, [audience, elections.length])

  const initials = user
    ? user.name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  // Shared media handler for the bottom Photo/Video buttons: insert a preview
  // block, upload to Blob, then swap in the real URL (never persist blob:).
  const addMedia = async (file: File, type: 'image' | 'video') => {
    const id = Math.random().toString(36).slice(2)
    setBlocks(bs => [...bs, { id, type, content: URL.createObjectURL(file) }])
    const url = await uploadPostMedia(file)
    setBlocks(bs => url
      ? bs.map(b => b.id === id ? { ...b, content: url } : b)
      : bs.filter(b => b.id !== id))
  }

  const handleSubmit = async () => {
    if (!hasContent(blocks)) return
    // Guard: never persist a local object URL — wait for uploads to resolve.
    if (blocks.some(b => b.content.startsWith('blob:'))) return
    if (audience === 'election' && !electionId) return
    setSubmitting(true)
    await onPost(blocks, audience === 'public', audience === 'election' ? electionId : null)
    setBlocks([emptyBlock()])
    setAudience('public')
    setOpen(false)
    setSubmitting(false)
  }

  if (!open) {
    return (
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-gray-300 transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{initials}</span>
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                className="absolute inset-0 w-full h-full object-cover"
                alt=""
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-400 hover:bg-gray-200 transition-colors">
            What&apos;s on your mind, {user?.name.split(' ')[0] ?? 'there'}?
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Create Post</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>

      <div className="p-5">
        {/* Audience toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAudience('public')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${audience === 'public' ? 'bg-[#84050C] text-white border-[#84050C]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            Public
          </button>
          <button
            onClick={() => setAudience('election')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${audience === 'election' ? 'bg-[#84050C] text-white border-[#84050C]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            For Election
          </button>
        </div>

        {/* Election picker */}
        {audience === 'election' && (
          <select
            value={electionId ?? ''}
            onChange={e => setElectionId(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C] bg-white"
          >
            <option value="">— Select election —</option>
            {elections.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        )}

        {/* Block editor */}
        <PostEditor value={blocks} onChange={setBlocks} />

        {/* Attachment shortcuts */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 font-medium mr-1">Add:</span>
          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Photo
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) addMedia(f, 'image')
              e.target.value = ''
            }} />
          </label>
          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Video
            <input type="file" accept="video/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) addMedia(f, 'video')
              e.target.value = ''
            }} />
          </label>
          <button
            onClick={() => {
              const url = prompt('Paste video URL (YouTube, TikTok, Drive, .mp4…):')
              if (url?.trim()) setBlocks(bs => [...bs, { id: Math.random().toString(36).slice(2), type: 'embed', content: url.trim() }])
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            Embed
          </button>
        </div>
      </div>

      <div className="px-5 pb-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || !hasContent(blocks) || blocks.some(b => b.content.startsWith('blob:')) || (audience === 'election' && !electionId)}
          className="px-5 py-2 bg-[#84050C] text-white text-sm font-semibold rounded-lg hover:bg-[#6B0409] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

export default function FeedPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadPosts = useCallback(() => {
    fetch('/api/posts?page=1', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { setPosts(j.data?.posts ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  const handlePost = async (blocks: Block[], isPublic: boolean, electionId: number | null) => {
    const res = await fetch('/api/posts', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: JSON.stringify(blocks), is_public: isPublic, election_id: electionId }),
    })
    const json = await res.json()
    if (res.ok) {
      loadPosts()
    } else {
      addToast(json.error || 'Failed to post', 'error')
    }
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Feed</h1>

        <div className="md:grid md:grid-cols-[1fr_300px] gap-6 items-start">
          {/* Left: posts */}
          <div className="min-w-0">
            {/* Composer on mobile */}
            <div className="md:hidden mb-4">
              {user?.id_verified ? (
                <ComposerCard user={user} onPost={handlePost} />
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-700">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Verify your identity to post and interact.{' '}
                    <Link href="/verify-id" className="underline font-medium">Upload ID →</Link>
                  </span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">No posts yet. Be the first!</div>
            ) : (
              posts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={user?.id ?? 0}
                  currentUserRole={user?.role}
                  currentUserIdVerified={!!user?.id_verified}
                  onDelete={id => setPosts(ps => ps.filter(x => x.id !== id))}
                />
              ))
            )}
          </div>

          {/* Right sidebar: composer (desktop) */}
          <div className="hidden md:block sticky top-6">
            {user?.id_verified ? (
              <ComposerCard user={user} onPost={handlePost} />
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-700">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Verify your identity to post.{' '}
                  <Link href="/verify-id" className="underline font-medium">Upload ID →</Link>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
