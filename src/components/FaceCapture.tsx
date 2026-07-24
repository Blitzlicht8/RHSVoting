'use client'

// Session 10 (experimental) — webcam capture for client-side face verification.
// Requests camera, lets the user capture a frame, computes a descriptor in-browser
// and hands it back. If the camera is unavailable or denied, exposes a Skip path so
// login is never hard-blocked.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, SkipForward, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import { scanFace, FACE_SCAN_MESSAGES } from '@/lib/faceApi'

type Props = {
  onCaptured: (descriptor: number[]) => void
  onSkip: (reason: string) => void
  matching?: boolean
  error?: string | null
}

export default function FaceCapture({ onCaptured, onSkip, matching, error }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'starting' | 'ready' | 'scanning' | 'unavailable'>('starting')
  const [localError, setLocalError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('ready')
      } catch {
        setStatus('unavailable')
      }
    }
    start()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [stopStream])

  const handleCapture = async () => {
    if (!videoRef.current) return
    setLocalError(null)
    setStatus('scanning')
    const result = await scanFace(videoRef.current)
    if (result.ok) {
      onCaptured(result.descriptor)
      setStatus('ready')
    } else {
      setLocalError(FACE_SCAN_MESSAGES[result.reason])
      setStatus('ready')
    }
  }

  if (status === 'unavailable') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Camera unavailable or permission denied. You can continue signing in without the face check.
        </p>
        <Button variant="secondary" size="lg" onClick={() => onSkip('camera-unavailable')} className="w-full">
          Continue without face check
        </Button>
      </div>
    )
  }

  const shown = localError ?? error

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 border border-gray-200">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-cover [transform:scaleX(-1)]" playsInline muted />
        {(status === 'starting' || status === 'scanning' || matching) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-sm">
            {status === 'starting' ? 'Starting camera…' : matching ? 'Matching…' : 'Scanning…'}
          </div>
        )}
      </div>

      {shown && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{shown}</p>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleCapture}
          disabled={status !== 'ready' || matching}
          className="flex-1"
        >
          {shown ? <RefreshCw className="w-4 h-4 mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
          {shown ? 'Retry face scan' : 'Verify my face'}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => { stopStream(); onSkip('user-skipped') }} disabled={matching}>
          <SkipForward className="w-4 h-4 mr-1" />
          Skip
        </Button>
      </div>
      <p className="text-xs text-gray-400 text-center">
        Your face is compared on this device only — no image or face data is sent to the server.
      </p>
    </div>
  )
}
