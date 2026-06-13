'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 5

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setVisible(true))
    const removeTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, 4000)
    return () => {
      cancelAnimationFrame(enterFrame)
      clearTimeout(removeTimer)
    }
  }, [toast.id, onRemove])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div
      className={[
        'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-full shadow-lg',
        'backdrop-blur-sm border text-sm font-medium transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        toast.type === 'success' ? 'bg-green-50/95 border-green-200 text-green-800' : '',
        toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' : '',
        toast.type === 'info' ? 'bg-blue-50/95 border-blue-200 text-blue-800' : '',
        toast.type === 'warning' ? 'bg-yellow-50/95 border-yellow-200 text-yellow-800' : '',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0">
        {toast.type === 'success' && <CheckCircle2 size={16} />}
        {toast.type === 'error' && <XCircle size={16} />}
        {toast.type === 'info' && <Info size={16} />}
        {toast.type === 'warning' && <AlertTriangle size={16} />}
      </span>
      <span className="flex-1 max-w-xs">{toast.message}</span>
      <button
        onClick={handleClose}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = `toast-${++counterRef.current}-${Date.now()}`
    setToasts((prev) => {
      const next = [...prev, { id, message, type }]
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
