/**
 * Runs once when the Node server boots, before any request handling.
 *
 * Weekly/daily bucketing uses local-time Date methods, so the server must run
 * in the athlete's timezone. Vercel reserves the `TZ` env var and defaults to
 * UTC, so set it here from APP_TIMEZONE instead (default: US Eastern).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.env.TZ = process.env.APP_TIMEZONE || 'America/New_York'
  }
}
