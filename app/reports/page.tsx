import dynamic from 'next/dynamic'

const ReportsClient = dynamic(() => import('./reports-client'), { ssr: false })

export default function ReportsPage() {
  return <ReportsClient />
}
