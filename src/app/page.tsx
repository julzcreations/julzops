import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SignInCard } from '@/components/SignInCard'
import { DashboardEmpty } from '@/components/DashboardEmpty'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) return <SignInCard />
  return <DashboardEmpty userEmail={session.user?.email ?? null} />
}
