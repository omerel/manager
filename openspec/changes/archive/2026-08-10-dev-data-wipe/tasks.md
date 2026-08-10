# Tasks: dev-data-wipe

## 1. The action

- [x] 1.1 `dev-wipe-actions.ts`: `devWipe(prev, formData)` for `useActionState` — refuse unless `NODE_ENV !== "production"` AND admin; one transaction over the ticked categories per the design's root table (אנשים deletes people then non-template plan copies); return `{ ok, counts }` Hebrew-labelled; activity-log entry naming categories + root counts

## 2. UI

- [x] 2.1 `DevWipe.tsx`: five checkboxes, delete button disabled with nothing ticked, inline warning naming the ticked categories with אישור מחיקה (red) / ביטול, success notice with per-category counts from the action state
- [x] 2.2 `/system` page: render the section only when `process.env.NODE_ENV !== "production"`, wired to the component

## 3. Verification

- [x] 3.1 `scripts/verify-dev-wipe.ts`: fixture spanning all five categories + a user + org nodes; each category alone deletes its roots and cascades and nothing else (careers-alone keeps people unassigned; people-alone keeps templates, deletes copies); all five together; users/org/settings/mappings/fieldDefs/activity survive; counts returned match; production-mode refusal (`NODE_ENV=production` in-process)
- [x] 3.2 Full sweep: suite twice, `npx tsc --noEmit`, `npm run build`
