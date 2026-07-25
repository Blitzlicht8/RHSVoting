'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface User {
  id: number
  email: string
  name: string
  role: 'master_admin' | 'admin' | 'moderator' | 'staff' | 'member' | string
  email_verified: boolean | number
  id_verified: boolean | number
  id_image: string | null
  active: boolean | number
  created_at: string
  needs_academic_update?: boolean | number
  avatar_url?: string | null
  bio?: string | null
  verification_status?: 'pending' | 'rejected' | null
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchMe = useCallback(async () => {
    // Abort a hung request so loading can't stay true forever (blank/infinite load).
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: controller.signal,
      })
      if (res.ok) {
        const json = await res.json()
        setUser(json.data ?? null)
      } else {
        setUser(null)
        // 401 = stale/invalid token. Cookie already cleared server-side; bounce to
        // landing ONCE (guarded by pathname) so we never loop back into a protected route.
        if (
          res.status === 401 &&
          typeof window !== 'undefined' &&
          window.location.pathname !== '/'
        ) {
          router.replace('/')
        }
      }
    } catch {
      setUser(null)
    } finally {
      clearTimeout(timer)
    }
  }, [router])

  useEffect(() => {
    fetchMe().finally(() => setLoading(false))
  }, [fetchMe])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore network errors — still clear local state
    }
    setUser(null)
    router.push('/')
  }, [router])

  const refetch = useCallback(async () => {
    await fetchMe()
  }, [fetchMe])

  return (
    <AuthContext.Provider value={{ user, loading, logout, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
