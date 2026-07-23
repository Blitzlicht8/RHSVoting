'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import DateTimePicker from '@/components/ui/DateTimePicker'
import PositionManager, { PositionForm } from './PositionManager'
import { CandidateForm, StudentResult } from './CandidateManager'

// ── Shared types ────────────────────────────────────────────────────────────

export type ElectionStatus = 'draft' | 'active' | 'ended'

export interface EligibilityRule {
  structure_id: number | null
  value_id: number | null
  is_all_groups: boolean
  is_exclude: boolean
}

export interface GroupValue {
  id: number
  structure_id: number
  parent_value_id: number | null
  name: string
  order_index: number
  active: boolean
}

export interface StructureWithValues {
  id: number
  name: string
  parent_structure_id: number | null
  is_required: boolean
  order_index: number
  active: boolean
  values: GroupValue[]
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
  auto_start: boolean
  auto_end: boolean
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

// ── GroupEligibilityBuilder ──────────────────────────────────────────────────

interface StructureSelection {
  allStructure: boolean
  valueIds: Set<number>
}

// For a leveled structure, the set of parent values currently selected (which
// gate which of this structure's values are shown/valid). Returns null for a
// standalone structure (no parent → no gating). An empty set means the parent
// has no selection yet, so none of this structure's values apply.
function parentSelectedValueIds(
  structures: StructureWithValues[],
  selections: Record<number, StructureSelection>,
  s: StructureWithValues,
): Set<number> | null {
  if (s.parent_structure_id == null) return null
  const parent = structures.find((p) => p.id === s.parent_structure_id)
  if (!parent) return null
  const psel = selections[parent.id]
  if (!psel) return new Set<number>()
  if (psel.allStructure) return new Set(parent.values.filter((v) => v.active).map((v) => v.id))
  return new Set(psel.valueIds)
}

function buildEligibility(
  structures: StructureWithValues[],
  selections: Record<number, StructureSelection>,
): EligibilityRule[] {
  const rules: EligibilityRule[] = []
  for (const s of structures) {
    const sel = selections[s.id]
    if (!sel) continue
    // A leveled structure only contributes rules once its parent is selected;
    // this also drops stale selections left over from a since-deselected parent.
    const parentSet = parentSelectedValueIds(structures, selections, s)
    if (parentSet !== null && parentSet.size === 0) continue
    if (sel.allStructure) {
      rules.push({ structure_id: s.id, value_id: null, is_all_groups: false, is_exclude: false })
      continue
    }
    for (const valueId of Array.from(sel.valueIds)) {
      if (parentSet !== null) {
        const v = s.values.find((x) => x.id === valueId)
        if (!v || v.parent_value_id == null || !parentSet.has(v.parent_value_id)) continue
      }
      rules.push({ structure_id: s.id, value_id: valueId, is_all_groups: false, is_exclude: false })
    }
  }
  return rules
}

function GroupEligibilityBuilder({
  value,
  onChange,
}: {
  value: EligibilityRule[]
  onChange: (rules: EligibilityRule[]) => void
}) {
  const [structures, setStructures] = useState<StructureWithValues[]>([])
  const [loading, setLoading] = useState(true)
  const [isAllGroups, setIsAllGroups] = useState(false)
  const [selections, setSelections] = useState<Record<number, StructureSelection>>({})
  const fetchedRef = useRef(false)
  const restoredRef = useRef(false)
  const initialValueRef = useRef(value)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch('/api/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const data: StructureWithValues[] = Array.isArray(json.data) ? json.data : []
        const active = data
          .filter((s) => s.active)
          .sort((a, b) => a.order_index - b.order_index)
        setStructures(active)
      })
      .catch(() => setStructures([]))
      .finally(() => setLoading(false))
  }, [])

  // Restore UI state from saved eligibility rules once structures are available.
  useEffect(() => {
    const saved = initialValueRef.current
    if (restoredRef.current || structures.length === 0 || saved.length === 0) return
    restoredRef.current = true

    if (saved.some((r) => r.is_all_groups)) {
      setIsAllGroups(true)
      return
    }

    const next: Record<number, StructureSelection> = {}
    for (const rule of saved) {
      if (rule.is_exclude || rule.structure_id == null) continue
      const cur = next[rule.structure_id] ?? { allStructure: false, valueIds: new Set<number>() }
      if (rule.value_id == null) {
        cur.allStructure = true
      } else {
        cur.valueIds.add(rule.value_id)
      }
      next[rule.structure_id] = cur
    }
    setSelections(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structures.length])

  // Notify parent whenever selection changes.
  // Suppressed before restoration completes so the on-mount empty state
  // does not overwrite the saved eligibility in the parent's formData.
  useEffect(() => {
    if (!restoredRef.current && initialValueRef.current.length > 0) return
    if (isAllGroups) {
      onChange([{ structure_id: null, value_id: null, is_all_groups: true, is_exclude: false }])
      return
    }
    onChange(buildEligibility(structures, selections))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllGroups, selections, structures])

  const toggleAllStructure = (structureId: number, checked: boolean) => {
    setSelections((prev) => ({
      ...prev,
      [structureId]: { allStructure: checked, valueIds: checked ? new Set<number>() : (prev[structureId]?.valueIds ?? new Set<number>()) },
    }))
  }

  const toggleValue = (structureId: number, valueId: number, checked: boolean) => {
    setSelections((prev) => {
      const cur = prev[structureId] ?? { allStructure: false, valueIds: new Set<number>() }
      const nextIds = new Set(cur.valueIds)
      if (checked) { nextIds.add(valueId) } else { nextIds.delete(valueId) }
      return { ...prev, [structureId]: { allStructure: false, valueIds: nextIds } }
    })
  }

  if (loading) return <p className="text-sm text-gray-400">Loading groups...</p>
  if (structures.length === 0) return <p className="text-sm text-gray-400">No groups configured.</p>

  return (
    <div className="space-y-3">
      {/* All groups */}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isAllGroups}
          onChange={(e) => setIsAllGroups(e.target.checked)}
          className="w-4 h-4 accent-[#84050C]"
        />
        <span className="text-sm text-gray-700 font-medium">All groups (everyone)</span>
      </label>

      {!isAllGroups && (
        <div className="ml-6 space-y-4">
          {structures.map((s) => {
            const sel = selections[s.id] ?? { allStructure: false, valueIds: new Set<number>() }
            const parentSet = parentSelectedValueIds(structures, selections, s)
            // Leveled structures only render values whose parent value is selected.
            const scopedValues = s.values
              .filter((v) => v.active && (parentSet === null || (v.parent_value_id != null && parentSet.has(v.parent_value_id))))
              .sort((a, b) => a.order_index - b.order_index)
            const parent = s.parent_structure_id != null
              ? structures.find((p) => p.id === s.parent_structure_id)
              : undefined
            const parentName = parent?.name ?? 'parent group'
            const awaitingParent = parentSet !== null && parentSet.size === 0
            // For leveled structures, group values under their parent value so
            // repeated names (e.g. Section A under each Strand) stay distinct.
            const parentGroups = parent && parentSet
              ? parent.values
                  .filter((pv) => pv.active && parentSet.has(pv.id))
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((pv) => ({ pv, children: scopedValues.filter((v) => v.parent_value_id === pv.id) }))
                  .filter((g) => g.children.length > 0)
              : null
            const valueCheckbox = (v: GroupValue) => (
              <label key={v.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={sel.valueIds.has(v.id)}
                  onChange={(e) => toggleValue(s.id, v.id, e.target.checked)}
                  className="w-3 h-3 accent-[#84050C]"
                />
                <span className="text-xs text-gray-600">{v.name}</span>
              </label>
            )
            return (
              <div key={s.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.name}</p>
                {awaitingParent ? (
                  <p className="ml-1 text-xs text-gray-400 italic">Select a {parentName} above to choose {s.name.toLowerCase()}.</p>
                ) : (
                  <>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={sel.allStructure}
                        onChange={(e) => toggleAllStructure(s.id, e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#84050C]"
                      />
                      <span className="text-xs text-gray-600 font-medium">All of {s.name}</span>
                    </label>
                    {!sel.allStructure && (
                      <div className="ml-6 space-y-2">
                        {scopedValues.length === 0 && (
                          <p className="text-xs text-gray-400">No values.</p>
                        )}
                        {parentGroups
                          ? parentGroups.map((g) => (
                              <div key={g.pv.id} className="space-y-1">
                                <p className="text-[11px] font-medium text-gray-400">{g.pv.name}</p>
                                <div className="ml-3 space-y-1">
                                  {g.children.map((v) => valueCheckbox(v))}
                                </div>
                              </div>
                            ))
                          : <div className="space-y-1">{scopedValues.map((v) => valueCheckbox(v))}</div>}
                      </div>
                    )}
                  </>
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
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (!open) { setConfirmDiscard(false); setIsDirty(false) }
  }, [open])

  const handleFormChange = (updates: Partial<ElectionForm>) => {
    setIsDirty(true)
    onFormChange(updates)
  }

  const handleClose = () => {
    if (isDirty) {
      setConfirmDiscard(true)
    } else {
      onClose()
    }
  }

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
        handleFormChange({ thumbnail_url: json.url })
      }
    } finally {
      setThumbnailUploading(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title={election ? 'Edit Election' : 'New Election'}
      size="lg"
      footer={
        <>
          {!election ? (
            <Button variant="secondary" onClick={() => setConfirmDiscard(true)} disabled={saving}>
              Discard Draft
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
          )}
          <Button onClick={onSave} loading={saving}>
            {election ? 'Save Changes' : 'Create Election'}
          </Button>
        </>
      }
    >
      {confirmDiscard && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-800">
            {!election
              ? 'Discard all draft progress? This cannot be undone.'
              : 'You have unsaved changes. Close without saving?'}
          </span>
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
              onClick={() => {
                setConfirmDiscard(false)
                if (!election) { onDiscard?.() } else { onClose() }
              }}
              className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              {!election ? 'Discard' : 'Close'}
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
                    onClick={() => handleFormChange({ thumbnail_url: null })}
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
                onChange={(e) => handleFormChange({ title: e.target.value })}
                placeholder="e.g. Student Council Election 2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFormChange({ description: e.target.value })}
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
                <DateTimePicker
                  value={formData.start_date}
                  onChange={(v) => handleFormChange({ start_date: v })}
                  placeholder="Pick start date & time"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <DateTimePicker
                  value={formData.end_date}
                  onChange={(v) => handleFormChange({ end_date: v })}
                  min={formData.start_date || undefined}
                  placeholder="Pick end date & time"
                />
              </div>
            </div>

            {/* Auto-start / Auto-end toggles */}
            {formData.status !== 'ended' && (
              <div className="space-y-3 pt-1">
                {formData.status === 'draft' && (
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.auto_start}
                      onClick={() => handleFormChange({ auto_start: !formData.auto_start })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:ring-offset-1 mt-0.5 ${formData.auto_start ? 'bg-[#84050C]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.auto_start ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Auto-start</p>
                      <p className="text-xs text-gray-400 mt-0.5">Automatically activate at the start date &amp; time. If already past, activates immediately on save.</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.auto_end}
                    onClick={() => handleFormChange({ auto_end: !formData.auto_end })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:ring-offset-1 mt-0.5 ${formData.auto_end ? 'bg-[#84050C]' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.auto_end ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Auto-end</p>
                    <p className="text-xs text-gray-400 mt-0.5">Automatically end at the end date &amp; time. If already past, ends immediately on save.</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleFormChange({ status: e.target.value as ElectionStatus })}
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
              onChange={(e) => handleFormChange({ is_global: e.target.checked, eligibility: [], ...(e.target.checked && { allow_teacher_vote: true }) })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Global Election (all verified members can vote)</span>
          </label>

          {/* Group targeting — shown when global=false */}
          {!formData.is_global && (
            <GroupEligibilityBuilder
              key={`${election?.id ?? 'new'}-${open}`}
              value={formData.eligibility}
              onChange={(eligibility) => handleFormChange({ eligibility })}
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
