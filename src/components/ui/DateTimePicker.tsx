'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string // YYYY-MM-DDTHH:MM
  onChange: (val: string) => void
  min?: string
  placeholder?: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parse(val: string) {
  if (!val) return null
  const [d, t] = val.split('T')
  if (!d || !t) return null
  const [yr, mo, dy] = d.split('-').map(Number)
  const [hr, mn] = t.split(':').map(Number)
  if ([yr, mo, dy, hr, mn].some(isNaN)) return null
  return { yr, mo, dy, hr, mn }
}

function fmt(val: string): string {
  const p = parse(val)
  if (!p) return ''
  const h12 = p.hr % 12 || 12
  const ap = p.hr >= 12 ? 'PM' : 'AM'
  return `${MONTHS[p.mo - 1].slice(0, 3)} ${p.dy}, ${p.yr} · ${h12}:${String(p.mn).padStart(2, '0')} ${ap}`
}

function toISO(yr: number, mo: number, dy: number, hr: number, mn: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${yr}-${pad(mo)}-${pad(dy)}T${pad(hr)}:${pad(mn)}`
}

function h12To24(h: number, ap: 'AM' | 'PM') {
  return ap === 'PM' ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h)
}

export default function DateTimePicker({ value, onChange, min, placeholder = 'Select date & time' }: Props) {
  const today = new Date()
  const p = parse(value)

  const [open, setOpen] = useState(false)
  const [viewYr, setViewYr] = useState(p?.yr ?? today.getFullYear())
  const [viewMo, setViewMo] = useState(p?.mo ?? (today.getMonth() + 1))
  const [selYr, setSelYr] = useState<number | null>(p?.yr ?? null)
  const [selMo, setSelMo] = useState<number | null>(p?.mo ?? null)
  const [selDy, setSelDy] = useState<number | null>(p?.dy ?? null)
  const [hr12, setHr12] = useState(p ? (p.hr % 12 || 12) : 8)
  const [mn, setMn] = useState(p?.mn ?? 0)
  const [ap, setAp] = useState<'AM' | 'PM'>(p ? (p.hr >= 12 ? 'PM' : 'AM') : 'AM')

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p2 = parse(value)
    if (p2) {
      setViewYr(p2.yr); setViewMo(p2.mo)
      setSelYr(p2.yr); setSelMo(p2.mo); setSelDy(p2.dy)
      setHr12(p2.hr % 12 || 12); setMn(p2.mn)
      setAp(p2.hr >= 12 ? 'PM' : 'AM')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const daysInMonth = new Date(viewYr, viewMo, 0).getDate()
  const firstDow = new Date(viewYr, viewMo - 1, 1).getDay()
  const minP = parse(min ?? '')

  function isDisabled(yr: number, mo: number, dy: number) {
    if (!minP) return false
    return yr * 10000 + mo * 100 + dy < minP.yr * 10000 + minP.mo * 100 + minP.dy
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function prevMo() {
    if (viewMo === 1) { setViewMo(12); setViewYr((y) => y - 1) } else setViewMo((m) => m - 1)
  }
  function nextMo() {
    if (viewMo === 12) { setViewMo(1); setViewYr((y) => y + 1) } else setViewMo((m) => m + 1)
  }

  function confirm() {
    if (!selYr || !selMo || !selDy) return
    onChange(toISO(selYr, selMo, selDy, h12To24(hr12, ap), mn))
    setOpen(false)
  }

  function clear() {
    onChange('')
    setSelYr(null); setSelMo(null); setSelDy(null)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#84050C] bg-white flex items-center justify-between gap-2 min-h-[38px]"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? fmt(value) : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg w-72 overflow-hidden left-0">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button type="button" onClick={prevMo} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">{MONTHS[viewMo - 1]} {viewYr}</span>
            <button type="button" onClick={nextMo} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* DOW headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DOW.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells — h-11 = 44px tap targets */}
          <div className="grid grid-cols-7 px-2 pb-2">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const disabled = isDisabled(viewYr, viewMo, day)
              const selected = selYr === viewYr && selMo === viewMo && selDy === day
              const isToday = viewYr === today.getFullYear() && viewMo === today.getMonth() + 1 && day === today.getDate()
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setSelYr(viewYr); setSelMo(viewMo); setSelDy(day) }}
                  className={[
                    'h-11 w-full flex items-center justify-center text-sm rounded-lg transition-colors',
                    disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : selected
                      ? 'bg-[#84050C] text-white font-semibold'
                      : isToday
                      ? 'ring-2 ring-[#84050C] ring-offset-1 text-[#84050C] font-medium hover:bg-[#FEE2E2]'
                      : 'text-gray-700 hover:bg-[#FEE2E2]',
                  ].join(' ')}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time picker — 12h with AM/PM */}
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Time</p>
            <div className="flex items-center gap-2 justify-center">
              <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => setHr12((h) => (h === 12 ? 1 : h + 1))} className="w-8 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <span className="text-xl font-semibold text-gray-900 w-8 text-center leading-tight">{String(hr12).padStart(2, '0')}</span>
                <button type="button" onClick={() => setHr12((h) => (h === 1 ? 12 : h - 1))} className="w-8 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              <span className="text-xl font-bold text-gray-400 leading-tight">:</span>
              <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => setMn((m) => (m + 5) % 60)} className="w-8 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <span className="text-xl font-semibold text-gray-900 w-8 text-center leading-tight">{String(mn).padStart(2, '0')}</span>
                <button type="button" onClick={() => setMn((m) => (m - 5 + 60) % 60)} className="w-8 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => setAp('AM')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${ap === 'AM' ? 'bg-[#84050C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >AM</button>
                <button
                  type="button"
                  onClick={() => setAp('PM')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${ap === 'PM' ? 'bg-[#84050C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >PM</button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-3 flex justify-between gap-2">
            <button type="button" onClick={clear} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Clear
            </button>
            <button
              type="button"
              disabled={!selYr || !selMo || !selDy}
              onClick={confirm}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#84050C] hover:bg-[#6B0409] rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
