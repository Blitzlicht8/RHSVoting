'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import Spinner from '@/components/ui/Spinner'

export default function JoinElectionPage() {
  const params = useParams()
  const token = params?.token as string
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ineligible' | 'error'>('loading')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/elections/join/${token}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/')
          return
        }
        const json = await res.json()
        if (res.status === 404) {
          setStatus('error')
          setReason('This link is invalid or the election no longer exists.')
          return
        }
        const data = json.data
        if (data?.eligible) {
          router.push(`/elections/${data.electionId}`)
        } else {
          setStatus('ineligible')
          setReason(data?.reason ?? "You're not eligible for this election.")
        }
      })
      .catch(() => {
        setStatus('error')
        setReason('Something went wrong. Please try again.')
      })
  }, [token, router])

  if (status === 'loading') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <Spinner size="xl" />
          <p className="text-gray-500 text-sm">Checking eligibility...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[#84050C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {status === 'error' ? 'Invalid Link' : 'Not Eligible'}
        </h1>
        <p className="text-gray-500 text-sm">{reason}</p>
        <Link
          href="/elections"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#84050C] hover:text-[#6B0409] border border-[#E2A8A4] hover:border-[#84050C]/50 px-4 py-2 rounded-lg transition-colors"
        >
          ← Back to Elections
        </Link>
      </div>
    </Layout>
  )
}
