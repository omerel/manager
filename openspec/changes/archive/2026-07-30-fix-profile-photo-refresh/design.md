## Context

Uploaded images are served by two authenticated routes rather than as static assets, because visibility must be checked per request:

```
GET /photo/<personId>   → session → visibility over person.teamId → read file
GET /logo               → read the AppSetting-configured file
```

Both URLs are stable while their content is not. Measured on the running system, one person, one replacement:

| moment | rendered | server response |
|---|---|---|
| before upload | 80px | 80px |
| immediately after upload | **80px (stale)** | 667 B — exactly the uploaded bytes |
| after a normal reload | **80px (stale)** | new |
| after clearing the browser cache | 120px (new) | new |
| with `?v=<timestamp>` | 120px (new) | new |

A normal reload does not help: `max-age` is honoured until it expires. Only a hard reload or waiting out the window recovers, which is why the upload looks broken rather than delayed.

Storage already produces a natural version token. `saveUpload` writes `<personId>/<8 random bytes as hex>-<filename>` and `person.photoPath` holds that relative path, so the stored value changes on every single upload and is already loaded by every page that renders a photo (`people.ts` selects `photoPath` for the list; the person page holds the full record).

Sibling route `/files/<attachmentId>` has no defect and shows why: an attachment id is never reused, so its URL is content-stable by construction. The fix makes photos and the logo behave the same way.

## Goals / Non-Goals

**Goals:**

- A replaced photo or logo is visible immediately, everywhere it appears, with no manual refresh.
- Correctness must not depend on a time window; a wrong image should be impossible, not merely short-lived.
- Fewer authenticated image requests than today, not more.
- Replacing an image does not accumulate files on the uploads volume.

**Non-Goals:**

- Serving uploads as unauthenticated static files. Per-person visibility is a requirement.
- Image resizing, format conversion, or thumbnail generation.
- A general garbage collector over the uploads directory. Only the file being replaced is removed, at the moment it is replaced.
- Changing how attachments (`/files/<id>`) are served — they are already correct.

## Decisions

### D1 — Version the URL rather than defeat the cache

`/photo/<personId>?v=<token>` where the token derives from `photoPath` (the random prefix of the stored filename). The URL changes if and only if the image changes.

Alternatives considered:

- **`no-cache` + `ETag`** — no call-site changes, always correct, but the browser must revalidate every image on every page load, and each of those requests runs session lookup, a database query and `computeVisibility`. On a people list of 40 avatars that is 40 authenticated round-trips per view, replacing a caching bug with a latency cost.
- **A timestamp cache-buster (`?v=Date.now()`)** — defeats caching entirely and re-downloads every image on every render; strictly worse than today.
- **Version in the path (`/photo/<id>/<token>`)** — equivalent, and slightly more robust across proxies that ignore query strings, but requires a new route segment for no behavioural gain in this deployment. Chosen against for simplicity.

The token is derived, never stored: a second source of truth would be one more thing to keep in sync.

### D2 — Cache aggressively when versioned, revalidate when not

- Request carries a `v` matching the current image → `private, max-age=31536000, immutable`.
- Request carries no `v`, or a stale one → `private, no-cache` plus an `ETag`, so the answer is always current.

This keeps old links and any hand-typed URL correct forever, while the paths the application renders get the fast route. `private` stays on the photo route because the bytes are visibility-scoped; the logo may keep `public` once versioned, since a versioned URL is safe to share and its content is not user-specific.

### D3 — Delete the replaced file inside the same action

When `photoPath` is overwritten, the previous file is removed. Safe because: storage paths are unique per upload and never shared between people; backups build their file list from current `photoPath` values, so the old file is already excluded; and any browser still holding the old URL is holding the bytes too.

Deletion is best-effort — a failure to unlink must not fail the upload, since the database is the source of truth and a leftover file is harmless. It is guarded through the same resolution helper that enforces the uploads root, so a malformed stored path cannot escape it.

The same reasoning applies to the logo, where the previous custom logo is likewise replaced.

### D4 — Refresh every surface that shows the image

`setProfilePhoto` currently revalidates only `/people/<id>`. The photo also appears on `/people`. Both are revalidated, so the change is visible wherever the person is listed.

### D5 — Missing token is a rendering decision, not a storage one

Pages compose the URL from data they already hold. A person without `photoPath` renders initials, exactly as today; no token, no request.

## Risks / Trade-offs

- **A year-long `immutable` cache on a URL that could theoretically be reused** → the token comes from 8 random bytes generated per upload, so reuse would require a collision within one person's directory. The unversioned fallback remains revalidating, so even then a correct answer is one request away.
- **Deleting the replaced file removes the ability to recover a mistaken overwrite** → accepted: profile photos are re-uploadable, and full backups continue to capture whatever is current. Called out here because it is the one irreversible part of the change.
- **A proxy that strips query strings would collapse all versions to one URL** → the fallback branch answers such requests with `no-cache` + `ETag`, so they revalidate rather than go stale.
- **Slightly more data threaded through page props** → `photoPath` is already selected in both list and detail queries; no new queries.

## Migration Plan

None. No schema change and no data migration: the token is derived from values already stored. Deploying the change is sufficient; browsers holding a stale image request a new URL on the next render and update immediately.

Rollback is reverting the code — the previous behaviour returns, including its bug.

## Open Questions

None outstanding. Scope decisions taken while exploring: the logo is included because it is the same defect with a wider blast radius, and orphan cleanup is limited to the file being replaced rather than a sweep of the uploads directory.
