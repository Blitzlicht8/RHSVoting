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
  collapsed?: boolean
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

      <div className="space-y-3">
        {positions.map((pos, pi) => {
          const mode: MaxVotesMode = (pos.max_votes_mode === 'candidates' ? 'candidates' : 'custom') as MaxVotesMode
          const isMultiVote = pos.max_votes > 1
          const isCollapsed = !!pos.collapsed

          if (isCollapsed) {
            return (
              <div key={pi} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-4 h-4 text-[#84050C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 truncate">{pos.name || 'Unnamed position'}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {pos.candidates.length} candidate{pos.candidates.length !== 1 ? 's' : ''}
                    {isMultiVote ? ` · max ${pos.max_votes}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdatePosition(pi, { collapsed: false })}
                    className="text-xs font-medium text-[#84050C] hover:text-[#6B0409] px-2.5 py-1 border border-[#E2A8A4] rounded-md transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemovePosition(pi)}
                    className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                    title="Remove position"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={pi} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
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

              {isMultiVote && (
                <div className="ml-6 mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-700">Max candidates per voter</p>
                  <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5 w-fit">
                    {(['custom', 'candidates'] as MaxVotesMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleModeChange(pi, m)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                          mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                      <p className="text-xs text-gray-400">You set the limit. Each voter can pick up to this many candidates.</p>
                    </>
                  )}
                  {mode === 'candidates' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{pos.max_votes}</span>
                        <span className="text-xs text-gray-400">(matches {pos.candidates.length} candidate{pos.candidates.length !== 1 ? 's' : ''})</span>
                      </div>
                      <p className="text-xs text-gray-400">Automatically matches the number of candidates. Voters can pick every candidate — useful for approval voting.</p>
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

              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => { if (pos.name.trim()) onUpdatePosition(pi, { collapsed: true }) }}
                  disabled={!pos.name.trim()}
                  className="text-xs font-medium text-white bg-[#84050C] hover:bg-[#6B0409] disabled:bg-gray-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors"
                >
                  Save Position
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
