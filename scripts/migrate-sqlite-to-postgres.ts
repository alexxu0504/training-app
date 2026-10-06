/**
 * Copy all data from the local SQLite dev DB into a Postgres database.
 *
 * Usage:
 *   DATABASE_URL=<postgres-url> npx tsx scripts/migrate-sqlite-to-postgres.ts prisma/dev.db
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts prisma/dev.db --dry-run
 *
 * Reads SQLite via node:sqlite (Prisma's generated client is bound to the
 * Postgres provider, so it can't read the sqlite file) and writes via
 * PrismaClient using DATABASE_URL. IDs are preserved so FKs stay intact.
 */
import { createRequire } from 'node:module'
import { PrismaClient } from '@prisma/client'

// node:sqlite has no bundled types on @types/node 20 — load untyped.
type Row = Record<string, unknown>
type SqliteDb = {
  prepare(sql: string): {
    all(): Row[]
    columns(): { name: string }[]
  }
  close(): void
}
const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDb
}

const BATCH = 500

// Prisma stores DateTime as ms-integer and Boolean as 0/1 in SQLite.
const TABLE_FIELDS: Record<string, { dates: string[]; bools: string[] }> = {
  User: { dates: ['createdAt'], bools: [] },
  ConnectedAccount: { dates: ['lastSyncAt', 'createdAt', 'updatedAt'], bools: [] },
  Race: { dates: ['date', 'createdAt'], bools: ['isPrimary'] },
  Activity: { dates: ['startTime', 'createdAt'], bools: ['hasGps'] },
  ActivitySplit: { dates: [], bools: [] },
  PersonalRecord: { dates: ['achievedAt', 'updatedAt'], bools: [] },
  WeeklyMetric: { dates: ['weekStart'], bools: [] },
}

function convert(table: string, row: Row): Row {
  const { dates, bools } = TABLE_FIELDS[table]
  const out: Row = { ...row }
  for (const f of dates) {
    if (out[f] != null) out[f] = new Date(out[f] as number)
  }
  for (const f of bools) {
    if (out[f] != null) out[f] = Boolean(out[f])
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const dbPath = args.find((a) => !a.startsWith('--'))
  if (!dbPath) {
    console.error('usage: npx tsx scripts/migrate-sqlite-to-postgres.ts <sqlite-path> [--dry-run]')
    process.exit(1)
  }

  const sqlite = new DatabaseSync(dbPath)
  const data = {} as Record<string, Row[]>
  for (const table of Object.keys(TABLE_FIELDS)) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
    data[table] = rows.map((r) => convert(table, r))
    console.log(`${table}: ${rows.length} rows`)
  }
  sqlite.close()

  if (dryRun) {
    console.log('dry run — not writing to Postgres')
    return
  }

  const prisma = new PrismaClient()
  try {
    const insert = async (
      rows: Row[],
      createMany: (batch: Row[]) => Promise<unknown>
    ) => {
      for (let i = 0; i < rows.length; i += BATCH) {
        await createMany(rows.slice(i, i + BATCH))
      }
    }

    await insert(data.User, (b) => prisma.user.createMany({ data: b as never, skipDuplicates: true }))
    await insert(data.ConnectedAccount, (b) =>
      prisma.connectedAccount.createMany({ data: b as never, skipDuplicates: true })
    )
    await insert(data.Race, (b) => prisma.race.createMany({ data: b as never, skipDuplicates: true }))

    // duplicateOfId self-references Activity — insert all with null, then patch.
    await insert(
      data.Activity.map((r) => ({ ...r, duplicateOfId: null })),
      (b) => prisma.activity.createMany({ data: b as never, skipDuplicates: true })
    )
    for (const r of data.Activity) {
      if (r.duplicateOfId) {
        await prisma.activity.update({
          where: { id: r.id as string },
          data: { duplicateOfId: r.duplicateOfId as string },
        })
      }
    }

    await insert(data.ActivitySplit, (b) =>
      prisma.activitySplit.createMany({ data: b as never, skipDuplicates: true })
    )
    await insert(data.PersonalRecord, (b) =>
      prisma.personalRecord.createMany({ data: b as never, skipDuplicates: true })
    )
    await insert(data.WeeklyMetric, (b) =>
      prisma.weeklyMetric.createMany({ data: b as never, skipDuplicates: true })
    )

    console.log('migration complete')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
