'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
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
}

// ── GradeTargetingBuilder ────────────────────────────────────────────────────

function GradeTargetingBuilder({
  value,
  onChange,
}: {
  value: EligibilityRule[]
  onChange: (rules: EligibilityRule[]) => void
}) {
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [loadingGrades, setLoadingGrades] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch('/api/academic/grade-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const levels: GradeLevel[] = json.data?.gradeLevels ?? json.data?.grade_levels ?? json.data ?? []
        setGradeLevels(Array.isArray(levels) ? levels : [])
      })
      .catch(() => {})
      .finally(() => setLoadingGrades(false))
  }, [])

  const isAllGrade = value.length === 1 && value[0].is_all_grade
  const selectedIds = new Set(value.filter((r) => !r.is_all_grade).map((r) => r.grade_level_id))

  const handleAllGrade = (checked: boolean) => {
    if (checked) {
      onChange([{ grade_level_id: null, subtype_id: null, section_id: null, is_all_grade: true, is_all_subtype: true, is_all_section: true, is_exclude: false }])
    } else {
      onChange([])
    }
  }

  const handleGradeToggle = (id: number, checked: boolean) => {
    if (checked) {
      onChange([...value, { grade_level_id: id, subtype_id: null, section_id: null, is_all_grade: false, is_all_subtype: true, is_all_section: true, is_exclude: false }])
    } else {
      onChange(value.filter((r) => r.grade_level_id !== id))
    }
  }

  if (loadingGrades) {
    return <p className="text-sm text-gray-400">Loading grade levels...</p>
  }

  if (gradeLevels.length === 0) {
    return <p className="text-sm text-gray-400">No grade levels found.</p>
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isAllGrade}
          onChange={(e) => handleAllGrade(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm text-gray-700 font-medium">All Grade Levels</span>
      </label>

      {!isAllGrade && (
        <div className="ml-6 space-y-1.5">
          {gradeLevels.map((gl) => (
            <label key={gl.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(gl.id)}
                onChange={(e) => handleGradeToggle(gl.id, e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">{gl.name}</span>
            </label>
          ))}
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
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={election ? 'Edit Election' : 'New Election'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} loading={saving}>
            {election ? 'Save Changes' : 'Create Election'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Basic Information
          </h3>
          <div className="space-y-4">
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
              onChange={(e) => onFormChange({ is_global: e.target.checked, eligibility: [] })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Global Election (all students can vote)</span>
          </label>

          {/* Teachers can vote — shown when global=true */}
          {formData.is_global && (
            <label className="flex items-center gap-3 mb-3 ml-6">
              <input
                type="checkbox"
                checked={formData.allow_teacher_vote}
                onChange={(e) => onFormChange({ allow_teacher_vote: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Teachers Can Vote</span>
            </label>
          )}

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
