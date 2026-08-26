# Design: person-career-vector

## Approach

Nothing is duplicated and nothing is stored. The person's plan copy already exists (the registry's long-standing "assignment is a template copy" rule), their per-event status is already computed by `person-view` and `gaps`, and the vector is already a pure SVG-string builder. This change hands the second to the third and puts the result on the card.

```
   card opened
        │
        ├── person-view  → per-event status (waived / gap level)   ─┐
        └── their plan copy (already in the database)              ─┴─▶ buildPlanDiagramSvg
                                                                        │
                                                            fresh SVG, stored nowhere
```

## Decisions

1. **The vector draws the COPY, never the template.** It is what the person is measured against, and it is the only source under which the colours are true — a template edited since assignment would otherwise paint events the person does not have. This is the existing data rule made visible, not a new one.

2. **Status reaches the diagram as an optional map**, `Map<eventId, "OVERDUE" | "APPROACHING" | "MET" | "WAIVED">`. `buildPlanDiagramSvg(plan)` keeps its present signature and present look, so the plan page and the PDF export are untouched; only the person card passes the second argument. Metrics and recurring occurrences carry a status too — the worst among their live checkpoints/occurrences — so the whole vector reads consistently rather than only its point events.

3. **Animation, and its restraint.** Only states that ask for action move:

   | state | treatment |
   |---|---|
   | in gap | red fill, a ring pulsing on a 2s ease-in-out loop |
   | approaching | amber, a softer 3s glow — present, not shouting |
   | waived | dimmed, desaturated, still |
   | met | solid green, still |

   Implemented as a `<style>` block inside the SVG (the diagram is inlined into the DOM, so CSS applies), wrapped in `@media (prefers-reduced-motion: no-preference)` — the reduced-motion default is therefore the static one, and no JavaScript is involved. In the PDF export, where no status is passed, none of it appears.

4. **A personal event is a `PointEvent` on the person's copy** with `personal: true` and `createdByName`. The copy already belongs to exactly one person, so no new table and no new relation: it is a plan event in every mechanical sense — gaps, waivers, progress, the timeline row — which is what the requirement asks for. On the vector it takes a star marker so the eye can tell "yours" from "the track's".

5. **The add form is gated on edit mode as well as authority.** The card is view-first everywhere else; a control that writes must live where the writing controls live. The suite asserts both halves — offered while editing, absent while reading.

6. **Authority is `mayEstablishAt`**, the predicate that already decides who may enrol a person into a framework — the same "section level and above" the user named. Reusing it means the two answers can never drift; inventing a second rule for the same rank is how they would.

7. **Carry-over on reassignment** happens inside `assignPlan`, which already copies template events into the new copy: it additionally copies the outgoing copy's `personal` events (keeping their labels, offsets and `createdByName`). Deliberately unconditional rather than another checkbox on the review screen — the review's existing checkboxes are about *progress* the commander must vouch for, whereas a personal obligation is not something to re-approve on every transfer.

8. **Enlarging reuses the photo lightbox's idiom** — click to open, Escape or a click outside to close — rather than inventing a second enlarging gesture on the same card. The SVG is server-built and carries no interactivity, so rendering a second copy inside the overlay costs only markup; the overlay scrolls, since a long plan is taller than any screen.

9. **The PDF is its own route** (`/people/[id]/plan-pdf`) rather than a parameter on the plan page's export: that one draws the TRACK for anyone allowed to read plans, while this one draws a PERSON and must therefore decide visibility from the requester's scope. Printing suppresses the pulse halo — a looping animation would otherwise be captured at an arbitrary opacity — and the colour, which carries the meaning, prints as it is.

10. **The two-column card**: `lg:grid-cols-2` with details first in the DOM (so a phone shows details first and the vector below), the vector column sticky on tall screens. The existing sections keep their place beneath.

## Risks

- **A tall vector next to short details** leaves whitespace on wide screens; accepted, and mitigated by the vector column scrolling independently rather than stretching the card.
- **`personal` on `PointEvent` means every consumer of point events sees them.** That is intended — but the plan *editor* must not offer to edit or delete another person's personal event, and template plans can never carry one (a copy-only concept). Both are asserted in the suite.

## Verification

`web/scripts/verify-person-vector.ts`:
- diagram: given a plan and a status map, the SVG carries the gap colour for the overdue event, the dimmed treatment for the waived one, a star for the personal one, and the animation is inside a `prefers-reduced-motion: no-preference` guard; called WITHOUT a map it is byte-identical to today's output (the plan page and PDF must not shift);
- authority: a section-level commander adds a personal event **through the real form in a browser** — not by writing the row, which would pass even against a server that could not — and it lands on that person's copy with `personal` and the author's name; a team-level manager is refused; a person with no plan is refused with the Hebrew reason;
- gaps: an overdue personal event puts the person in gap; waiving it takes them out;
- carry-over: reassigning to another template moves the personal event to the new copy and leaves the old track's events behind;
- the card: fetched as a signed-in user it contains the vector `<svg>` beside the details, and the textual lists are still present.
