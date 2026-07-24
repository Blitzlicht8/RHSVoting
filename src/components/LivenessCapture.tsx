'use client'

// Session 10 (experimental) — realtime webcam face capture with liveness.
// Runs a detection loop and issues two challenges the user must pass live:
//   1. Blink (eye-aspect-ratio dips then recovers)
//   2. Turn head to the side (nose/eye geometry shifts past a threshold)
// On success it captures the 128-float descriptor from the live frame.
// Camera unavailable / denied → Skip path so flows are never hard-blocked.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, SkipForward } from 'lucide-react'
import Button from '@/components/ui/Button'
import { analyzeFace } from '@/lib/faceApi'

type Challenge = 'blink' | 'turn'
const SEQUENCE: Challenge[] = ['blink', 'turn']

const EAR_CLOSED = 0.20   // below → eyes closed
const EAR_OPEN = 0.28     // above → eyes open (hysteresis for a real blink)
const YAW_TURN = 0.15     // deviation from 0.5 that counts as a head turn

const PROMPTS: Record<Challenge, string> = {
  blink: 'Blink your eyes',
  turn: 'Slowly turn your head to the side',
}

type Props = {
  mode: 'enroll' | 'verify'
  onComplete: (descriptor: number[]) => void
  onSkip: (reason: string) => void
  busy?: boolean
  error?: string | null
}

export default function LivenessCapture({ mode, onComplete, onSkip, busy, error }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const doneRef = useRef(false)

  // Challenge progress (refs so the async loop reads fresh values)
  const stepRef = useRef(0)
  const blinkArmedRef = useRef(false)

  const [status, setStatus] = useState<'starting' | 'active' | 'unavailable'>('starting')
  const [prompt, setPrompt] = useState('Position your face in the frame')
  const [step, setStep] = useState(0)
  const [hint, setHint] = useState<string | null>(null)

  const stop = useCallback(() => {
    runningRef.current = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const loop = useCallback(async () => {
    if (!runningRef.current || doneRef.current) return
    const video = videoRef.current
    if (video && video.readyState >= 2) {
      const res = await analyzeFace(video)
      if (!doneRef.current) {
        if (!res.ok) {
          setHint(res.reason === 'multiple-faces' ? 'Only one face allowed' : 'Position your face in the frame')
        } else {
          setHint(null)
          const cur = SEQUENCE[stepRef.current]
          if (cur === 'blink') {
            if (res.ear < EAR_CLOSED) blinkArmedRef.current = true
            else if (res.ear > EAR_OPEN && blinkArmedRef.current) {
              blinkArmedRef.current = false
              advance(res.descriptor)
            }
          } else if (cur === 'turn') {
            if (Math.abs(res.yawRatio - 0.5) > YAW_TURN) advance(res.descriptor)
          }
        }
      }
    }
    if (runningRef.current && !doneRef.current) {
      rafRef.current = requestAnimationFrame(() => { void loop() })
    }
  }, [])

  const advance = (descriptor: number[]) => {
    const next = stepRef.current + 1
    if (next >= SEQUENCE.length) {
      doneRef.current = true
      setPrompt('Verified ✓')
      stop()
      onComplete(descriptor)
      return
    }
    stepRef.current = next
    setStep(next)
    setPrompt(PROMPTS[SEQUENCE[next]])
  }

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('unavailable'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('active')
        setPrompt(PROMPTS[SEQUENCE[0]])
        runningRef.current = true
        rafRef.current = requestAnimationFrame(() => { void loop() })
      } catch {
        setStatus('unavailable')
      }
    }
    start()
    return () => { cancelled = true; stop() }
  }, [loop, stop])

  if (status === 'unavailable') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-gray-600">
          Camera unavailable or permission denied.{' '}
          {mode === 'enroll'
            ? 'You can continue with just your uploaded photo.'
            : 'You can continue signing in without the face check.'}
        </p>
        <Button variant="secondary" size="lg" onClick={() => onSkip('camera-unavailable')} className="w-full">
          Continue without face check
        </Button>
      </div>
    )
  }

  const shown = error ?? hint

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 border border-gray-200">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-cover [transform:scaleX(-1)]" playsInline muted />
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 p-2">
          {SEQUENCE.map((c, i) => (
            <span key={c} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-green-500' : i === step ? 'bg-[#84050C]' : 'bg-white/60'}`} />
          ))}
        </div>
        {(status === 'starting' || busy) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-sm">
            {busy ? 'Matching…' : 'Starting camera…'}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/45 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-1.5">
          <Camera className="w-4 h-4" /> {prompt}
        </div>
      </div>

      {shown && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{shown}</p>
      )}

      <button
        type="button"
        onClick={() => { stop(); onSkip('user-skipped') }}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 py-1"
      >
        <SkipForward className="w-4 h-4" /> Skip face check
      </button>
      <p className="text-xs text-gray-400 text-center">
        Face processing stays on this device — no image or face data is sent to the server.
      </p>
    </div>
  )
}
