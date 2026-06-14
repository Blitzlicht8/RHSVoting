'use client'

import { useEffect, useRef, useState } from 'react'

export interface StudentResult {
  id: number
  name: string
  email: string
  grade_level: string | null
  section: string | null
  avatar_url: string | null
  grade_name: string | null
  section_name: string | null
}

export interface CandidateForm {
  id?: number
  name: string
  bio: string
  platform?: string
  qualifications?: string
  grade_level?: string
  subtype?: string
  section?: string
  grade_level_id?: number | null
  subtype_id?: number | null
  section_id?: number | null
  subtype_required?: boolean
  section_required?: boolean
  student_user_id?: number | null
  photo_url?: string | null
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

const emptyAcademic: AcademicOptions = { gradeLevels: [], subtypes: [], sections: [], gradeLevelId: null, subtypeId: null }

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

function Avatar({ url, name, size = 8 }: { url?: string | null; name: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full overflow-hidden bg-[#FEE2E2] flex items-center justify-center flex-shrink-0`
  return (
    <div className={cls}>
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={`font-bold text-[#6B0409] ${size <= 7 ? 'text-xs' : 'text-sm'}`}>
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

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
  const fetchedRef = useRef(false)
  const [globalGradeLevels, setGlobalGradeLevels] = useState<AcademicOption[]>([])
  const [labels, setLabels] = useState({ l1: 'Group', l2: 'Subgroup', l3: 'Unit' })
  const [uploadingPhoto, setUploadingPhoto] = useState<Record<string, boolean>>({})
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({})
  const [collapsedCandidates, setCollapsedCandidates] = useState<Set<number>>(new Set())

  const toggleCandidateCollapse = (ci: number) =>
    setCollapsedCandidates((prev) => {
      const next = new Set(prev)
      next.has(ci) ? next.delete(ci) : next.add(ci)
      return next
    })

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      fetch('/api/academic/grade-levels', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/settings', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([gradesJson, settingsJson]) => {
      const levels: AcademicOption[] = gradesJson.data?.gradeLevels ?? gradesJson.data?.grade_levels ?? gradesJson.data ?? []
      setGlobalGradeLevels(Array.isArray(levels) ? levels : [])
      const s: Record<string, string> = settingsJson.data ?? {}
      setLabels({ l1: s.group_label_l1 ?? 'Group', l2: s.group_label_l2 ?? 'Subgroup', l3: s.group_label_l3 ?? 'Unit' })
    })
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
    onUpdateCandidate(pi, ci, { grade_level: glName, grade_level_id: glId, subtype_id: null, subtype: '', section_id: null, section: '', subtype_required: false, section_required: false })
    try {
      const r = await fetch(`/api/academic/subtypes?gradeLevelId=${glId}`, { credentials: 'include' })
      const json = await r.json()
      const subtypes: AcademicOption[] = json.data?.subtypes ?? json.data ?? []
      if (subtypes.length === 0) {
        const rs = await fetch(`/api/academic/sections?gradeLevelId=${glId}`, { credentials: 'include' })
        const jsons = await rs.json()
        const sections: AcademicOption[] = jsons.data?.sections ?? jsons.data ?? []
        setAcademic(ci, { subtypes: [], sections, gradeLevelId: glId })
        onUpdateCandidate(pi, ci, { subtype_required: false, section_required: sections.length > 0 })
      } else {
        setAcademic(ci, { subtypes, sections: [], gradeLevelId: glId })
        onUpdateCandidate(pi, ci, { subtype_required: true, section_required: false })
      }
    } catch {}
  }

  const handleSubtypeChange = async (ci: number, stId: number, glId: number) => {
    const subtypeName = getAcademic(ci).subtypes.find((s) => s.id === stId)?.name ?? ''
    setAcademic(ci, { subtypeId: stId, sections: [] })
    onUpdateCandidate(pi, ci, { subtype_id: stId, subtype: subtypeName, section_id: null, section: '' })
    try {
      const r = await fetch(`/api/academic/sections?gradeLevelId=${glId}&subtypeId=${stId}`, { credentials: 'include' })
      const json = await r.json()
      const sections: AcademicOption[] = json.data?.sections ?? json.data ?? []
      setAcademic(ci, { sections })
      onUpdateCandidate(pi, ci, { section_required: sections.length > 0 })
    } catch {}
  }

  const handleSectionChange = (ci: number, secId: number, secName: string) => {
    onUpdateCandidate(pi, ci, { section: secName, section_id: secId })
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, ci: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    const key = getKey(ci)
    setUploadingPhoto((prev) => ({ ...prev, [key]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('purpose', 'candidate')
      const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
      const json = await res.json()
      if (res.ok && json.data?.url) {
        onUpdateCandidate(pi, ci, { photo_url: json.data.url })
      }
    } catch {}
    setUploadingPhoto((prev) => ({ ...prev, [key]: false }))
    e.target.value = ''
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
        const isCandCollapsed = collapsedCandidates.has(ci)

        if (isCandCollapsed) {
          return (
            <div key={ci} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar url={cand.photo_url} name={cand.name || '?'} size={7} />
                <span className="text-sm font-medium text-gray-900 truncate">{cand.name || 'Unnamed candidate'}</span>
                {cand.mode === 'existing' && (
                  <span className="text-xs text-gray-400 flex-shrink-0">Member</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggleCandidateCollapse(ci)}
                  className="text-xs font-medium text-[#84050C] hover:text-[#6B0409] px-2 py-1 border border-[#E2A8A4] rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { onRemoveCandidate(pi, ci); setCollapsedCandidates((prev) => { const n = new Set(prev); n.delete(ci); return n }) }}
                  className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )
        }

        return (
          <div key={ci} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            {/* Mode toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateCandidate(pi, ci, { mode: 'existing', name: '', student_user_id: null, photo_url: null, grade_level: '', section: '' })}
                className={[
                  'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                  cand.mode === 'existing'
                    ? 'bg-[#84050C] text-white border-[#84050C]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#84050C]',
                ].join(' ')}
              >
                From Member Account
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
                    <Avatar url={cand.photo_url} name={cand.name || '?'} size={8} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{cand.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCandidate(pi, ci, { name: '', student_user_id: null, photo_url: null, grade_level: '', section: '' })
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
                      onChange={(e) => { onSearchStudents(searchKey, e.target.value); setSlotErrors((p) => { const n = { ...p }; delete n[ci]; return n }) }}
                      placeholder="Search member by name or email…"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                    />
                    {slotErrors[ci] && (
                      <p className="text-xs text-red-500 mt-1">{slotErrors[ci]}</p>
                    )}
                    {dropdownResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {dropdownResults.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              const alreadyAdded = candidates.some(
                                (c, idx) => idx !== ci && c.student_user_id === member.id
                              )
                              if (alreadyAdded) {
                                setSlotErrors((prev) => ({ ...prev, [ci]: `${member.name} is already added to this position.` }))
                                setTimeout(() => setSlotErrors((prev) => { const n = { ...prev }; delete n[ci]; return n }), 3000)
                                onClearStudentSearch(searchKey)
                                return
                              }
                              onUpdateCandidate(pi, ci, {
                                name: member.name,
                                student_user_id: member.id,
                                photo_url: member.avatar_url ?? null,
                              })
                              onClearStudentSearch(searchKey)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-[#FEE2E2] transition-colors flex items-center gap-2"
                          >
                            <Avatar url={member.avatar_url} name={member.name || '?'} size={7} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900">{member.name}</div>
                              <div className="text-xs text-gray-500">{member.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Existing mode save button */}
            {cand.mode === 'existing' && cand.student_user_id && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => toggleCandidateCollapse(ci)}
                  className="text-xs font-medium text-white bg-[#84050C] hover:bg-[#6B0409] px-3 py-1.5 rounded-md transition-colors"
                >
                  Save Candidate
                </button>
              </div>
            )}

            {/* Manual mode */}
            {cand.mode === 'manual' && (
              <div className="space-y-2">
                {/* Photo upload */}
                <div className="flex items-center gap-3">
                  <Avatar url={cand.photo_url} name={cand.name || '?'} size={10} />
                  <label className="cursor-pointer text-xs text-[#84050C] hover:underline">
                    {uploadingPhoto[getKey(ci)] ? 'Uploading…' : cand.photo_url ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto[getKey(ci)]}
                      onChange={(e) => handlePhotoUpload(e, ci)}
                    />
                  </label>
                </div>

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
                <textarea
                  value={cand.platform ?? ''}
                  onChange={(e) => onUpdateCandidate(pi, ci, { platform: e.target.value })}
                  placeholder="Platform / Advocacy (optional)"
                  rows={4}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] resize-none"
                />
                <textarea
                  value={cand.qualifications ?? ''}
                  onChange={(e) => onUpdateCandidate(pi, ci, { qualifications: e.target.value })}
                  placeholder="Qualifications — one per line e.g. BS Computer Science, 3 years leadership..."
                  rows={3}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] resize-none"
                />

                {(() => {
                  const acad = getAcademic(ci)
                  const selectClass = 'w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white'
                  return (
                    <div className="space-y-2">
                      <select
                        value={acad.gradeLevelId ?? ''}
                        onChange={(e) => {
                          const id = Number(e.target.value)
                          const list = acad.gradeLevels.length ? acad.gradeLevels : globalGradeLevels
                          const name = list.find((g) => g.id === id)?.name ?? ''
                          if (id) handleGradeLevelChange(ci, id, name)
                          else onUpdateCandidate(pi, ci, { grade_level: '', grade_level_id: null, subtype_id: null, section_id: null, section: '' })
                        }}
                        className={selectClass}
                      >
                        <option value="">Select {labels.l1}</option>
                        {(acad.gradeLevels.length ? acad.gradeLevels : globalGradeLevels).map((gl) => (
                          <option key={gl.id} value={gl.id}>{gl.name}</option>
                        ))}
                      </select>
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
                          <option value="">Select {labels.l2}</option>
                          {acad.subtypes.map((st) => (
                            <option key={st.id} value={st.id}>{st.name}</option>
                          ))}
                        </select>
                      )}
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
                          <option value="">Select {labels.l3}</option>
                          {acad.sections.map((sec) => (
                            <option key={sec.id} value={sec.id}>{sec.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })()}

                {/* Save manual candidate */}
                {cand.name.trim() && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => toggleCandidateCollapse(ci)}
                      className="text-xs font-medium text-white bg-[#84050C] hover:bg-[#6B0409] px-3 py-1.5 rounded-md transition-colors"
                    >
                      Save Candidate
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
