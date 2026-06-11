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

## [5.15.0] - 2026-06-12

### Added

- Umamin Chat: reply to a specific message — tap a message and pick Reply next to the reactions; your message is sent quoting the original. Tapping the quote jumps back to the original message, which briefly lights up.
- Umamin Chat: whisper messages — send a secret that arrives blurred, reveals when your partner taps it, and burns away about 10 seconds later for both of you. The text is withheld and later deleted on the server, not just hidden on screen.
- Umamin Chat: send with confetti or hearts — pick an effect from the new "+" button next to the message box and your message lands with a full-screen burst on both sides.
- Umamin Chat: mini-games — deal a "This or That" or "Would You Rather" card from the "+" button. You both pick privately, the answers reveal together, and a score chip in the header tracks how often you match. Every finished round stays in the conversation, so you can scroll back through what you both picked.
- Umamin Chat: share the vibe — when a chat ends, generate a story-size receipt image (avatars, duration, message and reaction counts, shared interests, your game score — never the conversation itself) to post or save.
- Umamin Chat: your invite card — share a story-size card with your avatar and your short umamin.chat link from the lobby. Anyone who opens your link lands directly on you while you're searching, or simply gets matched with someone new if you're not around.
- Share your profile as a story-size card — the share button on your own profile banner now offers "Share your card" (an image with your banner, avatar, name, and your anonymous-message link, ready for stories) alongside a quick copy-link.

### Fixed

- Profile follow buttons now remember when you're already following someone after reloading their profile, instead of showing "Follow" until clicked.

## [5.14.0] - 2026-06-10

### Added

- Install Umamin as an app: a polished home-screen experience with a crisp app icon, and long-press shortcuts that jump straight to your feed or notes.
- A branded launch screen when you open the installed app on iOS.
- An "Install" button on the landing page when your browser supports it (with iOS add-to-home-screen guidance).
- A Child Safety Standards page (linked in the footer) describing our zero-tolerance approach to child sexual abuse and exploitation.

### Changed

- The installed app now opens straight to your feed — the marketing landing page no longer shows up inside the app.
- The installed app feels more native: no rubber-band overscroll bounce when you reach the end of a list, and no grey flash when you tap.

### Fixed

- In the installed app, the bottom navigation and top header no longer tuck under the phone's home indicator or notch.
- The app now refreshes to the latest version after an update, instead of occasionally holding on to an older screen.

### Accessibility

- You can now pinch to zoom anywhere in the app.

## [5.13.3] - 2026-06-10

### Changed

- Tidied up the actions on other people's profiles: Message and an overflow menu (Share, Block) now sit at the top of the banner, with Follow as a compact pill just below it — replacing the full-width row of buttons.

## [5.13.2] - 2026-06-10

### Security & Privacy

- Deleting your account now also removes an uploaded banner from storage, the same as your profile photo.

## [5.13.1] - 2026-06-10

### Fixed

- A profile photo with the Umamin+ shine now sits overlapping the banner like every other avatar, instead of dropping below it.

## [5.13.0] - 2026-06-10

### Added

- Profile banners: add a cover image to your profile and frame it just how you want with a built-in crop-and-zoom tool. Your banner shows behind your avatar on your profile and at the top of your inbox, and you can change or remove it anytime from Settings. Free for everyone.
- The same crop-and-zoom tool now applies when you set a profile photo, so you can choose exactly how it's framed instead of relying on an automatic crop.
- A quick edit shortcut on your profile and inbox headers jumps straight to Settings.

### Changed

- Profile photo controls moved from the Privacy tab to General in Settings, alongside the new banner.
- The profile header was refreshed to a cover-photo layout, with your avatar overlapping the banner and the Share button moved up beside the edit shortcut.

## [5.12.0] - 2026-06-09

### Added

- Group chat: members can now message each other inside a group. Open it from the group's page, read the history, and send messages that show up for everyone within a few seconds. Conversations are kept, with scroll-back through earlier messages.
- An unread dot on the Groups page marks groups with new messages, and clears once you open the chat.
- Reply to a specific message (shown as a quote) and @mention members — mentioned members get a notification.
- React to messages with an emoji (❤️ 😂 🔥 😮 👍 😢) — one per message, tap again to remove; reactions show under each message and update live.
- Delete your own messages; group owners can remove any message.

### Security & Privacy

- Group chat is members-only on every read and send — leaving or being removed from a group cuts off access immediately — and messages are encrypted at rest, the same as direct messages.

## [5.11.0] - 2026-06-08

### Added

- Groups: Umamin+ members can create a group with a name, an optional description, a unique 4-character tag, and an icon and color of their choice. Find your groups under Groups on your profile — and anyone can open the Groups page, with a prompt to upgrade if they're not Umamin+ yet.
- Members can wear their group's tag as a small badge next to their name across the feed, posts, notes, and their profile — one badge at a time, switchable anytime. Tapping any badge opens that group's page.
- Groups are private and invite-only. Owners invite people by username, and anyone can request to join from the group's page; the owner approves or declines. Owners can edit their group's name, description, icon, and color, remove members, or delete the group. Notifications cover invites received, join requests, and new members.
- Joining is free for everyone — only creating a group needs Umamin+.
- An account menu, opened from your avatar — quick access to your profile, groups, settings, theme, and sign-out in one place.

### Changed

- Navigation refresh: notifications now live in the bottom bar, your profile, inbox, notifications, and settings open as focused pages with a back button, and the active section is highlighted.
- The landing page has its own streamlined navigation.

### Security & Privacy

- Wearing a group's tag is opt-in and broadcasts your membership on everything you post; joining itself stays private, and the member list is visible only to members. You can stop wearing a tag or leave a group at any time.
- Group tags are checked against reserved and lookalike names to prevent impersonation, and tags can't be changed after a group is created.

## [5.10.0] - 2026-06-08

### Added

- Anonymous messages now arrive sealed. A new message shows as a closed envelope in your inbox — tap to open it and reveal the question and message, with a subtle reveal animation. Messages you received before this update are already open. Whether you've opened a message is yours alone; senders are never told.
- Subtle haptic feedback on supported devices when you open a sealed message, like a post, vote on a poll, or react to a note. Off automatically when your system asks for reduced motion.

### Fixed

- The "developed by" footer no longer overlaps posts while scrolling to the bottom of the feed, profile, and notes lists.

## [5.9.0] - 2026-06-07

### Added

- Poll votes now count toward how a post ranks in the Hot feed, alongside likes, comments, and reposts.

### Changed

- The Hot feed ranks posts with a steadier engagement score: a burst of reactions lifts a post for hours rather than pinning it for days, and each additional reaction adds a little less, so fresh posts keep surfacing.
- Hot now spaces out consecutive posts from the same author throughout the feed.

### Fixed

- Posting and reposting no longer report an error when the "new posts" indicator briefly can't be updated — the post still goes through.

## [5.8.0] - 2026-06-07

### Added

- Polls: Umamin+ members can attach a poll to a post — 2 to 4 options, with the post text as the question, running for a duration you pick (1 hour to 7 days, default 1 day).
- Anyone signed in can vote, one vote per poll, and votes are final. Results appear as percentage bars once you've voted or the poll closes; until then only the options show.
- Poll authors get a "voted on your poll" notification, grouped the same way as likes.
- Quoted posts with a poll show a poll indicator — tap through to the original to vote.

## [5.7.0] - 2026-06-07

### Added

- Blocked words: in Settings → Privacy, list words or phrases you don't want to receive — any incoming anonymous message containing one is quietly discarded, and the sender is none the wiser.
- Block someone straight from their content: posts, comments, and notes by identified users now have a "Block" option in their menu, alongside the existing one on profiles.
- A Blocked Users section in Settings → Privacy lists everyone you've blocked, with a one-tap Unblock. Anyone you blocked in the past appears there too.

### Changed

- Blocking is now managed from profiles, posts, comments, notes, and the new Blocked Users list instead of from individual received messages.
- Save Image on Android now downloads straight to your gallery instead of opening the share sheet; iPhone and iPad keep the share sheet so the image can be saved to Photos.

### Security & Privacy

- Post pages and the post API no longer include non-public account fields of the post's author in their payload.

### Removed

- The "Block" option on received messages. Keeping it would have let your blocked list hint at who sent an anonymous message; use blocked words to filter unwanted messages instead.

## [5.6.0] - 2026-06-06

### Added

- In-app notifications: a bell in the top bar shows when someone likes or comments on your post, follows you, sends you an anonymous message, or replies to a message you sent. The badge counts what you haven't seen (capped at 9+), and the new Notifications page lists everything with links straight to the post, profile, or your inbox.
- Repeat activity on the same post is grouped into a single notification — "Alice and 4 others liked your post" — instead of flooding the list.
- Opening the Notifications page marks everything as seen and clears the badge.

### Security & Privacy

- Anonymous message notifications never reveal the sender — they show only that a message arrived, and never include message content, which stays encrypted.
- Notifications are kept for 30 days and then deleted automatically.

## [5.5.0] - 2026-06-06

### Added

- Quote posts are now real posts: they have their own likes, comments, reposts, and page — and they can carry an image. Quote someone by picking "Quote" on any post; the quoted post appears as a compact card you can tap through.
- You can now quote a post you've also reposted, and quote the same post more than once.
- Pin a post to your profile: pick "Pin to profile" from your post's menu and it stays at the top of your Posts tab with a pin marker. Pinning another post replaces the previous pin; deleting a pinned post unpins it.

### Changed

- Posts now hold up to 4 photos (up from 1) — the feed lays them out in a grid and the full-screen viewer pages between them with swipes or arrow keys.
- Quoting now opens the full composer (with image support for Umamin+) instead of a small caption box.
- Your existing quote reposts have been upgraded into real posts automatically — same text, same timestamps, now with their own engagement.
- If a quoted post is deleted, quotes of it show "This post is unavailable" instead of disappearing.

### Fixed

- Posts, post pages, and quote reposts now show the author's username when they haven't set a display name, instead of an empty space — matching how notes already behave.

## [5.4.0] - 2026-06-05

### Added

- Umamin+: accounts that are a year or older now hold Umamin+ — the avatar shine you already know, plus new perks starting with image uploads.
- Post images (Umamin+): attach a photo to a post on the feed — pick from your gallery, paste, or drag and drop into the composer, with an instant preview, upload progress, retry on failure, and one-tap removal.
- Posts can now be image-only; text is optional when an image is attached.
- Tapping a post's image opens a full-screen viewer — swipe down or press Esc to close.
- Upload your own profile photo from Settings — it's cropped square, compressed on your device, and applied after a preview. Using a connected Google photo still works.

### Changed

- Your profile and inbox now share one flat tab row — Posts, Received, Sent — replacing the nested Messages tabs, and each tab has its own link you can share or return to.
- The profile button in the navigation now opens your profile's Posts tab first; Received and Sent are one tap away.

### Performance & Cost

- Images are compressed on your device before uploading — to a small fraction of their original size — so uploads finish fast even on slow connections and feeds stay light to scroll.
- Post images are served from a dedicated media domain with long-lived caching, and their space is reserved up front so the feed never jumps while they load.

### Security & Privacy

- Compression strips photo metadata (location and other EXIF data) before anything leaves your device.
- Upload size and type are pinned to what the server approved and re-verified when a post is published; deleting a post also deletes its images from storage.
- Changing, hiding, or replacing your profile photo deletes the old uploaded one from storage, and deleting your account removes every photo you've uploaded.

### Accessibility

- The full-screen image viewer is fully keyboard operable (arrow keys, Esc) and upload progress is announced to screen readers.

### Removed

- Gravatar support: profile photos now come from your own uploads or a connected Google account. Existing Gravatar photos keep displaying until you change them.

## [5.3.0] - 2026-06-05

### Added

- Umamin Chat: tap the reactions on a message to see who reacted with what — shown as a dialog on desktop and a bottom sheet on mobile.
- Umamin Chat: when both of you react to a message with the same emoji, it now shows once with a counter instead of repeating.
- Umamin Chat: the reaction picker now highlights the reaction you've already given.

### Changed

- Umamin Chat: reactions are now per person — each of you gets one reaction per message; picking a new emoji replaces your previous one, and picking the same emoji again removes it. Reacting no longer removes your partner's identical reaction.

## [5.2.2] - 2026-06-04

### Added

- Umamin Chat: when your partner switches apps, locks their phone, or loses signal, they now show as "away" instead of the chat abruptly ending — the conversation only ends after they've been gone for a while, and picks right back up when they return.

### Fixed

- Umamin Chat: switching tabs or checking a notification mid-chat no longer ends the conversation within seconds.
- Umamin Chat: a fresh match shows your partner as online while they finish connecting, instead of briefly flashing "away".
- Umamin Chat: closing the tab now reliably tells your partner you've stepped away right away, instead of leaving them seeing "online" for over a minute.
- Umamin Chat: reopening the app while your chat (or your spot in the matchmaking queue) is still alive drops you straight back in, instead of stranding you in the lobby.
- Umamin Chat: long conversations are no longer cut off after 30 minutes with a false "partner left" — only genuinely abandoned chats are cleaned up.
- Umamin Chat: cancelling the partner search now actually removes you from the queue, so strangers stop getting matched with someone who already left — and a closed or backgrounded tab can no longer be matched at all.

### Security & Privacy

- Umamin Chat: online-status heartbeats now require the session's secret and are only accepted from a match's own participants, so a third party can no longer spoof someone else's presence.

## [5.2.1] - 2026-06-04

### Added

- Links and @mentions in notes are now clickable, matching posts and comments — URLs ask for confirmation before taking you off Umamin (with a stronger warning on risky links), and mentions go to the profile.

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

[5.16.0]: https://github.com/omsimos/umamin/compare/v5.15.0...v5.16.0
[5.15.0]: https://github.com/omsimos/umamin/compare/v5.14.0...v5.15.0
[5.14.0]: https://github.com/omsimos/umamin/compare/v5.13.3...v5.14.0
[5.13.3]: https://github.com/omsimos/umamin/compare/v5.13.2...v5.13.3
[5.13.2]: https://github.com/omsimos/umamin/compare/v5.13.1...v5.13.2
[5.13.1]: https://github.com/omsimos/umamin/compare/v5.13.0...v5.13.1
[5.13.0]: https://github.com/omsimos/umamin/compare/v5.12.0...v5.13.0
[5.12.0]: https://github.com/omsimos/umamin/compare/v5.11.0...v5.12.0
[5.11.0]: https://github.com/omsimos/umamin/compare/v5.10.0...v5.11.0
[5.10.0]: https://github.com/omsimos/umamin/compare/v5.9.0...v5.10.0
[5.9.0]: https://github.com/omsimos/umamin/compare/v5.8.0...v5.9.0
[5.8.0]: https://github.com/omsimos/umamin/compare/v5.7.0...v5.8.0
[5.7.0]: https://github.com/omsimos/umamin/compare/v5.6.0...v5.7.0
[5.6.0]: https://github.com/omsimos/umamin/compare/v5.5.0...v5.6.0
[5.5.0]: https://github.com/omsimos/umamin/compare/v5.4.0...v5.5.0
[5.4.0]: https://github.com/omsimos/umamin/compare/v5.3.0...v5.4.0
[5.3.0]: https://github.com/omsimos/umamin/compare/v5.2.2...v5.3.0
[5.2.2]: https://github.com/omsimos/umamin/compare/v5.2.1...v5.2.2
[5.2.1]: https://github.com/omsimos/umamin/compare/v5.2.0...v5.2.1
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
