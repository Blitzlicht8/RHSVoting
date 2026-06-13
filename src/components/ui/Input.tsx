'use client'

import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
  leftIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, leftIcon, className = '', id, ...rest }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    const inputClasses = [
      'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 bg-white transition-colors outline-none focus:ring-2 placeholder:text-gray-400',
      leftIcon ? 'pl-10' : '',
      error
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300 focus:ring-[#84050C] focus:border-[#84050C]',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input ref={ref} id={inputId} className={inputClasses} {...rest} />
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
        {helpText && !error && (
          <p className="text-xs text-gray-500 mt-1.5">{helpText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
