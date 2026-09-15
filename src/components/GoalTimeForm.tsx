'use client'

import { useState, useTransition } from 'react'
import { updateGoalTime } from '@/app/actions'
import { formatDuration } from '@/lib/format'

export function GoalTimeForm({ raceId, goalSec }: { raceId: string; goalSec: number | null }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(goalSec ? formatDuration(goalSec) : '4:00:00')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-zinc-500 underline decoration-dotted underline-offset-4 transition-colors hover:text-zinc-300"
      >
        Edit goal
      </button>
    )
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await updateGoalTime(raceId, value)
          setMsg(r.message)
          if (r.ok) setEditing(false)
        })
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="4:00:00"
        className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Cancel
      </button>
      {msg && !pending && <span className="text-xs text-amber-400">{msg}</span>}
    </form>
  )
}
