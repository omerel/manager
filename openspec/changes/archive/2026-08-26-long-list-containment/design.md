# Design: long-list-containment

## Approach

Two independent measures, deliberately kept separate because they solve different halves:

```
   containment  →  the PAGE stops growing   (CSS: max-height + overflow-y-auto)
   ceiling      →  the DOM stops growing    (render the first N of the filtered set)
```

Containment alone leaves 68,000 nodes in the document; a ceiling alone leaves the page tall whenever the ceiling is raised. The people list needs both. Everything else needs only containment, and gets exactly that.

## Decisions

1. **The ceiling lives on `shown`, the existing filtered memo** in `PeopleTable` — `shown.slice(0, limit)` renders, `shown.length` is reported. Filtering therefore keeps running over every loaded row, which is the property the spec protects: a match beyond the ceiling is still found. `limit` resets to the initial page in an effect keyed on the filter object, so a new filter always shows its results from the top.

2. **100 rows to start, +100 per press.** 100 fills more than a screen at any sensible height, so the first press is a deliberate act rather than something the user is forced into to see anything. The control states «מוצגים 100 מתוך 1,000», so the number is never a mystery.

3. **A scrolling `<tbody>` needs a plain wrapper, not table tricks.** `overflow` on `tbody` behaves inconsistently across engines; the reliable RTL-safe shape is a `max-h-[...] overflow-y-auto` wrapper around the table with `position: sticky; top: 0` on the header rows (`thead` cells, both the label row and the filter row). Sticky headers keep the filter row usable while the body scrolls — the reason to prefer sticky over a split table.

4. **Heights are viewport-relative** (`max-h-[70vh]` for a page's main list, `max-h-64`/`max-h-72` for a nested list such as a team's people), not pixel constants: a small laptop and a large monitor should both show one screenful.

5. **What is left alone**: queries, plans and the HR page all measured at one screen and carry no unbounded list; the needs-attention panel is already capped at 6; the movements list already has `max-h-96`. Touching them would be change for its own sake.

6. **Explicitly NOT doing**: virtualization (heap measured 28.4 MB at 1000 people — the machinery is not earned), server-side pagination (render measured 166–201 ms; and it would break the client-side filtering that makes the table feel instant), and infinite scroll (a scroll position that keeps loading is worse than a stated count and a button).

## Verification

`web/scripts/verify-list-containment.ts` — measured the way the problem was found, in a real browser against a planted registry:

- plant ~600 people, then assert on the rendered pages: the people page's `document.body.scrollHeight` is within a small multiple of the viewport (it was 68 screens), an inner scroller exists, rendered `<tbody tr>` count is at the ceiling rather than the registry size, and the header row is still visible after scrolling the body;
- «הצג עוד» raises the count by exactly the page size and the "N מתוך M" line agrees with it;
- typing a filter that matches a person **beyond** the ceiling finds them — the regression that a naive `slice` before filtering would cause;
- the dashboard tree's team list scrolls and the page is no longer dozens of screens tall;
- fixtures removed in `finally`, and the suite asserts the registry is back to its prior count.
