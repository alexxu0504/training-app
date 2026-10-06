import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { getDashboardData } from '@/lib/metrics'
import { buildRecommendations } from '@/lib/recommendations'
import { GoalRaceCard } from '@/components/GoalRaceCard'
import { ReadinessCard } from '@/components/ReadinessCard'
import { RecommendationsCard } from '@/components/RecommendationsCard'
import { SportCards } from '@/components/SportCards'
import { MileageChart } from '@/components/MileageChart'
import { StackedHoursChart } from '@/components/StackedHoursChart'
import { TrainingCalendar, type DayActivity } from '@/components/TrainingCalendar'
import { ActivityTable } from '@/components/ActivityTable'
import { Card, SportDot } from '@/components/ui'
import { formatDuration, formatMiles } from '@/lib/format'

export const dynamic = 'force-dynamic'

function isoDay(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function Dashboard() {
  const user = await getCurrentUser()

  // Calendar: activities in the visible month.
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const [data, recent, monthActs] = await Promise.all([
    getDashboardData(user.id),
    prisma.activity.findMany({
      where: { userId: user.id, duplicateOfId: null },
      orderBy: { startTime: 'desc' },
      take: 8,
      omit: { rawJson: true, streamsJson: true, polyline: true },
    }),
    prisma.activity.findMany({
      where: { userId: user.id, duplicateOfId: null, startTime: { gte: monthStart } },
      select: { startTime: true, sport: true },
    }),
  ])

  const recs = buildRecommendations(data, data.recentRuns)
  const calDays: Record<string, DayActivity> = {}
  for (const a of monthActs) {
    const key = isoDay(a.startTime)
    calDays[key] ??= { sports: [], count: 0 }
    if (!calDays[key].sports.includes(a.sport)) calDays[key].sports.push(a.sport)
    calDays[key].count++
  }

  return (
    <div className="space-y-5">
      <GoalRaceCard
        race={data.race}
        daysToRace={data.daysToRace}
        weeksToRace={data.weeksToRace}
        phase={data.phase}
        goalPaceSecPerMile={data.goalPaceSecPerMile}
      />

      <RecommendationsCard recs={recs} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <ReadinessCard data={data} />
          <Card title="This week by sport">
            <SportCards
              swim={data.thisWeek.swim}
              bike={data.thisWeek.bike}
              run={data.thisWeek.run}
              history={data.sportHistory}
            />
          </Card>
          <Card
            title="Training hours / week"
            right={
              <span className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1"><SportDot sport="run" size={7} />Run</span>
                <span className="flex items-center gap-1"><SportDot sport="bike" size={7} />Bike</span>
                <span className="flex items-center gap-1"><SportDot sport="swim" size={7} />Swim</span>
              </span>
            }
          >
            <StackedHoursChart weeks={data.weeklyHours} />
          </Card>
          <Card
            title="Run mileage — last 16 weeks"
            right={<span className="text-[11px] text-zinc-500"><span className="text-amber-400">●</span> longest run</span>}
          >
            <MileageChart weeks={data.weeklyRunHistory} />
          </Card>
        </div>
        <div className="space-y-5">
          <TrainingCalendar days={calDays} />
          <Card title="This week — all sports">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Sessions</span>
                <span className="stat-num font-semibold">{data.thisWeekTotals.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total time</span>
                <span className="stat-num font-semibold">{formatDuration(data.thisWeekTotals.durationSec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total distance</span>
                <span className="stat-num font-semibold">{formatMiles(data.thisWeekTotals.distanceM)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Highest-mileage week (run)</span>
                <span className="stat-num font-semibold">{data.run.highestWeekMiles.toFixed(1)} mi</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Recent activities">
        <ActivityTable activities={recent} />
      </Card>
    </div>
  )
}
