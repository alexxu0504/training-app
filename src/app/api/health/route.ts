import { prisma } from '@/lib/db'

export async function GET() {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({
      ok: true,
      db: 'connected',
      dbMs: Date.now() - start,
      tz: process.env.TZ ?? null,
      offsetMin: new Date().getTimezoneOffset(),
    })
  } catch (e) {
    return Response.json(
      { ok: false, db: 'error', error: e instanceof Error ? e.message.split('\n')[0] : String(e) },
      { status: 500 }
    )
  }
}
