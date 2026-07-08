import Sidebar from '@/components/Sidebar'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="lf-main flex-1 overflow-auto">
        <div className="lf-page p-8">{children}</div>
      </main>
    </div>
  )
}
