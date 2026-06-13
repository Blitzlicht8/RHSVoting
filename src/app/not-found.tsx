import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <p className="text-[9rem] font-black text-gray-200 leading-none select-none">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">Page not found</h1>
      <p className="text-gray-500 mt-2 text-sm max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#84050C] hover:bg-[#6B0409] rounded-lg transition-colors"
      >
        Go Home
      </Link>
    </div>
  )
}
