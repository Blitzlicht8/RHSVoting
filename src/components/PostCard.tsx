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
  election_title?: string | null
}

interface Comment {
  id: number
  author_id: number
  author_name: string
  author_avatar: string | null
  content: string
  created_at: string
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function relTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function renderContent(raw: string) {
  let blocks: Array<{ type: string; content: string; subtype?: string }> = []
  try { blocks = JSON.parse(raw) } catch { blocks = [{ type: 'text', content: raw }] }
  return blocks.map((b, i) => {
    if (b.type === 'image') return <img key={i} src={b.content} alt="" className="max-w-full rounded-xl my-2 max-h-96 object-contain" />
    if (b.type === 'video') return <video key={i} src={b.content} controls className="w-full rounded-xl my-2 max-h-80" />
    if (b.type === 'embed') {
      const yt = b.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
      const tk = b.content.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
      const gd = b.content.match(/drive\.google\.com\/file\/d\/([^/]+)/)
      if (yt) return <iframe key={i} className="w-full aspect-video rounded-xl my-2" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen />
      if (tk) return <iframe key={i} className="w-full aspect-video rounded-xl my-2" src={`https://www.tiktok.com/embed/${tk[1]}`} allowFullScreen />
      if (gd) return <iframe key={i} className="w-full aspect-video rounded-xl my-2" src={`https://drive.google.com/file/d/${gd[1]}/preview`} allowFullScreen />
      if (/\.(mp4|webm|mov)(\?|$)/i.test(b.content)) return <video key={i} src={b.content} controls className="w-full rounded-xl my-2 max-h-80" />
      if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(b.content)) return <img key={i} src={b.content} alt="" className="max-w-full rounded-xl my-2 max-h-96 object-contain" />
      return <a key={i} href={b.content} target="_blank" rel="noopener noreferrer" className="text-[#84050C] underline text-sm break-all">{b.content}</a>
    }
    const Tag = b.subtype === 'heading' ? 'h2' as const : b.subtype === 'subheading' ? 'h3' as const : 'p' as const
    const cls = b.subtype === 'heading'
      ? 'text-gray-900 font-bold text-lg whitespace-pre-wrap my-1'
      : b.subtype === 'subheading'
        ? 'text-gray-800 font-semibold text-base whitespace-pre-wrap my-0.5'
        : 'text-gray-800 text-sm whitespace-pre-wrap'
    return <Tag key={i} className={cls}>{b.content}</Tag>
  })
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" fill={filled ? '#84050C' : 'none'} stroke={filled ? '#84050C' : 'currentColor'} strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  )
}

export default function PostCard({ post, currentUserId, currentUserRole, onDelete }: {
  post: Post
  currentUserId: number
  currentUserRole?: string
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
  const [copied, setCopied] = useState(false)
  const [reportingCommentId, setReportingCommentId] = useState<number | null>(null)
  const [commentReportReason, setCommentReportReason] = useState('')

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

  const deleteComment = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return
    const res = await fetch(`/api/posts/${post.id}/comments?commentId=${commentId}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) setComments(cs => cs.filter(c => c.id !== commentId))
  }

  const submitCommentReport = async () => {
    if (!reportingCommentId) return
    await fetch(`/api/posts/${post.id}/comments/${reportingCommentId}/report`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: commentReportReason }),
    })
    setReportingCommentId(null)
    setCommentReportReason('')
  }

  const isAdmin = ['master_admin', 'teacher_admin', 'student_admin'].includes(currentUserRole ?? '')

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/posts/${post.id}`, { method: 'DELETE', credentials: 'include' })
    onDelete?.(post.id)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/feed#post-${post.id}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div id={`post-${post.id}`} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
            {post.author_avatar
              ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
              : initials(post.author_name)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm leading-tight">{post.author_name}</div>
            <div className="text-xs text-gray-400">{relTime(post.created_at)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.election_title && (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-200">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {post.election_title}
            </span>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[130px]">
                {post.author_id === currentUserId && (
                  <button onClick={() => { setShowMenu(false); handleDelete() }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete post</button>
                )}
                <button onClick={() => { setShowMenu(false); setShowReport(true) }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4 space-y-0.5">{renderContent(post.content)}</div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-3 border-t border-gray-100">
        <button
          onClick={toggleReact}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${reacted ? 'text-[#84050C] bg-[#FEE2E2]' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <HeartIcon filled={reacted} />
          <span>{reactionCount}</span>
        </button>
        <button onClick={loadComments} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100">
          <CommentIcon />
          <span>{post.comment_count}</span>
        </button>
        <button onClick={handleShare} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-100'}`}>
          <ShareIcon />
          <span>{copied ? 'Copied!' : 'Share'}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {comments.map(c => {
            const canDelete = isAdmin || c.author_id === currentUserId || post.author_id === currentUserId
            const canReport = c.author_id !== currentUserId
            return (
              <div key={c.id} className="flex gap-2.5 group/comment">
                <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden text-white">
                  {c.author_avatar
                    ? <img src={c.author_avatar} className="w-full h-full object-cover" alt="" />
                    : initials(c.author_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <div className="text-xs font-semibold text-gray-700 mb-0.5">{c.author_name}</div>
                    <div className="text-sm text-gray-600 break-words">{c.content}</div>
                  </div>
                  <div className="flex gap-2 mt-0.5 ml-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                    {canDelete && (
                      <button onClick={() => deleteComment(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    )}
                    {canReport && (
                      <button onClick={() => { setReportingCommentId(c.id); setCommentReportReason('') }} className="text-xs text-gray-400 hover:text-gray-600">Report</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div className="flex gap-2 mt-2">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              placeholder="Write a comment…"
              className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]" />
            <button onClick={submitComment} className="px-4 py-2 bg-[#84050C] text-white text-sm rounded-full hover:bg-[#6B0409] font-medium">Send</button>
          </div>
        </div>
      )}

      {/* Report post modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-3">Report Post</h3>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3}
              placeholder="Reason (optional)" className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-[#84050C]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={submitReport} className="px-4 py-2 text-sm bg-[#84050C] text-white rounded-lg hover:bg-[#6B0409]">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Report comment modal */}
      {reportingCommentId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-3">Report Comment</h3>
            <textarea value={commentReportReason} onChange={e => setCommentReportReason(e.target.value)} rows={3}
              placeholder="Reason (optional)" className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-[#84050C]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReportingCommentId(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={submitCommentReport} className="px-4 py-2 text-sm bg-[#84050C] text-white rounded-lg hover:bg-[#6B0409]">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
