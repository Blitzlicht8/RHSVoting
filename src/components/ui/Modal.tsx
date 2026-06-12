'use client'

import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}

const MAX_WIDTHS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[384px]',
  md: 'max-w-[512px]',
  lg: 'max-w-[640px]',
  xl: 'max-w-[800px]',
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const prevOpen = useRef(false)

  // Mount on client only
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle open/close animation
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      // Opening: mount immediately then animate in
      const raf = requestAnimationFrame(() => {
        setVisible(true)
      })
      prevOpen.current = true
      return () => cancelAnimationFrame(raf)
    } else if (!isOpen && prevOpen.current) {
      // Closing: animate out
      setVisible(false)
      prevOpen.current = false
    }
  }, [isOpen])

  // ESC key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!mounted || typeof document === 'undefined') return null
  if (!isOpen && !visible) return null

  const content = (
    <div
      className={[
        'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4',
        'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={[
          'bg-white rounded-2xl shadow-2xl w-full overflow-y-auto max-h-[90vh] flex flex-col',
          MAX_WIDTHS[size],
          'transition-all duration-200',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title !== undefined) && (
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
            <h2 id="modal-title" className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-5 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
