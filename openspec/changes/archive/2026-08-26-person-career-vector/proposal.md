# Proposal: person-career-vector

## Why

A person's plan is drawn as a career vector on the plan page — the arrow from placement to end of service with every event branching off it — but on the person's own card that same plan is only a list of rows. The picture that makes a path legible at a glance is exactly what a commander opening a card wants first, and it is the one place it is missing.

Second, a plan is a template: it says what this ROLE requires. Nothing today lets a commander record what THIS PERSON, individually, must do — a course, a hand-over, an obligation that belongs to them and to nobody else on the same track.

## What Changes

- The person card becomes two columns: personal details on the right (RTL primary), the **career plan drawn on the left**, live on every card open from the person's own plan copy — nothing new is stored and nothing needs syncing. In its column the drawing is half its natural width, so **clicking it opens it filling the screen**.
- The vector is **coloured by this person's status** and animated so that only what asks for action moves: an overdue event pulses red, an approaching one glows amber more slowly, a waived one is dimmed and still, a completed one is solid and still. `prefers-reduced-motion` keeps the colour and drops the motion.
- The card offers **«הפק PDF»** for the person's own plan — the same drawing, in their colours, unlike the plan page's export of the bare track.
- The existing textual event lists stay exactly as they are, beneath/beside the vector — the picture is for seeing, the list is for acting (marking done, recording values).
- A commander with **establishment authority (רמ״ד and above)** may add a **personal point event** to a person: a label and an offset, recorded on that person's plan copy, marked as personal, and drawn on the vector with its own star marker. It counts toward gaps exactly like any plan event, and can be waived like one.
- A personal event **travels with the person** when they are moved to another plan — it belongs to them, not to the track.
- Adding a personal event requires an assigned plan; without one the action refuses with a Hebrew message saying so.

## Capabilities

### Modified

- `career-plans`: gains the personal-event requirement (authority, gap participation, carry-over on reassignment).
- `people-registry`: gains the card's two-column layout with the live, status-coloured vector.

## Impact

- `prisma/schema.prisma` + migration: `PointEvent.personal Boolean @default(false)`, `createdByName String?`.
- `web/src/lib/plan-diagram.ts` — an optional per-event status map drives colour, animation and the personal marker; the plan page and the PDF keep passing nothing and look as they do today.
- `web/src/app/people/[id]/page.tsx` — the two-column layout, the vector, the add-personal-event form.
- `web/src/lib/plan-actions.ts` (or a new person-scoped action) — `addPersonalEvent` / `deletePersonalEvent` under `mayEstablishAt`.
- `web/src/lib/person-actions.ts` — `assignPlan` carries personal events onto the new copy.
