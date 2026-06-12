'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'

interface GradeLevel { id: number; name: string; order_index: number; active: number }
interface Subtype { id: number; grade_level_id: number; name: string; order_index: number; active: number }
interface Section { id: number; grade_level_id: number; subtype_id: number | null; name: string; active: number }
interface Teacher { id: number; name: string; email: string }
interface Assignment { id: number; teacher_id: number; grade_level_id: number | null; subtype_id: number | null; section_id: number | null; gl_name: string | null; sub_name: string | null; sec_name: string | null }

function requireAdmin(role?: string) {
  return role === 'master_admin' || role === 'teacher_admin'
}

interface DeleteConfirmModal {
  type: 'grade' | 'subtype' | 'section'
  id: number
  name: string
  userCount: number
  apiPath: string
}

export default function AcademicStructurePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [subtypes, setSubtypes] = useState<Subtype[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [userCounts, setUserCounts] = useState<Record<number, number>>({})

  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null)
  const [selectedSubtype, setSelectedSubtype] = useState<Subtype | null>(null)

  const [loadingGrades, setLoadingGrades] = useState(true)
  const [loadingSubtypes, setLoadingSubtypes] = useState(false)
  const [loadingSections, setLoadingSections] = useState(false)

  const [newGradeName, setNewGradeName] = useState('')
  const [newSubtypeName, setNewSubtypeName] = useState('')
  const [newSectionName, setNewSectionName] = useState('')

  const [editingGrade, setEditingGrade] = useState<{ id: number; name: string } | null>(null)
  const [editingSubtype, setEditingSubtype] = useState<{ id: number; name: string } | null>(null)
  const [editingSection, setEditingSection] = useState<{ id: number; name: string } | null>(null)

  const [saving, setSaving] = useState(false)

  // Safe delete modal
  const [deleteModal, setDeleteModal] = useState<DeleteConfirmModal | null>(null)
  const [deleteConfirm2, setDeleteConfirm2] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Teacher Assignments panel
  const [assignmentsOpen, setAssignmentsOpen] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [addGl, setAddGl] = useState<number | ''>('')
  const [addSub, setAddSub] = useState<number | ''>('')
  const [addSec, setAddSec] = useState<number | ''>('')
  const [addingAssignment, setAddingAssignment] = useState(false)
  const [assignSubtypes, setAssignSubtypes] = useState<Subtype[]>([])
  const [assignSections, setAssignSections] = useState<Section[]>([])

  useEffect(() => {
    if (user && !requireAdmin(user.role)) router.replace('/dashboard')
  }, [user, router])

  const fetchGrades = useCallback(async () => {
    setLoadingGrades(true)
    const [gradeRes, countRes] = await Promise.all([
      fetch('/api/admin/academic/grade-levels'),
      fetch('/api/admin/academic/grade-levels/user-counts').catch(() => null),
    ])
    const gradeJson = await gradeRes.json()
    setGradeLevels(gradeJson.data ?? [])
    // user-counts endpoint may not exist; fall back to inline count from grades
    if (countRes?.ok) {
      const cj = await countRes.json()
      const map: Record<number, number> = {}
      for (const row of cj.data ?? []) map[row.grade_level_id] = Number(row.cnt)
      setUserCounts(map)
    } else {
      // Fetch counts via a separate query inline
      try {
        const cr = await fetch('/api/admin/academic/grade-levels?includeCounts=1')
        const cj = await cr.json()
        if (cj.counts) setUserCounts(cj.counts)
      } catch { /* silent */ }
    }
    setLoadingGrades(false)
  }, [])

  const fetchUserCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/students?countByGrade=1')
      const json = await res.json()
      if (json.counts) setUserCounts(json.counts)
    } catch { /* silent */ }
  }, [])

  const fetchSubtypes = useCallback(async (gradeLevelId: number) => {
    setLoadingSubtypes(true)
    const res = await fetch(`/api/admin/academic/subtypes?gradeLevelId=${gradeLevelId}`)
    const json = await res.json()
    setSubtypes(json.data ?? [])
    setLoadingSubtypes(false)
  }, [])

  const fetchSections = useCallback(async (gradeLevelId: number, subtypeId?: number | null) => {
    setLoadingSections(true)
    const url = subtypeId != null
      ? `/api/admin/academic/sections?gradeLevelId=${gradeLevelId}&subtypeId=${subtypeId}`
      : `/api/admin/academic/sections?gradeLevelId=${gradeLevelId}`
    const res = await fetch(url)
    const json = await res.json()
    setSections(json.data ?? [])
    setLoadingSections(false)
  }, [])

  useEffect(() => { fetchGrades() }, [fetchGrades])

  const selectGrade = (gl: GradeLevel) => {
    setSelectedGrade(gl)
    setSelectedSubtype(null)
    setSections([])
    setEditingSubtype(null)
    setEditingSection(null)
    fetchSubtypes(gl.id)
    fetchSections(gl.id, null)
  }

  const selectSubtype = (st: Subtype) => {
    setSelectedSubtype(st)
    setEditingSection(null)
    if (selectedGrade) fetchSections(selectedGrade.id, st.id)
  }

  const clearSubtype = () => {
    setSelectedSubtype(null)
    setEditingSection(null)
    if (selectedGrade) fetchSections(selectedGrade.id, null)
  }

  // --- Grade Level CRUD ---
  const addGrade = async () => {
    if (!newGradeName.trim() || saving) return
    setSaving(true)
    await fetch('/api/admin/academic/grade-levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGradeName.trim() }),
    })
    setNewGradeName('')
    await fetchGrades()
    setSaving(false)
  }

  const saveGrade = async () => {
    if (!editingGrade || saving) return
    setSaving(true)
    await fetch(`/api/admin/academic/grade-levels/${editingGrade.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingGrade.name }),
    })
    setEditingGrade(null)
    await fetchGrades()
    setSaving(false)
  }

  const deleteGrade = async (gl: GradeLevel) => {
    const res = await fetch(`/api/admin/academic/grade-levels/${gl.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const json = await res.json()
      setDeleteModal({ type: 'grade', id: gl.id, name: gl.name, userCount: json.userCount, apiPath: `/api/admin/academic/grade-levels/${gl.id}` })
      setDeleteConfirm2(false)
      return
    }
    if (selectedGrade?.id === gl.id) { setSelectedGrade(null); setSubtypes([]); setSections([]) }
    await fetchGrades()
  }

  const forceDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    await fetch(`${deleteModal.apiPath}?force=true`, { method: 'DELETE' })
    setDeleteModal(null)
    setDeleteConfirm2(false)
    if (deleteModal.type === 'grade' && selectedGrade?.id === deleteModal.id) {
      setSelectedGrade(null); setSubtypes([]); setSections([])
    }
    if (deleteModal.type === 'subtype' && selectedSubtype?.id === deleteModal.id) clearSubtype()
    await fetchGrades()
    if (selectedGrade && deleteModal.type === 'subtype') await fetchSubtypes(selectedGrade.id)
    if (selectedGrade && deleteModal.type === 'section') await fetchSections(selectedGrade.id, selectedSubtype?.id ?? null)
    setDeleting(false)
  }

  // --- Subtype CRUD ---
  const addSubtype = async () => {
    if (!newSubtypeName.trim() || !selectedGrade || saving) return
    setSaving(true)
    await fetch('/api/admin/academic/subtypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSubtypeName.trim(), grade_level_id: selectedGrade.id }),
    })
    setNewSubtypeName('')
    await fetchSubtypes(selectedGrade.id)
    setSaving(false)
  }

  const saveSubtype = async () => {
    if (!editingSubtype || saving) return
    setSaving(true)
    await fetch(`/api/admin/academic/subtypes/${editingSubtype.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingSubtype.name }),
    })
    setEditingSubtype(null)
    if (selectedGrade) await fetchSubtypes(selectedGrade.id)
    setSaving(false)
  }

  const deleteSubtype = async (st: Subtype) => {
    const res = await fetch(`/api/admin/academic/subtypes/${st.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const json = await res.json()
      setDeleteModal({ type: 'subtype', id: st.id, name: st.name, userCount: json.userCount, apiPath: `/api/admin/academic/subtypes/${st.id}` })
      setDeleteConfirm2(false)
      return
    }
    if (selectedSubtype?.id === st.id) clearSubtype()
    if (selectedGrade) await fetchSubtypes(selectedGrade.id)
  }

  // --- Section CRUD ---
  const addSection = async () => {
    if (!newSectionName.trim() || !selectedGrade || saving) return
    setSaving(true)
    await fetch('/api/admin/academic/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newSectionName.trim(),
        grade_level_id: selectedGrade.id,
        subtype_id: selectedSubtype?.id ?? null,
      }),
    })
    setNewSectionName('')
    await fetchSections(selectedGrade.id, selectedSubtype?.id ?? null)
    setSaving(false)
  }

  const saveSection = async () => {
    if (!editingSection || saving) return
    setSaving(true)
    await fetch(`/api/admin/academic/sections/${editingSection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingSection.name }),
    })
    setEditingSection(null)
    if (selectedGrade) await fetchSections(selectedGrade.id, selectedSubtype?.id ?? null)
    setSaving(false)
  }

  const deleteSection = async (sec: Section) => {
    const res = await fetch(`/api/admin/academic/sections/${sec.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const json = await res.json()
      setDeleteModal({ type: 'section', id: sec.id, name: sec.name, userCount: json.userCount, apiPath: `/api/admin/academic/sections/${sec.id}` })
      setDeleteConfirm2(false)
      return
    }
    if (selectedGrade) await fetchSections(selectedGrade.id, selectedSubtype?.id ?? null)
  }

  // --- Teacher Assignments ---
  const fetchTeachers = useCallback(async () => {
    const res = await fetch('/api/users?role=teacher&limit=100')
    const json = await res.json()
    setTeachers(json.data?.users ?? json.data ?? [])
  }, [])

  const fetchAssignments = useCallback(async (teacherId: number) => {
    setLoadingAssignments(true)
    const res = await fetch(`/api/admin/teacher-assignments?teacherId=${teacherId}`)
    const json = await res.json()
    setAssignments(json.data ?? [])
    setLoadingAssignments(false)
  }, [])

  useEffect(() => {
    if (assignmentsOpen && teachers.length === 0) fetchTeachers()
  }, [assignmentsOpen, teachers.length, fetchTeachers])

  useEffect(() => {
    if (selectedTeacher) fetchAssignments(selectedTeacher.id)
  }, [selectedTeacher, fetchAssignments])

  useEffect(() => {
    if (addGl !== '') {
      fetch(`/api/admin/academic/subtypes?gradeLevelId=${addGl}`).then(r => r.json()).then(j => setAssignSubtypes(j.data ?? []))
      fetch(`/api/admin/academic/sections?gradeLevelId=${addGl}`).then(r => r.json()).then(j => setAssignSections(j.data ?? []))
      setAddSub('')
      setAddSec('')
    } else {
      setAssignSubtypes([])
      setAssignSections([])
    }
  }, [addGl])

  const addAssignment = async () => {
    if (!selectedTeacher || addingAssignment) return
    setAddingAssignment(true)
    await fetch('/api/admin/teacher-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: selectedTeacher.id,
        grade_level_id: addGl !== '' ? Number(addGl) : null,
        subtype_id: addSub !== '' ? Number(addSub) : null,
        section_id: addSec !== '' ? Number(addSec) : null,
      }),
    })
    setAddGl('')
    setAddSub('')
    setAddSec('')
    await fetchAssignments(selectedTeacher.id)
    setAddingAssignment(false)
  }

  const removeAssignment = async (id: number) => {
    await fetch(`/api/admin/teacher-assignments/${id}`, { method: 'DELETE' })
    if (selectedTeacher) await fetchAssignments(selectedTeacher.id)
  }

  if (!user || !requireAdmin(user.role)) return null

  const typeLabel = (m: DeleteConfirmModal) => m.type === 'grade' ? 'grade level' : m.type === 'subtype' ? 'subtype' : 'section'

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Academic Structure</h1>
        <p className="text-gray-400 text-sm mb-6">Manage grade levels, subtypes, and sections.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Panel 1: Grade Levels */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-200">Grade Levels</h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
              {loadingGrades ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading…</div>
              ) : gradeLevels.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No grade levels yet.</div>
              ) : (
                gradeLevels.map((gl) => (
                  <div
                    key={gl.id}
                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer group transition-colors ${
                      selectedGrade?.id === gl.id
                        ? 'border-l-2 border-[#84050C] bg-[#FEE2E2]/10'
                        : 'hover:bg-gray-800'
                    }`}
                    onClick={() => { if (!editingGrade || editingGrade.id !== gl.id) selectGrade(gl) }}
                  >
                    {editingGrade?.id === gl.id ? (
                      <>
                        <input
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#84050C]"
                          value={editingGrade.name}
                          onChange={(e) => setEditingGrade({ ...editingGrade, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveGrade(); if (e.key === 'Escape') setEditingGrade(null) }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button onClick={(e) => { e.stopPropagation(); saveGrade() }} disabled={saving} className="text-xs text-green-400 hover:text-green-300 px-1">Save</button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingGrade(null) }} className="text-xs text-gray-400 hover:text-white px-1">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm truncate ${selectedGrade?.id === gl.id ? 'text-[#F87171] font-medium' : 'text-gray-300'}`}>{gl.name}</span>
                        {userCounts[gl.id] != null && userCounts[gl.id] > 0 && (
                          <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-2 py-0.5">{userCounts[gl.id]}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingGrade({ id: gl.id, name: gl.name }) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity p-1"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.293-9.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L9 13z" /></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteGrade(gl) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity p-1"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="px-3 py-2.5 border-t border-gray-800 flex gap-2">
              <input
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#84050C]"
                placeholder="New grade level…"
                value={newGradeName}
                onChange={(e) => setNewGradeName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addGrade() }}
              />
              <button
                onClick={addGrade}
                disabled={!newGradeName.trim() || saving}
                className="px-3 py-1.5 bg-[#84050C] text-white text-sm rounded hover:bg-[#9e0610] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Panel 2: Subtypes */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-200">
                {selectedGrade ? `${selectedGrade.name} — Subtypes` : 'Subtypes'}
                <span className="ml-1 text-gray-500 font-normal">(optional)</span>
              </h2>
            </div>
            {!selectedGrade ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-gray-500 text-sm">
                Select a grade level to manage its subtypes.
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                      selectedSubtype === null
                        ? 'border-l-2 border-[#84050C] bg-[#FEE2E2]/10'
                        : 'hover:bg-gray-800'
                    }`}
                    onClick={clearSubtype}
                  >
                    <span className={`flex-1 text-sm italic ${selectedSubtype === null ? 'text-[#F87171]' : 'text-gray-500'}`}>
                      (no subtype)
                    </span>
                  </div>
                  {loadingSubtypes ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Loading…</div>
                  ) : subtypes.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No subtypes. Sections can be added directly.</div>
                  ) : (
                    subtypes.map((st) => (
                      <div
                        key={st.id}
                        className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer group transition-colors ${
                          selectedSubtype?.id === st.id
                            ? 'border-l-2 border-[#84050C] bg-[#FEE2E2]/10'
                            : 'hover:bg-gray-800'
                        }`}
                        onClick={() => { if (!editingSubtype || editingSubtype.id !== st.id) selectSubtype(st) }}
                      >
                        {editingSubtype?.id === st.id ? (
                          <>
                            <input
                              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#84050C]"
                              value={editingSubtype.name}
                              onChange={(e) => setEditingSubtype({ ...editingSubtype, name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveSubtype(); if (e.key === 'Escape') setEditingSubtype(null) }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); saveSubtype() }} disabled={saving} className="text-xs text-green-400 hover:text-green-300 px-1">Save</button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingSubtype(null) }} className="text-xs text-gray-400 hover:text-white px-1">Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className={`flex-1 text-sm truncate ${selectedSubtype?.id === st.id ? 'text-[#F87171] font-medium' : 'text-gray-300'}`}>{st.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingSubtype({ id: st.id, name: st.name }) }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity p-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.293-9.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L9 13z" /></svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteSubtype(st) }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity p-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="px-3 py-2.5 border-t border-gray-800 flex gap-2">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#84050C]"
                    placeholder="New subtype…"
                    value={newSubtypeName}
                    onChange={(e) => setNewSubtypeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addSubtype() }}
                  />
                  <button
                    onClick={addSubtype}
                    disabled={!newSubtypeName.trim() || saving}
                    className="px-3 py-1.5 bg-[#84050C] text-white text-sm rounded hover:bg-[#9e0610] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Panel 3: Sections */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-200">
                Sections
                {selectedSubtype && <span className="ml-1 text-gray-400 font-normal">— {selectedSubtype.name}</span>}
                {!selectedSubtype && selectedGrade && <span className="ml-1 text-gray-500 font-normal">(no subtype)</span>}
              </h2>
            </div>
            {!selectedGrade ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-gray-500 text-sm">
                Select a grade level to manage sections.
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3">
                  {loadingSections ? (
                    <div className="text-center text-gray-500 text-sm py-4">Loading…</div>
                  ) : sections.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">No sections yet.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sections.map((sec) => (
                        <div key={sec.id} className="group relative">
                          {editingSection?.id === sec.id ? (
                            <div className="flex items-center gap-1 bg-gray-800 border border-gray-600 rounded-full px-2 py-1">
                              <input
                                className="bg-transparent text-sm text-white focus:outline-none w-24"
                                value={editingSection.name}
                                onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveSection(); if (e.key === 'Escape') setEditingSection(null) }}
                                autoFocus
                              />
                              <button onClick={saveSection} disabled={saving} className="text-xs text-green-400 hover:text-green-300">✓</button>
                              <button onClick={() => setEditingSection(null)} className="text-xs text-gray-400 hover:text-white">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-sm text-gray-300 hover:border-gray-500 transition-colors">
                              <span>{sec.name}</span>
                              <button
                                onClick={() => setEditingSection({ id: sec.id, name: sec.name })}
                                className="opacity-0 group-hover:opacity-100 ml-1 text-gray-500 hover:text-white transition-opacity"
                                title="Edit"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.293-9.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L9 13z" /></svg>
                              </button>
                              <button
                                onClick={() => deleteSection(sec)}
                                className="opacity-0 group-hover:opacity-100 ml-0.5 text-gray-500 hover:text-red-400 transition-opacity"
                                title="Delete"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 border-t border-gray-800 flex gap-2">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#84050C]"
                    placeholder="New section…"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addSection() }}
                  />
                  <button
                    onClick={addSection}
                    disabled={!newSectionName.trim() || saving}
                    className="px-3 py-1.5 bg-[#84050C] text-white text-sm rounded hover:bg-[#9e0610] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Teacher Assignments Panel */}
        <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            onClick={() => setAssignmentsOpen(v => !v)}
          >
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Teacher Assignments</h2>
              <p className="text-xs text-gray-500 mt-0.5">Assign teachers to grade levels, subtypes, or sections.</p>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${assignmentsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {assignmentsOpen && (
            <div className="border-t border-gray-800 p-5 space-y-5">
              {/* Teacher picker */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Teacher</label>
                <select
                  className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#84050C]"
                  value={selectedTeacher?.id ?? ''}
                  onChange={(e) => {
                    const t = teachers.find(t => t.id === Number(e.target.value)) ?? null
                    setSelectedTeacher(t)
                    setAssignments([])
                  }}
                >
                  <option value="">-- Pick a teacher --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                </select>
              </div>

              {selectedTeacher && (
                <>
                  {/* Current assignments */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2">Current Assignments</p>
                    {loadingAssignments ? (
                      <p className="text-xs text-gray-500">Loading…</p>
                    ) : assignments.length === 0 ? (
                      <p className="text-xs text-gray-500">No assignments yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {assignments.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-xs text-gray-300">
                            <span>{[a.gl_name, a.sub_name, a.sec_name].filter(Boolean).join(' › ') || 'All'}</span>
                            <button onClick={() => removeAssignment(a.id)} className="text-gray-500 hover:text-red-400 ml-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add assignment */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2">Add Assignment</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Grade Level</label>
                        <select
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#84050C]"
                          value={addGl}
                          onChange={(e) => setAddGl(e.target.value === '' ? '' : Number(e.target.value))}
                        >
                          <option value="">-- Any --</option>
                          {gradeLevels.map(gl => <option key={gl.id} value={gl.id}>{gl.name}</option>)}
                        </select>
                      </div>
                      {assignSubtypes.length > 0 && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Subtype</label>
                          <select
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#84050C]"
                            value={addSub}
                            onChange={(e) => setAddSub(e.target.value === '' ? '' : Number(e.target.value))}
                          >
                            <option value="">-- Any --</option>
                            {assignSubtypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}
                      {assignSections.length > 0 && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Section</label>
                          <select
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#84050C]"
                            value={addSec}
                            onChange={(e) => setAddSec(e.target.value === '' ? '' : Number(e.target.value))}
                          >
                            <option value="">-- Any --</option>
                            {assignSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}
                      <button
                        onClick={addAssignment}
                        disabled={addingAssignment}
                        className="px-3 py-1.5 bg-[#84050C] text-white text-sm rounded hover:bg-[#9e0610] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {addingAssignment ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Safe delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            {!deleteConfirm2 ? (
              <>
                <h3 className="text-base font-semibold text-white">Cannot Delete {deleteModal.name}</h3>
                <p className="text-sm text-gray-300">
                  This {typeLabel(deleteModal)} has <strong className="text-white">{deleteModal.userCount} student(s)</strong> assigned.
                  You must remove them before deleting.
                </p>
                <p className="text-sm text-gray-400">
                  You can force-delete — this will clear all students&apos; {typeLabel(deleteModal)} info and flag them for re-verification.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteConfirm2(true)}
                    className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    Remove all students &amp; delete
                  </button>
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-white">Are you sure?</h3>
                <p className="text-sm text-gray-300">
                  This will reset <strong className="text-white">{deleteModal.userCount} student(s)</strong>&apos; school information and require re-verification. This cannot be undone.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={forceDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete and reset students'}
                  </button>
                  <button
                    onClick={() => { setDeleteModal(null); setDeleteConfirm2(false) }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
