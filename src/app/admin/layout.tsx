import { redirect } from 'next/navigation'
import { getAuthUser, isAdmin } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/')
  if (!isAdmin(user.role)) redirect('/dashboard')
  return <>{children}</>
}
