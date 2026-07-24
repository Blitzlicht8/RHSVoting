// Uploads a post image/video to Vercel Blob via /api/upload and returns the
// server URL. Used by every composer media path (button, plus-menu, paste,
// drop) so a `blob:` object URL is NEVER persisted into post content.
export async function uploadPostMedia(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('purpose', 'post')
  const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
  const json = await res.json().catch(() => null)
  return json?.data?.url ?? null
}
