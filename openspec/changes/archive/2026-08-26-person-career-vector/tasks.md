# Tasks: person-career-vector

- [x] 1. Schema: `PointEvent.personal Boolean @default(false)` + `createdByName String?`; migration `personal_point_event`; `prisma generate`.
- [x] 2. `plan-diagram.ts`: optional `status?: Map<string, VectorStatus>` argument driving per-event colour, the star marker for personal events, and a `<style>` block whose animations sit inside `@media (prefers-reduced-motion: no-preference)`. Without the map the output must be unchanged.
- [x] 3. `person-view.ts`: build the status map for the person (points by id; metrics and recurring events reduced to their worst live item).
- [x] 4. `people/[id]/page.tsx`: two-column layout — details right, vector left (details first in the DOM for narrow screens); existing lists retained.
- [x] 5. Personal events: `addPersonalEvent` / `removePersonalEvent` actions under `mayEstablishAt`, refusing when the person has no plan; the form on the card; the personal badge in the point-events list.
- [x] 6. `assignPlan`: carry `personal` events from the outgoing copy onto the new one.
- [x] 7. Verify: `npx tsc --noEmit`; new `web/scripts/verify-person-vector.ts` passing twice; `verify-recurring-score` + `verify-dashboard-filters` green; `npm run build` clean.
