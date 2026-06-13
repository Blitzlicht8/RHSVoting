'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Spinner from '@/components/ui/Spinner'
import PostCard from '@/components/PostCard'
import { useAuth } from '@/components/providers/AuthProvider'

interface Candidate {
  id: number
  name: string
  bio: string | null
  photo_url: string | null
  position_name: string
  election_name: string
  user_id: number | null
}

interface Achievement {
  id: number
  title: string
  description: string | null
  year: number | null
}

function getInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function CandidateProfilePage() {
  const { id: electionId, candidateId } = useParams<{ id: string; candidateId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/elections/${electionId}/candidates/${candidateId}`, { credentials: 'include' })
      if (!res.ok) { router.replace(`/elections/${electionId}`); return }
      const json = await res.json()
      const c = json.data
      setCandidate(c)

      if (c.user_id) {
        const [achRes, postRes] = await Promise.all([
          fetch(`/api/users/${c.user_id}/achievements`),
          fetch(`/api/posts?userId=${c.user_id}&electionId=${electionId}`, { credentials: 'include' }),
        ])
        const achJson = await achRes.json()
        const postJson = await postRes.json()
        setAchievements(achJson.data ?? [])
        setPosts(postJson.data?.posts ?? [])
      }
      setLoading(false)
    }
    load()
  }, [electionId, candidateId, router])

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (!candidate) return null

  const sortedAchievements = [...achievements].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5 pb-10">

        {/* Back link */}
        <Link
          href={`/elections/${electionId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {candidate.election_name}
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            {candidate.photo_url ? (
              <img
                src={candidate.photo_url}
                alt={candidate.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#84050C] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg">
                {getInitials(candidate.name)}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Position badge */}
                <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                  {candidate.position_name}
                </span>

                {/* Independent badge */}
                {candidate.user_id === null && (
                  <span className="text-xs bg-amber-100 text-amber-700 font-medium px-3 py-1 rounded-full">
                    Independent Candidate
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-2">{candidate.election_name}</p>
            </div>
          </div>
        </div>

        {/* About */}
        {candidate.bio && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">About</h2>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{candidate.bio}</p>
          </div>
        )}

        {/* Achievements */}
        {sortedAchievements.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Achievements</h2>
            <ol className="space-y-3">
              {sortedAchievements.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="text-sm font-bold text-[#84050C] w-12 flex-shrink-0">
                    {a.year ?? '—'}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                    {a.description && (
                      <div className="text-xs text-gray-500">{a.description}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Campaign Posts — only shown if candidate has an account */}
        {candidate.user_id !== null && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Campaign Posts</h2>
            {posts.length === 0 ? (
              <p className="text-sm text-gray-400">No campaign posts yet.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} currentUserId={user?.id ?? 0} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  )
}
