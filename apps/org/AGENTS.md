# apps/org

Umamin for Organizations: invite-only anonymous messaging for organizations.
Members of the public send anonymous messages to an organization's page at
`/to/[username]`; the organization reads and exports them from its dashboard.
Low activity. Long term it moves onto the `apps/web` platform, so don't build
large new features here without asking.

Next.js 16 with the App Router and the React Compiler, deployed on Vercel. Its
own database is `@umamin/org-db`; message content is encrypted with
`@umamin/encryption`.

```sh
pnpm dev:org                              # from the root, http://localhost:3001
pnpm --filter=org check-types
pnpm --filter=org test
pnpm --filter=org build
pnpm org:create-org                       # provision an organization (no signup)
```

## Rules

- This is the only workspace on TypeScript 6 (`^6.0.3`). Next.js doesn't
  support 7 yet. Don't align it with the rest of the repo.
- The React Compiler is on. Don't hand-write `memo`, `useMemo` or
  `useCallback` for performance.
- Mutations are server actions wrapped in `withAction`
  (`lib/server/with-action.ts`): zod parse, session guard (`auth: "session"`,
  `"user"` or `"none"`), rate limit, handler. Return `{ error }` instead of
  throwing.
- Every GET route is per-viewer and goes through `withPrivateRead`
  (`lib/server/read-route.ts`), which sends `no-store` + `Vary: Cookie`. There
  is no public cached route; don't add one without a cache-key design.
- Rate limiting uses Upstash Redis (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).
  Without them it logs a warning and turns rate limiting off, so production must
  have both set.
- Sessions are database-backed (`lib/session.ts`, `lib/auth.ts`). A Vercel cron
  (`vercel.json`) calls `/api/cron/cleanup-sessions` daily with
  `CRON_SECRET`.
- Message export builds branded images and a ZIP in the browser
  (`lib/export.tsx`, `lib/export-themes.ts`, `jszip`, `modern-screenshot`).
  Test changes against `test/export-themes.test.ts` and an actual export.
- Use `@umamin/ui` components. Add new shadcn components to `packages/ui`
  rather than this app when another app could use them.

## Changelog

This app keeps its own `CHANGELOG.md` with its own version numbers. Same format
rules as the root changelog. Org changes don't go in the root `CHANGELOG.md`.
