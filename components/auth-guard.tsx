'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const PUBLIC_ROUTES = ['/login']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublic = PUBLIC_ROUTES.includes(pathname)

  useEffect(() => {
    if (loading) return
    if (!session && !isPublic) {
      router.replace('/login')
    }
    if (session && isPublic) {
      router.replace('/')
    }
  }, [session, loading, isPublic, router])

  // Loading spinner
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid rgba(124,58,237,0.2)',
            borderTop: '3px solid #7c3aed',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#606080', fontSize: '13px' }}>جاري التحقق...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Don't render protected content if no session
  if (!session && !isPublic) return null
  // Don't render login if already logged in
  if (session && isPublic) return null

  return <>{children}</>
}
