'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Lock, Pencil, Trash2, Plus, Shield, Crown } from 'lucide-react'

interface AppRole {
  id: number
  name: string
  is_system: number
  permissions: string
}

const PERMISSION_KEYS = [
  'manageUsers',
  'manageElections',
  'manageSettings',
  'viewReports',
  'verifyMembers',
  'managePosts',
  'manageAcademic',
  'manageRoles',
  'viewLogs',
  'manageFeed',
] as const

const PERM_LABELS: Record<string, string> = {
  manageUsers: 'Manage Users',
  manageElections: 'Manage Elections',
  manageSettings: 'Manage Settings',
  viewReports: 'View Reports',
  verifyMembers: 'Verify Members',
  managePosts: 'Manage Posts',
  manageAcademic: 'Manage Group Structure',
  manageRoles: 'Manage Roles',
  viewLogs: 'View Activity Logs',
  manageFeed: 'Manage Feed',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  master_admin: 'Always highest — cannot be edited or deleted',
  admin: 'Full administrator access',
  moderator: 'Moderate content and reports',
  staff: 'Elevated member with staff privileges',
  member: 'Default role for all verified members',
  unverified: 'Assigned before identity verification',
}

function parsePerms(raw: string): Record<string, boolean> {
  try { return JSON.parse(raw) } catch { return {} }
}

const isMemberRole = (r: AppRole) => r.name === 'member'
const isMasterAdmin = (r: AppRole) => r.name === 'master_admin'
const isFullyLocked = (r: AppRole) => isMasterAdmin(r)
const isRenameOnly = (r: AppRole) => isMemberRole(r)

export default function RolesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number|null>(null)
  const [editName, setEditName] = useState('')
  const [editPerms, setEditPerms] = useState<Record<string,boolean>>({})
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPerms, setNewPerms] = useState<Record<string,boolean>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number|null>(null)

  useEffect(() => {
    if (user && user.role !== 'master_admin') { router.replace('/admin'); return }
    if (user) fetchRoles()
  }, [user])

  const fetchRoles = () => {
    fetch('/api/admin/roles', { credentials: 'include' }).then(r=>r.json())
      .then(j => { setRoles(j.data ?? []); setLoading(false) })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const editingRole = roles.find(r => r.id === editingId)
    const memberOnly = editingRole ? isRenameOnly(editingRole) : false
    const body = memberOnly
      ? { name: editName }
      : { name: editName, permissions: editPerms }
    const res = await fetch(`/api/admin/roles/${editingId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { addToast('Role updated', 'success'); setEditingId(null); fetchRoles() }
    else { const j = await res.json(); addToast(j.error || 'Failed', 'error') }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    const res = await fetch(`/api/admin/roles/${deletingId}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { addToast('Role deleted', 'success'); fetchRoles() }
    else { const j = await res.json(); addToast(j.error || 'Failed', 'error') }
    setDeletingId(null)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const res = await fetch('/api/admin/roles', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, permissions: newPerms }),
    })
    if (res.ok) { addToast('Role created', 'success'); setShowNew(false); setNewName(''); setNewPerms({}); fetchRoles() }
    else { const j = await res.json(); addToast(j.error || 'Failed', 'error') }
  }

  if (loading) return <AdminLayout><div className="flex items-center justify-center h-64 text-gray-400">Loading...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield size={22} className="text-[#84050C]" /> Roles &amp; Permissions
            </h1>
            <p className="text-sm text-gray-500 mt-1">System roles are locked. Custom roles can be created and assigned permissions.</p>
          </div>
          <button onClick={() => setShowNew(v=>!v)} className="flex items-center gap-1.5 px-4 py-2 bg-[#84050C] text-white rounded-xl text-sm font-medium hover:bg-[#6b0409] shrink-0 mt-1">
            <Plus size={16} /> New Role
          </button>
        </div>

        {showNew && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-1">New Custom Role</h3>
            <p className="text-xs text-gray-400 mb-3">Custom roles can be assigned permissions and deleted. System roles (master_admin, admin, etc.) cannot be replaced.</p>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Role name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none" />
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PERMISSION_KEYS.map(p => (
                <label key={p} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!newPerms[p]} onChange={e=>setNewPerms(prev=>({...prev,[p]:e.target.checked}))}
                    className="w-4 h-4 rounded border-gray-300 text-[#84050C]" />
                  {PERM_LABELS[p]}
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowNew(false); setNewName(''); setNewPerms({}) }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm bg-[#84050C] text-white rounded-xl hover:bg-[#6b0409]">Create</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {roles.map(role => {
            const perms = parsePerms(role.permissions)
            const isEditing = editingId === role.id
            const fullyLocked = isFullyLocked(role)
            const renameOnly = isRenameOnly(role)
            const otherSystem = role.is_system === 1 && !fullyLocked && !renameOnly
            const isCustom = role.is_system === 0

            return (
              <div key={role.id} className={`bg-white rounded-2xl border p-5 shadow-sm ${fullyLocked ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {fullyLocked
                      ? <Crown size={16} className="text-amber-500 shrink-0" />
                      : role.is_system
                        ? <Lock size={16} className="text-gray-400 shrink-0" />
                        : <Shield size={16} className="text-gray-400 shrink-0" />}

                    {isEditing ? (
                      <input value={editName} onChange={e=>setEditName(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none" />
                    ) : (
                      <span className="font-semibold text-gray-900 capitalize">{role.name.replace(/_/g,' ')}</span>
                    )}

                    {fullyLocked && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Supreme Role</span>
                    )}
                    {renameOnly && (
                      <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Default Member</span>
                    )}
                    {otherSystem && (
                      <span className="text-xs bg-[#FEE2E2] text-[#84050C] px-2 py-0.5 rounded-full font-medium">System</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5 shrink-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                        <button onClick={handleSaveEdit}
                          className="text-xs text-white bg-[#84050C] px-3 py-1.5 rounded-lg hover:bg-[#6b0409]">Save</button>
                      </>
                    ) : (
                      <>
                        {(renameOnly || isCustom) && (
                          <button
                            onClick={() => { setEditingId(role.id); setEditName(role.name); setEditPerms(perms) }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            title={renameOnly ? 'Rename' : 'Edit'}>
                            <Pencil size={15} />
                          </button>
                        )}
                        {isCustom && (
                          <button
                            onClick={() => { setDeletingId(role.id); setConfirmOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Role description */}
                {ROLE_DESCRIPTIONS[role.name] && !isEditing && (
                  <p className="text-xs text-gray-400 mt-1 ml-6">{ROLE_DESCRIPTIONS[role.name]}</p>
                )}

                {/* Permissions */}
                <div className="mt-3">
                  {isEditing && renameOnly && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                      Member role cannot have custom permissions
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {PERMISSION_KEYS.map(p => {
                      if (isEditing && renameOnly) {
                        return (
                          <div key={p}
                            onClick={() => addToast('Member role permissions cannot be changed', 'error')}
                            className="cursor-not-allowed">
                            <label className="flex items-center gap-2 text-xs text-gray-300 pointer-events-none select-none">
                              <input type="checkbox" checked={false} readOnly
                                className="w-3.5 h-3.5 rounded border-gray-200 opacity-40" />
                              {PERM_LABELS[p]}
                            </label>
                          </div>
                        )
                      }
                      return (
                        <label key={p} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox"
                            checked={isEditing ? !!editPerms[p] : !!perms[p]}
                            onChange={isEditing ? e=>setEditPerms(prev=>({...prev,[p]:e.target.checked})) : undefined}
                            disabled={!isEditing}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-[#84050C]" />
                          <span className={isEditing ? 'text-gray-700' : (perms[p] ? 'text-gray-600' : 'text-gray-300')}>
                            {PERM_LABELS[p]}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <ConfirmDialog
          open={confirmOpen}
          title="Delete role?"
          message="This will permanently remove the role. Members assigned to it will keep their current role string but lose the role_id link."
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => { setConfirmOpen(false); handleDelete() }}
          onCancel={() => { setConfirmOpen(false); setDeletingId(null) }}
        />
      </div>
    </AdminLayout>
  )
}
