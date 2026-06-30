import WorkerProfileClient from './worker-profile-client'

export default function WorkerProfilePage({ params }: { params: { id: string } }) {
  return <WorkerProfileClient workerId={params.id} />
}
