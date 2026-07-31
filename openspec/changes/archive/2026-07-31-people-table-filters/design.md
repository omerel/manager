## Context

The page is a server component that loads every visible person and filters by name on the server, through a `?q=` round trip:

```
getVisiblePeople(visibility)   → all rows the user may see, already permission-clipped
  ?q=דנה                       → server re-renders, filtering on fullName
```

Two facts shape the design. The list is **already fully loaded** — there is no pagination, so nothing is gained by filtering on the server; and the rows are **already permission-clipped** by `getVisiblePeople`, so filtering can only ever narrow that set.

`PersonRow` today carries id, name, recruitment date, status, team, org path, photo and an edit flag. It does not carry the plan, so the column needs the query widened.

Current data: 40 people, 26 with a plan, 4 templates, and no plan copy whose template has been deleted — though that state is reachable, since `sourceTemplateId` is `SetNull`.

## Goals / Non-Goals

**Goals:**

- Filter each column as the user types, with no reload.
- Make the plan visible in the list and one click from the template that defines it.
- One filtering mechanism, not two.
- Filtering never widens what a user can see.

**Non-Goals:**

- Sorting. Not asked for, and it interacts with filtering in ways worth designing deliberately rather than smuggling in.
- Pagination or server-side search. Both would be premature at this volume and would undo the reason instant filtering is possible.
- Filtering on admin-defined card fields. The list shows core columns; the card holds the rest.
- Saved or shareable filter state. It is the acknowledged cost of the choice below.

## Decisions

### D1 — Filter on the client, over rows the server already sent

The page keeps loading and clipping on the server; the table becomes a client component that filters the array it was handed.

The alternative — a filter per column as URL parameters, like today's `?q=` — was rejected for this table: five columns means five round trips as someone narrows down, and the whole set is already in the browser. The cost is real and worth stating: **filter state is not in the URL**, so a filtered view cannot be linked to and a reload clears it. Accepted because the filters are for scanning, not for reporting; the moment someone wants to send a filtered list, that is an export, not a URL.

Permissions are unaffected by construction: the client filters a subset of what the server chose to send, so the worst a bug can do is show too few rows.

### D2 — Filter kind follows the column's nature

| column | filter | why |
|---|---|---|
| name | text, substring | open set |
| framework | text, substring | open set, and matching the path lets "מדור ראייה" find every team under it |
| recruitment date | text, substring over the formatted date | open set; typing a year is the common case |
| status | select of the three statuses | closed set — a typo should be impossible |
| career plan | select of the templates in use, plus "ללא תכנית" | closed set, and "who has no plan" is a real question |

A single free-text box across all columns was considered and rejected: it cannot express "status = departed" without also matching people whose framework happens to contain the word.

### D3 — The plan column links to the template, not the copy

Each person's plan is an independent copy; the template is what a reader means by "the plan". `PersonRow` carries the copy's name for display and its `sourceTemplateId` for the link.

Two states need handling rather than assuming: a person with **no plan**, and a person whose copy's **template has been deleted** (`sourceTemplateId` is `SetNull`). The second shows the plan's name as text, unlinked — the name is still true, only the destination is gone.

The first reads **"ללא מסלול"**, deliberately not "ללא שיוך": that string is already `UNASSIGNED_LABEL`, the framework column's value for someone with no team. Reusing it would put identical text in two adjacent columns of the same row, meaning different things — and a person with neither team nor plan would show it twice.

The plan select lists the templates actually present among the visible rows, not every template in the system, so a manager is not offered filters that would return nothing.

### D4 — The count line stays honest about filtering

The header already distinguishes "40 people in your view" from a filtered subset. It keeps doing so for any combination of filters, alongside a single action that clears them all. Filtering that silently hides rows is how a reader concludes someone has left the organisation.

## Risks / Trade-offs

- **Filter state lost on reload, not linkable** → the accepted cost of D1, stated in the open so it is a choice rather than an oversight. If linkable filters are wanted later, the same filter shape can move to URL params without changing the table.
- **The whole list ships to the browser** → already true today; this change does not increase it. It becomes a real question only with pagination, which would change the filtering decision too.
- **Substring matching on a formatted date is crude** — "1 ביוני 2024" matches "2024" and also "1" → acceptable for scanning; a date range is the answer if it becomes a real complaint.
- **A filtered empty table can look like a permission problem** → mitigated by the count line and the clear action.

## Migration Plan

None. No schema change and no data migration; the plan fields are read from relations that already exist.

## Open Questions

None. Settled before writing: filtering is instant rather than submitted, and the existing search box folds into the name column rather than living alongside the new filters.
