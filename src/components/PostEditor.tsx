'use client'
import { useRef, useState, useCallback } from 'react'
import { uploadPostMedia } from '@/lib/uploadMedia'

export interface Block {
  id: string
  type: 'text' | 'image' | 'video' | 'embed'
  subtype?: 'normal' | 'heading' | 'subheading'
  content: string
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function emptyBlock(): Block {
  return { id: uid(), type: 'text', subtype: 'normal', content: '' }
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface PlusMenuProps {
  onClose: () => void
  onImageFile: () => void
  onVideoFile: () => void
  onEmbedUrl: () => void
  onImageUrl: () => void
}

function PlusMenu({ onClose, onImageFile, onVideoFile, onEmbedUrl, onImageUrl }: PlusMenuProps) {
  return (
    <div className="absolute left-7 top-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[180px] py-1" onMouseLeave={onClose}>
      <button onClick={() => { onImageFile(); onClose() }} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        Upload Image
      </button>
      <button onClick={() => { onVideoFile(); onClose() }} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Upload Video
      </button>
      <button onClick={() => { onEmbedUrl(); onClose() }} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Embed Video URL
      </button>
      <button onClick={() => { onImageUrl(); onClose() }} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Embed Image URL
      </button>
    </div>
  )
}

export interface PostEditorProps {
  value: Block[]
  onChange: (blocks: Block[]) => void
}

interface BlockWithFile extends Block {
  _file?: File
}

export default function PostEditor({ value, onChange }: PostEditorProps) {
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [plusOpenId, setPlusOpenId] = useState<string | null>(null)

  const imageRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const videoRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Latest blocks ref so async uploads write against fresh state (paste/drop can
  // insert several blocks before the first upload resolves).
  const valueRef = useRef(value)
  valueRef.current = value

  const uploadFile = useCallback(async (file: File, blockId: string) => {
    setUploadingIds(s => new Set(s).add(blockId))
    try {
      const url = await uploadPostMedia(file)
      if (url) {
        onChange(valueRef.current.map(b => b.id === blockId ? { ...b, content: url } : b))
      } else {
        // Upload failed — drop the placeholder block rather than keep a blob: URL.
        onChange(valueRef.current.filter(b => b.id !== blockId))
      }
    } finally {
      setUploadingIds(s => { const n = new Set(s); n.delete(blockId); return n })
    }
  }, [onChange])

  const insertAfter = useCallback((afterId: string, newBlock: BlockWithFile) => {
    const idx = value.findIndex(b => b.id === afterId)
    const clean: Block = { id: newBlock.id, type: newBlock.type, subtype: newBlock.subtype, content: newBlock.content }
    const next = [...value]
    next.splice(idx + 1, 0, clean)
    onChange(next)
    if (newBlock._file) {
      uploadFile(newBlock._file, newBlock.id)
    }
  }, [value, onChange, uploadFile])

  const updateBlock = useCallback((id: string, updated: Partial<Block>) => {
    onChange(value.map(b => b.id === id ? { ...b, ...updated } : b))
  }, [value, onChange])

  const deleteBlock = useCallback((id: string) => {
    const next = value.filter(b => b.id !== id)
    onChange(next.length === 0 ? [emptyBlock()] : next)
  }, [value, onChange])

  // Paste / drag-drop path: append image & video files as blocks, then upload
  // each through the SAME handler as the button path (no persisted blob: URLs).
  const appendMediaFiles = useCallback((files: File[]) => {
    const media = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (media.length === 0) return
    const newBlocks: Block[] = media.map(f => ({
      id: uid(),
      type: f.type.startsWith('video/') ? 'video' : 'image',
      content: URL.createObjectURL(f),
    }))
    onChange([...valueRef.current, ...newBlocks])
    media.forEach((f, i) => uploadFile(f, newBlocks[i].id))
  }, [onChange, uploadFile])

  return (
    <div
      className="space-y-1 min-h-[80px]"
      onPaste={e => {
        const files = Array.from(e.clipboardData?.files ?? [])
        if (files.some(f => f.type.startsWith('image/') || f.type.startsWith('video/'))) {
          e.preventDefault()
          appendMediaFiles(files)
        }
      }}
      onDragOver={e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() }}
      onDrop={e => {
        const files = Array.from(e.dataTransfer?.files ?? [])
        if (files.length) { e.preventDefault(); appendMediaFiles(files) }
      }}
    >
      {value.map((block) => {
        const isHovered = hoveredId === block.id
        const plusOpen = plusOpenId === block.id

        if (block.type === 'image') {
          return (
            <div key={block.id} className="relative group my-2">
              {uploadingIds.has(block.id) ? (
                <div className="w-full h-40 bg-gray-100 rounded-xl flex items-center justify-center text-sm text-gray-400 animate-pulse">Uploading image…</div>
              ) : (
                <img src={block.content} alt="" className="max-w-full rounded-xl max-h-96 object-contain" />
              )}
              <button onClick={() => deleteBlock(block.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <XIcon />
              </button>
            </div>
          )
        }

        if (block.type === 'video') {
          return (
            <div key={block.id} className="relative group my-2">
              {uploadingIds.has(block.id) ? (
                <div className="w-full h-40 bg-gray-100 rounded-xl flex items-center justify-center text-sm text-gray-400 animate-pulse">Uploading video…</div>
              ) : (
                <video src={block.content} controls className="w-full rounded-xl max-h-80" />
              )}
              <button onClick={() => deleteBlock(block.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <XIcon />
              </button>
            </div>
          )
        }

        if (block.type === 'embed') {
          const yt = block.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
          const tk = block.content.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
          const gd = block.content.match(/drive\.google\.com\/file\/d\/([^/]+)/)
          return (
            <div key={block.id} className="relative group my-2">
              {yt ? (
                <iframe className="w-full aspect-video rounded-xl" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen />
              ) : tk ? (
                <iframe className="w-full aspect-video rounded-xl" src={`https://www.tiktok.com/embed/${tk[1]}`} allowFullScreen />
              ) : gd ? (
                <iframe className="w-full aspect-video rounded-xl" src={`https://drive.google.com/file/d/${gd[1]}/preview`} allowFullScreen />
              ) : (
                <a href={block.content} target="_blank" rel="noopener noreferrer" className="text-[#84050C] underline text-sm break-all">{block.content}</a>
              )}
              <button onClick={() => deleteBlock(block.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <XIcon />
              </button>
            </div>
          )
        }

        // Text block
        const subtypeClass = block.subtype === 'heading'
          ? 'text-gray-900 font-bold text-xl'
          : block.subtype === 'subheading'
            ? 'text-gray-800 font-semibold text-base'
            : 'text-gray-800 text-sm'

        return (
          <div
            key={block.id}
            className="relative"
            onMouseEnter={() => setHoveredId(block.id)}
            onMouseLeave={() => { if (!plusOpen) { setHoveredId(null); setPlusOpenId(null) } }}
          >
            {/* Subtype selector */}
            {isHovered && (
              <div className="flex gap-1 mb-0.5">
                {(['normal', 'heading', 'subheading'] as const).map(st => (
                  <button key={st} onClick={() => updateBlock(block.id, { subtype: st })}
                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${block.subtype === st ? 'bg-[#84050C] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {st === 'normal' ? 'Normal' : st === 'heading' ? 'H1' : 'H2'}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-start gap-1">
              {/* Plus button */}
              <div className="relative w-6 flex-shrink-0 mt-0.5">
                {isHovered && (
                  <button
                    onClick={() => setPlusOpenId(plusOpen ? null : block.id)}
                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                  >
                    <PlusIcon />
                  </button>
                )}
                {plusOpen && (
                  <PlusMenu
                    onClose={() => { setPlusOpenId(null); setHoveredId(null) }}
                    onImageFile={() => imageRefs.current[block.id]?.click()}
                    onVideoFile={() => videoRefs.current[block.id]?.click()}
                    onEmbedUrl={() => {
                      const url = prompt('Paste video URL (YouTube, TikTok, Drive, .mp4…):')
                      if (url?.trim()) insertAfter(block.id, { id: uid(), type: 'embed', content: url.trim() })
                    }}
                    onImageUrl={() => {
                      const url = prompt('Paste image URL:')
                      if (url?.trim()) insertAfter(block.id, { id: uid(), type: 'image', content: url.trim() })
                    }}
                  />
                )}
              </div>

              {/* Contenteditable */}
              <div
                contentEditable
                suppressContentEditableWarning
                onInput={e => updateBlock(block.id, { content: (e.target as HTMLDivElement).innerText })}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    insertAfter(block.id, emptyBlock())
                  }
                  if (e.key === 'b' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.execCommand('bold') }
                  if (e.key === 'i' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.execCommand('italic') }
                  if (e.key === 'u' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.execCommand('underline') }
                }}
                className={`flex-1 outline-none py-0.5 min-h-[1.5rem] ${subtypeClass} [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400`}
                data-placeholder={block.subtype === 'heading' ? 'Heading…' : block.subtype === 'subheading' ? 'Subheading…' : 'Write something…'}
              />
            </div>

            {/* Hidden file inputs for this block */}
            <input
              ref={el => { imageRefs.current[block.id] = el }}
              type="file" accept="image/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) insertAfter(block.id, { id: uid(), type: 'image', content: URL.createObjectURL(f), _file: f } as BlockWithFile)
              }}
            />
            <input
              ref={el => { videoRefs.current[block.id] = el }}
              type="file" accept="video/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) insertAfter(block.id, { id: uid(), type: 'video', content: URL.createObjectURL(f), _file: f } as BlockWithFile)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
