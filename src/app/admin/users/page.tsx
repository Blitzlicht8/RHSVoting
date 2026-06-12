'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'

type Role = 'master_admin' | 'teacher_admin' | 'student_admin' | 'teacher' | 'student'

interface UserRow {
  id: number
  email: string
  name: string
  role: Role
  email_verified: 0 | 1
  id_verified: 0 | 1
  id_image: string | null
  active: 0 | 1
  created_at: string
}

interface UsersResponse {
  users: UserRow[]
  total: number
  page: number
  limit: number
}

const ROLE_LABELS: Record<Role, string> = {
  master_admin: 'Master Admin',
  teacher_admin: 'Teacher Admin',
  student_admin: 'Student Admin',
  teacher: 'Teacher',
  student: 'Student',
}

const ROLE_BADGE: Record<Role, 'danger' | 'warning' | 'purple' | 'info' | 'default'> = {
  master_admin: 'danger',
  teacher_admin: 'warning',
  student_admin: 'purple',
  teacher: 'info',
  student: 'default',
}

const ALL_ROLES: Role[] = ['master_admin', 'teacher_admin', 'student_admin', 'teacher', 'student']

const ROLE_LEVEL: Record<Role, number> = {
  student: 0, teacher: 1, student_admin: 2, teacher_admin: 3, master_admin: 4,
}

function getAssignableRoles(currentUserRole: Role): Role[] {
  if (currentUserRole === 'master_admin') return ALL_ROLES
  if (currentUserRole === 'teacher_admin') return ['teacher', 'student']
  if (currentUserRole === 'student_admin') return ['student']
  return []
}

function canDeleteUser(actorRole: Role, target: UserRow, selfId: number): boolean {
  if (target.id === selfId) return false
  if (actorRole === 'master_admin') return true
  if (actorRole === 'teacher_admin') return ROLE_LEVEL[target.role] < ROLE_LEVEL['teacher_admin']
  return false
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-[#84050C]', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500',
  'bg-teal-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500',
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({length: 12}, () => chars[Math.floor(Math.random()*chars.length)]).join('')
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { addToast } = useToast()

  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [idModalUser, setIdModalUser] = useState<UserRow | null>(null)
  const [patchingId, setPatchingId] = useState<number | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserRow | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'student' as Role,
    grade_level_id: '', subtype_id: '', section_id: '',
    email_verified: true, id_verified: false,
  })
  const [gradeLevels, setGradeLevels] = useState<Array<{id:number,name:string}>>([])
  const [subtypes, setSubtypes] = useState<Array<{id:number,name:string}>>([])
  const [sections, setSections] = useState<Array<{id:number,name:string}>>([])
  const [showPassword, setShowPassword] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const isAdmin =
    currentUser?.role === 'master_admin' ||
    currentUser?.role === 'teacher_admin' ||
    currentUser?.role === 'student_admin'

  const fetchUsers = useCallback(async (p: number, s: string, r: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (s) params.set('search', s)
      if (r) params.set('role', r)
      const res = await fetch(`/api/users?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setData(json.data)
      } else {
        addToast(json.error || 'Failed to load users', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  useEffect(() => {
    fetchUsers(page, debouncedSearch, roleFilter)
  }, [page, debouncedSearch, roleFilter, fetchUsers])

  // Load grade levels when create modal opens
  useEffect(() => {
    if (!showCreateModal) return
    fetch('/api/academic/grade-levels').then(r => r.json()).then(j => setGradeLevels(j.data ?? []))
  }, [showCreateModal])

  // Load subtypes when grade level changes
  useEffect(() => {
    if (!createForm.grade_level_id) { setSubtypes([]); setSections([]); return }
    fetch(`/api/academic/subtypes?gradeLevelId=${createForm.grade_level_id}`).then(r=>r.json()).then(j=>setSubtypes(j.data??[]))
  }, [createForm.grade_level_id])

  // Load sections when grade level or subtype changes
  useEffect(() => {
    if (!createForm.grade_level_id) { setSections([]); return }
    const url = `/api/academic/sections?gradeLevelId=${createForm.grade_level_id}${createForm.subtype_id?`&subtypeId=${createForm.subtype_id}`:''}`
    fetch(url).then(r=>r.json()).then(j=>setSections(j.data??[]))
  }, [createForm.grade_level_id, createForm.subtype_id])

  const patchUser = useCallback(async (id: number, patch: Partial<{ role: Role; active: 0 | 1; email_verified: 0 | 1; id_verified: 0 | 1 }>) => {
    setPatchingId(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (res.ok) {
        addToast('User updated', 'success')
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            users: prev.users.map((u) =>
              u.id === id ? { ...u, ...patch } : u
            ),
          }
        })
      } else {
        addToast(json.error || 'Update failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setPatchingId(null)
    }
  }, [addToast])

  const deleteUser = useCallback(async (id: number) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (res.ok) {
        addToast('User deleted', 'success')
        setData((prev) => {
          if (!prev) return prev
          return { ...prev, users: prev.users.filter((u) => u.id !== id), total: prev.total - 1 }
        })
      } else {
        addToast(json.error || 'Delete failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setDeletingId(null)
    }
  }, [addToast])

  const handleCreateUser = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          grade_level_id: createForm.grade_level_id ? parseInt(createForm.grade_level_id) : null,
          subtype_id: createForm.subtype_id ? parseInt(createForm.subtype_id) : null,
          section_id: createForm.section_id ? parseInt(createForm.section_id) : null,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        addToast('User created', 'success')
        setShowCreateModal(false)
        fetchUsers(page, debouncedSearch, roleFilter)
      } else {
        addToast(json.error || 'Failed', 'error')
      }
    } catch { addToast('Network error', 'error') }
    finally { setCreating(false) }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-1">You do not have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const assignableRoles = currentUser ? getAssignableRoles(currentUser.role) : []
  const canVerify = currentUser?.role === 'master_admin' || currentUser?.role === 'teacher_admin'
  const totalPages = data ? Math.ceil(data.total / 20) : 1
  const isStudentRole = createForm.role === 'student' || createForm.role === 'student_admin'

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          {data && (
            <span className="bg-[#FEE2E2] text-[#6B0409] text-sm font-semibold px-3 py-1 rounded-full">
              {data.total.toLocaleString()} users
            </span>
          )}
          {canVerify && (
            <button
              onClick={() => {
                setShowCreateModal(true)
                setCreateForm({
                  name: '', email: '', password: generatePassword(), role: 'student',
                  grade_level_id: '', subtype_id: '', section_id: '',
                  email_verified: true, id_verified: false,
                })
              }}
              className="ml-auto px-4 py-2 bg-[#84050C] text-white rounded-lg text-sm font-medium hover:bg-[#6B0409]"
            >
              + Create User
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as Role | ''); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
          >
            <option value="">All Roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">Name / Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Email ✓</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">ID ✓</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Active</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">No users found.</td>
                    </tr>
                  )}
                  {data.users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      {/* Name / Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(u.id)}`}>
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role select */}
                      <td className="px-4 py-4">
                        <select
                          value={u.role}
                          disabled={patchingId === u.id || u.id === currentUser?.id}
                          onChange={(e) => patchUser(u.id, { role: e.target.value as Role })}
                          className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {ALL_ROLES.map((r) => (
                            <option
                              key={r}
                              value={r}
                              disabled={!assignableRoles.includes(r)}
                            >
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Email verified */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {u.email_verified ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <>
                              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              {canVerify && (
                                <button
                                  disabled={patchingId === u.id}
                                  onClick={() => patchUser(u.id, { email_verified: 1 })}
                                  className="text-xs text-[#84050C] hover:text-[#6B0409] font-medium disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* ID verified */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {u.id_verified ? (
                            <>
                              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              {canVerify && (
                                <button
                                  disabled={patchingId === u.id}
                                  onClick={() => patchUser(u.id, { id_verified: 0 })}
                                  className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                >
                                  Revoke
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              {canVerify && (
                                <button
                                  disabled={patchingId === u.id}
                                  onClick={() => patchUser(u.id, { id_verified: 1 })}
                                  className="text-xs text-[#84050C] hover:text-[#6B0409] font-medium disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Active toggle */}
                      <td className="px-4 py-4 text-center">
                        <button
                          disabled={patchingId === u.id || u.id === currentUser?.id}
                          onClick={() => patchUser(u.id, { active: u.active ? 0 : 1 })}
                          className={[
                            'relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#84050C] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
                            u.active ? 'bg-[#84050C]' : 'bg-gray-300',
                          ].join(' ')}
                          aria-label={u.active ? 'Deactivate user' : 'Activate user'}
                        >
                          <span
                            className={[
                              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform m-0.5',
                              u.active ? 'translate-x-5' : 'translate-x-0',
                            ].join(' ')}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {u.id_image ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setIdModalUser(u)}
                            >
                              View ID
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">No ID</span>
                          )}
                          {currentUser && canDeleteUser(currentUser.role as Role, u, currentUser.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === u.id}
                              onClick={() => setConfirmDeleteUser(u)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {data.users.length === 0 && (
                <div className="text-center py-12 text-gray-400">No users found.</div>
              )}
              {data.users.map((u) => (
                <div key={u.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${avatarColor(u.id)}`}>
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{u.name}</div>
                      <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      <Badge variant={ROLE_BADGE[u.role]} size="sm" className="mt-1">
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        {u.email_verified ? (
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        )}
                        Email verified
                      </div>
                      {!u.email_verified && canVerify && (
                        <button
                          disabled={patchingId === u.id}
                          onClick={() => patchUser(u.id, { email_verified: 1 })}
                          className="text-xs text-[#84050C] hover:text-[#6B0409] font-medium text-left disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        {u.id_verified ? (
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        )}
                        ID verified
                      </div>
                      {u.id_verified && canVerify && (
                        <button
                          disabled={patchingId === u.id}
                          onClick={() => patchUser(u.id, { id_verified: 0 })}
                          className="text-xs text-red-600 hover:text-red-800 font-medium text-left disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                      {!u.id_verified && canVerify && (
                        <button
                          disabled={patchingId === u.id}
                          onClick={() => patchUser(u.id, { id_verified: 1 })}
                          className="text-xs text-[#84050C] hover:text-[#6B0409] font-medium text-left disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Active</span>
                      <button
                        disabled={patchingId === u.id || u.id === currentUser?.id}
                        onClick={() => patchUser(u.id, { active: u.active ? 0 : 1 })}
                        className={[
                          'relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
                          u.active ? 'bg-[#84050C]' : 'bg-gray-300',
                        ].join(' ')}
                      >
                        <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform m-0.5', u.active ? 'translate-x-4' : 'translate-x-0'].join(' ')} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        disabled={patchingId === u.id || u.id === currentUser?.id}
                        onChange={(e) => patchUser(u.id, { role: e.target.value as Role })}
                        className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#84050C] bg-white disabled:opacity-60"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r} disabled={!assignableRoles.includes(r)}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      {u.id_image && (
                        <Button variant="secondary" size="sm" onClick={() => setIdModalUser(u)}>
                          View ID
                        </Button>
                      )}
                      {currentUser && canDeleteUser(currentUser.role as Role, u, currentUser.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === u.id}
                          onClick={() => setConfirmDeleteUser(u)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ID Image Modal */}
      <Modal
        isOpen={!!idModalUser}
        onClose={() => setIdModalUser(null)}
        title={idModalUser ? `${idModalUser.name}'s ID` : ''}
        size="lg"
      >
        {idModalUser?.id_image && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm text-gray-500">{idModalUser.email}</div>
            <img
              src={idModalUser.id_image}
              alt="School ID"
              className="w-full rounded-lg object-contain max-h-[60vh] border border-gray-200"
            />
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDeleteUser}
        onClose={() => setConfirmDeleteUser(null)}
        title="Delete User"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteUser(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deletingId === confirmDeleteUser?.id}
              onClick={async () => {
                if (!confirmDeleteUser) return
                const id = confirmDeleteUser.id
                setConfirmDeleteUser(null)
                await deleteUser(id)
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {confirmDeleteUser && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete{' '}
              <strong>{confirmDeleteUser.name}</strong> ({confirmDeleteUser.email})?
            </p>
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">
              This action cannot be undone. The user&apos;s account and all associated data will be removed.
            </p>
          </div>
        )}
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create User"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={creating}
              disabled={creating}
              onClick={handleCreateUser}
            >
              Create User
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCreateForm(f => ({ ...f, password: generatePassword() }))}
                className="px-3 py-2 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 whitespace-nowrap"
              >
                Regenerate
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value as Role, grade_level_id: '', subtype_id: '', section_id: '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Academic fields for student / student_admin */}
          {isStudentRole && (
            <>
              {/* Grade Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                <select
                  value={createForm.grade_level_id}
                  onChange={(e) => setCreateForm(f => ({ ...f, grade_level_id: e.target.value, subtype_id: '', section_id: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                >
                  <option value="">— Select grade level —</option>
                  {gradeLevels.map((gl) => (
                    <option key={gl.id} value={String(gl.id)}>{gl.name}</option>
                  ))}
                </select>
              </div>

              {/* Subtype (only if subtypes exist for this grade level) */}
              {subtypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Track / Strand</label>
                  <select
                    value={createForm.subtype_id}
                    onChange={(e) => setCreateForm(f => ({ ...f, subtype_id: e.target.value, section_id: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  >
                    <option value="">— Select track/strand —</option>
                    {subtypes.map((st) => (
                      <option key={st.id} value={String(st.id)}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section */}
              {sections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <select
                    value={createForm.section_id}
                    onChange={(e) => setCreateForm(f => ({ ...f, section_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white"
                  >
                    <option value="">— Select section —</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={String(sec.id)}>{sec.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Verification flags */}
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createForm.email_verified}
                onChange={(e) => setCreateForm(f => ({ ...f, email_verified: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C]"
              />
              <span className="text-sm text-gray-700">Email Verified</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createForm.id_verified}
                onChange={(e) => setCreateForm(f => ({ ...f, id_verified: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-[#84050C] focus:ring-[#84050C]"
              />
              <span className="text-sm text-gray-700">ID Verified</span>
            </label>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
