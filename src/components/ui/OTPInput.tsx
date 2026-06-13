'use client'

import React, {
  ClipboardEvent,
  KeyboardEvent,
  useRef,
} from 'react'

export interface OTPInputProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  length?: number
}

export default function OTPInput({
  value,
  onChange,
  disabled = false,
  length = 6,
}: OTPInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>(
    Array.from({ length }, () => null)
  )

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focusIndex = (index: number) => {
    const el = inputRefs.current[index]
    if (el) {
      el.focus()
      // Move cursor to end
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }

  const updateValue = (newDigits: string[]) => {
    onChange(newDigits.join(''))
  }

  const handleChange = (index: number, raw: string) => {
    // Accept only the last typed character (could be replacement)
    const char = raw.replace(/\D/g, '').slice(-1)
    if (!char && raw !== '') return // non-digit typed, ignore

    const newDigits = [...digits]
    newDigits[index] = char

    updateValue(newDigits)

    if (char && index < length - 1) {
      focusIndex(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const newDigits = [...digits]
      if (newDigits[index]) {
        newDigits[index] = ''
        updateValue(newDigits)
      } else if (index > 0) {
        newDigits[index - 1] = ''
        updateValue(newDigits)
        focusIndex(index - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (index > 0) focusIndex(index - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (index < length - 1) focusIndex(index + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length)

    if (!pasted) return

    const newDigits = [...digits]
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i]
    }
    updateValue(newDigits)

    const lastFilled = Math.min(pasted.length - 1, length - 1)
    focusIndex(lastFilled)
  }

  return (
    <div className="flex gap-3" role="group" aria-label="One-time password input">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={[
            'w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl',
            'focus:ring-4 focus:ring-[#FEE2E2] outline-none transition-all cursor-text',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            digit
              ? 'border-[#BA4955] bg-[#FEE2E2]/60'
              : 'border-gray-300 bg-white',
            'focus:border-[#84050C]',
          ].join(' ')}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  )
}
