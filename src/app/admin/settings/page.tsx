'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { APP_VERSION } from '@/lib/version'

interface ToggleRowProps {
  label: string
  description: string
  isOn: boolean
  disabled?: boolean
  onToggle: () => void
}

function ToggleRow({ label, description, isOn, disabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <div className="text-sm text-gray-500 mt-0.5">{description}</div>
      </div>
      <button
        disabled={disabled}
        onClick={onToggle}
        className={[
          'relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mt-0.5',
          isOn ? 'bg-indigo-600' : 'bg-gray-300',
        ].join(' ')}
        aria-label={label}
        role="switch"
        aria-checked={isOn}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform m-0.5',
            isOn ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

interface SectionCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

function SectionCard({ title, children, className = '' }: SectionCardProps) {
  return (
    <div className={['bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className].join(' ')}>
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-4 divide-y divide-gray-100">{children}</div>
    </div>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 font-mono">{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  useEffect(() => {
    if (!authLoading && user && user.role !== 'master_admin') {
      router.replace('/dashboard')
    }
  }, [authLoading, user, router])

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      const json = await res.json()
      if (res.ok) {
        setSettings(json.data.settings)
      } else {
        addToast(json.error || 'Failed to load settings', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const toggleSetting = async (key: string) => {
    const current = settings[key]
    const next = current === 'true' ? 'false' : 'true'
    setTogglingKey(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: next }),
      })
      const json = await res.json()
      if (res.ok) {
        setSettings((s) => ({ ...s, [key]: next }))
        addToast('Setting updated', 'success')
      } else {
        addToast(json.error || 'Update failed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setTogglingKey(null)
    }
  }

  const handleResetConfirm = () => {
    setShowResetModal(false)
    setResetConfirmText('')
    addToast('This feature is not yet implemented', 'info')
  }

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (!user || user.role !== 'master_admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-1">Only master admins can access settings.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const autoVerifyOn = settings['auto_verify_id'] === 'true'
  const otpRequiredOn = settings['otp_required_login'] === 'true'

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <div className="space-y-4">
          {/* Card 1: Verification Settings */}
          <SectionCard title="Verification Settings">
            <ToggleRow
              label="Auto-Approve ID Submissions"
              description="Automatically verify accounts when they upload a school ID. If disabled, admins must manually approve each submission."
              isOn={autoVerifyOn}
              disabled={togglingKey === 'auto_verify_id'}
              onToggle={() => toggleSetting('auto_verify_id')}
            />
          </SectionCard>

          {/* Card 2: Login & Security */}
          <SectionCard title="Login & Security">
            <ToggleRow
              label="Require OTP on Login"
              description="Users receive an OTP email each time they sign in. Adds an extra layer of security."
              isOn={otpRequiredOn}
              disabled={togglingKey === 'otp_required_login'}
              onToggle={() => toggleSetting('otp_required_login')}
            />
          </SectionCard>

          {/* Card 3: System Information */}
          <SectionCard title="System Information">
            <InfoRow label="App Version" value={`v${APP_VERSION}`} />
            <InfoRow label="Default Admin" value="admin@school.edu" />
            <InfoRow
              label="Environment"
              value={process.env.NODE_ENV || 'unknown'}
            />
            <div className="pt-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-700">
                  To change admin credentials, modify the database directly or contact your system administrator.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Card 4: Danger Zone */}
          <div className="bg-red-50/30 rounded-xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200">
              <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Reset All Elections</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    This will permanently delete all elections and voting data. This cannot be undone.
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => { setResetConfirmText(''); setShowResetModal(true) }}
                >
                  Reset All Elections
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => { setShowResetModal(false); setResetConfirmText('') }}
        title="Reset All Elections"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setShowResetModal(false); setResetConfirmText('') }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetConfirmText !== 'RESET'}
              onClick={handleResetConfirm}
            >
              Reset All Elections
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700 font-medium">
              This action will permanently delete ALL elections, positions, candidates, and votes. This cannot be undone.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <strong>RESET</strong> to confirm
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
