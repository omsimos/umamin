# apps/web

Umamin, the production app at `www.umamin.link`. One Cloudflare Worker:
TanStack Start renders pages, Hono owns `/api/*`, the global middleware chain
and the `scheduled()` crons. Entry is `src/server.ts`. Umamin Chat lives here
too, at `/chat`, on Durable Objects.

Read `README.md` for the layout and `ENVIRONMENT.md` before touching any env
var, secret or binding.

## Commands

```sh
pnpm dev:web                       # from the repo root
pnpm --filter=web check-types
pnpm --filter=web test             # jsdom + node suites
pnpm --filter=web test:workers     # workerd suites (*.worker.test.ts)
pnpm --filter=web build            # staging build; build:production for prod
pnpm --filter=web eval:moderation check   # classifier regression gate
pnpm biome check --write <files>
```

`pnpm test` at the root does not run `test:workers`. Run both when you touch
anything that only works inside workerd: KV, the Cache API, rate-limit
bindings, Durable Objects, argon2 wasm.

## Local development

- Dev runs with `CLOUDFLARE_ENV=staging`, so it inherits staging's vars from
  `wrangler.jsonc`. Worker secrets come from `.dev.vars` (copy
  `.dev.vars.example`). Public `VITE_*` config is committed per environment in
  `.env.development`, `.env.staging` and `.env.production`.
- The database is a local libSQL server: `pnpm --filter=@umamin/db dev` runs
  `turso dev` on `127.0.0.1:8080` with `packages/db/local.db`. If signup or a
  query fails locally with a missing column, the local database has drifted
  behind the migrations; see `packages/db/AGENTS.md`.
- The Vite dev server listens on IPv6 only (`[::1]`). If `localhost` misbehaves
  in a script, use `http://[::1]:<port>`. Check the real port with `lsof`.
- `components/service-worker.tsx` registers `/sw.js` in dev too, and the SW
  serves scripts cache-first. After editing a module, a browser test can keep
  running the old code. Unregister the SW and clear `caches` before re-testing.
- Diagnose hydration errors against a dev build. Production React only gives a
  minified error code.

## Caching

Read this before touching any read path.

- The Worker is the origin, so CDN `s-maxage` does nothing. Public reads are
  cached in the Worker through the Cache API in `server-lib/read-route.ts`, the
  only file allowed to use `caches.default`. There is no purge; invalidation is
  TTL-only. Don't reintroduce Next-era `revalidateTag`/`"use cache"` ideas.
- Every read goes through `withPrivateRead` (per viewer, `private, no-store`,
  `Vary: Cookie`, never cached) or `withPublicRead` (`public, max-age=B,
  s-maxage=N`). Early exits (401/403/404) get re-stamped, so a bare
  `Response.json` can't escape without cache headers.
- A public handler receives only `(req, env)`, no `Context`, so it can't
  resolve a viewer. A response carrying `Set-Cookie` is never cached.
  `test/read-route.worker.test.ts` proves both leak guards.
- Each public route lists the query params that belong in its cache key; other
  params are ignored so `?utm_source=` can't mint new entries and new Turso
  reads.
- Static assets never reach the Worker. Their headers come from
  `public/_headers`, not `server-lib/csp.ts`.
- SSR HTML is pinned `no-store` by `securityHeadersMiddleware`, so
  authenticated HTML is never heuristically cached.

## Cost and latency

- Turso is in AWS Tokyo. From Southeast Asia one round trip is about 75 to 90
  ms, and time to first byte is dominated by the number of chained round trips,
  not query cost. Use `Promise.all` or one batched query instead of sequential
  awaits, and never add a hop to a hot path.
- Turso bills per row scanned. Bound every list query (LIMIT before union or
  rank). A bulk `UPDATE ... WHERE <soft-ref column>` needs a partial index
  (`WHERE col IS NOT NULL`) or it scans the table.
- Writes are the scarcer budget. Avoid per-event write amplification
  (per-poll, per-keystroke); prefer one bounded write and many reads.
- Two author projections live in `server-lib/data.ts`: `feedAuthorColumns`
  (lean, for every list: feed, notes, comments, messages, follows, members) and
  `publicUserColumns` (full, for the profile and `/api/me`). Never widen a list
  select to `publicUserColumns`. A new user column must be added to the
  projection it belongs to.
- Never return user rows through a Drizzle relational include
  (`with: { author: true }`). It selects every column, including
  `passwordHash`, and a type cast strips nothing at runtime. Join with the
  projection maps.
- Tracing is on in both environments (`observability.traces` in
  `wrangler.jsonc`). Each span is a billed observability event, so production
  samples at 10%. An env block replaces the inherited `observability` object
  instead of merging, so each env must restate `enabled: true` or its logs turn
  off.

## Backend patterns

Use these for all new code.

- Mutations go through `action()` in `server-lib/action.ts`: parse, session
  guard, rate limit, handler. It returns `Out | { error }` and never throws.
  `auth: "none"` rate-limits before the session lookup. On the client, narrow
  with `res && "error" in res`.
- Error strings live in `server-lib/errors.ts`. The shared `idSchema` lives in
  `server-lib/schema.ts`.
- Rate limits are Workers Rate Limiting bindings (`RL_*` in `wrangler.jsonc`).
  The period can only be 10 or 60 seconds, and counters are per colo. The
  shared `RL_READ` limiter is keyed per IP; a polled or per-user read needs a
  per-user key or a school or office NAT throttles its own users. A cap the
  bindings can't express (for example 2 group edits a day) goes on KV, like
  `server-lib/group-edit.ts`.
- Workers KV is eventually consistent (about 60 s) and allows 1 write per
  second per key. Store one key per entry, never one JSON blob, or concurrent
  read-modify-writes drop data. Every KV consumer must no-op without the
  binding.
- Sessions stay off KV. `validateSessionToken` has a 12 s in-isolate cache of
  positive results plus single-flight. A ban or logout is instant on the
  isolate that handled it; other warm isolates keep their cached entry until
  the TTL.
- Per-viewer overlay caches are keyed on `(viewerId, sorted ids)`. Keep that
  shape.

## Route loaders

- Loaders run in the Worker during SSR and on hover preload
  (`defaultPreload: "intent"`), so keep them cheap.
- A loader may fetch only through `lib/loader-fetch.ts`, which dispatches
  in-process on SSR (a Worker can't `fetch()` its own zone). The fetchers in
  `lib/query-fetchers.ts` use relative URLs, which throw in workerd. Passing one
  as a loader `queryFn` works on client navigation and breaks a hard load.
- Resolve the viewer with `lib/loader-viewer.ts` (`loadViewer`,
  `loadViewerId`), never a direct `/api/me` call. It skips the dispatch when
  there is no session cookie.
- Don't materialize a search-param default in `validateSearch`. The router
  canonicalizes the URL to what it returns, so a default turns every bare
  request into a redirect. Make the param optional and resolve the default in
  `loaderDeps`.
- Never read `window` or `document` during render to decide what to render. It
  causes a hydration mismatch and a full client re-render. Resolve it in an
  effect, like `hooks/use-media-query`.

## UI rules for this app

- Mobile first. Judge every screen at phone width before desktop.
- Compose posts inline on `/feed` (the FAB opens a dialog). Never add a
  `/compose` route; avoid any server-side fetch to the app's own host.
- `AppHeader` (logo header) is mobile only. Desktop `/feed` and `/notes` use
  `Navbar` + `PublicMenubar`. Neither may sit at `top-0` on desktop.
- The bottom menubar has five slots with Profile in the middle. Adding a tab
  means removing one; `components/public-menu-bar.test.tsx` pins the order.
- Portaled Dialog and Drawer overlays ignore the layout's safe-area padding and
  overlap the notch in the installed PWA. Add `env(safe-area-inset-*)` to any
  new full-screen overlay.
- `list-row` (in `styles.css`) adds permanent paint containment. Anything a row
  paints outside its box gets clipped, like a tilt or a focus ring. Give the row
  bleed room or opt out, as `note-list.tsx` does.
- Hono percent-decodes route params. `formatUsername` handles both `@you` and
  `%40you`.

## SEO

- `lib/seo.ts` `pageSeo()` builds every page's title, description, canonical,
  Open Graph and Twitter tags with absolute URLs from `VITE_SITE_URL`. Head
  meta is deduped per property with the deepest route winning, so every page
  re-declares its share image. A page image must be listed in `SHARE_IMAGES`
  with its real size.
- `public/robots.txt` and `public/sitemap.xml` are static and must use the
  production host (`test/seo.test.ts` checks).
- Staging sends `X-Robots-Tag: noindex` (`SEO_INDEXABLE` var). Production
  doesn't.

## Error tracking (PostHog)

- PostHog is error tracking only. Autocapture, pageviews, replay and surveys
  are all off in `lib/posthog.ts`. Product analytics is Google Analytics.
- The client dynamically imports `posthog-js`, gated on `import.meta.env.PROD`.
  Don't switch to `@posthog/react`'s provider; it imports the SDK at module
  scope and adds about 260 KB to the Worker bundle.
- The Worker client (`server-lib/posthog.ts`) uses `flushAt: 1` and hands every
  send to `waitUntil`, gated on `NODE_ENV === "production"`.
- Four report points, which don't overlap: `action()`'s unmapped catch, both
  read wrappers' catches, `app.onError` in `server.ts`, and each cron. Reporting
  must never throw.
- Source maps upload post-build through `@posthog/cli`
  (`scripts/posthog-sourcemaps.mjs`), not a bundler plugin. Rolldown minifies
  after plugin hooks, so a plugin's comment marker never reaches the client
  bundle.

## Feature flags

- Flags are evaluated in the Worker and read by the browser from the private
  `/api/flags` route. Keys live in `lib/flags.ts` only. Use `evaluateFlags` +
  `isEnabled`, not `isFeatureEnabled`.
- `/api/flags` must stay `withPrivateRead`; a shared cached response would hand
  one viewer's rollout to everyone.
- Flags fail closed, and a failure is not cached. Client defaults are hidden.
  Routes that gate a surface prefetch in the loader with `lib/loader-flags.ts`.
- The staging env forces flags on with `FLAGS_FORCE_ON` in `wrangler.jsonc`.
  Production sets nothing on purpose; copying staging's vars into production
  launches every listed flag. `test/wrangler-flags.test.ts` pins both halves.
- `umamin-pro` gates the Pro offer only, never entitlements. Badge, theme,
  ad-free and image limits read `user.proUntil`, and the Lemon Squeezy webhook
  stays ungated.

## Ads

Placements map to `{ slotId, minHeight, lazy }` in `lib/ad-placements.ts` and
render through `<ClientOnlyAdContainer placement=...>`. Adding or removing a
placement must update `lib/ad-placements.test.ts`. `VITE_ADS_ENABLED=false`
removes every ad surface; any other value keeps ads on.

## Feature areas

**Umamin Chat** (`/chat`, flag `umamin-chat`). Anonymous one-on-one chat on
Durable Objects with hibernatable WebSockets.

- Rules are pure functions in `src/lib/chat/`: `engine.ts` (ops return what to
  write), `project.ts` (the only place a frame is shaped per viewer, with all
  anti-leak rules), `pairing.ts`, `protocol.ts` (zod frames), `decks.ts` (game
  cards), `limits.ts`. Test rules there under plain Vitest.
- `server-lib/chat/lobby.ts` (`ChatLobby`, one instance named `lobby:v1`) holds
  the queue as socket attachments. `server-lib/chat/room.ts` (`ChatRoom`, one
  per match) stores the match in DO SQLite. Both are thin adapters; keep rules
  out of them. `api/chat-socket.ts` routes `/api/chat/lobby` and
  `/api/chat/room/:matchId`.
- Cost rules: pings are runtime auto-responses so idle rooms sleep; one chat
  message is one row written; timers are rows in a `timers` table behind a
  single alarm; a room that was never initialized is never written.
- A breaking frame change bumps `PROTOCOL_VERSION`. The server closes old
  clients with `CLOSE.VERSION` and they reload.
- Card ids in `decks.ts` are part of the wire protocol. Never reuse or
  repurpose one. Every card needs a `followUp` question that reads naturally
  whatever either side picked.
- The UI talks to a `ChatTransport` interface. `transport/mock-transport.ts` is
  what component tests run on; `transport/ws-transport.ts` is the real one.
  Both must implement the full interface.
- The reveal handle is PII. Never log it, never put it in an error, never put
  it on a share card. Never log session ids or message text.
- Worker tests: `test/chat-do.worker.test.ts` and
  `test/chat-socket.worker.test.ts`, mounted through `test/chat-entry.ts`.
- To QA as two chatters in one browser profile, namespace the
  `umamin-chat:*` localStorage keys per tab with an init script.
- Adding a Durable Object class blocks dashboard rollbacks to Worker versions
  from before that class existed.

**Groups.** Caps in `lib/group.ts`: 50 members per group, 1 owned and 5 joined
per user. Creation needs Umamin Plus (`hasUmaminPlus`); joining is free and
re-checked on the server. The 4-character tag has a confusable-folded `tagNorm`
with the unique index; the blocklist is `server-lib/group-reserved.ts`. Every
join goes through `addActiveMember(tx)`, which guards the cap atomically.
`memberCount` is denormalized, never `COUNT(*)`. The badge is
`user.equippedGroupId`, a soft reference; resolve it per page with
`getGroupBadgeMap`/`withGroupBadge`.

**Group chat.** Polling on Turso, not push. The client polls
`/api/groups/[tag]/chat/head` every 8 s, served from an 8 s Cache API entry;
keep those two numbers close. Membership is re-checked on every read, send and
react. Messages are encrypted at rest (not end-to-end). `getGroupMessageReactions`
must join on `groupId`; a bare `messageId IN (...)` is a cross-group IDOR. If it
ever needs real push, use a Durable Object with hibernatable WebSockets, like
Umamin Chat.

**Aura.** A cosmetic score. Award and reverse only through
`server-lib/points.ts` (`awardAura`, `reverseAura`) inside the action's
transaction. Never increment points inline; the guards there (no self-award,
no award across a block, minimum account age) are the only farming defense.
Posting images needs 50 aura or active Pro (`canPostImages` in
`lib/post-images.ts`), re-checked in both `api/actions/upload.ts` and
`api/actions/post.ts`.

**Image uploads (R2).** The client compresses, then PUTs to a presigned URL
under `staging/<userId>/`; creating the post copies it to `posts/`. Abandoned
staging files are deleted by an R2 lifecycle rule configured in the Cloudflare
dashboard, not in code. Bucket CORS lists allowed origins per bucket, and a
wrong R2 credential shows up in the browser as a CORS error. Replay the
presigned URL with curl to see the real R2 error.

**Moderation.** `isModerator(user)` reads the server-only `MODERATOR_USERS`
env. Bans have one chokepoint: `validateSessionToken` returns no session when
`user.bannedAt` is set. Ban fields are server-only and never in a projection.
The IP denylist (`server-lib/ip-denylist.ts`, KV, fail-open) applies at the
anonymous entry points only, and IPs are canonicalized on store and compare.

**Content classification.** Posts, comments and notes are scored by the
classifier in `server-lib/content-classifier.ts` through the AI Gateway, behind
the `content-moderation` flag. The `ai` package is dynamically imported to keep
it out of the Worker's startup bundle. After changing prompts or thresholds,
run `pnpm --filter=web eval:moderation check`; it replays
`scripts/moderation-cases.json` and is deterministic.

**Notes song embeds.** `lib/music.ts` is the single source of truth. The stored
id is a validated token, never a raw URL, and every embed URL is rebuilt and
re-validated from that token. oEmbed is server-only (`server-lib/music-meta.ts`)
with a thumbnail host allowlist. CSP `frame-src` must list each embed origin.

**Notifications.** One aggregated upsert row per (recipient, type, entity) plus
a `lastSeen` watermark for the badge. No per-event rows, no `COUNT`. Web Push
uses VAPID; `VITE_VAPID_PUBLIC_KEY` must be exactly 87 base64url characters or
`pushManager.subscribe()` throws.

## PWA

The app ships as an installable PWA. `sw.js` must delete old cache names on
`activate`, or installed users keep stale assets after a deploy. The cache name
rotates with the version read from `CHANGELOG.md`.
