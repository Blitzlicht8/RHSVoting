'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Settings2, X } from 'lucide-react'

export default function AppConfigPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [docTypes, setDocTypes] = useState<string[]>([])
  const [newDoc, setNewDoc] = useState('')
  const newDocRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== 'master_admin') { router.replace('/admin'); return }
    if (user) {
      fetch('/api/settings', { credentials: 'include' }).then(r=>r.json())
        .then(j => {
          const s = j.data ?? {}
          setSettings(s)
          try { setDocTypes(JSON.parse(s.doc_type_labels ?? '[]')) } catch { setDocTypes([]) }
        })
    }
  }, [user])

  const save = async (key: string, value: string) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (res.ok) addToast('Saved', 'success')
    else addToast('Failed to save', 'error')
    setSettings(s => ({ ...s, [key]: value }))
  }

  const saveDocTypes = (types: string[]) => {
    setDocTypes(types)
    save('doc_type_labels', JSON.stringify(types))
  }

  const inputCls = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#84050C]/20 focus:border-[#84050C] outline-none w-full'
  const saveBtnCls = 'bg-[#84050C] text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-[#6b0409] transition-colors'

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
              <div className="flex gap-2">
                <input defaultValue={settings.app_name ?? 'Community Hub'} key={settings.app_name}
                  className={inputCls}
                  onBlur={e => save('app_name', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Organization Type</label>
              <div className="flex gap-3">
                {['community','school','corporate'].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="org_type" value={type}
                      checked={(settings.org_type ?? 'community') === type}
                      onChange={() => save('org_type', type)}
                      className="text-[#84050C]" />
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
          <p className="text-xs text-gray-500 mb-4">These labels appear throughout the app instead of hardcoded terms.</p>
          <div className="space-y-3">
            {([['group_label_l1','Level 1 (e.g. Grade, Department)','Group'],
               ['group_label_l2','Level 2 (e.g. Track, Division)','Subgroup'],
               ['group_label_l3','Level 3 (e.g. Section, Unit)','Unit']] as const).map(([key, placeholder, def]) => (
              <div key={key} className="flex gap-2 items-center">
                <input defaultValue={settings[key] ?? def} key={settings[key]}
                  placeholder={placeholder}
                  className={inputCls}
                  onBlur={e => save(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Document Types */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Verification Document Types</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {docTypes.map((t, i) => (
              <span key={i} className="flex items-center gap-1 bg-[#FEE2E2] text-[#84050C] rounded-full px-3 py-1 text-xs font-medium">
                {t}
                <button onClick={() => saveDocTypes(docTypes.filter((_,j)=>j!==i))} className="hover:opacity-70 ml-0.5">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input ref={newDocRef} value={newDoc} onChange={e=>setNewDoc(e.target.value)}
              placeholder="Add document type..."
              className={inputCls}
              onKeyDown={e => { if (e.key==='Enter' && newDoc.trim()) { saveDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') }}}
            />
            <button onClick={() => { if (newDoc.trim()) { saveDocTypes([...docTypes, newDoc.trim()]); setNewDoc('') }}}
              className={saveBtnCls}>Add</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}