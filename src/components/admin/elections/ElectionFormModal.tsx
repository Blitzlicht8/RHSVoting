'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import PositionManager, { PositionForm } from './PositionManager'
import { CandidateForm, StudentResult } from './CandidateManager'

// ── Shared types ────────────────────────────────────────────────────────────

export type ElectionStatus = 'draft' | 'active' | 'ended'

export interface GradeLevel {
  id: number
  name: string
}

export interface EligibilityRule {
  grade_level_id: number | null
  subtype_id: number | null
  section_id: number | null
  is_all_grade: boolean
  is_all_subtype: boolean
  is_all_section: boolean
  is_exclude: boolean
}

export interface ElectionForm {
  title: string
  description: string
  start_date: string
  end_date: string
  status: ElectionStatus
  positions: PositionForm[]
  is_global: boolean
  allow_teacher_vote: boolean
  eligibility: EligibilityRule[]
  thumbnail_url?: string | null
}

export interface Election {
  id: number
  title: string
  description: string | null
  start_date: string
  end_date: string
  status: ElectionStatus
  position_count: number
  candidate_count: number
  vote_count: number
  created_at: string
  thumbnail_url?: string | null
  share_token?: string | null
}

// ── GradeTargetingBuilder ────────────────────────────────────────────────────

interface GradeSubtype { id: number; name: string; grade_level_id: number }
interface Section { id: number; name: string; grade_level_id: number; subtype_id: number | null }

interface GradeState {
  subtypes: GradeSubtype[]
  subtypesLoaded: boolean
  sections: Record<string, Section[]>   // key: subtypeId string or 'direct'
  sectionsLoaded: Record<string, boolean>
}

// Selection state (separate from eligibility rules for UI control)
interface GradeSelection {
  allGrade: boolean
  subtypes: Record<number, { checked: boolean; allSubtype: boolean; sections: Record<number, boolean>; allSection: boolean }>
  directSections: Record<number, boolean>
  directAllSection: boolean
}

function buildEligibility(
  gradeLevels: GradeLevel[],
  gradeSelections: Record<number, GradeSelection>,
  gradeStates: Record<number, GradeState>,
  checkedGradeIds: Set<number>,
): EligibilityRule[] {
  const rules: EligibilityRule[] = []

  for (const gradeId of Array.from(checkedGradeIds)) {
    const sel = gradeSelections[gradeId]
    if (!sel) continue
    const gl = gradeLevels.find((g) => g.id === gradeId)
    if (!gl) continue

    if (sel.allGrade) {
      rules.push({ grade_level_id: gradeId, subtype_id: null, section_id: null, is_all_grade: false, is_all_subtype: true, is_all_section: true, is_exclude: false })
      continue
    }

    const state = gradeStates[gradeId]
    const hasSubtypes = state?.subtypesLoaded && state.subtypes.length > 0

    if (!hasSubtypes) {
      // direct sections
      if (sel.directAllSection) {
        rules.push({ grade_level_id: gradeId, subtype_id: null, section_id: null, is_all_grade: false, is_all_subtype: true, is_all_section: true, is_exclude: false })
      } else {
        const directSections = state?.sections['direct'] ?? []
        for (const sec of directSections) {
          if (sel.directSections[sec.id]) {
            rules.push({ grade_level_id: gradeId, subtype_id: null, section_id: sec.id, is_all_grade: false, is_all_subtype: true, is_all_section: false, is_exclude: false })
          }
        }
      }
    } else {
      for (const st of state.subtypes) {
        const stSel = sel.subtypes[st.id]
        if (!stSel?.checked) continue

        if (stSel.allSubtype) {
          rules.push({ grade_level_id: gradeId, subtype_id: st.id, section_id: null, is_all_grade: false, is_all_subtype: false, is_all_section: true, is_exclude: false })
        } else {
          const stSections = state.sections[String(st.id)] ?? []
          for (const sec of stSections) {
            if (stSel.sections[sec.id]) {
              rules.push({ grade_level_id: gradeId, subtype_id: st.id, section_id: sec.id, is_all_grade: false, is_all_subtype: false, is_all_section: false, is_exclude: false })
            }
          }
        }
      }
    }
  }

  return rules
}

function GradeTargetingBuilder({
  onChange,
}: {
  value: EligibilityRule[]
  onChange: (rules: EligibilityRule[]) => void
}) {
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [loadingGrades, setLoadingGrades] = useState(true)
  const [isAllGrades, setIsAllGrades] = useState(false)
  const [checkedGradeIds, setCheckedGradeIds] = useState<Set<number>>(new Set())
  const [gradeStates, setGradeStates] = useState<Record<number, GradeState>>({})
  const [gradeSelections, setGradeSelections] = useState<Record<number, GradeSelection>>({})
  const [labels, setLabels] = useState({ l1: 'Group', l2: 'Subgroup', l3: 'Unit' })
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      fetch('/api/academic/grade-levels', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/settings', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([gradesJson, settingsJson]) => {
        const levels: GradeLevel[] = gradesJson.data?.gradeLevels ?? gradesJson.data?.grade_levels ?? gradesJson.data ?? []
        setGradeLevels(Array.isArray(levels) ? levels : [])
        const s: Record<string, string> = settingsJson.data ?? {}
        setLabels({
          l1: s.group_label_l1 ?? 'Group',
          l2: s.group_label_l2 ?? 'Subgroup',
          l3: s.group_label_l3 ?? 'Unit',
        })
      })
      .finally(() => setLoadingGrades(false))
  }, [])

  // Notify parent whenever selection changes
  useEffect(() => {
    if (isAllGrades) {
      onChange([{ grade_level_id: null, subtype_id: null, section_id: null, is_all_grade: true, is_all_subtype: true, is_all_section: true, is_exclude: false }])
      return
    }
    onChange(buildEligibility(gradeLevels, gradeSelections, gradeStates, checkedGradeIds))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllGrades, checkedGradeIds, gradeSelections, gradeStates])

  const fetchSubtypes = async (gradeId: number) => {
    setGradeStates((prev) => ({
      ...prev,
      [gradeId]: { ...prev[gradeId], subtypes: [], subtypesLoaded: false, sections: prev[gradeId]?.sections ?? {}, sectionsLoaded: prev[gradeId]?.sectionsLoaded ?? {} },
    }))
    try {
      const r = await fetch(`/api/academic/subtypes?gradeLevelId=${gradeId}`, { credentials: 'include' })
      const json = await r.json()
      const subtypes: GradeSubtype[] = json.data?.subtypes ?? json.data ?? []
      setGradeStates((prev) => ({
        ...prev,
        [gradeId]: { ...(prev[gradeId] ?? { sections: {}, sectionsLoaded: {} }), subtypes, subtypesLoaded: true },
      }))
      if (subtypes.length === 0) {
        // no subtypes — fetch direct sections
        fetchDirectSections(gradeId)
      }
    } catch {
      setGradeStates((prev) => ({
        ...prev,
        [gradeId]: { ...(prev[gradeId] ?? { sections: {}, sectionsLoaded: {} }), subtypes: [], subtypesLoaded: true },
      }))
    }
  }

  const fetchDirectSections = async (gradeId: number) => {
    try {
      const r = await fetch(`/api/academic/sections?gradeLevelId=${gradeId}`, { credentials: 'include' })
      const json = await r.json()
      const sections: Section[] = json.data?.sections ?? json.data ?? []
      setGradeStates((prev) => ({
        ...prev,
        [gradeId]: {
          ...(prev[gradeId] ?? { subtypes: [], subtypesLoaded: false, sectionsLoaded: {} }),
          sections: { ...(prev[gradeId]?.sections ?? {}), direct: sections },
          sectionsLoaded: { ...(prev[gradeId]?.sectionsLoaded ?? {}), direct: true },
        },
      }))
    } catch {}
  }

  const fetchSubtypeSections = async (gradeId: number, subtypeId: number) => {
    try {
      const r = await fetch(`/api/academic/sections?gradeLevelId=${gradeId}&subtypeId=${subtypeId}`, { credentials: 'include' })
      const json = await r.json()
      const sections: Section[] = json.data?.sections ?? json.data ?? []
      setGradeStates((prev) => ({
        ...prev,
        [gradeId]: {
          ...(prev[gradeId] ?? { subtypes: [], subtypesLoaded: false, sectionsLoaded: {} }),
          sections: { ...(prev[gradeId]?.sections ?? {}), [String(subtypeId)]: sections },
          sectionsLoaded: { ...(prev[gradeId]?.sectionsLoaded ?? {}), [String(subtypeId)]: true },
        },
      }))
    } catch {}
  }

  const handleAllGradesToggle = (checked: boolean) => {
    setIsAllGrades(checked)
    if (checked) {
      setCheckedGradeIds(new Set())
      setGradeSelections({})
    }
  }

  const handleGradeToggle = (gradeId: number, checked: boolean) => {
    setCheckedGradeIds((prev) => {
      const next = new Set(prev)
      if (checked) { next.add(gradeId) } else { next.delete(gradeId) }
      return next
    })
    if (checked) {
      setGradeSelections((prev) => ({
        ...prev,
        [gradeId]: prev[gradeId] ?? { allGrade: false, subtypes: {}, directSections: {}, directAllSection: false },
      }))
      fetchSubtypes(gradeId)
    }
  }

  const updateGradeSel = (gradeId: number, patch: Partial<GradeSelection>) => {
    setGradeSelections((prev) => ({ ...prev, [gradeId]: { ...(prev[gradeId] ?? { allGrade: false, subtypes: {}, directSections: {}, directAllSection: false }), ...patch } }))
  }

  if (loadingGrades) return <p className="text-sm text-gray-400">Loading {labels.l1.toLowerCase()} levels...</p>
  if (gradeLevels.length === 0) return <p className="text-sm text-gray-400">No {labels.l1.toLowerCase()} levels found.</p>

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{labels.l1} Levels</p>
      {/* All levels */}
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={isAllGrades} onChange={(e) => handleAllGradesToggle(e.target.checked)} className="w-4 h-4" />
        <span className="text-sm text-gray-700 font-medium">All {labels.l1} Levels</span>
      </label>

      {!isAllGrades && (
        <div className="ml-6 space-y-3">
          {gradeLevels.map((gl) => {
            const isChecked = checkedGradeIds.has(gl.id)
            const sel = gradeSelections[gl.id]
            const state = gradeStates[gl.id]

            return (
              <div key={gl.id}>
                {/* Grade row */}
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleGradeToggle(gl.id, e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 font-medium">{gl.name}</span>
                </label>

                {isChecked && sel && (
                  <div className="ml-6 mt-1.5 space-y-2">
                    {/* All of this grade */}
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={sel.allGrade}
                        onChange={(e) => updateGradeSel(gl.id, { allGrade: e.target.checked })}
                        className="w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-600 font-medium">All of {gl.name}</span>
                    </label>

                    {!sel.allGrade && state && (
                      <>
                        {!state.subtypesLoaded && (
                          <p className="text-xs text-gray-400 ml-1">Loading...</p>
                        )}

                        {/* Subtypes */}
                        {state.subtypesLoaded && state.subtypes.length > 0 && state.subtypes.map((st) => {
                          const stSel = sel.subtypes[st.id] ?? { checked: false, allSubtype: false, sections: {}, allSection: false }
                          return (
                            <div key={st.id}>
                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={stSel.checked}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    updateGradeSel(gl.id, {
                                      subtypes: { ...sel.subtypes, [st.id]: { ...stSel, checked } },
                                    })
                                    if (checked && !state.sectionsLoaded[String(st.id)]) {
                                      fetchSubtypeSections(gl.id, st.id)
                                    }
                                  }}
                                  className="w-3.5 h-3.5"
                                />
                                <span className="text-xs text-gray-700">{st.name}</span>
                              </label>

                              {stSel.checked && (
                                <div className="ml-6 mt-1 space-y-1">
                                  {/* All subtype sections */}
                                  <label className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={stSel.allSubtype}
                                      onChange={(e) => updateGradeSel(gl.id, {
                                        subtypes: { ...sel.subtypes, [st.id]: { ...stSel, allSubtype: e.target.checked } },
                                      })}
                                      className="w-3 h-3"
                                    />
                                    <span className="text-xs text-gray-500">All {st.name} {labels.l3}s</span>
                                  </label>

                                  {!stSel.allSubtype && (
                                    <>
                                      {!state.sectionsLoaded[String(st.id)] && <p className="text-xs text-gray-400">Loading sections...</p>}
                                      {(state.sections[String(st.id)] ?? []).map((sec) => (
                                        <label key={sec.id} className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={stSel.sections[sec.id] ?? false}
                                            onChange={(e) => updateGradeSel(gl.id, {
                                              subtypes: {
                                                ...sel.subtypes,
                                                [st.id]: { ...stSel, sections: { ...stSel.sections, [sec.id]: e.target.checked } },
                                              },
                                            })}
                                            className="w-3 h-3"
                                          />
                                          <span className="text-xs text-gray-600">{sec.name}</span>
                                        </label>
                                      ))}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Direct sections (no subtypes) */}
                        {state.subtypesLoaded && state.subtypes.length === 0 && (
                          <div className="space-y-1">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={sel.directAllSection}
                                onChange={(e) => updateGradeSel(gl.id, { directAllSection: e.target.checked })}
                                className="w-3 h-3"
                              />
                              <span className="text-xs text-gray-500">All {labels.l3}s</span>
                            </label>
                            {!sel.directAllSection && (
                              <>
                                {!state.sectionsLoaded['direct'] && <p className="text-xs text-gray-400">Loading sections...</p>}
                                {(state.sections['direct'] ?? []).map((sec) => (
                                  <label key={sec.id} className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={sel.directSections[sec.id] ?? false}
                                      onChange={(e) => updateGradeSel(gl.id, {
                                        directSections: { ...sel.directSections, [sec.id]: e.target.checked },
                                      })}
                                      className="w-3 h-3"
                                    />
                                    <span className="text-xs text-gray-600">{sec.name}</span>
                                  </label>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ElectionFormModal ────────────────────────────────────────────────────────

interface ElectionFormModalProps {
  open: boolean
  election: Election | null
  formData: ElectionForm
  saving: boolean
  studentSearches: Record<string, string>
  studentDropdowns: Record<string, StudentResult[]>
  onClose: () => void
  onDiscard?: () => void
  onSave: () => void
  onFormChange: (updates: Partial<ElectionForm>) => void
  onAddPosition: () => void
  onUpdatePosition: (pi: number, updates: Partial<PositionForm>) => void
  onRemovePosition: (pi: number) => void
  onAddCandidate: (pi: number) => void
  onUpdateCandidate: (pi: number, ci: number, updates: Partial<CandidateForm>) => void
  onRemoveCandidate: (pi: number, ci: number) => void
  onSearchStudents: (key: string, q: string) => void
  onClearStudentSearch: (key: string) => void
}

export default function ElectionFormModal({
  open,
  election,
  formData,
  saving,
  studentSearches,
  studentDropdowns,
  onClose,
  onDiscard,
  onSave,
  onFormChange,
  onAddPosition,
  onUpdatePosition,
  onRemovePosition,
  onAddCandidate,
  onUpdateCandidate,
  onRemoveCandidate,
  onSearchStudents,
  onClearStudentSearch,
}: ElectionFormModalProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)

  useEffect(() => {
    if (!open) setConfirmDiscard(false)
  }, [open])

  const handleThumbnailUpload = async (file: File) => {
    setThumbnailUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/elections/upload-thumbnail', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const json = await res.json()
      if (res.ok && json.url) {
        onFormChange({ thumbnail_url: json.url })
      }
    } finally {
      setThumbnailUploading(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={election ? 'Edit Election' : 'New Election'}
      size="lg"
      footer={
        <>
          {!election ? (
            <Button variant="secondary" onClick={() => setConfirmDiscard(true)} disabled={saving}>
              Discard Draft
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          )}
          <Button onClick={onSave} loading={saving}>
            {election ? 'Save Changes' : 'Create Election'}
          </Button>
        </>
      }
    >
      {confirmDiscard && !election && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-800">Discard all draft progress? This cannot be undone.</span>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => { setConfirmDiscard(false); onDiscard?.() }}
              className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Basic Information
          </h3>
          <div className="space-y-4">
            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
              <p className="text-xs text-gray-400 mb-2">Recommended: 1200×630px</p>
              {formData.thumbnail_url ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={formData.thumbnail_url}
                    alt="Cover"
                    className="w-full h-32 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => onFormChange({ thumbnail_url: null })}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1.5 shadow-sm transition-colors"
                    title="Remove image"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${thumbnailUploading ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-gray-300 hover:border-[#84050C] hover:bg-[#FEE2E2]/20'}`}>
                  {thumbnailUploading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <svg className="w-7 h-7 text-gray-300 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-400">Click to upload cover image</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={thumbnailUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleThumbnailUpload(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => onFormChange({ title: e.target.value })}
                placeholder="e.g. Student Council Election 2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => onFormChange({ description: e.target.value })}
                rows={3}
                placeholder="Optional description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => onFormChange({ start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => onFormChange({ end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => onFormChange({ status: e.target.value as ElectionStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Eligibility Section */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Eligibility</h3>

          {/* Global toggle */}
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={formData.is_global}
              onChange={(e) => onFormChange({ is_global: e.target.checked, eligibility: [], ...(e.target.checked && { allow_teacher_vote: true }) })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Global Election (all verified members can vote)</span>
          </label>

          {/* Grade targeting — shown when global=false */}
          {!formData.is_global && (
            <GradeTargetingBuilder
              value={formData.eligibility}
              onChange={(eligibility) => onFormChange({ eligibility })}
            />
          )}
        </div>

        {/* Positions */}
        <PositionManager
          positions={formData.positions}
          electionId={election?.id}
          studentSearches={studentSearches}
          studentDropdowns={studentDropdowns}
          onAddPosition={onAddPosition}
          onUpdatePosition={onUpdatePosition}
          onRemovePosition={onRemovePosition}
          onAddCandidate={onAddCandidate}
          onUpdateCandidate={onUpdateCandidate}
          onRemoveCandidate={onRemoveCandidate}
          onSearchStudents={onSearchStudents}
          onClearStudentSearch={onClearStudentSearch}
        />
      </div>
    </Modal>
  )
}
