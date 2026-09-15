<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- Next.js 16.3.5 + Prisma 6 + Tailwind 4. `params`/`searchParams` are Promises — always `await` them.
- Prisma is intentionally pinned to v6 (classic engine). `@prisma/client@7+` and `prisma@8` use a different driver-adapter architecture — do not upgrade without migrating the setup.
- Dev DB: SQLite at `prisma/dev.db` via `DATABASE_URL` in `.env` (gitignored). Reset/reseed: `npm run seed`.
- Machine has no system Node — a local toolchain lives at `~/tools/node` (`export PATH="$HOME/tools/node/bin:$PATH"`). npm 12 blocks install scripts; approve via `npm install-scripts approve <pkg>` if `@prisma/engines` or `esbuild` break.
- Verify changes: `npx tsc --noEmit`, `npx eslint .`, `npx next build`.
- All dashboard metric queries must filter `duplicateOfId: null` (deduped sources).
