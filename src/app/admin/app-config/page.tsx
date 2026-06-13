'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Settings2, X } from 'lucide-react'

const ALLOWED = ['master_admin', 'admin', 'teacher_admin']

export default function AppConfigPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [loaded, setLoaded] = useState(false)
  const [appName, setAppName] = useState('Community Hub')
  const [orgType, setOrgType] = useState('community')
  const [l1, setL1] = useState('Group')
  const [l2, setL2] = useState('Subgroup')
  const [l3, setL3] = useState('Unit')
  const [docTypes, setDocTypes] = useState<string[]>([])
  const [newDoc, setNewDoc] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const newDocRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    if (!ALLOWED.includes(user.role as string)) { router.replace('/admin'); return }
    fetch('/api/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        const s: Record<string, string> = j.data ?? {}
        setAppName(s.app_name ?? 'Community Hub')
        setOrgType(s.org_type ?? 'community')
        setL1(s.group_label_l1 ?? 'Group')
        setL2(s.group_label_l2 ?? 'Subgroup')
        setL3(s.group_label_l3 ?? 'Unit')
        try { setDocTypes(JSON.parse(s.doc_type_labels ?? '[]')) } catch { setDocTypes([]) }
        setLoaded(true)
      })
      .catch(() => { addToast('Failed to load settings', 'error'); setLoaded(true) })
  }, [user])

  const save = async (key: string, value: string) => {
    setSaving(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (res.ok) addToast('Saved', 'success')
      else { const j = await res.json(); addToast(j.error ?? 'Failed to save', 'error') }
    } catch { addToast('Network error', 'error') }
    finally { setSaving(null) }
  }

  const saveDocTypes = (types: string[]) => {
    setDocTypes(types)
    save('doc_type_labels', JSON.stringify(types))
  }

  const inputCls = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none w-full'

  if (!loaded) {
    return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
          <Settings2 size={22} className="text-[#84050C]" /> App Configuration
        </h1>

        {/* App Identity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">App Identity</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">App Name</label>
              <div className="flex gap-2 items-center">
                <input
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  className={inputCls}
                  onBlur={e => save('app_name', e.target.value)}
                />
                {saving === 'app_name' && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Organization Type</label>
              <div className="flex gap-4 flex-wrap">
                {['community', 'school', 'corporate', 'nonprofit'].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="org_type"
                      value={type}
                      checked={orgType === type}
                      onChange={() => { setOrgType(type); save('org_type', type) }}
                      className="text-[#84050C]"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Group Labels */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Group Labels</h2>
          <p className="text-xs text-gray-500 mb-4">Blur each field to save. Labels appear throughout the app.</p>
          <div className="space-y-3">
            {([
              ['group_label_l1', 'Level 1 label (e.g. Grade, Department, Division)', l1, setL1],
              ['group_label_l2', 'Level 2 label (e.g. Track, Strand, Stream)', l2, setL2],
              ['group_label_l3', 'Level 3 label (e.g. Section, Unit, Team)', l3, setL3],
            ] as [string, string, string, (v: string) => void][]).map(([key, placeholder, val, setter]) => (
              <div key={key} className="flex gap-2 items-center">
                <label className="text-xs text-gray-500 w-8 shrink-0 font-mono">
                  {key === 'group_label_l1' ? 'L1' : key === 'group_label_l2' ? 'L2' : 'L3'}
                </label>
                <input
                  value={val}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  className={inputCls}
                  onBlur={e => save(key, e.target.value)}
                />
                {saving === key && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Document Types */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Verification Document Types</h2>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {docTypes.length === 0
              ? <p className="text-xs text-gray-400">No document types yet.</p>
              : docTypes.map((t, i) => (
                <span key={i} className="flex items-center gap-1 bg-[#FEE2E2] text-[#84050C] rounded-full px-3 py-1 text-xs font-medium">
                  {t}
                  <button onClick={() => saveDocTypes(docTypes.filter((_, j) => j !== i))} className="hover:opacity-70 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              ))
            }
          </div>
          <div className="flex gap-2">
            <input
              ref={newDocRef}
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              placeholder="Add document type…"
              className={inputCls}
              onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { saveDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') } }}
            />
            <button
              onClick={() => { if (newDoc.trim()) { saveDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') } }}
              className="bg-[#84050C] text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-[#6b0409] transition-colors shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
