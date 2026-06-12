import Spinner from '@/components/ui/Spinner'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Spinner size="xl" />
    </div>
  )
}
