'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Props {
  urls: string[]
  startIndex?: number
  onClose: () => void
}

export default function LightboxModal({ urls, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [zoomed, setZoomed] = useState(false)
  const url = urls[index]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, urls.length - 1))
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [urls.length, onClose])

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm">{index + 1} / {urls.length}</span>
          <div className="flex items-center gap-3">
            <a
              href={url}
              download
              target="_blank"
              rel="noreferrer"
              className="text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg"
              onClick={e => e.stopPropagation()}
            >
              Download
            </a>
            <button onClick={onClose} className="text-white text-2xl leading-none w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg">&#x2715;</button>
          </div>
        </div>

        <div className={`flex items-center justify-center overflow-auto ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}>
          {url.endsWith('.pdf') || url.includes('/pdf') ? (
            <iframe src={url} className="w-full h-[80vh] rounded-lg" title="Document" />
          ) : (
            <Image
              src={url}
              alt="Document"
              width={0}
              height={0}
              sizes="90vw"
              onClick={() => setZoomed(z => !z)}
              className={`rounded-lg transition-all duration-200 w-auto h-auto ${zoomed ? 'max-w-none max-h-none' : 'max-h-[80vh] max-w-[90vw] object-contain'}`}
              style={{ width: 'auto', height: 'auto' }}
            />
          )}
        </div>

        {urls.length > 1 && (
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={() => setIndex(i => Math.max(i - 1, 0))}
              disabled={index === 0}
              className="text-white bg-white/20 hover:bg-white/30 disabled:opacity-30 px-4 py-2 rounded-lg"
            >&#8592; Prev</button>
            <button
              onClick={() => setIndex(i => Math.min(i + 1, urls.length - 1))}
              disabled={index === urls.length - 1}
              className="text-white bg-white/20 hover:bg-white/30 disabled:opacity-30 px-4 py-2 rounded-lg"
            >Next &#8594;</button>
          </div>
        )}
      </div>
    </div>
  )
}
