'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { useAuth } from '@/components/providers/AuthProvider'
import { Calendar, Award } from 'lucide-react'

interface ProfileUser { id:number; name:string; role:string; avatar_url:string|null; bio:string|null; created_at:string }
interface Achievement { id:number; title:string; description:string|null; year:number|null }

export default function UserProfilePage() {
  const { id } = useParams()
  const { user: authUser } = useAuth()
  const [profile, setProfile] = useState<ProfileUser|null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${id}`, { credentials: 'include' }).then(r=>r.json()),
      fetch(`/api/users/${id}/achievements`, { credentials: 'include' }).then(r=>r.json()).catch(()=>({data:[]})),
      fetch(`/api/posts?author_id=${id}&page=1`, { credentials: 'include' }).then(r=>r.json()).catch(()=>({data:[]})),
    ]).then(([u,a,p]) => {
      setProfile(u.data?.user ?? u.data ?? null)
      setAchievements(a.data ?? [])
      setPosts(p.data?.posts ?? p.data ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-gray-400">Loading...</div></Layout>
  if (!profile) return <Layout><div className="flex items-center justify-center h-64 text-gray-500">Member not found.</div></Layout>

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="relative w-16 h-16 rounded-full bg-[#84050C] flex items-center justify-center text-white text-2xl font-bold ring-2 ring-[#FEE2E2] overflow-hidden flex-shrink-0">
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{profile.name?.charAt(0)?.toUpperCase()}</span>
              {profile.avatar_url && (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
              <span className="inline-block px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#84050C] text-xs font-medium capitalize mt-1">
                {profile.role.replace(/_/g,' ')}
              </span>
              {profile.bio && <p className="text-sm text-gray-600 mt-2">{profile.bio}</p>}
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                <Calendar size={12} />
                <span>Joined {new Date(profile.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
              </div>
            </div>
          </div>
        </div>

        {achievements.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <Award size={14} className="text-[#D69A23]" /> Achievements
            </h2>
            <div className="space-y-2">
              {achievements.map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <span className="text-[#D69A23] mt-0.5 shrink-0">&#10022;</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.title}{a.year && <span className="text-gray-400 font-normal"> &middot; {a.year}</span>}</p>
                    {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {posts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 px-1">Recent Posts</h2>
            <div className="space-y-4">
              {posts.slice(0,5).map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={authUser?.id ?? 0}
                  currentUserRole={authUser?.role}
                  currentUserIdVerified={!!authUser?.id_verified}
                  onDelete={pid => setPosts(ps => ps.filter(x => x.id !== pid))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}