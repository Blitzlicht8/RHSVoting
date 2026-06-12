const VARIANTS = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  ended: 'bg-red-100 text-red-700',
} as const

export default function StatusBadge({ status }: { status: 'draft' | 'active' | 'ended' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${VARIANTS[status]}`}>
      {status}
    </span>
  )
}
