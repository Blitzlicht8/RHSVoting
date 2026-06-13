'use client'

import { useEffect, useRef, useState } from 'react'

export interface StudentResult {
  id: number
  name: string
  email: string
  grade_level: string | null
  section: string | null
}

export interface CandidateForm {
  id?: number
  name: string
  bio: string
  grade_level?: string
  section?: string
  grade_level_id?: number | null
  subtype_id?: number | null
  section_id?: number | null
  student_user_id?: number | null
  mode: 'manual' | 'existing'
}

interface AcademicOption { id: number; name: string }
interface AcademicOptions {
  gradeLevels: AcademicOption[]
  subtypes: AcademicOption[]
  sections: AcademicOption[]
  gradeLevelId: number | null
  subtypeId: number | null
}

interface CandidateManagerProps {
  positionIndex: number
  candidates: CandidateForm[]
  studentSearches: Record<string, string>
  studentDropdowns: Record<string, StudentResult[]>
  onAddCandidate: (pi: number) => void
  onUpdateCandidate: (pi: number, ci: number, updates: Partial<CandidateForm>) => void
  onRemoveCandidate: (pi: number, ci: number) => void
  onSearchStudents: (key: string, q: string) => void
  onClearStudentSearch: (key: string) => void
}

const emptyAcademic: AcademicOptions = { gradeLevels: [], subtypes: [], sections: [], gradeLevelId: null, subtypeId: null }

export default function CandidateManager({
  positionIndex: pi,
  candidates,
  studentSearches,
  studentDropdowns,
  onAddCandidate,
  onUpdateCandidate,
  onRemoveCandidate,
  onSearchStudents,
  onClearStudentSearch,
}: CandidateManagerProps) {
  const [academicOptions, setAcademicOptions] = useState<Record<string, AcademicOptions>>({})
  const gradeLevelsFetchedRef = useRef(false)
  const [globalGradeLevels, setGlobalGradeLevels] = useState<AcademicOption[]>([])

  // Fetch grade levels once
  useEffect(() => {
    if (gradeLevelsFetchedRef.current) return
    gradeLevelsFetchedRef.current = true
    fetch('/api/academic/grade-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const levels: AcademicOption[] = json.data?.gradeLevels ?? json.data?.grade_levels ?? json.data ?? []
        setGlobalGradeLevels(Array.isArray(levels) ? levels : [])
      })
      .catch(() => {})
  }, [])

  const getKey = (ci: number) => `${pi}_${ci}`

  const getAcademic = (ci: number): AcademicOptions =>
    academicOptions[getKey(ci)] ?? { ...emptyAcademic, gradeLevels: globalGradeLevels }

  const setAcademic = (ci: number, patch: Partial<AcademicOptions>) =>
    setAcademicOptions((prev) => ({
      ...prev,
      [getKey(ci)]: { ...(prev[getKey(ci)] ?? { ...emptyAcademic, gradeLevels: globalGradeLevels }), ...patch },
    }))

  const handleGradeLevelChange = async (ci: number, glId: number, glName: string) => {
    setAcademic(ci, { gradeLevelId: glId, subtypeId: null, subtypes: [], sections: [] })
    onUpdateCandidate(pi, ci, { grade_level: glName, grade_level_id: glId, subtype_id: null, section_id: null, section: '' })
    try {
      const r = await fetch(`/api/academic/subtypes?gradeLevelId=${glId}`, { credentials: 'include' })
      const json = await r.json()
      const subtypes: AcademicOption[] = json.data?.subtypes ?? json.data ?? []
      if (subtypes.length === 0) {
        // no subtypes — fetch sections directly
        const rs = await fetch(`/api/academic/sections?gradeLevelId=${glId}`, { credentials: 'include' })
        const jsons = await rs.json()
        const sections: AcademicOption[] = jsons.data?.sections ?? jsons.data ?? []
        setAcademic(ci, { subtypes: [], sections, gradeLevelId: glId })
      } else {
        setAcademic(ci, { subtypes, sections: [], gradeLevelId: glId })
      }
    } catch {}
  }

  const handleSubtypeChange = async (ci: number, stId: number, glId: number) => {
    setAcademic(ci, { subtypeId: stId, sections: [] })
    onUpdateCandidate(pi, ci, { subtype_id: stId, section_id: null, section: '' })
    try {
      const r = await fetch(`/api/academic/sections?gradeLevelId=${glId}&subtypeId=${stId}`, { credentials: 'include' })
      const json = await r.json()
      const sections: AcademicOption[] = json.data?.sections ?? json.data ?? []
      setAcademic(ci, { sections })
    } catch {}
  }

  const handleSectionChange = (ci: number, secId: number, secName: string) => {
    onUpdateCandidate(pi, ci, { section: secName, section_id: secId })
  }

  return (
    <div className="ml-0 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Candidates</span>
        <button
          onClick={() => onAddCandidate(pi)}
          className="text-xs text-[#84050C] hover:text-[#6B0409] font-medium flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Candidate
        </button>
      </div>

      {candidates.length === 0 && (
        <p className="text-xs text-gray-400 pl-1">No candidates yet.</p>
      )}

      {candidates.map((cand, ci) => {
        const searchKey = `${pi}_${ci}`
        const dropdownResults = studentDropdowns[searchKey] || []
        const searchQuery = studentSearches[searchKey] ?? ''
        return (
          <div key={ci} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            {/* Mode toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateCandidate(pi, ci, { mode: 'existing', name: '', student_user_id: null, grade_level: '', section: '' })}
                className={[
                  'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                  cand.mode === 'existing'
                    ? 'bg-[#84050C] text-white border-[#84050C]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#84050C]',
                ].join(' ')}
              >
                From Student Account
              </button>
              <button
                type="button"
                onClick={() => onUpdateCandidate(pi, ci, { mode: 'manual', student_user_id: null })}
                className={[
                  'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                  cand.mode === 'manual'
                    ? 'bg-[#84050C] text-white border-[#84050C]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#84050C]',
                ].join(' ')}
              >
                Enter Manually
              </button>
              <button
                type="button"
                onClick={() => onRemoveCandidate(pi, ci)}
                className="ml-auto text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0"
                title="Remove candidate"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Existing mode */}
            {cand.mode === 'existing' && (
              <div className="space-y-1.5">
                {cand.student_user_id ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#FEE2E2] border border-[#FEE2E2] rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{cand.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCandidate(pi, ci, { name: '', student_user_id: null, grade_level: '', section: '' })
                        onClearStudentSearch(searchKey)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
                    >
                      ✕ Clear
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchStudents(searchKey, e.target.value)}
                      placeholder="Search student by name or email…"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                    />
                    {dropdownResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {dropdownResults.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => {
                              onUpdateCandidate(pi, ci, {
                                name: student.name,
                                student_user_id: student.id,
                              })
                              onClearStudentSearch(searchKey)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-[#FEE2E2] transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            <div className="text-xs text-gray-500">{student.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Manual mode */}
            {cand.mode === 'manual' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={cand.name}
                  onChange={(e) => onUpdateCandidate(pi, ci, { name: e.target.value })}
                  placeholder="Candidate name"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                />
                <textarea
                  value={cand.bio}
                  onChange={(e) => onUpdateCandidate(pi, ci, { bio: e.target.value })}
                  placeholder="Short bio (optional)"
                  rows={1}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] resize-none"
                />
                {/* Academic cascading dropdowns */}
                {(() => {
                  const acad = getAcademic(ci)
                  const selectClass = 'w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white'
                  return (
                    <div className="space-y-2">
                      {/* Grade Level */}
                      <select
                        value={acad.gradeLevelId ?? ''}
                        onChange={(e) => {
                          const id = Number(e.target.value)
                          const name = acad.gradeLevels.find((g) => g.id === id)?.name ?? ''
                          if (id) handleGradeLevelChange(ci, id, name)
                          else onUpdateCandidate(pi, ci, { grade_level: '', grade_level_id: null, subtype_id: null, section_id: null, section: '' })
                        }}
                        className={selectClass}
                      >
                        <option value="">Grade Level (optional)</option>
                        {(acad.gradeLevels.length ? acad.gradeLevels : globalGradeLevels).map((gl) => (
                          <option key={gl.id} value={gl.id}>{gl.name}</option>
                        ))}
                      </select>

                      {/* Subtype (shown only if subtypes exist) */}
                      {acad.subtypes.length > 0 && (
                        <select
                          value={acad.subtypeId ?? ''}
                          onChange={(e) => {
                            const id = Number(e.target.value)
                            if (id && acad.gradeLevelId) handleSubtypeChange(ci, id, acad.gradeLevelId)
                            else { setAcademic(ci, { subtypeId: null, sections: [] }); onUpdateCandidate(pi, ci, { subtype_id: null, section_id: null, section: '' }) }
                          }}
                          className={selectClass}
                        >
                          <option value="">Subtype (required)</option>
                          {acad.subtypes.map((st) => (
                            <option key={st.id} value={st.id}>{st.name}</option>
                          ))}
                        </select>
                      )}

                      {/* Section */}
                      {acad.sections.length > 0 && (
                        <select
                          value={cand.section_id ?? ''}
                          onChange={(e) => {
                            const id = Number(e.target.value)
                            const name = acad.sections.find((s) => s.id === id)?.name ?? ''
                            if (id) handleSectionChange(ci, id, name)
                            else onUpdateCandidate(pi, ci, { section: '', section_id: null })
                          }}
                          className={selectClass}
                        >
                          <option value="">Section (required)</option>
                          {acad.sections.map((sec) => (
                            <option key={sec.id} value={sec.id}>{sec.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
