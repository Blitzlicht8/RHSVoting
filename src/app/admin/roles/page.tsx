'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Lock, Pencil, Trash2, Plus, Shield } from 'lucide-react'

interface AppRole {
  id: number
  name: string
  is_system: number
  permissions: string
}

const PERMISSION_KEYS = ['manageUsers','manageElections','manageSettings','viewReports','verifyMembers','managePosts'] as const

function parsePerms(raw: string): Record<string, boolean> {
  try { return JSON.parse(raw) } catch { return {} }
}

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
    const res = await fetch(`/api/admin/roles/${editingId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, permissions: editPerms }),
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

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-gray-400">Loading...</div></Layout>

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield size={22} className="text-[#84050C]" /> Roles &amp; Permissions</h1>
          <button onClick={() => setShowNew(v=>!v)} className="flex items-center gap-1.5 px-4 py-2 bg-[#84050C] text-white rounded-xl text-sm font-medium hover:bg-[#6b0409]">
            <Plus size={16} /> New Role
          </button>
        </div>

        {showNew && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">New Role</h3>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Role name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none" />
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PERMISSION_KEYS.map(p => (
                <label key={p} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!newPerms[p]} onChange={e=>setNewPerms(prev=>({...prev,[p]:e.target.checked}))}
                    className="w-4 h-4 rounded border-gray-300 text-[#84050C]" />
                  {p.replace(/([A-Z])/g,' $1').trim()}
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm bg-[#84050C] text-white rounded-xl hover:bg-[#6b0409]">Create</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {roles.map(role => {
            const perms = parsePerms(role.permissions)
            const isEditing = editingId === role.id
            return (
              <div key={role.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {role.is_system ? <Lock size={16} className="text-[#D69A23]" /> : <Shield size={16} className="text-gray-400" />}
                    {isEditing ? (
                      <input value={editName} onChange={e=>setEditName(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none" />
                    ) : (
                      <span className="font-semibold text-gray-900 capitalize">{role.name.replace(/_/g,' ')}</span>
                    )}
                    {role.is_system === 1 && (
                      <span className="text-xs bg-[#FEE2E2] text-[#84050C] px-2 py-0.5 rounded-full font-medium">System</span>
                    )}
                  </div>
                  {!role.is_system && (
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button onClick={handleSaveEdit} className="text-xs text-white bg-[#84050C] px-3 py-1.5 rounded-lg hover:bg-[#6b0409]">Save</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(role.id); setEditName(role.name); setEditPerms(perms) }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => { setDeletingId(role.id); setConfirmOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-3">
                  {PERMISSION_KEYS.map(p => (
                    <label key={p} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox"
                        checked={isEditing ? !!editPerms[p] : !!perms[p]}
                        onChange={isEditing ? e=>setEditPerms(prev=>({...prev,[p]:e.target.checked})) : undefined}
                        disabled={!isEditing}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-[#84050C]" />
                      <span className={isEditing ? 'text-gray-700' : (perms[p] ? 'text-gray-600' : 'text-gray-300')}>
                        {p.replace(/([A-Z])/g,' $1').trim()}
                      </span>
                    </label>
                  ))}
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
    </Layout>
  )
}
