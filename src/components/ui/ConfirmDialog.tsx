'use client'
import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default', onConfirm, onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  const isDestructive = variant === 'danger'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDestructive ? 'bg-red-50' : 'bg-yellow-50'}`}>
          {isDestructive ? <Trash2 size={22} className="text-red-600" /> : <AlertTriangle size={22} className="text-yellow-600" />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#84050C] hover:bg-[#6b0409]'}`}>
            {confirmLabel}
          </button>
        </div>
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>
    </div>
  )
}
