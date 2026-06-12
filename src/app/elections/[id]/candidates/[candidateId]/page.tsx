'use client'
import { useEffect, useState } from 'react'
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

  if (loading) return <Layout><div className="flex justify-center items-center h-64"><Spinner /></div></Layout>
  if (!candidate) return null

  function getInitials(name: string) {
    const p = name.trim().split(/\s+/)
    return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Back button */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Election
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-5">
            {candidate.photo_url ? (
              <img src={candidate.photo_url} alt={candidate.name} className="w-20 h-20 rounded-full object-cover border-2 border-[#84050C]" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#84050C] flex items-center justify-center text-white text-2xl font-bold">
                {getInitials(candidate.name)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>
              <div className="text-sm text-[#84050C] font-medium mt-1">{candidate.position_name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{candidate.election_name}</div>
            </div>
          </div>
        </div>

        {/* About / Bio */}
        {candidate.bio && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{candidate.bio}</p>
          </div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Achievements</h2>
            <ul className="space-y-3">
              {achievements.map(a => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#84050C] mt-2 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-800">
                      {a.title}
                      {a.year && <span className="text-xs text-gray-400 ml-2">{a.year}</span>}
                    </div>
                    {a.description && <div className="text-sm text-gray-600">{a.description}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Campaign Posts */}
        {posts.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Posts</h2>
            {posts.map(p => (
              <PostCard key={p.id} post={p} currentUserId={user?.id ?? 0} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
