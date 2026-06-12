'use client'
import { useState } from 'react'

interface Post {
  id: number
  author_id: number
  author_name: string
  author_avatar: string | null
  content: string
  created_at: string
  reaction_count: number
  comment_count: number
  user_reacted: number | null
  is_public: number
  election_id: number | null
}

interface Comment {
  id: number
  author_name: string
  author_avatar: string | null
  content: string
  created_at: string
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function renderContent(raw: string) {
  let blocks: Array<{ type: string; content: string }> = []
  try { blocks = JSON.parse(raw) } catch { blocks = [{ type: 'text', content: raw }] }
  return blocks.map((b, i) => {
    if (b.type === 'image') return <img key={i} src={b.content} alt="" className="max-w-full rounded-lg my-2" />
    if (b.type === 'video') return <video key={i} src={b.content} controls className="max-w-full rounded-lg my-2" />
    if (b.type === 'embed') {
      const yt = b.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
      if (yt) return <iframe key={i} className="w-full aspect-video rounded-lg my-2" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen />
      return <iframe key={i} className="w-full aspect-video rounded-lg my-2" src={b.content} allowFullScreen sandbox="allow-scripts allow-same-origin" />
    }
    return <p key={i} className="text-gray-800 text-sm whitespace-pre-wrap">{b.content}</p>
  })
}

export default function PostCard({ post, currentUserId, onDelete }: {
  post: Post
  currentUserId: number
  onDelete?: (id: number) => void
}) {
  const [reacted, setReacted] = useState(!!post.user_reacted)
  const [reactionCount, setReactionCount] = useState(Number(post.reaction_count))
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')

  const toggleReact = async () => {
    const method = reacted ? 'DELETE' : 'POST'
    setReacted(!reacted)
    setReactionCount(c => reacted ? c - 1 : c + 1)
    await fetch(`/api/posts/${post.id}/react`, { method, credentials: 'include' })
  }

  const loadComments = async () => {
    if (!showComments && comments.length === 0) {
      const res = await fetch(`/api/posts/${post.id}/comments`, { credentials: 'include' })
      const json = await res.json()
      setComments(json.data ?? [])
    }
    setShowComments(v => !v)
  }

  const submitComment = async () => {
    if (!commentText.trim()) return
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText.trim() }),
    })
    const json = await res.json()
    if (res.ok) { setComments(c => [...c, json.data]); setCommentText('') }
  }

  const submitReport = async () => {
    await fetch(`/api/posts/${post.id}/report`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reportReason }),
    })
    setShowReport(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/posts/${post.id}`, { method: 'DELETE', credentials: 'include' })
    onDelete?.(post.id)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden">
            {post.author_avatar
              ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
              : initials(post.author_name)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{post.author_name}</div>
            <div className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(v => !v)} className="p-1 text-gray-400 hover:text-gray-600 text-lg leading-none">⋯</button>
          {showMenu && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
              {post.author_id === currentUserId && (
                <button onClick={() => { setShowMenu(false); handleDelete() }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
              )}
              <button onClick={() => { setShowMenu(false); setShowReport(true) }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Report</button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">{renderContent(post.content)}</div>

      <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
        <button onClick={toggleReact} className={`flex items-center gap-1.5 text-sm transition-colors ${reacted ? 'text-[#84050C]' : 'text-gray-400 hover:text-[#84050C]'}`}>
          <span>{reacted ? '❤️' : '🤍'}</span> {reactionCount}
        </button>
        <button onClick={loadComments} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
          💬 {post.comment_count}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {initials(c.author_name)}
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1">
                <div className="text-xs font-semibold text-gray-700">{c.author_name}</div>
                <div className="text-sm text-gray-600">{c.content}</div>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              placeholder="Write a comment…" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#84050C]" />
            <button onClick={submitComment} className="px-3 py-1.5 bg-[#84050C] text-white text-sm rounded-lg hover:bg-[#6B0409]">Post</button>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-3">Report Post</h3>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3}
              placeholder="Reason (optional)" className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-[#84050C]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={submitReport} className="px-4 py-2 text-sm bg-[#84050C] text-white rounded-lg hover:bg-[#6B0409]">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
