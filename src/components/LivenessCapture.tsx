'use client'

// Session 10 — realtime webcam face ENROLLMENT with liveness.
// Runs a fast landmarks-only loop and requires two live challenges (blink, then
// head-turn) before capturing the 128-float descriptor. All compute is on-device.
// Used for enrollment (register + admin-prompted re-enroll). Login uses the
// lighter single-shot FaceCapture to compare against the stored descriptor.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import Button from '@/components/ui/Button'
import { faceLivenessMetrics, scanFace } from '@/lib/faceApi'

// Head-pose challenges — the 68-landmark model tracks nose/eye geometry far more
// reliably than eyelids, so pose beats blink for low-res webcams. We first
// CALIBRATE the user's resting yaw (their "forward"), then require movement
// RELATIVE to that baseline — so a naturally off-centre face can't auto-pass.
type Challenge = 'calibrate' | 'turn' | 'center'
const SEQUENCE: Challenge[] = ['calibrate', 'turn', 'center']
const CALIBRATE_SAMPLES = 8   // frames of "hold still" to average into a baseline
const YAW_TURN_DELTA = 0.10   // move this far from baseline → "turned"
const YAW_CENTER_DELTA = 0.05 // back within this of baseline → "forward"
const PROMPTS: Record<Challenge, string> = {
  calibrate: 'Hold still and look at the camera',
  turn: 'Slowly turn your head to one side',
  center: 'Now face forward again',
}

type Props = {
  onComplete: (descriptor: number[]) => void
  onSkip?: (reason: string) => void   // omit to disallow skipping (hard-block)
}

export default function LivenessCapture({ onComplete, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const doneRef = useRef(false)
  const stepRef = useRef(0)
  const capturingRef = useRef(false)
  const yawSamplesRef = useRef<number[]>([])
  const yawBaseRef = useRef(0.5)

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

  const advance = useCallback(async () => {
    const next = stepRef.current + 1
    if (next >= SEQUENCE.length) {
      capturingRef.current = true
      setPrompt('Hold still…')
      const scan = await scanFace(videoRef.current!)
      if (!scan.ok) { capturingRef.current = false; setHint('Hold still and face the camera'); return }
      doneRef.current = true
      setPrompt('Captured ✓')
      stop()
      onComplete(scan.descriptor)
      return
    }
    stepRef.current = next
    setStep(next)
    setPrompt(PROMPTS[SEQUENCE[next]])
  }, [onComplete, stop])

  const loop = useCallback(async () => {
    if (!runningRef.current || doneRef.current) return
    const video = videoRef.current
    if (video && video.readyState >= 2 && !capturingRef.current) {
      const res = await faceLivenessMetrics(video)
      if (!doneRef.current) {
        if (!res.ok) {
          setHint(res.reason === 'multiple-faces' ? 'Only one face allowed' : 'Position your face in the frame')
        } else {
          setHint(null)
          const cur = SEQUENCE[stepRef.current]
          if (cur === 'calibrate') {
            const arr = yawSamplesRef.current
            arr.push(res.yawRatio)
            if (arr.length >= CALIBRATE_SAMPLES) {
              yawBaseRef.current = arr.reduce((s, v) => s + v, 0) / arr.length
              await advance()
            }
          } else if (cur === 'turn') {
            if (Math.abs(res.yawRatio - yawBaseRef.current) > YAW_TURN_DELTA) await advance()
          } else if (cur === 'center') {
            if (Math.abs(res.yawRatio - yawBaseRef.current) < YAW_CENTER_DELTA) await advance()
          }
        }
      }
    }
    if (runningRef.current && !doneRef.current) rafRef.current = requestAnimationFrame(() => { void loop() })
  }, [advance])

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('unavailable'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setStatus('active'); setPrompt(PROMPTS[SEQUENCE[0]])
        runningRef.current = true
        rafRef.current = requestAnimationFrame(() => { void loop() })
      } catch { setStatus('unavailable') }
    }
    start()
    return () => { cancelled = true; stop() }
  }, [loop, stop])

  if (status === 'unavailable') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          A working camera is required to register your face. Enable camera access and reload.
        </p>
        {onSkip && (
          <Button variant="secondary" size="lg" onClick={() => onSkip('camera-unavailable')} className="w-full">
            Continue without face
          </Button>
        )}
      </div>
    )
  }

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
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-sm">Starting camera…</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/45 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-1.5">
          <Camera className="w-4 h-4" /> {prompt}
        </div>
      </div>
      {hint && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{hint}</p>}
      {onSkip && (
        <button type="button" onClick={() => { stop(); onSkip('user-skipped') }}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">Skip</button>
      )}
      <p className="text-xs text-gray-400 text-center">Face processing stays on this device — nothing is sent to the server.</p>
    </div>
  )
}
