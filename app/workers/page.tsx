import dynamic from 'next/dynamic'

const WorkersClient = dynamic(() => import('./workers-client'), { ssr: false })

export default function WorkersPage() {
  return <WorkersClient />
}
