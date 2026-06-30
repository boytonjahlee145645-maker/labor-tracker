import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/bottom-nav'
import ServiceWorkerRegistrar from '@/components/sw-register'
import { AuthProvider } from '@/lib/auth-context'
import AuthGuard from '@/components/auth-guard'
import ConditionalNav from '@/components/conditional-nav'

export const metadata: Metadata = {
  title: 'Labor Tracker',
  description: 'Manage factory workers and track contractor earnings',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Labor Tracker',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegistrar />
        <AuthProvider>
          <AuthGuard>
            <main className="min-h-dvh pb-nav">{children}</main>
            <ConditionalNav />
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  )
}

