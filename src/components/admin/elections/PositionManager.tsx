'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import CandidateManager, { CandidateForm, StudentResult } from './CandidateManager'

export interface PositionForm {
  id?: number
  name: string
  max_votes: number
  max_votes_mode?: 'custom' | 'candidates' | 'eligible'
  candidates: CandidateForm[]
}

type MaxVotesMode = 'custom' | 'candidates' | 'eligible'

interface PositionManagerProps {
  positions: PositionForm[]
  electionId?: number
  studentSearches: Record<string, string>
  studentDropdowns: Record<string, StudentResult[]>
  onAddPosition: () => void
  onUpdatePosition: (pi: number, updates: Partial<PositionForm>) => void
  onRemovePosition: (pi: number) => void
  onAddCandidate: (pi: number) => void
  onUpdateCandidate: (pi: number, ci: number, updates: Partial<CandidateForm>) => void
  onRemoveCandidate: (pi: number, ci: number) => void
  onSearchStudents: (key: string, q: string) => void
  onClearStudentSearch: (key: string) => void
}

export default function PositionManager({
  positions,
  electionId,
  studentSearches,
  studentDropdowns,
  onAddPosition,
  onUpdatePosition,
  onRemovePosition,
  onAddCandidate,
  onUpdateCandidate,
  onRemoveCandidate,
  onSearchStudents,
  onClearStudentSearch,
}: PositionManagerProps) {
  const [eligibleCounts, setEligibleCounts] = useState<Record<number, number | 'loading' | 'error'>>({})

  // Auto-sync max_votes for 'candidates' mode when candidate count changes
  const candidateLengths = positions.map((p) => p.candidates.length).join(',')
  useEffect(() => {
    positions.forEach((pos, pi) => {
      if (pos.max_votes_mode === 'candidates') {
        const newMax = Math.max(1, pos.candidates.length)
        if (pos.max_votes !== newMax) {
          onUpdatePosition(pi, { max_votes: newMax })
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateLengths])

  const fetchEligibleCount = async (pi: number) => {
    if (!electionId) return
    setEligibleCounts((prev) => ({ ...prev, [pi]: 'loading' }))
    try {
      const res = await fetch(`/api/elections/eligible-count?electionId=${electionId}`, { credentials: 'include' })
      const json = await res.json()
      const count: number = json.data?.count ?? 0
      setEligibleCounts((prev) => ({ ...prev, [pi]: count }))
      onUpdatePosition(pi, { max_votes: Math.max(1, count) })
    } catch {
      setEligibleCounts((prev) => ({ ...prev, [pi]: 'error' }))
    }
  }

  const handleModeChange = (pi: number, mode: MaxVotesMode) => {
    const pos = positions[pi]
    if (mode === 'candidates') {
      onUpdatePosition(pi, { max_votes_mode: mode, max_votes: Math.max(1, pos.candidates.length) })
    } else if (mode === 'eligible') {
      onUpdatePosition(pi, { max_votes_mode: mode })
      if (electionId) fetchEligibleCount(pi)
    } else {
      onUpdatePosition(pi, { max_votes_mode: mode })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Positions</h3>
        <Button variant="secondary" size="sm" onClick={onAddPosition}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Position
        </Button>
      </div>

      {positions.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No positions yet. Add one above.</p>
      )}

      <div className="space-y-4">
        {positions.map((pos, pi) => {
          const mode: MaxVotesMode = pos.max_votes_mode ?? 'custom'
          const eligibleCount = eligibleCounts[pi]

          return (
            <div key={pi} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {/* Position name + remove */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={pos.name}
                    onChange={(e) => onUpdatePosition(pi, { name: e.target.value })}
                    placeholder="Position name (e.g. President)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  />
                </div>
                <button
                  onClick={() => onRemovePosition(pi)}
                  className="text-red-400 hover:text-red-600 p-1 rounded transition-colors mt-0.5"
                  title="Remove position"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Max votes section */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Max votes</p>
                {/* Mode pill tabs */}
                <div className="flex gap-0.5 bg-gray-200 rounded-md p-0.5 w-fit mb-2">
                  {(['custom', 'candidates', 'eligible'] as MaxVotesMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleModeChange(pi, m)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                        mode === m
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {m === 'custom' ? 'Custom' : m === 'candidates' ? 'By Candidates' : 'Eligible Members'}
                    </button>
                  ))}
                </div>

                {/* Custom: plain number input */}
                {mode === 'custom' && (
                  <input
                    type="number"
                    min={1}
                    value={pos.max_votes}
                    onChange={(e) => onUpdatePosition(pi, { max_votes: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  />
                )}

                {/* By Candidates: read-only, shows count */}
                {mode === 'candidates' && (
                  <div className="flex items-center gap-2 h-8">
                    <span className="text-sm font-semibold text-gray-800">{pos.max_votes}</span>
                    <span className="text-xs text-gray-400">
                      (= {pos.candidates.length} candidate{pos.candidates.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}

                {/* Eligible Members: fetch + display */}
                {mode === 'eligible' && (
                  <div className="flex items-center gap-2 h-8">
                    {!electionId ? (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        Save election first to use auto-count
                      </span>
                    ) : eligibleCount === 'loading' ? (
                      <span className="text-xs text-gray-400 italic">Fetching...</span>
                    ) : eligibleCount === 'error' ? (
                      <>
                        <span className="text-xs text-red-500">Failed to fetch</span>
                        <button
                          type="button"
                          onClick={() => fetchEligibleCount(pi)}
                          className="text-xs text-[#84050C] hover:underline"
                        >
                          Retry
                        </button>
                      </>
                    ) : typeof eligibleCount === 'number' ? (
                      <>
                        <span className="text-sm font-semibold text-gray-800">{pos.max_votes}</span>
                        <span className="text-xs text-gray-400">
                          (= {eligibleCount} eligible member{eligibleCount !== 1 ? 's' : ''})
                        </span>
                        <button
                          type="button"
                          onClick={() => fetchEligibleCount(pi)}
                          className="text-xs text-[#84050C] hover:underline"
                        >
                          Refresh
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fetchEligibleCount(pi)}
                        className="text-xs text-[#84050C] hover:underline"
                      >
                        Fetch count
                      </button>
                    )}
                  </div>
                )}
              </div>

              <CandidateManager
                positionIndex={pi}
                candidates={pos.candidates}
                studentSearches={studentSearches}
                studentDropdowns={studentDropdowns}
                onAddCandidate={onAddCandidate}
                onUpdateCandidate={onUpdateCandidate}
                onRemoveCandidate={onRemoveCandidate}
                onSearchStudents={onSearchStudents}
                onClearStudentSearch={onClearStudentSearch}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
