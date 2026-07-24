'use client'

import { useEffect, useRef } from 'react'

/**
 * Guards against losing unsaved edits.
 * - `beforeunload`: blocks tab close / refresh / external navigation (native browser prompt).
 * - In-app link clicks: intercepts internal <a> navigations (Next.js App Router has no
 *   cancelable route-change event) and shows a confirm dialog before allowing the jump.
 *
 * Pass `dirty=true` while there are pending changes. `message` is used for the in-app confirm.
 */
export function useUnsavedGuard(dirty: boolean, message = 'You have unsaved changes. Discard them?') {
  // Keep latest values in refs so the listeners (installed once) always read fresh state.
  const dirtyRef = useRef(dirty)
  const messageRef = useRef(message)
  dirtyRef.current = dirty
  messageRef.current = message

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = '' // required for Chrome to show the native prompt
    }

    const onClickCapture = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      // Only left-click without modifier keys triggers SPA navigation
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      // Same-origin only; let external links fall through to beforeunload
      let dest: URL
      try { dest = new URL(anchor.href, window.location.href) } catch { return }
      if (dest.origin !== window.location.origin) return
      if (dest.pathname === window.location.pathname && dest.search === window.location.search) return
      if (!window.confirm(messageRef.current)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    // Capture phase so we intercept before Next.js Link's own handler
    document.addEventListener('click', onClickCapture, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [])
}
