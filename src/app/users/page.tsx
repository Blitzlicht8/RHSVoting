'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import Spinner from '@/components/ui/Spinner'
import { Search } from 'lucide-react'

interface Member {
  id: number
  name: string
  email: string
  role: string
  avatar_url: string | null
  bio: string | null
  id_verified: number
}

function roleBadgeCls(role: string): string {
  if (['master_admin', 'admin'].includes(role)) return 'bg-[#84050C] text-white'
  if (role === 'moderator') return 'bg-purple-100 text-purple-700'
  if (role === 'staff') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function MembersPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/users?page=1&limit=100', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { setMembers(j.data?.users ?? j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase())
      )
    : members

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Members</h1>
            <p className="text-sm text-gray-500 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Spinner size="xl" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {query ? 'No members match your search.' : 'No members yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => (
              <Link
                key={m.id}
                href={`/users/${m.id}`}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-gray-300 transition-all flex items-start gap-3 group"
              >
                <div className="relative w-11 h-11 rounded-full bg-[#84050C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{getInitials(m.name)}</span>
                  {m.avatar_url && (
                    <Image
                      src={m.avatar_url}
                      alt={m.name}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-[#84050C] transition-colors">{m.name}</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${roleBadgeCls(m.role)}`}>
                    {m.role.replace(/_/g, ' ')}
                  </span>
                  {m.bio && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{m.bio}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
