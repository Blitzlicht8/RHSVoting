'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { useAuth } from '@/components/providers/AuthProvider'
import { Skeleton } from '@/components/ui/Skeleton'

interface Achievement {
  id: number
  title: string
  description: string | null
  year: number | null
}

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

interface CandidateProfile {
  id: number
  name: string
  bio: string | null
  photo_url: string | null
  platform: string | null
  qualifications: string | null
  user_id: number | null
  position_id: number
  position_name: string
  election_name: string
  achievements: Achievement[]
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CandidateProfilePage() {
  const { id: electionId, candidateId } = useParams<{ id: string; candidateId: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)

  const isAdmin = user ? ['master_admin', 'admin', 'moderator'].includes(user.role) : false
  const isOwnProfile = !!user && !!candidate?.user_id && user.id === candidate.user_id

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/elections/${electionId}/candidates/${candidateId}`, { credentials: 'include' })
      if (!res.ok) { router.replace(`/elections/${electionId}`); return }
      const json = await res.json()
      setCandidate(json.data ?? null)
      setLoading(false)
    }
    load()
  }, [electionId, candidateId, router])

  useEffect(() => {
    if (!candidate?.user_id) return
    setPostsLoading(true)
    fetch(`/api/posts?userId=${candidate.user_id}&electionId=${electionId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setPosts(json.data?.posts ?? []))
      .catch(() => {})
      .finally(() => setPostsLoading(false))
  }, [candidate?.user_id, electionId])

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    )
  }

  if (!candidate) return null

  const qualificationLines = candidate.qualifications
    ? candidate.qualifications.split('\n').map((l) => l.trim()).filter(Boolean)
    : []

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5 pb-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <Link href="/elections" className="hover:text-gray-700">Elections</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`} className="hover:text-gray-700 max-w-[140px] truncate">
            {candidate.election_name}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium max-w-[140px] truncate">{candidate.name}</span>
        </nav>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-5">
            {candidate.photo_url ? (
              <img
                src={candidate.photo_url}
                alt={candidate.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#84050C] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md">
                {getInitials(candidate.name)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{candidate.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{candidate.position_name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#6B0409]">
                  {candidate.election_name}
                </span>
                {candidate.user_id === null && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    Independent
                  </span>
                )}
              </div>
              {candidate.bio && (
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{candidate.bio}</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link
              href={`/elections/${electionId}`}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#84050C] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {candidate.election_name}
            </Link>
          </div>
        </div>

        {/* Platform & Advocacy */}
        {candidate.platform && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Platform &amp; Advocacy</h2>
            <blockquote className="border-l-4 border-[#84050C] pl-4 text-gray-700 text-sm leading-relaxed whitespace-pre-line">
              {candidate.platform}
            </blockquote>
          </div>
        )}

        {/* Qualifications */}
        {qualificationLines.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Qualifications</h2>
            <ul className="space-y-2">
              {qualificationLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-[#84050C] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Achievements */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Achievements</h2>
          {candidate.achievements.length === 0 ? (
            <p className="text-sm text-gray-400">No achievements listed.</p>
          ) : (
            <div className="space-y-3">
              {candidate.achievements.map((ach) => (
                <div key={ach.id} className="flex items-start gap-3">
                  {ach.year && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#FEE2E2] text-[#6B0409] flex-shrink-0 mt-0.5">
                      {ach.year}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ach.title}</p>
                    {ach.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{ach.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Posts — only shown if candidate has a linked account */}
        {candidate.user_id !== null && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Campaign Posts</h2>
              {(isOwnProfile || isAdmin) && (
                <Link
                  href={`/feed?electionId=${electionId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#84050C] hover:bg-[#6B0409] rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Post
                </Link>
              )}
            </div>

            {postsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-400">
                No campaign posts yet.
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={user?.id ?? 0}
                    currentUserRole={user?.role}
                    currentUserIdVerified={!!user?.id_verified}
                    onDelete={(deletedId) => setPosts((prev) => prev.filter((post) => post.id !== deletedId))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  )
}
