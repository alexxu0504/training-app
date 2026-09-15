import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { stravaConfigured } from '@/lib/strava'
import { Card } from '@/components/ui'
import { FileUpload, SyncStravaButton } from '@/components/ActionButtons'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

const ERROR_TEXT: Record<string, string> = {
  strava_not_configured: 'Strava credentials are not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.',
  strava_denied: 'Strava authorization was denied.',
  strava_exchange: 'Strava token exchange failed. Check your credentials.',
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const user = await getCurrentUser()
  const accounts = await prisma.connectedAccount.findMany({ where: { userId: user.id } })
  const strava = accounts.find((a) => a.provider === 'strava')

  const err = typeof sp.error === 'string' ? ERROR_TEXT[sp.error] : null
  const connectedMsg = sp.connected === 'strava' ? 'Strava connected. Run a sync to import activities.' : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide">Import & connections</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect data sources or import Garmin export files.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}
      {connectedMsg && (
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {connectedMsg}
        </div>
      )}

      <Card title="Strava">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-zinc-400">
            {strava ? (
              <>
                <span className="font-medium text-emerald-400">Connected</span>
                {strava.providerUserId && <span className="text-zinc-500"> · athlete {strava.providerUserId}</span>}
                {strava.lastSyncAt && (
                  <span className="text-zinc-500"> · last sync {formatDateTime(strava.lastSyncAt)}</span>
                )}
              </>
            ) : stravaConfigured() ? (
              'Not connected yet.'
            ) : (
              'Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to .env first.'
            )}
          </div>
          <SyncStravaButton connected={Boolean(strava?.accessToken)} />
        </div>
      </Card>

      <Card title="Garmin — file import">
        <p className="mb-4 text-sm text-zinc-400">
          Direct Garmin Connect API access requires Garmin developer-program approval.
          Until then, export any activity from Garmin Connect (activity → gear icon →
          export as FIT/TCX/GPX) and drop it here. Duplicates against Strava are
          detected automatically and the richer record wins.
        </p>
        <FileUpload />
      </Card>

      <Card title="Garmin — API status">
        <ul className="list-inside list-disc space-y-1.5 text-sm text-zinc-400">
          <li>Garmin Health API / Activity API: official, but approval-gated (business use case required).</li>
          <li>This app already treats <code className="rounded bg-zinc-800 px-1 font-mono text-xs">source=&quot;garmin&quot;</code> as first-class — API sync drops in without schema changes.</li>
          <li>Unofficial Garmin Connect libraries are intentionally not used (MFA breakage, ToS risk).</li>
        </ul>
      </Card>
    </div>
  )
}
