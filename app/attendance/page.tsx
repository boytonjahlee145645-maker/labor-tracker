import dynamic from 'next/dynamic'

const AttendanceClient = dynamic(() => import('./attendance-client'), { ssr: false })

export default function AttendancePage() {
  return <AttendanceClient />
}
