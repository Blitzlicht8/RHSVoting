// Session 10 (experimental) — Client-side face verification helper.
// All face compute runs in the browser: model weights are static files under
// /public/models, so the server never does face detection or comparison.
// Library: @vladmandic/face-api (maintained fork of face-api.js) — chosen over
// MediaPipe because it ships a ready-made 128-float recognition descriptor
// (FaceRecognitionNet) that we can store and Euclidean-compare directly, whereas
// MediaPipe Face Landmarker only gives landmarks (we'd have to roll our own
// embedding). Bundle cost: weights ~7 MB, loaded lazily on first use only.

import type * as FaceApiNs from '@vladmandic/face-api'

const MODEL_URL = '/models'

// Match threshold on Euclidean distance between two 128-float descriptors.
// face-api.js docs recommend 0.6; we tighten slightly to 0.55 to reduce
// false-accepts for an additive auth factor. Tune from handoff.md test notes.
export const FACE_MATCH_THRESHOLD = 0.55

let faceapi: typeof FaceApiNs | null = null
let modelsLoaded = false
let loadPromise: Promise<typeof FaceApiNs> | null = null

/** Lazily import the library + load the three model sets. Safe to call repeatedly. */
export async function loadFaceModels(): Promise<typeof FaceApiNs> {
  if (faceapi && modelsLoaded) return faceapi
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const mod = await import('@vladmandic/face-api')
    await Promise.all([
      mod.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      mod.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      mod.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
    faceapi = mod
    modelsLoaded = true
    return mod
  })()
  return loadPromise
}

export type FaceScan =
  | { ok: true; descriptor: number[] }
  | { ok: false; reason: 'no-face' | 'multiple-faces' | 'error' }

/**
 * Detect faces in an image/video/canvas element and return a single 128-float
 * descriptor. Rejects when zero or more than one face is present.
 */
export async function scanFace(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<FaceScan> {
  try {
    const api = await loadFaceModels()
    const opts = new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
    const results = await api
      .detectAllFaces(input, opts)
      .withFaceLandmarks()
      .withFaceDescriptors()
    if (results.length === 0) return { ok: false, reason: 'no-face' }
    if (results.length > 1) return { ok: false, reason: 'multiple-faces' }
    return { ok: true, descriptor: Array.from(results[0].descriptor) }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Load a File into an <img> element and scan it. */
export async function scanFaceFromFile(file: File): Promise<FaceScan> {
  const url = URL.createObjectURL(file)
  try {
    const img = document.createElement('img')
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
    })
    return await scanFace(img)
  } catch {
    return { ok: false, reason: 'error' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Euclidean distance between two descriptors. Lower = more similar. */
export function faceDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function isFaceMatch(a: number[], b: number[], threshold = FACE_MATCH_THRESHOLD): boolean {
  return faceDistance(a, b) <= threshold
}

export const FACE_SCAN_MESSAGES: Record<'no-face' | 'multiple-faces' | 'error', string> = {
  'no-face': 'No face detected — use a clear, well-lit photo showing your face.',
  'multiple-faces': 'Multiple faces detected — the photo must show only you.',
  error: 'Face check could not run. Try a different photo or continue without it.',
}
