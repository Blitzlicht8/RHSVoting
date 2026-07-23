'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

// ─── Types (mirror of src/lib/groups.ts, kept local for client bundle) ──────────

export interface GroupValue {
  id: number
  structure_id: number
  parent_value_id: number | null
  name: string
  order_index: number
  active: number
}

export interface StructureWithValues {
  id: number
  name: string
  parent_structure_id: number | null
  is_required: number
  order_index: number
  active: number
  values: GroupValue[]
}

export interface Assignment {
  structure_id: number
  value_id: number
}

// selected maps structure_id → chosen value_id (as string, matching <select> semantics)
export type GroupSelection = Record<number, string>

// ─── Hook: fetch structures + manage cascading selection ────────────────────────

export function useGroupSelections() {
  const [structures, setStructures] = useState<StructureWithValues[]>([])
  const [selected, setSelected] = useState<GroupSelection>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/groups', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (!cancelled) setStructures((j.data as StructureWithValues[]) ?? []) })
      .catch(() => { if (!cancelled) setStructures([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const ordered = useMemo(
    () => [...structures].sort((a, b) => a.order_index - b.order_index),
    [structures],
  )

  // Options available for a structure given the current parent selection.
  const optionsFor = useCallback((s: StructureWithValues): GroupValue[] => {
    const active = s.values.filter(v => v.active !== 0)
    if (s.parent_structure_id == null) return active
    const parentVal = selected[s.parent_structure_id]
    if (!parentVal) return []
    return active.filter(v => v.parent_value_id === Number(parentVal))
  }, [selected])

  // Set a structure's value and clear any descendants whose parent chain changed.
  const setValue = useCallback((structureId: number, valueId: string) => {
    setSelected(prev => {
      const next: GroupSelection = { ...prev, [structureId]: valueId }
      // Recursively clear structures that descend (by parent_structure_id) from this one.
      const clearChildren = (parentId: number) => {
        for (const s of structures) {
          if (s.parent_structure_id === parentId && next[s.id] != null) {
            delete next[s.id]
            clearChildren(s.id)
          }
        }
      }
      clearChildren(structureId)
      if (!valueId) delete next[structureId]
      return next
    })
  }, [structures])

  const assignments = useMemo<Assignment[]>(() =>
    Object.entries(selected)
      .filter(([, v]) => v)
      .map(([sid, v]) => ({ structure_id: Number(sid), value_id: Number(v) })),
    [selected],
  )

  // First required structure still missing a value (null when all satisfied).
  const firstMissingRequired = useCallback((): StructureWithValues | null => {
    for (const s of ordered) {
      if (s.is_required && !selected[s.id]) return s
    }
    return null
  }, [ordered, selected])

  return { structures: ordered, selected, setValue, assignments, optionsFor, firstMissingRequired, loading }
}

// ─── Presentational component ───────────────────────────────────────────────────

interface GroupSelectsProps {
  structures: StructureWithValues[]
  selected: GroupSelection
  setValue: (structureId: number, valueId: string) => void
  optionsFor: (s: StructureWithValues) => GroupValue[]
  onChangeSide?: () => void
}

export default function GroupSelects({ structures, selected, setValue, optionsFor, onChangeSide }: GroupSelectsProps) {
  return (
    <>
      {structures.map(s => {
        const opts = optionsFor(s)
        const disabled = s.parent_structure_id != null && !selected[s.parent_structure_id]
        return (
          <div key={s.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {s.name}{s.is_required ? <span className="text-red-500"> *</span> : null}
            </label>
            <select
              value={selected[s.id] ?? ''}
              disabled={disabled}
              onChange={e => { setValue(s.id, e.target.value); onChangeSide?.() }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {disabled ? `Select previous group first…` : `Select ${s.name.toLowerCase()}…`}
              </option>
              {opts.map(v => (
                <option key={v.id} value={String(v.id)}>{v.name}</option>
              ))}
            </select>
          </div>
        )
      })}
    </>
  )
}
