# Changelog

All notable changes to Umamin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release groups its changes under the following sections, in this order, omitting
any that are empty.

- **Added** — new features and capabilities.
- **Changed** — changes to existing behavior.
- **Fixed** — bug fixes.
- **Performance & Cost** — speed, bundle-size, and infrastructure-cost improvements.
- **Security & Privacy** — hardening, access control, and data-exposure fixes.
- **Accessibility** — screen-reader, keyboard, and assistive-technology improvements.
- **SEO** — crawlability, canonicalization, and indexing changes.
- **Deprecated** — features marked for removal.
- **Removed** — features removed.

## [5.2.0] - 2026-06-04

### Added

- React to any note anonymously — a one-tap flame with a public count. Nobody sees who reacted, and reactions reset when a note is rewritten or cleared. Your own note shows how many strangers reacted to it.
- A "Surprise me" shuffle on the notes feed that jumps to a random note and briefly highlights it.

### Changed

- Notes got a personality pass: rotating prompts in the composer, a clearer "as @you / as nobody" anonymous toggle, and friendlier confirmations and empty states.
- Notes now render in the display typeface with a subtle alternating tilt, and anonymous notes are set apart with a dashed border.

### Performance & Cost

- The notes page now ships a static shell with the first page of notes streamed from a shared public cache — sign-in is resolved in the browser, and reacting no longer forces shared feed-cache recomputes. Reaction counts in the feed are eventually consistent within two minutes.

## [5.1.0] - 2026-06-04

### Changed

- The landing page is fully redesigned: an animated decrypting headline, live playable previews of Messages, Notes, Social, and Umamin Chat, a product marquee, and a new footer with product links and a shortcut to send the team anonymous feedback.
- Headings now use the Bricolage Grotesque display typeface, matching Umamin Chat.

### Fixed

- Body text now renders in the intended Geist typeface instead of the system font.
- The top bar's translucent backdrop now spans the full width of wide screens, so content no longer scrolls past its edges unblurred.

## [5.0.4] - 2026-06-04

### Added

- A dismissible Umamin Chat announcement on the feed and notes pages — a quick intro to anonymous, interest-based one-on-one chats with a button to try it.
- The navigation's Umamin Chat button now shows a "new" indicator until you open it for the first time.

## [5.0.3] - 2026-06-03

### Added

- The umamin navigation now has an Umamin Chat shortcut that opens a quick intro with a link to start an anonymous chat.

### Fixed

- In Umamin Chat, the message box no longer jumps to the top of the screen and covers the conversation when the other person starts typing.
- The emoji reaction picker is no longer cut off at the top of a chat — it now stays fully on-screen, flipping below messages near the header.

### Performance & Cost

- Umamin Chat's app-wide rate-limit buckets are now sharded, so high-frequency activity (especially presence heartbeats) no longer contends on a single record and stays reliable under load.

## [5.0.2] - 2026-06-03

### Added

- Umamin Chat can be switched into a maintenance mode that pauses new matches and shows a notice during planned downtime.

### Changed

- Shared links now show a dedicated Umamin Chat preview card.

### Fixed

- Umamin Chat now has a cleanup backstop for stale active matches, so abandoned
  conversations and their sessions cannot remain attached indefinitely if a presence
  reconciliation path is missed.
- Umamin Chat now rejects legacy or mismatched anonymous session credentials instead of allowing a session id alone to access chat state.

### Performance & Cost

- Umamin Chat now applies app-wide Convex rate-limit buckets to matching, sending,
  reactions, typing, and presence heartbeats, adding an aggregate cost brake on top of
  per-session limits.
- Chat cleanup remains paged and scheduled, so large conversations are deleted across
  bounded Convex mutations instead of a single oversized teardown.

### Security & Privacy

- Anonymous chat sessions now use a persisted session secret in addition to the
  session id for Convex queries and mutations.
- Server-side chat input validation now bounds identity fields, interest ids, message
  length, and reaction payloads, and only accepts supported reaction emoji.

## [5.0.1] - 2026-06-03

### Changed

- Umamin Chat's tagline is now "Anonymous conversations with unexpected people" — carried through the lobby, the page title, and link previews.

### Fixed

- On the main platform, ad slots that can't be filled now collapse instead of leaving an empty space.

## [5.0.0] - 2026-06-03

### Added

- Umamin Chat: anonymous, ephemeral one-on-one chat. Pick an alias and a few interests, and get matched with someone who shares one.
- Talk in real time with typing indicators, emoji reactions, and a "stay
  connected" signal; skip to a new match anytime.
- Nothing is saved — conversations disappear the moment they end.

## [4.9.0] - 2026-06-02

### Added

- Share a saved post, message, or note image straight to your device's share sheet,
  including saving it directly to your photo library on iOS and Android.
- Posts now keep the line breaks you write.

### Changed

- Post pages open in a focused view: a top bar with a back button and the post's menu,
  and a reply box pinned to the bottom of the screen.
- Saved images are now exported as a square (1:1) with padding around the card, so they
  are ready to post on social media.
- The center navigation button now opens your inbox (messages) instead of your profile.

### Fixed

- Long links and unbroken text in posts no longer stretch the layout off-screen.

### Security & Privacy

- Links in posts now ask for confirmation before taking you off Umamin, with a stronger
  warning when a link looks risky — for example link shorteners, non-secure (http) links,
  raw IP addresses, or look-alike domains.

## [4.8.0] - 2026-06-01

### Added

- Following feed — signed-in users now get `/feed?sort=following`, showing posts and
  reposts from people they follow using the existing follow graph. No database
  migration required.

### Fixed

- Like, comment-like, and repost counters now update only when the underlying edge was
  actually inserted or removed, closing race conditions that could make counts drift.
- Creating a post no longer optimistically inserts it into the Following timeline unless
  it belongs there.
- Authenticated requests for `sort=following` now return `401` when there is no active
  session instead of silently falling back to Hot.

### Performance & Cost

- Anonymous `/feed` no longer performs server-side session work; the public shell
  prefetches only public Hot/Latest data and resolves the current user on the client.
- Feed query caches are scoped by viewer/public identity, preventing cross-user cache
  reuse while preserving broad feed cache updates.
- Hot feed can use a Redis sorted-set rank cache when it is warm enough, falling back to
  the existing bounded DB ranking path when Redis is unavailable or underfilled.
- Following feed pages are keyset-paginated and cached per viewer using existing tables
  and indexes.

### Security & Privacy

- The public posts API treats `sort=following` as unsupported for anonymous public reads,
  avoiding accidental personalized-feed semantics on the public endpoint.

## [4.7.2] - 2026-06-01

### Fixed

- Posting could hang and time out. The compose button now opens the composer in a
  dialog on the feed instead of a separate page, which resolves it.
- On desktop, the feed/notes navigation icons were hidden behind the header; the
  desktop top bar now shows correctly.

## [4.7.1] - 2026-06-01

### Fixed

- Creating a post (and deleting one) could hang and time out. A post or delete now
  refreshes the feed in the background instead of forcing a blocking full-feed
  recompute, so the action returns immediately.

## [4.7.0] - 2026-06-01

### Added

- Feed sorting — `/feed` now has Hot and Latest modes. Hot is the default discovery
  feed; Latest preserves the chronological posts/reposts timeline at
  `/feed?sort=latest`.
- Mobile compose — a floating compose button on the feed opens a full-screen
  `/compose` page for writing a post, replacing the inline composer at the top of the
  feed.

### Changed

- The default feed now ranks recent posts by time-decayed engagement from likes,
  comments, and reposts, with a small author-diversity pass so one active author is
  less likely to dominate a page.
- Refreshed the `/feed` and `/notes` header into a compact top bar — your avatar
  (left), a centered umamin logo, and the theme toggle (right) — replacing the
  default bar on those pages.

### Performance & Cost

- Hot feed ranking stays globally cacheable: it ranks only a bounded recent candidate
  window, reuses the existing per-viewer overlay, and keeps likes/comments/reposts
  eventually consistent instead of invalidating the whole feed on every interaction.

## [4.6.1] - 2026-06-01

### Added

- Login shows a clear "No account found" message when you sign in with a Google
  account that isn't linked to any Umamin account, instead of silently creating one.

### Changed

- Signing in with Google no longer creates an account automatically. A new account is
  created only when you use **Continue with Google** on the Register page; on Login, an
  unknown Google account is rejected with the message above. Signing in with an
  already-linked account, and linking Google from Settings, are unchanged.

## [4.6.0] - 2026-06-01

Followers/following lists, a unified profile and inbox with Posts/Messages tabs, and
follow/block correctness plus read-endpoint rate limiting.

### Added

- Followers / Following lists — tap the counts on any profile to open a list (drawer on
  mobile, dialog on desktop) with inline Follow/Following and lazy per-tab loading.
  Users you've blocked (either direction) are hidden.
- Unified profile and inbox — a Posts | Messages tab switch on your own profile and
  inbox, so you move between your posts and your messages in one place.
- Your profile is reachable from the nav — a profile entry now takes you to
  `/user/<you>`. The bottom/side nav is auth-aware on public pages too (Profile / Share
  / Settings show when you're signed in).
- Edit profile button on your own profile and inbox card (top-right).

### Changed

- Your own profile shows Edit profile instead of disabled Follow/Message/Block.
- Follower/Following counts are now interactive (open the list).

### Fixed

- Follower/following counts can no longer drift — counters update only when an edge
  actually changes, closing a race where rapid or concurrent follow toggles could
  permanently skew the numbers.
- The nav's "Inbox" entry no longer routes through `/login` to get where you're going.

### Performance & Cost

- Per-viewer profile overlay (is-following / is-blocked / blocked-by) now resolves in
  one query instead of three.
- Followers/following lists are on-demand, cached, and keyset-paginated on existing
  indexes — no new DB cost, no migration.

### Security & Privacy

- Rate-limited every DB-backed read endpoint (per-IP, sliding window) — caps
  cursor-scraping that would otherwise force repeated Turso reads. CDN-cached hits are
  unaffected; only expensive cache-miss requests are throttled. No-ops without Redis
  (local dev).
- Follow respects blocks server-side — you can't follow across a block in either
  direction (was UI-only).
- Blocking severs the follow both ways — a blocked user no longer keeps following you or
  counting toward your followers.

## [4.5.0] - 2026-05-31

A broad pass of correctness, privacy, performance, accessibility, and SEO fixes, plus
the ability to delete your own comments.

### Added

- Delete your own comments — comments you wrote now have an ellipsis menu with a Delete
  option (with confirmation); the post's comment count updates instantly.

### Fixed

- Post-detail header showed the author's join date instead of the post's date (a post
  made today read "2y").
- Like/repost counts could drift permanently when an action was a no-op (already
  liked/removed) or when liking and reposting at the same time.
- Replying to a message no longer reports success when nothing was saved.
- Sharing a note that fails now rolls back the optimistic note.
- Timestamps render safely from API strings (no stray "Invalid Date").

### Performance & Cost

- Per-viewer feed/comment/notes overlays now hit cache reliably (keyed on stable IDs),
  cutting Turso reads.
- Reposts, comment-likes, and blocks no longer invalidate the global feed/comments
  caches.
- Parallelized independent reads (current-user data; message-send checks).
- Smaller feed page size, dropped date-fns locale tables from hot bundles, removed dead
  API routes.

### Security & Privacy

- Quiet mode is enforced on the server, not just hidden in the UI.
- Personalized API responses are marked private (`Cache-Control: private` +
  `Vary: Cookie`) — no cross-user cache bleed.
- Account deletion verifies the confirmation phrase server-side.
- Rate limiting keys on a non-spoofable client IP and logs loudly if Redis is missing in
  production.
- Login no longer reveals which usernames exist via response timing.

### Accessibility

- Inline links and @mentions in posts are now clickable; dialogs, drawers, and icon-only
  buttons have accessible names; standardized on the shared `<Button>` for visible
  keyboard focus; PWA launches to a public route.

### SEO

- Per-route canonical URLs (replacing a single global canonical that flagged every page
  as a homepage duplicate); relative OG URLs; `noindex` on auth/utility/missing pages;
  cleaned-up sitemap.

## [4.4.0] - 2026-05-31

Umamin Social / feed improvements — making the feed feel alive and smooth, fixing real
bugs, and a big cost win on the logged-in path.

### Added

- Profile feed — a user's posts now show on their profile (`/user/[username]`).
  Previously every profile was a dead end.
- "New posts" indicator — the feed surfaces a pill when new posts arrive; tap it to jump
  to the top and load them, without a full page reload.
- Clickable content — URLs, `@mentions`, and `#hashtags` in posts and comments are now
  links (mentions go to the profile).
- Tap-to-open — the whole post card opens the thread, not just the small comment icon.

### Fixed

- Comments no longer overlap each other when they have different lengths
  (virtualized-list measurement fix).
- Like / repost state no longer flickers or reverts mid-action, and the repost count no
  longer occasionally goes off by one.
- A rate-limited or failed like/repost/follow/block/clear no longer shows a false
  success — it now surfaces the real error and rolls back.
- Links no longer capture trailing punctuation (e.g. a period right after a URL stays
  out of the link).
- `/social` no longer shows placeholder/sample posts (redirects to the live feed; only
  shows a "Coming soon" screen when under maintenance).
- Avatars load lazily and don't leak the page URL to the avatar host; timestamps now
  show the exact date on hover.

### Performance & Cost

- Session caching (Redis) — logged-in browsing/scrolling no longer hits the database to
  validate your session on every request; collapses a whole scroll session into a single
  read.
- Lighter pages — the screenshot/"save image" library (~212KB) is no longer bundled
  upfront; it loads on demand, shrinking the feed/profile/chat JS.
- Smoother scrolling — less off-screen rendering in the virtualized lists.

### Security & Privacy

- Changing your password now signs you out on every other device, and deleting your
  account immediately invalidates all of its sessions (no lingering access).

### Accessibility

- Like / repost / comment buttons now have proper labels and pressed-state for screen
  readers.

## [4.3.0] - 2026-05-31

Cost-efficiency and security hardening pass for the Vercel-hosted stack — rate limiting,
Turso query cost, and a set of audit-driven correctness and security fixes.

### Fixed

- Notes created in-app had a `NULL updated_at`, which sank them in the notes feed and
  produced broken pagination cursors — now set on insert, backfilled for existing rows,
  and the cursor is hardened.
- Account deletion no longer leaves other users' follower/like/comment/repost counts
  inflated (decremented in a transaction before the cascade).
- Rate-limited or failed like / repost / follow / block / clear-note actions no longer
  show a false success — the optimistic UI rolls back and surfaces the real error.
- Message content is encrypted only after the block check (no wasted work on blocked
  sends).
- Whitespace-only notes are now rejected.

### Performance & Cost

- Bounded the public feed query so a cache miss reads about one page per table instead of
  scanning every post and repost; added the supporting `post_repost(created_at, id)`
  index (removes a full-table scan and temp sort on the hottest path).
- Stopped invalidating the whole feed cache on every like and comment (counts are
  eventually consistent within the cache window).
- Dropped a redundant `oauth_account` index; added a `session(user_id)` index.
- `modern-screenshot` (~212KB) is now loaded on demand — no longer shipped in the
  feed/profile/chat client bundles.

### Security & Privacy

- Server-side rate limiting (Upstash) across every mutating/expensive endpoint: auth
  (login, signup, password change, account deletion, Google OAuth callback), message send
  and reply, and all authenticated writes (posts, comments, likes, reposts, follows,
  blocks, notes, settings, avatar, Gravatar lookup). Keyed by user for authenticated
  actions and by IP for credential/anonymous ones. No-ops automatically when Redis isn't
  configured.
- Avatar URL validation — values are stored and rendered as a raw `<img src>` for all
  viewers, so they're now restricted to an https + Gravatar/Google host allowlist (blocks
  tracking-beacon and arbitrary-image injection).
- Sessions are revoked on password change (the current device is re-issued a fresh
  session).
- Gravatar lookup now requires a session and has a request timeout.
- Google OAuth callback hardened: account link/creation wrapped in transactions, existing
  avatars no longer overwritten on link, ID-token picture claim validated, profile cache
  invalidated on link.
- Restored a Content-Security-Policy (Report-Only for now).
- Stopped logging raw errors that could contain usernames or token internals.
- Added a daily cron that prunes expired sessions.

[5.2.0]: https://github.com/omsimos/umamin/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/omsimos/umamin/compare/v5.0.4...v5.1.0
[5.0.4]: https://github.com/omsimos/umamin/compare/v5.0.3...v5.0.4
[5.0.3]: https://github.com/omsimos/umamin/compare/v5.0.2...v5.0.3
[5.0.2]: https://github.com/omsimos/umamin/compare/v5.0.1...v5.0.2
[5.0.1]: https://github.com/omsimos/umamin/compare/v5.0.0...v5.0.1
[5.0.0]: https://github.com/omsimos/umamin/compare/v4.9.0...v5.0.0
[4.9.0]: https://github.com/omsimos/umamin/compare/v4.8.0...v4.9.0
[4.8.0]: https://github.com/omsimos/umamin/compare/v4.7.2...v4.8.0
[4.7.2]: https://github.com/omsimos/umamin/compare/v4.7.1...v4.7.2
[4.7.1]: https://github.com/omsimos/umamin/compare/v4.7.0...v4.7.1
[4.7.0]: https://github.com/omsimos/umamin/compare/v4.6.1...v4.7.0
[4.6.1]: https://github.com/omsimos/umamin/compare/v4.6.0...v4.6.1
[4.6.0]: https://github.com/omsimos/umamin/compare/v4.5.0...v4.6.0
[4.5.0]: https://github.com/omsimos/umamin/compare/v4.4.0...v4.5.0
[4.4.0]: https://github.com/omsimos/umamin/compare/v4.3.0...v4.4.0
[4.3.0]: https://github.com/omsimos/umamin/compare/v4.2.1...v4.3.0
