'use client'

import { usePathname, useRouter } from 'next/navigation'
import BottomNav from './bottom-nav'
import { useAuth } from '@/lib/auth-context'

export default function ConditionalNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, signOut } = useAuth()

  // Don't show nav on login page
  if (pathname === '/login') return null

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  return (
    <>
      {/* Logout button — small icon in top-right corner */}
      {session && (
        <button
          onClick={handleLogout}
          title="تسجيل خروج"
          style={{
            position: 'fixed', top: 16, left: 16, zIndex: 100,
            width: 36, height: 36, borderRadius: '10px',
            background: 'rgba(10,10,15,0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(42,42,61,0.8)',
            color: '#606080', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#606080'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(42,42,61,0.8)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      )}
      <BottomNav />
    </>
  )
}
