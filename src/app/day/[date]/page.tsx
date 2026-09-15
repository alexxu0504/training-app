import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { Card } from '@/components/ui'
import { ActivityTable } from '@/components/ActivityTable'

export const dynamic = 'force-dynamic'

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const user = await getCurrentUser()
  const day = new Date(`${date}T00:00:00`)
  const next = new Date(day)
  next.setDate(next.getDate() + 1)

  const activities = isNaN(day.getTime())
    ? []
    : await prisma.activity.findMany({
        where: {
          userId: user.id,
          duplicateOfId: null,
          startTime: { gte: day, lt: next },
        },
        orderBy: { startTime: 'asc' },
      })

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold">
          {isNaN(day.getTime())
            ? 'Invalid date'
            : day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h1>
      </div>
      <Card>
        {activities.length ? (
          <ActivityTable activities={activities} />
        ) : (
          <p className="text-sm text-zinc-500">Rest day — no workouts recorded.</p>
        )}
      </Card>
    </div>
  )
}
