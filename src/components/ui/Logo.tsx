export default function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z" fill="#84050C" opacity="0.15" />
      <path d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.6C34.3 44.3 42 34.5 42 24V12L24 4z" stroke="#84050C" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="16" y="18" width="4" height="3" rx="1" fill="#84050C" />
      <rect x="22" y="19" width="10" height="1.5" rx="0.75" fill="#84050C" />
      <rect x="16" y="24" width="4" height="3" rx="1" fill="#84050C" opacity="0.5" />
      <rect x="22" y="25" width="10" height="1.5" rx="0.75" fill="#84050C" opacity="0.5" />
      <path d="M18 20l1.5 1.5L22 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
