import React, { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  actions?: ReactNode
  noPadding?: boolean
}

export default function Card({
  children,
  className = '',
  title,
  description,
  actions,
  noPadding = false,
}: CardProps) {
  const hasHeader = title !== undefined || description !== undefined || actions !== undefined

  return (
    <div
      className={['bg-white rounded-xl border border-gray-200 shadow-sm', className]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader && (
        <div className="flex justify-between items-start px-6 pt-6 pb-0 gap-4">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}
      {noPadding ? (
        children
      ) : (
        <div className="p-6">{children}</div>
      )}
    </div>
  )
}
