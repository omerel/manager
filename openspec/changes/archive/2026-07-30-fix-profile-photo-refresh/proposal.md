## Why

Replacing a person's profile photo appears to do nothing: the new image is saved correctly to disk and to the database, but the page keeps showing the previous one — through reloads, for up to a minute. Verified empirically: right after an upload the server returns the new bytes while the browser renders the old image; clearing the browser cache, or adding any query string to the URL, immediately shows the new photo.

The cause is that a **mutable resource sits behind an immutable-looking URL**. `/photo/<personId>` never changes when its content changes, and the route answers `Cache-Control: private, max-age=60`, so the browser reuses what it already has. `/logo` has the same defect and is worse: `public, max-age=300` means an intermediary proxy may serve the old logo to everyone for five minutes after the Admin replaces it.

## What Changes

- Photo and logo URLs carry a **version token derived from the stored file**, so the URL changes exactly when the image changes. The token already exists: every upload writes a file whose name begins with 8 fresh random bytes.
- With a versioned URL the response becomes **long-lived and immutable**, which both fixes the staleness and removes repeat requests. Today every avatar on the people list costs a request that performs authentication, a database read and a visibility computation on every page load; after the change those happen once per image.
- Requests without a version token stay correct by falling back to revalidation rather than a time window, so links that predate the change never go stale.
- Replacing a photo **deletes the file it replaced**. Today each replacement orphans the previous file forever on the very volume that must be a PVC; backups already ignore them, so they are pure dead weight.
- The people list refreshes when a person's photo changes, not only the person's own page.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `people-registry`: replacing a person's photo takes effect immediately wherever the photo is displayed, and the replaced file is not retained.
- `branding`: replacing the logo takes effect immediately for every user, including through caching intermediaries.

## Impact

- `src/app/photo/[id]/route.ts`, `src/app/logo/route.ts` — cache headers and version handling
- `src/app/people/[id]/page.tsx`, `src/app/people/page.tsx`, `src/components/Logo.tsx` — image URLs gain the version token
- `src/lib/extract-actions.ts` (`setProfilePhoto`), `src/lib/person-actions.ts` (`createPerson`), `src/lib/branding-actions.ts` — delete the replaced file, widen revalidation
- `src/lib/storage.ts` — deletion helper, guarded to the uploads root
- No schema change, no new dependency, no change to the air-gap image
