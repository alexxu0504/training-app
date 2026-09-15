/**
 * Seed ~20 weeks of realistic triathlon training ending today, plus the
 * Philadelphia Marathon goal race. Deterministic RNG so reseeds are stable.
 * Run: `npm run seed` (idempotent — wipes and rebuilds demo data).
 */
import { prisma } from '../src/lib/db'
import { linkDuplicatesForUser } from '../src/lib/dedup'
import { recomputeWeeklyMetrics, startOfWeekMonday, addDays } from '../src/lib/metrics'
import { recomputePRs } from '../src/lib/prs'
import { encodePolyline } from '../src/lib/polyline'

// Deterministic PRNG
let rngState = 1337
function rng() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0
  return rngState / 2 ** 32
}
const rand = (lo: number, hi: number) => lo + rng() * (hi - lo)

const M_PER_MI = 1609.344
const PHILLY: [number, number] = [39.9526, -75.1652]

/** Circular route around Philadelphia sized to roughly match distanceM. */
function loopPolyline(distanceM: number, wobble = 0.25): string {
  const r = Math.max(distanceM / (2 * Math.PI), 150)
  const n = 40
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    const rr = r * (1 + wobble * Math.sin(a * 3 + rng() * 2))
    pts.push([
      PHILLY[0] + (rr / 111320) * Math.sin(a),
      PHILLY[1] + (rr / (111320 * Math.cos((PHILLY[0] * Math.PI) / 180))) * Math.cos(a),
    ])
  }
  return encodePolyline(pts)
}

type Act = {
  name: string
  sport: string
  sportDetail: string | null
  startTime: Date
  durationSec: number
  movingSec: number
  distanceM: number
  elevGainM: number
  avgHr: number
  maxHr: number
  avgSpeedMs: number
  calories: number
  hasGps: boolean
  polyline: string | null
  splits: { distanceM: number; durationSec: number; avgHr: number; elevDiffM: number }[]
}

function makeRun(start: Date, distMi: number, paceSecMi: number, hrBase: number, name: string): Act {
  const distanceM = distMi * M_PER_MI
  const miles = Math.floor(distMi)
  const splits = Array.from({ length: miles }, () => {
    const p = paceSecMi * rand(0.96, 1.05)
    return { distanceM: M_PER_MI, durationSec: Math.round(p), avgHr: Math.round(hrBase + rand(-4, 6)), elevDiffM: rand(-8, 8) }
  })
  const rem = distMi - miles
  if (rem > 0.05) splits.push({ distanceM: rem * M_PER_MI, durationSec: Math.round(rem * paceSecMi * rand(0.95, 1.05)), avgHr: Math.round(hrBase), elevDiffM: rand(-4, 4) })
  const durationSec = splits.reduce((s, x) => s + x.durationSec, 0)
  return {
    name,
    sport: 'run',
    sportDetail: 'Run',
    startTime: start,
    durationSec,
    movingSec: durationSec,
    distanceM,
    elevGainM: rand(15, 90),
    avgHr: Math.round(hrBase + rand(-3, 3)),
    maxHr: Math.round(hrBase + rand(18, 30)),
    avgSpeedMs: distanceM / durationSec,
    calories: Math.round(distMi * 105),
    hasGps: true,
    polyline: loopPolyline(distanceM),
    splits,
  }
}

function makeRide(start: Date, distMi: number, mph: number, hrBase: number, name: string): Act {
  const distanceM = distMi * M_PER_MI
  const durationSec = Math.round(distanceM / (mph / 2.236936))
  return {
    name,
    sport: 'bike',
    sportDetail: 'Ride',
    startTime: start,
    durationSec,
    movingSec: Math.round(durationSec * 0.97),
    distanceM,
    elevGainM: rand(150, 700),
    avgHr: Math.round(hrBase),
    maxHr: Math.round(hrBase + rand(20, 32)),
    avgSpeedMs: mph / 2.236936,
    calories: Math.round(distMi * 42),
    hasGps: true,
    polyline: loopPolyline(distanceM, 0.4),
    splits: [],
  }
}

function makeSwim(start: Date, distM: number, paceSec100: number, name: string): Act {
  const n = Math.floor(distM / 100)
  const splits = Array.from({ length: n }, () => ({
    distanceM: 100,
    durationSec: Math.round(paceSec100 * rand(0.95, 1.06)),
    avgHr: Math.round(rand(125, 145)),
    elevDiffM: 0,
  }))
  const durationSec = splits.reduce((s, x) => s + x.durationSec, 0) + n * 8 // +rest between 100s
  return {
    name,
    sport: 'swim',
    sportDetail: 'Swim',
    startTime: start,
    durationSec,
    movingSec: durationSec,
    distanceM: n * 100,
    elevGainM: 0,
    avgHr: Math.round(rand(128, 142)),
    maxHr: Math.round(rand(150, 160)),
    avgSpeedMs: (n * 100) / durationSec,
    calories: Math.round(distM * 0.28),
    hasGps: false,
    polyline: null,
    splits,
  }
}

function at(d: Date, h: number, m = 0) {
  const x = new Date(d)
  x.setHours(h, m, 0, 0)
  return x
}

async function main() {
  console.log('Seeding…')

  const user = await prisma.user.upsert({
    where: { email: 'alex@endurance.local' },
    create: { name: 'Alex', email: 'alex@endurance.local' },
    update: {},
  })

  // Clean slate for a repeatable demo.
  await prisma.activitySplit.deleteMany({ where: { activity: { userId: user.id } } })
  await prisma.activity.deleteMany({ where: { userId: user.id } })
  await prisma.weeklyMetric.deleteMany({ where: { userId: user.id } })
  await prisma.personalRecord.deleteMany({ where: { userId: user.id } })

  await prisma.race.deleteMany({ where: { userId: user.id } })
  await prisma.race.create({
    data: {
      userId: user.id,
      name: 'Philadelphia Marathon',
      date: new Date('2026-11-22T07:00:00-05:00'),
      distanceM: 42195,
      raceType: 'marathon',
      goalSec: 4 * 3600,
      isPrimary: true,
    },
  })

  const now = new Date()
  const thisMonday = startOfWeekMonday(now)
  const acts: Act[] = []

  // 20-week build. Weeks indexed back from this week (0 = current week).
  for (let w = 19; w >= 0; w--) {
    const monday = addDays(thisMonday, -7 * w)
    const isCutback = w % 4 === 0 && w !== 0 // every 4th week easier
    const block = Math.floor(w / 4) // 0..4, higher = earlier

    // Weekly run volume ramps from ~24 mi up to ~46 mi.
    const targetMiles = (24 + (19 - w) * 1.3) * (isCutback ? 0.72 : 1)
    // Long run: 10 -> 20 mi, cutbacks ~13.
    const longMi = isCutback ? 13 : Math.min(10 + (19 - w) * 0.6, 20)
    const easyPace = 555 - block * 4 + rand(-8, 8) // ~9:15 improving to ~9:00
    const longPace = easyPace + rand(15, 30)

    const runDays = [
      { d: 2, mi: targetMiles * 0.18, pace: easyPace, hr: 141, n: 'Easy Run' },        // Tue
      { d: 3, mi: targetMiles * 0.22, pace: easyPace - 40, hr: 156, n: 'Workout Run' }, // Wed
      { d: 5, mi: targetMiles * 0.16, pace: easyPace + 5, hr: 138, n: 'Recovery Run' }, // Fri
      { d: 6, mi: Math.min(longMi, targetMiles * 0.45), pace: longPace, hr: 148, n: 'Long Run' }, // Sat? use Sun
    ]
    // Long run on Sunday (d=0 of next week boundary -> d=7)
    for (const r of runDays) {
      const day = addDays(monday, r.d === 6 ? 0 : r.d) // long run day handled below
      if (r.d === 6) continue
      acts.push(makeRun(at(day, 6, 30), r.mi, r.pace, r.hr, r.n))
    }
    acts.push(makeRun(at(addDays(monday, 6), 7, 15), Math.min(longMi, targetMiles * 0.45), longPace, 148, 'Long Run'))
    if (!isCutback && rng() < 0.6) {
      acts.push(makeRun(at(addDays(monday, 1), 12, 0), rand(3, 4.5), easyPace + 20, 135, 'Lunch Run'))
    }

    // Bike: Mon + Thu steady, Sat long ride.
    acts.push(makeRide(at(addDays(monday, 1), 17, 30), rand(24, 32), rand(17.5, 19), 128, 'Evening Ride'))
    acts.push(makeRide(at(addDays(monday, 4), 17, 30), rand(26, 34), rand(18, 19.5), 132, 'Tempo Ride'))
    acts.push(makeRide(at(addDays(monday, 5), 8, 0), isCutback ? rand(34, 42) : rand(46, 62), rand(17, 18.5), 135, 'Long Ride'))

    // Swim: Wed morning + Sat.
    acts.push(makeSwim(at(addDays(monday, 3), 6, 0), Math.round(rand(1800, 2400)), rand(100, 110), 'Pool Swim'))
    acts.push(makeSwim(at(addDays(monday, 5), 10, 30), Math.round(rand(2000, 2800)), rand(98, 106), 'Endurance Swim'))
  }

  // Only include activities that already happened (don't seed the future).
  const past = acts.filter((a) => a.startTime <= now)
  for (const a of past) {
    await prisma.activity.create({
      data: {
        userId: user.id,
        source: 'strava',
        externalId: `seed-${a.startTime.getTime()}-${Math.round(a.distanceM)}`,
        name: a.name,
        sport: a.sport,
        sportDetail: a.sportDetail,
        startTime: a.startTime,
        durationSec: a.durationSec,
        movingSec: a.movingSec,
        distanceM: a.distanceM,
        elevGainM: a.elevGainM,
        avgHr: a.avgHr,
        maxHr: a.maxHr,
        avgSpeedMs: a.avgSpeedMs,
        calories: a.calories,
        hasGps: a.hasGps,
        polyline: a.polyline,
        splits: { create: a.splits.map((s, i) => ({ index: i, ...s })) },
      },
    })
  }

  // Simulate Garmin file-import duplicates for the 3 most recent runs:
  // same workout arriving from a second source must be linked, not double-counted.
  const recentRuns = await prisma.activity.findMany({
    where: { userId: user.id, sport: 'run' },
    orderBy: { startTime: 'desc' },
    take: 3,
  })
  for (const r of recentRuns) {
    const start = new Date(r.startTime.getTime() + 45_000) // +45s start offset
    await prisma.activity.create({
      data: {
        userId: user.id,
        source: 'file',
        externalId: `gdup-${r.externalId}`,
        name: `${r.name} (Garmin)`,
        sport: 'run',
        sportDetail: 'running',
        startTime: start,
        durationSec: r.durationSec + 20,
        movingSec: r.movingSec,
        distanceM: r.distanceM * 1.005,
        elevGainM: r.elevGainM,
        avgHr: r.avgHr,
        maxHr: r.maxHr,
        avgSpeedMs: r.avgSpeedMs,
        hasGps: true,
        polyline: r.polyline,
      },
    })
  }

  const linked = await linkDuplicatesForUser(user.id)
  await recomputeWeeklyMetrics(user.id)
  await recomputePRs(user.id)

  const total = await prisma.activity.count({ where: { userId: user.id } })
  console.log(`Seeded ${total} activities (${linked} duplicates linked).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
