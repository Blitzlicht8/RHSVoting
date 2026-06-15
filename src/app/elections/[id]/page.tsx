'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import Spinner from '@/components/ui/Spinner'

interface Candidate {
  id: number
  name: string
  bio: string | null
  photo_url: string | null
  position_id: number
  election_id: number
  vote_count?: number
  percentage?: number
}

interface Position {
  id: number
  name: string
  order_index: number
  max_votes: number
  candidates: Candidate[]
}

interface Election {
  id: number
  title: string
  description: string | null
  status: 'draft' | 'active' | 'ended'
  start_date: string
  end_date: string
  positions: Position[]
  hasVoted: boolean
  thumbnail_url?: string | null
  share_token?: string | null
  auto_start?: number | boolean
  auto_end?: number | boolean
}

interface UserVote {
  position_id: number
  candidate_id: number
}

function StatusBadge({ status }: { status: Election['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Active
      </span>
    )
  if (status === 'ended')
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
        Ended
      </span>
    )
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
      Draft
    </span>
  )
}

/* ─── Confirmation Modal ─────────────────────────────────────── */
function ConfirmModal({
  positions,
  selectedVotes,
  onConfirm,
  onCancel,
  submitting,
}: {
  positions: Position[]
  selectedVotes: Record<number, number[]>
  onConfirm: () => void
  onCancel: () => void
  submitting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Confirm Your Vote</h2>
          <p className="text-sm text-gray-500 mt-1">Please review your selections before submitting. This action cannot be undone.</p>
        </div>
        <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
          {positions.map((pos) => {
            const candidateIds = selectedVotes[pos.id] ?? []
            const candidateNames = candidateIds.map((id) => pos.candidates.find((c) => c.id === id)?.name ?? '?')
            return (
              <div key={pos.id} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0 gap-4">
                <span className="text-sm text-gray-500 flex-shrink-0">{pos.name}</span>
                <div className="text-right">
                  {candidateNames.length > 0 ? candidateNames.map((name, i) => (
                    <p key={i} className="text-sm font-semibold text-gray-900">{name}</p>
                  )) : <p className="text-sm text-gray-400">—</p>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="p-4 bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#84050C] hover:bg-[#6B0409] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Spinner size="sm" /> : null}
            Confirm Vote
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Voting View ────────────────────────────────────────────── */
function VotingView({
  election,
  onVoteSuccess,
}: {
  election: Election
  onVoteSuccess: () => void
}) {
  const toast = useToast()
  // Record<position_id, candidate_id[]> — multi-vote positions hold multiple IDs
  const [selectedVotes, setSelectedVotes] = useState<Record<number, number[]>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const positions = election.positions
  const totalPositions = positions.length
  const selectedCount = positions.filter((p) => (selectedVotes[p.id] ?? []).length > 0).length
  const allSelected = positions.every((p) => (selectedVotes[p.id] ?? []).length > 0)

  function toggleCandidate(positionId: number, candidateId: number, maxVotes: number) {
    setSelectedVotes((prev) => {
      const current = prev[positionId] ?? []
      if (current.includes(candidateId)) {
        return { ...prev, [positionId]: current.filter((id) => id !== candidateId) }
      }
      if (maxVotes === 1) {
        return { ...prev, [positionId]: [candidateId] }
      }
      if (current.length >= maxVotes) return prev
      return { ...prev, [positionId]: [...current, candidateId] }
    })
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const votes = positions.flatMap((pos) =>
        (selectedVotes[pos.id] ?? []).map((candidateId) => ({
          position_id: pos.id,
          candidate_id: candidateId,
        }))
      )
      const res = await fetch(`/api/elections/${election.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes }),
      })
      const json = await res.json()
      if (res.ok) {
        toast?.addToast(json.message ?? 'Your votes have been submitted!', 'success')
        setShowConfirm(false)
        onVoteSuccess()
      } else {
        toast?.addToast(json.error ?? 'Failed to submit votes.', 'error')
        setShowConfirm(false)
      }
    } catch {
      toast?.addToast('Something went wrong. Please try again.', 'error')
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="space-y-6 pb-28">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#84050C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">
            Cast Your Vote — {totalPositions} position{totalPositions !== 1 ? 's' : ''}
          </h2>
        </div>

        {positions.map((position) => {
          const isMultiVote = position.max_votes > 1
          const selectedForPos = selectedVotes[position.id] ?? []
          const atMax = isMultiVote && selectedForPos.length >= position.max_votes

          return (
            <div key={position.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">{position.name}</h3>
                {isMultiVote ? (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Select up to {position.max_votes} candidates
                    <span className="ml-1.5 font-medium text-gray-500">
                      {selectedForPos.length}/{position.max_votes} selected
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Select one candidate</p>
                )}
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {position.candidates.map((candidate) => {
                  const isSelected = selectedForPos.includes(candidate.id)
                  const isDisabled = isMultiVote && atMax && !isSelected
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => toggleCandidate(position.id, candidate.id, position.max_votes)}
                      disabled={isDisabled}
                      className={`relative text-left rounded-xl border-2 p-4 transition-all focus:outline-none ${
                        isSelected
                          ? 'border-[#84050C] bg-[#FEE2E2] ring-2 ring-[#84050C] ring-offset-1'
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-gray-200 hover:border-[#84050C]/50 hover:bg-[#FEE2E2]/50'
                      }`}
                    >
                      {isMultiVote ? (
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="sr-only" />
                      ) : (
                        <input
                          type="radio"
                          name={`position-${position.id}`}
                          value={candidate.id}
                          checked={isSelected}
                          onChange={() => toggleCandidate(position.id, candidate.id, 1)}
                          className="sr-only"
                        />
                      )}
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-full bg-[#FEE2E2] text-[#6B0409] flex items-center justify-center flex-shrink-0 text-xl font-bold overflow-hidden">
                          {candidate.photo_url ? (
                            <img src={candidate.photo_url} alt={candidate.name} className="w-full h-full object-cover" />
                          ) : (
                            candidate.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{candidate.name}</p>
                          {candidate.bio && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{candidate.bio}</p>
                          )}
                          <Link
                            href={`/elections/${election.id}/candidates/${candidate.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#84050C] hover:underline mt-0.5 inline-block"
                          >
                            View Profile
                          </Link>
                        </div>
                        {isSelected && (
                          <div className={`w-5 h-5 bg-[#84050C] flex items-center justify-center flex-shrink-0 ml-1 ${isMultiVote ? 'rounded' : 'rounded-full'}`}>
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-4 z-20">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{selectedCount}</span> / {totalPositions} positions selected
        </p>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!allSelected}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#84050C] hover:bg-[#6B0409] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Vote
        </button>
      </div>

      {showConfirm && (
        <ConfirmModal
          positions={positions}
          selectedVotes={selectedVotes}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}
    </>
  )
}

/* ─── Results View ───────────────────────────────────────────── */
function ResultsView({
  election,
  userVotes,
  myVoteCandidateIds,
  isStudentRole,
  isAdmin,
}: {
  election: Election
  userVotes: UserVote[]
  myVoteCandidateIds: number[]
  isStudentRole: boolean
  isAdmin: boolean
}) {
  const electionId = String(election.id)
  const [livePositions, setLivePositions] = useState(election.positions)
  const [totalVoters, setTotalVoters] = useState<number | null>(null)
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)
  const [participationRate, setParticipationRate] = useState<number | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [exporting, setExporting] = useState(false)
  const mountedRef = useRef(true)

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/elections/${electionId}/results`, { credentials: 'include' })
      if (!res.ok || !mountedRef.current) return
      const json = await res.json()
      if (json.data?.positions) setLivePositions(json.data.positions)
      if (json.data?.total_voters != null) setTotalVoters(Number(json.data.total_voters))
      if (json.data?.eligible_count != null) setEligibleCount(Number(json.data.eligible_count))
      if (json.data?.participation_rate != null) setParticipationRate(Number(json.data.participation_rate))
      setLastUpdatedAt(Date.now())
    } catch { /* ignore */ }
  }, [electionId])

  useEffect(() => {
    mountedRef.current = true
    fetchResults()
    return () => { mountedRef.current = false }
  }, [fetchResults])

  useEffect(() => {
    if (!isAdmin || election.status !== 'active') return
    const interval = setInterval(fetchResults, 30000)
    return () => clearInterval(interval)
  }, [isAdmin, election.status, fetchResults])

  useEffect(() => {
    if (!isAdmin || election.status !== 'active' || !lastUpdatedAt) return
    const tick = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [isAdmin, election.status, lastUpdatedAt])

  const userVoteMap: Record<number, number[]> = {}
  for (const v of userVotes) {
    if (!userVoteMap[v.position_id]) userVoteMap[v.position_id] = []
    userVoteMap[v.position_id].push(v.candidate_id)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/elections/${electionId}/results/export`, { credentials: 'include' })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `election-${electionId}-results.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally { setExporting(false) }
  }

  if (election.status !== 'ended') {
    const myVoteSet = new Set(myVoteCandidateIds.map(Number))
    const mySelections = election.positions.map((pos) => {
      const chosen = pos.candidates.filter((c) => myVoteSet.has(c.id))
      return { position: pos.name, candidates: chosen.length > 0 ? chosen.map((c) => c.name) : ['—'] }
    })

    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;ve voted!</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Your votes have been recorded. Results will be displayed once the election ends on{' '}
            <strong>{new Date(election.end_date).toLocaleDateString()}</strong>.
          </p>
        </div>

        {mySelections.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Your Votes</h3>
              <p className="text-xs text-gray-400 mt-0.5">A summary of your selections</p>
            </div>
            <div className="p-4 space-y-2">
              {mySelections.map(({ position, candidates }) => (
                <div key={position} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0 gap-4">
                  <span className="text-sm text-gray-500 flex-shrink-0">{position}</span>
                  <div className="text-right">
                    {candidates.map((name, i) => (
                      <p key={i} className="text-sm font-semibold text-gray-900">{name}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <ResultsPositionList
            positions={livePositions}
            userVoteMap={userVoteMap}
            isEnded={false}
            hideVoteCounts={false}
            electionId={electionId}
            isAdmin={isAdmin}
            secondsAgo={secondsAgo}
            lastUpdatedAt={lastUpdatedAt}
            totalVoters={totalVoters}
            eligibleCount={eligibleCount}
            participationRate={participationRate}
            onExport={handleExport}
            exporting={exporting}
          />
        )}
      </div>
    )
  }

  return (
    <ResultsPositionList
      positions={livePositions}
      userVoteMap={userVoteMap}
      isEnded={true}
      hideVoteCounts={isStudentRole && election.status !== 'ended'}
      electionId={electionId}
      isAdmin={isAdmin}
      secondsAgo={secondsAgo}
      lastUpdatedAt={lastUpdatedAt}
      totalVoters={totalVoters}
      eligibleCount={eligibleCount}
      participationRate={participationRate}
      onExport={handleExport}
      exporting={exporting}
    />
  )
}

function ResultsPositionList({
  positions,
  userVoteMap,
  isEnded,
  hideVoteCounts,
  electionId,
  isAdmin,
  secondsAgo,
  lastUpdatedAt,
  totalVoters,
  eligibleCount,
  participationRate,
  onExport,
  exporting,
}: {
  positions: Position[]
  userVoteMap: Record<number, number[]>
  isEnded: boolean
  hideVoteCounts: boolean
  electionId: string
  isAdmin: boolean
  secondsAgo: number
  lastUpdatedAt: number
  totalVoters: number | null
  eligibleCount: number | null
  participationRate: number | null
  onExport: () => void
  exporting: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#84050C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Election Results</h2>
          {isAdmin && !isEnded && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && !isEnded && lastUpdatedAt > 0 && (
            <span className="text-xs text-gray-400">Updated {secondsAgo}s ago</span>
          )}
          {isAdmin && isEnded && (
            <button
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#84050C] hover:bg-[#6B0409] rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {isEnded && totalVoters !== null && eligibleCount !== null && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-3 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{totalVoters}</span> of{' '}
          <span className="font-semibold text-gray-900">{eligibleCount}</span> eligible members voted
          {participationRate !== null && (
            <span className="ml-1 text-gray-400">({participationRate}%)</span>
          )}
        </div>
      )}

      {positions.map((position) => {
        const total = position.candidates.reduce((sum, c) => sum + (c.vote_count ?? 0), 0)
        const sorted = [...position.candidates].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
        const winnerVotes = sorted[0]?.vote_count ?? 0

        return (
          <div key={position.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-900">{position.name}</h3>
              {!hideVoteCounts && (
                <p className="text-xs text-gray-400 mt-0.5">{total} total vote{total !== 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="p-4 space-y-3">
              {sorted.map((candidate, index) => {
                const votes = candidate.vote_count ?? 0
                const pct = candidate.percentage ?? (total > 0 ? Math.round((votes / total) * 10000) / 100 : 0)
                const isWinner = !hideVoteCounts && isEnded && index === 0 && votes === winnerVotes && winnerVotes > 0
                const userVotedFor = (userVoteMap[position.id] ?? []).includes(candidate.id)

                return (
                  <div
                    key={candidate.id}
                    className={`rounded-lg p-4 ${
                      isWinner
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isWinner && (
                          <span className="text-amber-500 text-base flex-shrink-0" title="Winner">👑</span>
                        )}
                        <div className="w-9 h-9 rounded-full bg-[#FEE2E2] text-[#6B0409] flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
                          {candidate.photo_url ? (
                            <img src={candidate.photo_url} alt={candidate.name} className="w-full h-full object-cover" />
                          ) : (
                            candidate.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">{candidate.name}</span>
                            {isWinner && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                WINNER
                              </span>
                            )}
                            {userVotedFor && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                Your vote
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/elections/${electionId}/candidates/${candidate.id}`}
                            className="text-xs text-[#84050C] hover:underline mt-0.5 inline-block"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                      {!hideVoteCounts && (
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-bold text-gray-900">{votes}</span>
                          <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
                        </div>
                      )}
                    </div>
                    {!hideVoteCounts && (
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-[#84050C] rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Upcoming View ──────────────────────────────────────────── */
function UpcomingView({ election }: { election: Election }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#FEE2E2] border border-[#FEE2E2] rounded-xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-[#FEE2E2] rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-[#84050C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-[#84050C]">Voting opens on</p>
          <p className="text-[#6B0409] text-sm mt-0.5">
            {new Date(election.start_date).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {election.positions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Candidates Preview
          </h2>
          <div className="space-y-4">
            {election.positions.map((position) => (
              <div key={position.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-medium text-gray-900">{position.name}</h3>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {position.candidates.map((candidate) => (
                    <div key={candidate.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#6B0409] flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
                        {candidate.photo_url ? (
                          <img src={candidate.photo_url} alt={candidate.name} className="w-full h-full object-cover" />
                        ) : (
                          candidate.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{candidate.name}</p>
                        {candidate.bio && (
                          <p className="text-xs text-gray-500 truncate">{candidate.bio}</p>
                        )}
                        <Link
                          href={`/elections/${election.id}/candidates/${candidate.id}`}
                          className="text-xs text-[#84050C] hover:underline mt-0.5 inline-block"
                        >
                          View Profile
                        </Link>
                      </div>
                    </div>
                  ))}
                  {position.candidates.length === 0 && (
                    <p className="text-sm text-gray-400 col-span-2 py-2">No candidates yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Share Button ───────────────────────────────────────────── */
function ShareButton({ token }: { token: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const url = `${window.location.origin}/elections/join/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast?.addToast('Link copied!', 'success')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy share link"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-[#84050C] hover:border-[#E2A8A4] transition-colors text-sm"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="hidden sm:inline text-green-600 font-medium">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </button>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function ElectionDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { user } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [election, setElection] = useState<Election | null>(null)
  const [userVotes, setUserVotes] = useState<UserVote[]>([])
  const [myVoteCandidateIds, setMyVoteCandidateIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const adminRoles = ['master_admin', 'admin', 'moderator']
  const isAdmin = user ? adminRoles.includes(user.role) : false
  const isStudentRole = user ? user.role === 'member' : false
  const idVerified = !!user?.id_verified

  const fetchElection = useCallback(async () => {
    if (!id) return
    try {
      const [electionRes, voteRes] = await Promise.all([
        fetch(`/api/elections/${id}`),
        fetch(`/api/elections/${id}/vote`),
      ])
      if (electionRes.status === 404) {
        router.push('/not-found')
        return
      }
      const electionJson = await electionRes.json()
      const voteJson = await voteRes.json()

      const electionData = electionJson.data?.election ?? null
      setElection(electionData)

      const rawVotes: UserVote[] = voteJson.data?.votes ?? []
      setUserVotes(rawVotes as UserVote[])
      setMyVoteCandidateIds((voteJson.data?.myVotes ?? []) as number[])
    } catch {
      toast?.addToast('Failed to load election.', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    fetchElection()
  }, [fetchElection])

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  if (!election) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-500">Election not found.</p>
          <Link href="/elections" className="text-[#84050C] hover:underline text-sm mt-2 inline-block">
            Back to Elections
          </Link>
        </div>
      </Layout>
    )
  }

  const isUpcoming =
    election.status === 'draft' || new Date(election.start_date) > new Date()

  const showVotingView =
    election.status === 'active' &&
    idVerified &&
    !election.hasVoted &&
    !isUpcoming

  const showResultsView =
    election.status === 'ended' || (election.status === 'active' && election.hasVoted)

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/elections" className="hover:text-gray-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Elections
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-xs">{election.title}</span>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {election.thumbnail_url && (
            <img
              src={election.thumbnail_url}
              alt=""
              className="w-full max-h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">{election.title}</h1>
                {election.description && (
                  <p className="text-gray-500 mt-2 text-sm">{election.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={election.status} />
                {election.share_token && (isAdmin || election.status === 'active') && (
                  <ShareButton token={election.share_token} />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(election.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' – '}
              {new Date(election.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>

            {/* Auto-start / Auto-end badges for admins */}
            {isAdmin && (election.auto_start || election.auto_end) && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {!!election.auto_start && election.status === 'draft' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Auto-start scheduled
                  </span>
                )}
                {!!election.auto_end && election.status !== 'ended' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-100">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Auto-end scheduled
                  </span>
                )}
              </div>
            )}

            {/* Admin actions */}
            {isAdmin && election.status === 'draft' && (
              <div className="mt-4 flex gap-2">
                <Link
                  href="/admin/elections"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#84050C] border border-[#E2A8A4] hover:border-[#84050C]/50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Edit Election
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ID not verified warning */}
        {election.status === 'active' && !idVerified && !election.hasVoted && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-700">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Your ID must be verified to vote.{' '}
            <Link href="/verify-id" className="underline font-medium ml-1">Upload ID →</Link>
          </div>
        )}

        {/* Content View */}
        {showVotingView && (
          <VotingView
            election={election}
            onVoteSuccess={() => fetchElection()}
          />
        )}

        {showResultsView && (
          <ResultsView
            election={election}
            userVotes={userVotes}
            myVoteCandidateIds={myVoteCandidateIds}
            isStudentRole={isStudentRole}
            isAdmin={isAdmin}
          />
        )}

        {isUpcoming && !showVotingView && !showResultsView && (
          <UpcomingView election={election} />
        )}
      </div>
    </Layout>
  )
}
