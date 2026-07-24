'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import Spinner from '@/components/ui/Spinner'

interface Election {
  id: number
  title: string
  description: string | null
  status: 'draft' | 'active' | 'ended'
  start_date: string
  end_date: string
  position_count: number
  candidate_count: number
  vote_count: number
  hasVoted?: boolean
  thumbnail_url?: string | null
  share_token?: string | null
  is_global?: number | boolean
  visible_to_all?: number | boolean
  eligible?: number | boolean
  structure_ids?: number[]
}

interface GroupStructure {
  id: number
  name: string
  active: boolean
}

type FilterTab = 'all' | 'active' | 'upcoming' | 'ended'

function StatusBadge({ status }: { status: Election['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Active
      </span>
    )
  if (status === 'ended')
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        Ended
      </span>
    )
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Draft
    </span>
  )
}

function ElectionCard({
  election,
  isAdmin,
  idVerified,
}: {
  election: Election
  isAdmin: boolean
  idVerified: boolean
}) {
  // Non-admins who can see a scoped election only because it's visible_to_all
  // (not because they're eligible) get a read-only view — no voting.
  const canVote = isAdmin || election.eligible === undefined || !!election.eligible
  const isUpcoming =
    election.status === 'draft' ||
    (election.status === 'active' && new Date(election.start_date) > new Date())

  return (
    <Link
      href={`/elections/${election.id}`}
      className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
    >
      {election.thumbnail_url && (
        <img
          src={election.thumbnail_url}
          alt=""
          className="w-full h-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-lg truncate group-hover:text-[#84050C] transition-colors">
            {election.title}
          </h3>
          <StatusBadge status={election.status} />
        </div>

        {election.description ? (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{election.description}</p>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {new Date(election.start_date).toLocaleDateString()} – {new Date(election.end_date).toLocaleDateString()}
        </div>

        <p className="text-xs text-gray-400 mb-4">
          {election.position_count} position{election.position_count !== 1 ? 's' : ''} ·{' '}
          {election.candidate_count} candidate{election.candidate_count !== 1 ? 's' : ''}
        </p>

        {/* Actions footer */}
        <div onClick={(e) => e.preventDefault()}>
          {election.status === 'active' && !canVote && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-100 px-4 py-1.5 rounded-lg select-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View only — not eligible
            </span>
          )}
          {election.status === 'active' && canVote && idVerified && !election.hasVoted && (
            <Link
              href={`/elections/${election.id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-[#84050C] hover:bg-[#6B0409] px-4 py-1.5 rounded-lg transition-colors"
            >
              Vote Now →
            </Link>
          )}
          {election.status === 'active' && canVote && !idVerified && !election.hasVoted && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-400 bg-gray-100 px-4 py-1.5 rounded-lg cursor-not-allowed select-none">
              ID Required
            </span>
          )}
          {election.status === 'active' && election.hasVoted && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 px-4 py-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Voted ✓
            </span>
          )}
          {election.status === 'ended' && (
            <Link
              href={`/elections/${election.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#84050C] hover:text-[#6B0409] border border-[#E2A8A4] hover:border-[#D47F88] px-4 py-1.5 rounded-lg transition-colors"
            >
              View Results
            </Link>
          )}
          {election.status === 'draft' && isAdmin && (
            <div className="flex items-center gap-2">
              <Link
                href={`/elections/${election.id}`}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                Preview
              </Link>
              <Link
                href="/admin/elections"
                className="text-sm text-[#84050C] hover:text-[#6B0409] px-3 py-1.5 rounded-lg border border-[#E2A8A4] hover:border-[#D47F88] transition-colors"
              >
                Edit
              </Link>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, string> = {
    all: 'No elections found.',
    active: 'No active elections right now.',
    upcoming: 'No upcoming elections.',
    ended: 'No ended elections yet.',
  }
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="w-24 h-24 text-gray-200 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="16" y="8" width="64" height="80" rx="8" strokeWidth="3" />
        <path d="M32 32h32M32 48h32M32 64h20" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="text-gray-400 text-base">{messages[filter]}</p>
    </div>
  )
}

export default function ElectionsPage() {
  const { user } = useAuth()
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [structures, setStructures] = useState<GroupStructure[]>([])
  const [groupFilter, setGroupFilter] = useState<number | 'all'>('all')

  const adminRoles = ['master_admin', 'admin', 'moderator']
  const isAdmin = user ? adminRoles.includes(user.role) : false
  const idVerified = !!user?.id_verified

  useEffect(() => {
    if (!user) return
    const fetchElections = async () => {
      try {
        const res = await fetch('/api/elections')
        const json = await res.json()
        const raw: Election[] = json.data?.elections ?? []

        setElections(raw)
      } finally {
        setLoading(false)
      }
    }
    fetchElections()
  }, [user])

  useEffect(() => {
    if (!user) return
    fetch('/api/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const data: GroupStructure[] = Array.isArray(json.data) ? json.data : []
        setStructures(data.filter((s) => s.active))
      })
      .catch(() => setStructures([]))
  }, [user])

  const now = new Date()

  // Only offer group filters actually referenced by at least one visible election.
  const usedStructureIds = new Set<number>()
  for (const e of elections) for (const id of e.structure_ids ?? []) usedStructureIds.add(id)
  const groupOptions = structures.filter((s) => usedStructureIds.has(s.id))

  const filtered = elections.filter((e) => {
    if (activeTab === 'active' && e.status !== 'active') return false
    if (activeTab === 'upcoming' && !(e.status === 'draft' || new Date(e.start_date) > now)) return false
    if (activeTab === 'ended' && e.status !== 'ended') return false
    if (groupFilter !== 'all' && !(e.structure_ids ?? []).includes(groupFilter)) return false
    return true
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'ended', label: 'Ended' },
  ]

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Elections</h1>
            <p className="text-sm text-gray-500 mt-1">Browse and participate in school elections</p>
          </div>
          {isAdmin && (
            <Link
              href="/admin/elections"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#84050C] hover:bg-[#6B0409] px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Election
            </Link>
          )}
        </div>

        {/* Unverified warning */}
        {!idVerified && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-700">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Your identity must be verified to vote.{' '}
              <a href="/verify-id" className="underline font-medium">Upload ID →</a>
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {groupOptions.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#84050C]"
            >
              <option value="all">All groups</option>
              {groupOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.length === 0 ? (
              <EmptyState filter={activeTab} />
            ) : (
              filtered.map((election) => (
                <ElectionCard
                  key={election.id}
                  election={election}
                  isAdmin={isAdmin}
                  idVerified={idVerified}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
