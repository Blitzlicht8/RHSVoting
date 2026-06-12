'use client'

import Button from '@/components/ui/Button'
import CandidateManager, { CandidateForm, StudentResult } from './CandidateManager'

export interface PositionForm {
  id?: number
  name: string
  max_votes: number
  candidates: CandidateForm[]
}

interface PositionManagerProps {
  positions: PositionForm[]
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
        {positions.map((pos, pi) => (
          <div key={pi} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            {/* Position row */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={pos.name}
                    onChange={(e) => onUpdatePosition(pi, { name: e.target.value })}
                    placeholder="Position name (e.g. President)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Max votes</label>
                  <input
                    type="number"
                    min={1}
                    value={pos.max_votes}
                    onChange={(e) => onUpdatePosition(pi, { max_votes: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  />
                </div>
              </div>
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
        ))}
      </div>
    </div>
  )
}
