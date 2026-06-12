'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import { Skeleton } from '@/components/ui/Skeleton'

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
}

interface StatCard {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  href?: string
}

function StatCardItem({ card }: { card: StatCard }) {
  const inner = (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow duration-200 ${card.href ? 'cursor-pointer' : ''}`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${card.color}`}>
        {card.icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{card.value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
      </div>
    </div>
  )
  if (card.href) return <Link href={card.href}>{inner}</Link>
  return inner
}

function StatusBadge({ status }: { status: Election['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Active
      </span>
    )
  if (status === 'ended')
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        Ended
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Draft
    </span>
  )
}

function ElectionCard({ election, isAdmin }: { election: Election; isAdmin: boolean }) {
  const { user } = useAuth()
  const idVerified = !!user?.id_verified

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <Link href={`/elections/${election.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 truncate text-base">{election.title}</h3>
          <StatusBadge status={election.status} />
        </div>
        {election.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{election.description}</p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {new Date(election.start_date).toLocaleDateString()} – {new Date(election.end_date).toLocaleDateString()}
        </div>
        <p className="text-xs text-gray-400">
          {election.position_count} position{election.position_count !== 1 ? 's' : ''} · {election.candidate_count} candidate{election.candidate_count !== 1 ? 's' : ''}
        </p>
      </Link>
      <div className="px-5 pb-4">
        {election.status === 'active' && !election.hasVoted && idVerified && (
          <Link
            href={`/elections/${election.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-white bg-[#84050C] hover:bg-[#6B0409] px-4 py-1.5 rounded-lg transition-colors"
          >
            Vote Now →
          </Link>
        )}
        {election.status === 'active' && !election.hasVoted && !idVerified && (
          <Link
            href="/verify-id"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-1.5 rounded-lg transition-colors"
          >
            Verify to Vote →
          </Link>
        )}
        {election.status === 'active' && election.hasVoted && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-4 py-1.5 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Voted
          </span>
        )}
        {election.status === 'ended' && (
          <Link
            href={`/elections/${election.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#84050C] hover:text-[#6B0409] px-4 py-1.5 rounded-lg border border-[#84050C]/30 hover:border-[#84050C]/60 transition-colors"
          >
            View Results
          </Link>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [elections, setElections] = useState<Election[]>([])
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [pendingVerifications, setPendingVerifications] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const adminRoles = ['master_admin', 'teacher_admin', 'student_admin']
  const isAdmin = user ? adminRoles.includes(user.role) : false

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      try {
        const electionsRes = await fetch('/api/elections')
        const electionsJson = await electionsRes.json()
        const rawElections: Election[] = electionsJson.data?.elections ?? []

        // hasVoted is returned directly from the elections API (no N+1 per-election fetch)
        setElections(rawElections.map((e) => ({ ...e, hasVoted: !!e.hasVoted })))

        if (isAdmin) {
          const [usersRes, verificationsRes] = await Promise.all([
            fetch('/api/users?limit=1'),
            fetch('/api/verifications?status=pending&limit=1'),
          ])
          const usersJson = await usersRes.json()
          const verificationsJson = await verificationsRes.json()
          setTotalUsers(usersJson.data?.total ?? 0)
          setPendingVerifications(verificationsJson.data?.total ?? 0)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user, isAdmin])

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  const activeElections = elections.filter((e) => e.status === 'active')
  const endedElections = elections.filter((e) => e.status === 'ended')

  const statCards: StatCard[] = [
    {
      label: 'Active Elections',
      value: activeElections.length,
      color: 'bg-green-100 text-green-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: '/elections',
    },
    {
      label: 'Ended Elections',
      value: endedElections.length,
      color: 'bg-slate-100 text-slate-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      href: '/elections',
    },
  ]

  if (isAdmin) {
    statCards.push(
      {
        label: 'Total Users',
        value: totalUsers,
        color: 'bg-[#FEE2E2] text-[#6B0409]',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        href: '/admin/users',
      },
      {
        label: 'Pending Verifications',
        value: pendingVerifications,
        color: pendingVerifications > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        href: '/admin/verifications',
      }
    )
  }

  const quickActions = [
    { label: 'Manage Users', href: '/admin/users', icon: '👥' },
    { label: 'Elections', href: '/admin/elections', icon: '🗳️' },
    { label: 'Verifications', href: '/admin/verifications', icon: '📋' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ]

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Pending Verifications Alert */}
        {isAdmin && pendingVerifications > 0 && (
          <Link href="/admin/verifications">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4 hover:bg-amber-100 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800">
                  {pendingVerifications} pending ID verification{pendingVerifications !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-amber-600">Click to review and approve student IDs</p>
              </div>
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* Stat Cards */}
        <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
          {statCards.map((card) => (
            <StatCardItem key={card.label} card={card} />
          ))}
        </div>

        {/* Active Elections */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Elections</h2>
            <Link href="/elections" className="text-sm text-[#84050C] hover:text-[#6B0409] font-medium">
              View all →
            </Link>
          </div>

          {activeElections.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No active elections at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeElections.map((election) => (
                <ElectionCard key={election.id} election={election} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions (admin only) */}
        {isAdmin && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center gap-2 text-center hover:border-[#84050C]/50 hover:shadow-md transition-all group"
                >
                  <span className="text-3xl">{action.icon}</span>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-[#84050C] transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
