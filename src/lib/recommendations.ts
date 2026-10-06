import { metersToMiles, M_PER_MI, formatPaceSecPerMile } from './format'
import type { DashboardData } from './metrics'
import type { Activity } from '@prisma/client'

type RunFields = Pick<Activity, 'startTime' | 'avgSpeedMs' | 'avgHr'>

export type Recommendation = {
  title: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

/**
 * Rule-based training recommendations. Every rule reads only actual
 * computed metrics — nothing is invented, and no performance claims
 * are made beyond what the data shows.
 */
export function buildRecommendations(data: DashboardData, runs: RunFields[]): Recommendation[] {
  const recs: Recommendation[] = []
  const r = data.run
  const { daysToRace, weeksToRace, goalPaceSecPerMile } = data

  // --- Phase-aware guidance ---
  if (weeksToRace !== null && weeksToRace <= 1 && daysToRace !== null && daysToRace > 0) {
    recs.push({
      title: 'Race week',
      detail:
        'Keep runs short and easy with a few strides. No new fitness is coming — the goal now is arriving fresh.',
      tone: 'info',
    })
  } else if (weeksToRace !== null && weeksToRace <= 3) {
    recs.push({
      title: 'Taper time',
      detail:
        'Cut weekly volume roughly 20–30% per week while keeping a little intensity. Fitness is banked; freshness wins now.',
      tone: 'info',
    })
  }

  // --- Ramp-rate check ---
  if (r.mileageChangePct !== null) {
    if (r.mileageChangePct > 10) {
      recs.push({
        title: 'Volume ramping fast',
        detail: `Your 4-week average mileage is up ${Math.round(r.mileageChangePct)}% versus the prior four weeks. Common practice caps increases near 10% — consider a cutback week (~20–30% lower) to absorb it.`,
        tone: 'warn',
      })
    } else if (r.mileageChangePct < -15 && (weeksToRace ?? 99) > 4) {
      recs.push({
        title: 'Volume trending down',
        detail: `Mileage is down ${Math.abs(Math.round(r.mileageChangePct))}% versus the prior four weeks. If that was intentional recovery, fine — otherwise it may stall the build.`,
        tone: 'info',
      })
    }
  }

  // --- Long-run management ---
  if (r.daysSinceLongRun !== null && r.daysSinceLongRun > 14 && (weeksToRace ?? 99) > 3) {
    recs.push({
      title: 'Long run overdue',
      detail: `It has been ${r.daysSinceLongRun} days since your last long run. With ${weeksToRace} weeks to race day, aim for one this weekend.`,
      tone: 'warn',
    })
  } else if (r.longRunStreakWeeks >= 3) {
    recs.push({
      title: 'Long-run consistency',
      detail: `A long run in each of the past ${r.longRunStreakWeeks} weeks — that is exactly the backbone a marathon build needs.`,
      tone: 'good',
    })
  }

  // --- Marathon-specific: longest run vs typical peak ---
  if (
    data.race?.raceType === 'marathon' &&
    weeksToRace !== null &&
    weeksToRace > 3 &&
    weeksToRace <= 10
  ) {
    const longestMi = metersToMiles(r.longestRecentM)
    if (longestMi > 0 && longestMi < 16) {
      recs.push({
        title: 'Build the long run',
        detail: `Your longest run in the last four weeks is ${longestMi.toFixed(1)} mi. Marathon builds typically peak around 18–20 mi — keep progressing it ~1 mi per week.`,
        tone: 'info',
      })
    } else if (longestMi >= 18) {
      recs.push({
        title: 'Long-run distance is there',
        detail: `A ${longestMi.toFixed(1)} mi long run in the last four weeks — your peak distance is in solid marathon shape. Protect it with recovery.`,
        tone: 'good',
      })
    }
  }

  // --- Frequency ---
  if (r.runsThisWeek === 0 && new Date().getDay() >= 3) {
    recs.push({
      title: 'No runs yet this week',
      detail: 'It is already mid-week with zero runs logged — even a short easy run keeps the week from becoming a hole.',
      tone: 'warn',
    })
  } else if (r.consistencyPct !== null && r.consistencyPct < 40) {
    recs.push({
      title: 'Consistency is the gap',
      detail: `Only ${r.consistencyPct}% of days in the last 28 had a workout. Frequency beats volume for adaptation — adding one short session helps more than extending one long one.`,
      tone: 'info',
    })
  }

  // --- Goal-pace reality check ---
  if (goalPaceSecPerMile && r.avgRunPaceSecPerMile) {
    const gap = r.avgRunPaceSecPerMile - goalPaceSecPerMile
    if (gap > 90) {
      recs.push({
        title: 'Goal pace check',
        detail: `Recent runs average ${formatPaceSecPerMile(r.avgRunPaceSecPerMile)} vs goal pace ${formatPaceSecPerMile(goalPaceSecPerMile)}. Most of that volume should be easy — but consider tempo work at goal pace to rehearse it.`,
        tone: 'info',
      })
    } else if (gap <= 45 && gap > 0) {
      recs.push({
        title: 'Pace trending toward goal',
        detail: `Recent average pace (${formatPaceSecPerMile(r.avgRunPaceSecPerMile)}) is within ~${Math.round(gap)}s/mi of goal pace (${formatPaceSecPerMile(goalPaceSecPerMile)}).`,
        tone: 'good',
      })
    }
  }

  // --- Simple fatigue signal: last 2 weeks vs prior 2 weeks ---
  const now = Date.now()
  const recent = runs.filter((a) => a.startTime.getTime() > now - 14 * 86400000 && a.avgSpeedMs && a.avgHr)
  const prior = runs.filter(
    (a) =>
      a.startTime.getTime() > now - 28 * 86400000 &&
      a.startTime.getTime() <= now - 14 * 86400000 &&
      a.avgSpeedMs &&
      a.avgHr
  )
  if (recent.length >= 3 && prior.length >= 3) {
    const avg = (xs: RunFields[], f: (a: RunFields) => number) =>
      xs.reduce((s, a) => s + f(a), 0) / xs.length
    const paceNow = avg(recent, (a) => M_PER_MI / (a.avgSpeedMs ?? 1))
    const pacePrev = avg(prior, (a) => M_PER_MI / (a.avgSpeedMs ?? 1))
    const hrNow = avg(recent, (a) => a.avgHr ?? 0)
    const hrPrev = avg(prior, (a) => a.avgHr ?? 0)
    if (paceNow > pacePrev + 15 && hrNow > hrPrev + 4) {
      recs.push({
        title: 'Possible fatigue signal',
        detail: `Runs the last two weeks are slower (~${Math.round(paceNow - pacePrev)}s/mi) at higher heart rate (~${Math.round(hrNow - hrPrev)} bpm) than the prior two. A lighter few days usually fixes that.`,
        tone: 'warn',
      })
    } else if (paceNow < pacePrev - 10 && hrNow <= hrPrev + 2) {
      recs.push({
        title: 'Pace improving at same effort',
        detail: `Last two weeks are ~${Math.round(pacePrev - paceNow)}s/mi faster at similar heart rate — fitness is moving the right way.`,
        tone: 'good',
      })
    }
  }

  // Keep it digestible: warnings first, cap at 5.
  const order = { warn: 0, info: 1, good: 2 }
  return recs.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 5)
}
