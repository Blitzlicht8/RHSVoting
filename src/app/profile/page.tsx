'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'

interface Achievement {
  id: number
  title: string
  description: string | null
  year: number | null
  order_index: number
}

interface ProfileUser {
  id: number
  email: string
  name: string
  role: string
  email_verified: number | boolean
  id_verified: number | boolean
  avatar_url: string | null
  bio: string | null
  grade_level_id: number | null
  subtype_id: number | null
  section_id: number | null
  grade_level_name: string | null
  subtype_name: string | null
  section_name: string | null
}

interface GradeLevel { id: number; name: string }
interface Subtype { id: number; name: string; grade_level_id: number }
interface Section { id: number; name: string; subtype_id: number | null; grade_level_id: number }

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

export default function ProfilePage() {
  const { user: authUser, refetch } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])

  // Name edit state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // Avatar state
  const [avatarTab, setAvatarTab] = useState<'upload' | 'url'>('upload')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const [avatarInput, setAvatarInput] = useState('')

  // Academic change state
  const [showAcademicModal, setShowAcademicModal] = useState(false)
  const [showAcademicWarning, setShowAcademicWarning] = useState(false)
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [subtypes, setSubtypes] = useState<Subtype[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('')
  const [selectedSubtype, setSelectedSubtype] = useState<number | ''>('')
  const [selectedSection, setSelectedSection] = useState<number | ''>('')
  const [academicSaving, setAcademicSaving] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Bio state
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')
  const [bioSaving, setBioSaving] = useState(false)

  // Settings (group labels)
  const [settings, setSettings] = useState<{group_label_l1?:string;group_label_l2?:string;group_label_l3?:string}>({})

  // Achievement state
  const [showAddAchievement, setShowAddAchievement] = useState(false)
  const [achTitle, setAchTitle] = useState('')
  const [achDesc, setAchDesc] = useState('')
  const [achYear, setAchYear] = useState('')
  const [achSaving, setAchSaving] = useState(false)
  const [editingAchId, setEditingAchId] = useState<number | null>(null)
  const [editAchTitle, setEditAchTitle] = useState('')
  const [editAchDesc, setEditAchDesc] = useState('')
  const [editAchYear, setEditAchYear] = useState('')
  const [editAchSaving, setEditAchSaving] = useState(false)
  const [deletingAchId, setDeletingAchId] = useState<number | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me')
      const json = await res.json()
      if (res.ok) {
        setProfile(json.data.user)
        setAchievements(json.data.achievements)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(j=>setSettings(j.data??{}))
  }, [])

  // Load grade levels when modal opens; pre-populate selections from profile
  useEffect(() => {
    if (!showAcademicModal) return
    fetch('/api/academic/grade-levels').then(r => r.json()).then(gl => {
      setGradeLevels(gl.data ?? [])
      setSelectedGrade(profile?.grade_level_id ?? '')
      setSelectedSubtype(profile?.subtype_id ?? '')
      setSelectedSection(profile?.section_id ?? '')
    })
  }, [showAcademicModal, profile])

  // Cascade: grade → subtypes
  useEffect(() => {
    if (!showAcademicModal) return
    setSubtypes([])
    setSections([])
    if (!selectedGrade) return
    fetch(`/api/academic/subtypes?gradeLevelId=${selectedGrade}`)
      .then(r => r.json())
      .then(st => setSubtypes(st.data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrade, showAcademicModal])

  // Cascade: subtype → sections
  useEffect(() => {
    if (!showAcademicModal || !selectedGrade) return
    setSections([])
    const url = selectedSubtype
      ? `/api/academic/sections?gradeLevelId=${selectedGrade}&subtypeId=${selectedSubtype}`
      : `/api/academic/sections?gradeLevelId=${selectedGrade}`
    fetch(url)
      .then(r => r.json())
      .then(sc => setSections(sc.data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubtype, selectedGrade, showAcademicModal])

  const isStudent = authUser?.role === 'member' || authUser?.role === 'moderator'

  const l1 = settings.group_label_l1 ?? 'Grade Level'
  const l2 = settings.group_label_l2 ?? 'Track / Strand'
  const l3 = settings.group_label_l3 ?? 'Section'

  const initials = profile
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : ''

  // --- Name save ---
  async function saveName() {
    if (!nameInput.trim()) return
    setNameSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setProfile(p => p ? { ...p, name: nameInput.trim() } : p)
        setEditingName(false)
        addToast('Name updated', 'success')
        refetch()
      } else {
        addToast(json.error ?? 'Failed to update name', 'error')
      }
    } finally {
      setNameSaving(false)
    }
  }

  // --- Bio save ---
  async function saveBio() {
    setBioSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioInput.trim() || null }),
      })
      if (res.ok) {
        setProfile(p => p ? { ...p, bio: bioInput.trim() || null } : p)
        setEditingBio(false)
        addToast('Bio updated', 'success')
      } else {
        const j = await res.json()
        addToast(j.error ?? 'Failed to update bio', 'error')
      }
    } finally {
      setBioSaving(false)
    }
  }

  // --- Avatar upload ---
  async function uploadAvatar(file: File) {
    if (!file.type.startsWith('image/')) { addToast('Only image files allowed', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { addToast('File too large — max 5 MB', 'error'); return }
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('purpose', 'avatar')
      const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
      const json = await res.json()
      if (res.ok) {
        setProfile(p => p ? { ...p, avatar_url: json.data.url } : p)
        addToast('Photo updated', 'success')
        refetch()
      } else {
        addToast(json.error ?? 'Upload failed', 'error')
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  async function saveAvatarUrl() {
    setAvatarUploading(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarInput.trim() || null }),
      })
      const json = await res.json()
      if (res.ok) {
        setProfile(p => p ? { ...p, avatar_url: avatarInput.trim() || null } : p)
        addToast('Photo updated', 'success')
        refetch()
      } else {
        addToast(json.error ?? 'Failed to update', 'error')
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  // --- Academic save ---
  async function saveAcademic() {
    if (authUser?.role === 'member' || authUser?.role === 'moderator') {
      if (!selectedGrade) { addToast('Select a grade level', 'error'); return }
      if (filteredSubtypes.length > 0 && !selectedSubtype) { addToast('Select a track/strand', 'error'); return }
      if (filteredSections.length === 0) { addToast('No sections available. Contact admin.', 'error'); return }
      if (!selectedSection) { addToast('Select a section', 'error'); return }
    }
    setAcademicSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade_level_id: selectedGrade || null,
          subtype_id: selectedSubtype || null,
          section_id: selectedSection || null,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        addToast('Academic info updated. Please re-upload your ID.', 'info')
        setShowAcademicWarning(false)
        setShowAcademicModal(false)
        await fetchProfile()
        refetch()
        router.push('/verify-id')
      } else {
        addToast(json.error ?? 'Failed to update academic info', 'error')
      }
    } finally {
      setAcademicSaving(false)
    }
  }

  // --- Password change ---
  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (res.ok) {
        addToast('Password changed successfully', 'success')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        addToast(json.error ?? 'Failed to change password', 'error')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  // --- Achievement add ---
  async function addAchievement(e: React.FormEvent) {
    e.preventDefault()
    if (!achTitle.trim()) return
    setAchSaving(true)
    try {
      const res = await fetch('/api/users/me/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: achTitle.trim(), description: achDesc.trim() || null, year: achYear ? parseInt(achYear) : null }),
      })
      const json = await res.json()
      if (res.ok) {
        setAchievements(prev => [...prev, json.data as Achievement])
        setAchTitle(''); setAchDesc(''); setAchYear('')
        setShowAddAchievement(false)
        addToast('Achievement added', 'success')
      } else {
        addToast(json.error ?? 'Failed to add achievement', 'error')
      }
    } finally {
      setAchSaving(false)
    }
  }

  // --- Achievement edit ---
  async function saveEditAchievement(id: number) {
    if (!editAchTitle.trim()) return
    setEditAchSaving(true)
    try {
      const res = await fetch(`/api/users/me/achievements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editAchTitle.trim(), description: editAchDesc.trim() || null, year: editAchYear ? parseInt(editAchYear) : null }),
      })
      if (res.ok) {
        setAchievements(prev => prev.map(a => a.id === id ? { ...a, title: editAchTitle.trim(), description: editAchDesc.trim() || null, year: editAchYear ? parseInt(editAchYear) : null } : a))
        setEditingAchId(null)
        addToast('Achievement updated', 'success')
      } else {
        const json = await res.json()
        addToast(json.error ?? 'Failed to update', 'error')
      }
    } finally {
      setEditAchSaving(false)
    }
  }

  // --- Achievement delete ---
  async function deleteAchievement(id: number) {
    const res = await fetch(`/api/users/me/achievements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAchievements(prev => prev.filter(a => a.id !== id))
      setDeletingAchId(null)
      addToast('Achievement deleted', 'success')
    } else {
      addToast('Failed to delete', 'error')
    }
  }

  // subtypes and sections are now fetched filtered from the API; use them directly
  const filteredSubtypes = subtypes
  const filteredSections = sections

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Spinner size="xl" className="text-[#84050C]" />
        </div>
      </Layout>
    )
  }

  if (!profile) return <Layout><div className="text-center py-20 text-gray-500">Profile not found.</div></Layout>

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

        {/* ── 1. PROFILE PHOTO ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#84050C] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1">
              <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-3 w-fit">
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${avatarTab === 'upload' ? 'bg-[#84050C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setAvatarTab('upload')}
                >Upload Photo</button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${avatarTab === 'url' ? 'bg-[#84050C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setAvatarTab('url')}
                >Use URL</button>
              </div>
              {avatarTab === 'upload' ? (
                <div>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
                  />
                  <Button size="sm" variant="secondary" loading={avatarUploading} onClick={() => avatarFileRef.current?.click()}>
                    Choose Photo
                  </Button>
                  <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP or GIF · max 5 MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={avatarInput}
                    onChange={e => setAvatarInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                  />
                  <Button size="sm" loading={avatarUploading} onClick={saveAvatarUrl}>Save URL</Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. BASIC INFO ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Basic Info</h2>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    autoFocus
                  />
                  <Button size="sm" loading={nameSaving} onClick={saveName}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingName(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">{profile.name}</span>
                  <button
                    onClick={() => { setNameInput(profile.name); setEditingName(true) }}
                    className="text-xs text-[#84050C] hover:underline font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900">{profile.email}</span>
                {profile.email_verified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Verified
                  </span>
                ) : (
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Unverified</span>
                )}
              </div>
            </div>
            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Role</label>
              <span className="text-sm text-gray-900 capitalize">{profile.role.replace(/_/g, ' ')}</span>
            </div>
            {/* Bio */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bio</label>
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value.slice(0, 200))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C] resize-none"
                    placeholder="Tell the community about yourself…"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{bioInput.length}/200</span>
                    <div className="flex gap-2">
                      <Button size="sm" loading={bioSaving} onClick={saveBio}>Save</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingBio(false)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-gray-900">{profile.bio ?? <span className="text-gray-400 italic">No bio yet</span>}</span>
                  <button
                    onClick={() => { setBioInput(profile.bio ?? ''); setEditingBio(true) }}
                    className="text-xs text-[#84050C] hover:underline font-medium shrink-0"
                  >Edit</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. GROUP INFO (students only) ── */}
        {isStudent && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Group Info</h2>
              <Button size="sm" variant="secondary" onClick={() => setShowAcademicModal(true)}>
                Request Change
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.grade_level_name ? (
                <span className="bg-[#84050C]/10 text-[#84050C] text-xs font-medium px-3 py-1 rounded-full">
                  {profile.grade_level_name}
                </span>
              ) : null}
              {profile.subtype_name ? (
                <span className="bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full">
                  {profile.subtype_name}
                </span>
              ) : null}
              {profile.section_name ? (
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full">
                  {l3} {profile.section_name}
                </span>
              ) : null}
              {!profile.grade_level_name && !profile.subtype_name && !profile.section_name && (
                <span className="text-sm text-gray-400">No group info set</span>
              )}
            </div>
            {profile.id_verified ? (
              <p className="mt-3 text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ID verified
              </p>
            ) : (
              <p className="mt-3 text-xs text-amber-600">ID pending verification</p>
            )}
          </div>
        )}

        {/* ── 4. CHANGE PASSWORD ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Change Password</h2>
          <form onSubmit={changePassword} className="space-y-3">
            {[
              { label: 'Current Password', value: currentPassword, setter: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
              { label: 'New Password', value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v) },
              { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
            ].map(({ label, value, setter, show, toggle }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                    required
                  />
                  <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <EyeIcon open={show} />
                  </button>
                </div>
              </div>
            ))}
            <div className="pt-1">
              <Button type="submit" loading={passwordSaving}>
                Change Password
              </Button>
            </div>
          </form>
        </div>

        {/* ── 5. ACHIEVEMENTS ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Achievements</h2>
            <Button size="sm" onClick={() => setShowAddAchievement(v => !v)}>
              {showAddAchievement ? 'Cancel' : '+ Add Achievement'}
            </Button>
          </div>

          {showAddAchievement && (
            <form onSubmit={addAchievement} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                <input
                  type="text"
                  value={achTitle}
                  onChange={e => setAchTitle(e.target.value)}
                  placeholder="e.g. Honor Roll"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={achDesc}
                  onChange={e => setAchDesc(e.target.value)}
                  placeholder="Optional details"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                <input
                  type="number"
                  value={achYear}
                  onChange={e => setAchYear(e.target.value)}
                  placeholder="e.g. 2024"
                  min={1990}
                  max={2100}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                />
              </div>
              <Button type="submit" size="sm" loading={achSaving}>Add</Button>
            </form>
          )}

          {achievements.length === 0 && !showAddAchievement && (
            <p className="text-sm text-gray-400">No achievements yet. Add one!</p>
          )}

          <div className="space-y-3">
            {achievements.map(ach => (
              <div key={ach.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                {editingAchId === ach.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editAchTitle}
                      onChange={e => setEditAchTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                    />
                    <input
                      type="text"
                      value={editAchDesc}
                      onChange={e => setEditAchDesc(e.target.value)}
                      placeholder="Description"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                    />
                    <input
                      type="number"
                      value={editAchYear}
                      onChange={e => setEditAchYear(e.target.value)}
                      placeholder="Year"
                      min={1990}
                      max={2100}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" loading={editAchSaving} onClick={() => saveEditAchievement(ach.id)}>Save</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingAchId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{ach.title}</span>
                        {ach.year && (
                          <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{ach.year}</span>
                        )}
                      </div>
                      {ach.description && (
                        <p className="text-xs text-gray-500 mt-1">{ach.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingAchId(ach.id); setEditAchTitle(ach.title); setEditAchDesc(ach.description ?? ''); setEditAchYear(ach.year ? String(ach.year) : '') }}
                        className="p-1.5 text-gray-400 hover:text-[#84050C] rounded-lg hover:bg-white transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingAchId(ach.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Academic change selector modal */}
      <Modal
        isOpen={showAcademicModal}
        onClose={() => setShowAcademicModal(false)}
        title="Change Group Info"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAcademicModal(false)}>Cancel</Button>
            <Button
              onClick={() => setShowAcademicWarning(true)}
              disabled={
                !selectedGrade ||
                (filteredSubtypes.length > 0 && !selectedSubtype) ||
                filteredSections.length === 0 ||
                !selectedSection
              }
            >
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{l1}</label>
            <select
              value={selectedGrade}
              onChange={e => { setSelectedGrade(e.target.value ? Number(e.target.value) : ''); setSelectedSubtype(''); setSelectedSection('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
            >
              <option value="">Select {l1.toLowerCase()}</option>
              {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {filteredSubtypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{l2}</label>
              <select
                value={selectedSubtype}
                onChange={e => { setSelectedSubtype(e.target.value ? Number(e.target.value) : ''); setSelectedSection('') }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
              >
                <option value="">Select {l2.toLowerCase()}</option>
                {filteredSubtypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {filteredSections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{l3}</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#84050C]/30 focus:border-[#84050C]"
              >
                <option value="">Select {l3.toLowerCase()}</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* Academic change warning modal */}
      <Modal
        isOpen={showAcademicWarning}
        onClose={() => setShowAcademicWarning(false)}
        title="Confirm Group Change"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAcademicWarning(false)}>Go Back</Button>
            <Button variant="danger" loading={academicSaving} onClick={saveAcademic}>
              Yes, Proceed
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800">
              Changing your group info will <strong>reset your ID verification</strong>. You will need to re-upload your documents and wait for re-approval before you can vote.
            </p>
          </div>
          <p className="text-sm text-gray-600">Are you sure you want to proceed?</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deletingAchId !== null}
        title="Delete Achievement"
        message="Are you sure you want to delete this achievement? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deletingAchId !== null && deleteAchievement(deletingAchId)}
        onCancel={() => setDeletingAchId(null)}
      />
    </Layout>
  )
}
