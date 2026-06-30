import dynamic from 'next/dynamic'

// Disable SSR for this page since it uses Supabase client directly
const HomeClient = dynamic(() => import('./home-client'), { ssr: false })

export default function HomePage() {
  return <HomeClient />
}
