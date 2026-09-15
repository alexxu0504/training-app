'use client'

import { useRef, useState, useTransition } from 'react'
import { importFileAction, syncStravaAction } from '@/app/actions'

export function SyncStravaButton({ connected }: { connected: boolean }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!connected) {
    return (
      <a
        href="/api/auth/strava"
        className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e34402]"
      >
        Connect Strava
      </a>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null)
            const r = await syncStravaAction()
            setMsg(r.message)
          })
        }
        className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e34402] disabled:opacity-50"
      >
        {pending ? 'Syncing…' : 'Sync Strava now'}
      </button>
      {msg && <span className="text-xs text-zinc-400">{msg}</span>}
    </div>
  )
}

export function FileUpload() {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          setMsg(null)
          const r = await importFileAction(fd)
          setMsg(r.message)
          if (r.ok && inputRef.current) inputRef.current.value = ''
        })
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".fit,.tcx,.gpx"
        required
        className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? 'Importing…' : 'Import'}
      </button>
      {msg && <span className="text-xs text-zinc-400">{msg}</span>}
    </form>
  )
}
