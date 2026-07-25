'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/components/providers/AuthProvider'
import { ArrowLeft } from 'lucide-react'

// Canonical single-post permalink. Renders the real PostCard (media/embeds and
// all) so a shared link opens the actual post, not a text excerpt.
export default function PostPermalinkPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => setPost(j.data?.post ?? null))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#84050C] mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : notFound || !post ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
            <p className="text-gray-500 text-sm">This post is unavailable or you don&apos;t have access to it.</p>
            <Link href="/feed" className="inline-block mt-3 text-sm text-[#84050C] font-medium hover:underline">Go to Feed</Link>
          </div>
        ) : (
          <PostCard
            post={post}
            currentUserId={user?.id ?? 0}
            currentUserRole={user?.role}
            currentUserIdVerified={!!user?.id_verified}
            onDelete={() => router.push('/feed')}
          />
        )}
      </div>
    </Layout>
  )
}
