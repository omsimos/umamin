# Changelog

All notable changes to Umamin for Organizations are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this app adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
This changelog is separate from the root `CHANGELOG.md`, which tracks the main
Umamin app's releases.

## [0.3.0] - 2026-07-20

### Added

- Organizations can choose the maximum length of anonymous messages, while
  organizations without a custom setting keep the 1,000-character default.

## [0.2.0] - 2026-07-19

### Added

- Select or deselect every message on the current page at once when picking messages to export.
- An inbox button in the header, so getting back to your messages no longer relies on clicking the organization name.
- Browser tabs now name the page you're on (Inbox, Settings, Sign in).

### Changed

- Profile changes — your prompt, display name, and pausing messages — now show on your public submit page immediately after saving, instead of up to a minute later.

### Fixed

- Signing out after your session had already expired showed an error page instead of the sign-in screen.
- When your session expires while viewing the inbox, you're returned to the sign-in page instead of a failing retry loop.
- The header could show outdated organization details for up to a minute after saving your profile.

### Performance & Cost

- The public submit page is now served from the CDN and refreshed in the background, instead of being rendered on every visit.
- Paging back through the inbox is instant — recently viewed pages are reused instead of refetched.
- The dashboard loads less code up front; the ZIP packaging library is fetched only when you export.

### Security & Privacy

- Password changes are now rate-limited as strictly as sign-in attempts.

### Accessibility

- Errors on the sign-in and password forms are announced to screen readers.
- Icon-only header and toolbar buttons now carry labels for assistive technology.

## [0.1.0] - 2026-07-04

### Added

- Initial release: invite-only anonymous message collection with a shareable submit page, a paginated inbox, single-image saves and bulk ZIP export of branded message images, export color themes, and organization profile and password settings.
