'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const tabs = [
  {
    href: '/',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={active ? 'currentColor' : 'none'} />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill={active ? 'currentColor' : 'none'} />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        {active && <><line x1="9" y1="15" x2="11" y2="17" stroke="white" strokeWidth="2"/><line x1="11" y1="17" x2="15" y2="13" stroke="white" strokeWidth="2"/></>}
      </svg>
    ),
  },
  {
    href: '/workers',
    label: 'Workers',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" fill={active ? 'currentColor' : 'none'} />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" strokeWidth={active ? 3 : 2} />
        <line x1="12" y1="20" x2="12" y2="4" strokeWidth={active ? 3 : 2} />
        <line x1="6" y1="20" x2="6" y2="14" strokeWidth={active ? 3 : 2} />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(42, 42, 61, 0.8)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center justify-around pt-2 pb-1 px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 touch-target"
              style={{
                color: isActive ? '#a78bfa' : '#606080',
                minWidth: '52px',
              }}
            >
              <div
                className="relative"
                style={{
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s ease',
                }}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-full blur-md opacity-40"
                    style={{ background: '#7c3aed', transform: 'scale(1.5)' }}
                  />
                )}
                <div className="relative">{tab.icon(isActive)}</div>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '0.02em',
                }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 touch-target"
          style={{ color: '#ef4444', minWidth: '52px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ transform: 'scale(1)', transition: 'transform 0.2s ease' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 400, letterSpacing: '0.02em' }}>خروج</span>
        </button>
      </div>
    </nav>
  )
}

