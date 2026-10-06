import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { ActivityTable } from '@/components/ActivityTable'
import { Card } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ActivitiesPage() {
  const user = await getCurrentUser()
  const activities = await prisma.activity.findMany({
    where: { userId: user.id },
    orderBy: { startTime: 'desc' },
    take: 200,
    omit: { rawJson: true, streamsJson: true, polyline: true },
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide">Activities</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All sources. Rows marked <span className="text-zinc-400">dup</span> are duplicates
          excluded from metrics.
        </p>
      </div>
      <Card>
        <ActivityTable activities={activities} />
      </Card>
    </div>
  )
}
