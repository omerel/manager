## 1. Versioned image URLs

- [x] 1.1 Derive a version token from a stored path (the random prefix of the stored filename) — `src/lib/upload-version.ts`, client-safe so components can build URLs without pulling `fs` into the bundle
- [x] 1.2 `/photo/[id]`: serve `private, max-age=31536000, immutable` when the request's `v` matches the current image; otherwise `private, no-cache` with an `ETag` (and a 304 on a match)
- [x] 1.3 `/logo`: same treatment, keeping `public` for the versioned case
- [x] 1.4 Render versioned URLs on the person card, the people list and the logo component (`AppLogo` now takes the stored path instead of a boolean)

## 2. Replacement hygiene

- [x] 2.1 `storage.ts`: best-effort delete of a stored file, resolved against the uploads root
- [x] 2.2 `setProfilePhoto`: delete the file being replaced, ignoring failures — `createPerson` needs nothing, a new person has no previous photo
- [x] 2.3 Logo upload and reset: delete the custom logo being replaced
- [x] 2.4 `setProfilePhoto`: revalidate `/people` as well as the person's page

## 3. Verification

- [x] 3.1 Replace a photo and confirm the new image renders immediately, without clearing the cache and without a hard reload — 40px → 120px, and still correct after a normal reload
- [x] 3.2 Confirm the people list shows the new avatar
- [x] 3.3 Confirm repeat replacement leaves exactly one file per person on disk — 3 replacements, file count unchanged (5 → 5)
- [x] 3.4 Confirm an unversioned `/photo/<id>` request still returns the current image — identical bytes, `no-cache`, and 304 on a matching ETag; the versioned response is `immutable`
- [x] 3.5 Replace the logo and confirm every page shows it without a manual refresh (60px → 140px); revert to the built-in mark works and removes the file
- [x] 3.6 Confirm visibility is still enforced: an unauthenticated request is refused with or without a version token (401)
- [x] 3.7 Confirm a full backup round-trip still restores photos and the logo — 8 people / 2 photos / 2 attachments preserved, 4 files restored
