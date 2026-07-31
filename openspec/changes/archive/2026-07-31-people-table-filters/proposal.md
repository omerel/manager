## Why

The people list answers "who is here" and little else. It shows name, framework, recruitment date and status, and offers one search box that matches names only. The question a manager actually arrives with — "who is on the command track", "who in this section is departing" — cannot be asked at all, and the plan a person is on is invisible until you open their card one at a time.

Career plan is now the most consequential column missing. With four templates and people moving between them, the list is where the distribution should be readable at a glance.

## What Changes

- **A career-plan column.** The person's active plan, or a plain mark when they have none.
- **Clicking it opens the template**, not the person's copy. The copy is per-person and reachable from their card; what a reader wants from a list is "what is this track", which is the generic plan.
- **A filter on every column**, applied as the user types, with no page reload. Text columns match on substring; closed sets — status, career plan — offer their actual values, so a filter cannot be spelled wrong.
- **The existing search box moves into the name column.** Two mechanisms doing the same job is worse than one; this is a small visible change and is called out because the search box is where people currently look.
- The count line reports how many of the total are shown, and filters can be cleared in one action.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `people-registry`: the people list gains a career-plan column linking to the template, and per-column filtering.

## Impact

- `src/app/people/page.tsx` — the table becomes a client component to filter without a round trip; the server still loads and permission-clips the rows
- `src/lib/people.ts` — `PersonRow` carries the active plan's name and its template id
- No schema change, no new dependency, no change to permissions: filtering narrows what is already visible to that user and can never widen it
