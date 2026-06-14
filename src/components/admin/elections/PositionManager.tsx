'use client'

import { useEffect } from 'react'
import Button from '@/components/ui/Button'
import CandidateManager, { CandidateForm, StudentResult } from './CandidateManager'

export interface PositionForm {
  id?: number
  name: string
  max_votes: number
  max_votes_mode?: 'custom' | 'candidates'
  candidates: CandidateForm[]
}

type MaxVotesMode = 'custom' | 'candidates'

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
  // Auto-sync max_votes for 'candidates' mode when candidate count changes
  const candidateLengths = positions.map((p) => p.candidates.length).join(',')
  useEffect(() => {
    positions.forEach((pos, pi) => {
      if (pos.max_votes_mode === 'candidates') {
        const newMax = Math.max(2, pos.candidates.length)
        if (pos.max_votes !== newMax) {
          onUpdatePosition(pi, { max_votes: newMax })
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateLengths])

  const handleModeChange = (pi: number, mode: MaxVotesMode) => {
    const pos = positions[pi]
    if (mode === 'candidates') {
      onUpdatePosition(pi, { max_votes_mode: mode, max_votes: Math.max(2, pos.candidates.length) })
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
          const mode: MaxVotesMode = (pos.max_votes_mode === 'candidates' ? 'candidates' : 'custom') as MaxVotesMode
          const isMultiVote = pos.max_votes > 1

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

              {/* Multi-vote toggle */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id={`multi-${pi}`}
                    checked={isMultiVote}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onUpdatePosition(pi, { max_votes_mode: 'custom', max_votes: 2 })
                      } else {
                        onUpdatePosition(pi, { max_votes_mode: 'custom', max_votes: 1 })
                      }
                    }}
                    className="w-4 h-4 accent-[#84050C] cursor-pointer"
                  />
                  <label htmlFor={`multi-${pi}`} className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                    Allow multiple selections per voter
                  </label>
                </div>
                <p className="text-xs text-gray-400 ml-6">
                  {isMultiVote
                    ? `Voters can pick up to ${pos.max_votes} candidate${pos.max_votes !== 1 ? 's' : ''} for this position.`
                    : 'Voters pick exactly one candidate for this position.'}
                </p>
              </div>

              {/* Max per voter — only visible when multi-vote is on */}
              {isMultiVote && (
                <div className="ml-6 mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-700">Max candidates per voter</p>

                  {/* Mode tabs */}
                  <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5 w-fit">
                    {(['custom', 'candidates'] as MaxVotesMode[]).map((m) => (
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
                        {m === 'custom' ? 'Custom' : 'Match candidates'}
                      </button>
                    ))}
                  </div>

                  {mode === 'custom' && (
                    <>
                      <input
                        type="number"
                        min={2}
                        value={pos.max_votes}
                        onChange={(e) => onUpdatePosition(pi, { max_votes: Math.max(2, parseInt(e.target.value) || 2) })}
                        className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                      />
                      <p className="text-xs text-gray-400">
                        You set the limit. Each voter can pick up to this many candidates.
                      </p>
                    </>
                  )}

                  {mode === 'candidates' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{pos.max_votes}</span>
                        <span className="text-xs text-gray-400">
                          (matches {pos.candidates.length} candidate{pos.candidates.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Automatically matches the number of candidates. Voters can pick every candidate — useful for approval voting.
                      </p>
                    </>
                  )}
                </div>
              )}

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
