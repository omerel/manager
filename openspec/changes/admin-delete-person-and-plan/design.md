## Context

Nothing in the system can be deleted except a framework in the hierarchy (`removeOrgNode`) and individual plan items (`deletePlanItem`). Two of the three list pages therefore only grow.

The schema does most of the cascading already, but not all of it, and the two cases fail in opposite directions. Both were measured against the development database (40 people, 4 templates, 33 copies, 26 active assignments) inside a transaction that was rolled back:

```
person.delete("אדוה זילברמן")            — naive
  the person's plan copies:              2
  still in the DB after the delete:      2   ← orphans, no assignment, no owner
  orphaned plan items left behind:       4 point · 8 metric · 2 recurring

careerPlan.delete(<template with 4 copies>)
  people on those copies before:         3
  people still holding a plan after:     26  ← unchanged
  copies now with sourceTemplateId=null:  4  ← the /plans/<id> link dies
  assignment rows still naming it:        4  ← via the templateName snapshot
```

The asymmetry has a cause. `PlanAssignment.plan` and `PlanAssignment.person` both cascade, but a `CareerPlan` copy holds no reference to its person — the ownership arrow points the other way (`Person.assignedPlanId → CareerPlan`, and `PlanAssignment.planId → CareerPlan`). Delete the person and the copy is simply unreferenced. A template, by contrast, was designed to be deletable: `sourceTemplateId` is `onDelete: SetNull` and `PlanAssignment.templateName` is a name snapshot whose schema comment already says "readable history even if the template is later deleted".

Constraints inherited from the project: admin-only mutations go through `requireAdmin()`; uploads live under `uploads/<personId>/` and are written through `src/lib/storage.ts`, which enforces an uploads-root guard; the delete-confirmation idiom (red modal, real counts, no typed confirmation) already exists in `HierarchyTree.tsx` and should not be reinvented.

## Goals / Non-Goals

**Goals:**

- A person can be deleted leaving nothing behind — no rows, no orphan plan copies, no files.
- A template can be deleted without disturbing anyone currently measured against a copy of it.
- The admin sees, before confirming, the true count of what will be destroyed, read from the database rather than estimated.
- Non-admins cannot reach either operation, in the UI or by posting the form.

**Non-Goals:**

- Undo, soft delete, or a recycle bin. `EmploymentStatus` already covers "this person left"; delete means the record was a mistake.
- Deleting a plan copy on its own. A copy belongs to an assignment; ending the assignment is how a person leaves a plan.
- Bulk delete. One row at a time.
- Cleaning up the orphan copies that a *previous* version might have left — there are none today (`orphan copies: 0`), and none can be created before this change ships.

## Decisions

### 1. Deleting a person deletes their plan copies explicitly, in one transaction

The action collects the copy ids from the person's `planAssignments` **plus** `assignedPlanId` (belt and braces: the active copy is reachable both ways, and a copy without an assignment row would otherwise be missed), then in a single `$transaction` deletes the person and then those copies.

Order matters and is the reverse of intuition: the person must go **first**. Deleting a copy cascades to its `PlanAssignment`, which cascades to the waivers and carry-overs — all of which are things we want gone anyway — but `PointProgress` and `MetricReading` hang off the copy's *items*, and those are also the person's records. Either order destroys the same set; deleting the person first means the copies are already unreferenced when they go, so no FK can fail mid-transaction.

*Alternative considered — add `personId` to `CareerPlan` with a cascade.* It would make the delete a one-liner, but it duplicates ownership that `PlanAssignment` already expresses, needs a migration, and would have to be kept true for templates (which have no person). Rejected: a schema change to avoid four lines in one action.

*Alternative considered — a nightly sweep for unreferenced copies.* Rejected: it makes correctness eventual, and an orphan copy is invisible in the UI, so nothing would ever notice the sweep had stopped running.

### 2. Files are deleted after the transaction commits, best-effort

`uploads/<personId>/` is removed recursively once the database transaction has succeeded. This follows the rule `deleteUpload` already documents: the database is the source of truth, and a file left behind is harmless, whereas failing a committed deletion because of a filesystem error is not. The converse order — files first — could destroy attachments for a person whose deletion then rolls back.

The recursive removal goes through a new `deleteUploadDir` in `storage.ts` so it inherits the existing path-traversal guard rather than composing a path by hand at the call site.

### 3. Deleting a template is permitted while people hold copies, and says so

The confirmation states the number of people currently assigned a copy — `countAssignmentsByTemplate` already computes this, though it clips to the caller's visibility; for an admin the scope is everything, so a dedicated unclipped count is used for the warning. It also states plainly what does **not** happen: their plan, progress and gap status are untouched.

The one real consequence is the dead link. `PeopleTable` already renders it — `<span title="התבנית שממנה הועתק המסלול נמחקה">` — so the copy's name still shows, only without a destination. That branch exists today and was written for exactly this.

*Alternative considered — block while anyone is assigned.* Safer on its face, but it forces the admin to transfer every person off a track before retiring it, which is the opposite of how tracks are retired: you stop assigning it, and the people already on it finish. Rejected on the user's decision.

### 4. Confirmation counts load with the list, not on demand

The obvious design is to fetch the counts when the modal opens, so a dialog that is rarely used costs nothing on page load. Measured, that reasoning is simply wrong:

```
40 people in the registry
  person.findMany + _count for all rows        7.6 ms   ← one query
  person.findMany, no counts (baseline)        1.1 ms
  person.findUnique + _count for ONE person    9.0 ms   ← slower than the whole list
```

`_count: { select: {…} }` compiles to a single query with correlated sub-counts, not one query per counted relation. There is no per-person multiplier to avoid: counting every row costs 6.5 ms on a page that already loads every row, and counting one row on demand costs more than counting all forty.

So the counts come down with the list. That removes a server action, a fetch-on-open, a loading state, a disabled confirm button, and the window in which the displayed numbers could go stale — all of which existed only to save something that was not being spent.

One count lies outside `_count`'s reach: `Attachment` is a child of `EvalEntry`, not of `Person`. It is gathered by a second query over evaluation rows (1.6 ms for the whole list).

The plans list gets its numbers the same way. `countAssignmentsByTemplate` already runs there but clips to the caller's visibility; the confirmation needs the true system-wide number, so an unclipped count is computed alongside it.

### 5. The modal shows what is not zero

The same measurement showed what the numbers actually look like:

```
totals:  planAssignments:33  evalEntries:115  pointProgress:41
         metricReadings:49   fieldValues:298  agentRuns:0  proposals:0
people whose deletion would destroy nothing but themselves: 4/40
```

Three consequences, taken as design:

- **Custom field values are not listed.** 298 of the 538 records are field values, ~9 for nearly every person, because they are the person's card — name, details, the schema every person shares. They are destroyed with the person the way their photo is, and listing them puts the largest and least meaningful number at the top of a dialog whose job is to convey severity.
- **Zero lines are omitted.** `agentRuns` and `proposals` are zero for every person today. A row reading "0" is clutter that dilutes the rows that carry weight.
- **"Nothing" is stated, not implied.** For the 4 people in 10 whose deletion destroys no history at all, five zeros read as gravity. Those confirmations say plainly that the person has no history and only the record itself will go.

The counts shown are therefore: plan assignments (which is also the number of plan copies), evaluations, attachments, recorded milestones, metric readings, and whether a photo exists.

### 6. Both list pages keep their server-rendered shape

`PeopleTable` is already a client component, so the actions column and modal go straight in. The plans page is a server component rendering a list; rather than converting the page, the row's admin controls move into a small client component (`PlanRowActions`) that owns the copy form and the new delete control. The page stays a server component and keeps its data loading.

### 7. Authorization is enforced in the action, not the render

`isAdmin()` decides whether the control is drawn; `requireAdmin()` inside `removePerson` / `removePlan` decides whether the deletion happens. The second is the one that matters — hiding a button is presentation, and a server action is a public endpoint.

## Risks / Trade-offs

- **Irreversible, one click behind a modal** → The modal is red, names the person or template, lists real counts, and the confirm button carries the consequence in its label. This matches the existing framework-delete, which is equally irreversible. A full backup remains available from system settings, and is what a mistaken delete is recovered from.
- **The counts are read when the page loads, so a long-open tab can show stale numbers** → Accepted, and narrower than it looks: the system has one admin, and the delete itself is transactional, so the numbers can be slightly off while the outcome cannot be half-done. Loading them on demand would shrink the window to seconds rather than close it, and costs more than it saves (decision 4).
- **`uploads/<personId>/` removal is best-effort; a filesystem error leaves files with no owner** → Accepted and documented, consistent with `deleteUpload`. The files are unreachable through the app (every route resolves through a database row) and reclaimable by hand.
- **Deleting a template silently changes what a manager sees in the people list** — the plan name stops being a link → Made visible: the existing tooltip explains it, and the confirmation warns before the fact.
- **A person deleted while an agent run references them** → `AgentRun.personId` is `onDelete: Cascade`; the run's history disappears with the person. Correct, and worth stating: the alternative is a report row pointing at nobody.

## Migration Plan

None. No schema change, no data backfill, nothing to roll back — the change is two new server actions and their UI. Reverting the commit removes the capability and leaves the data untouched.

## Open Questions

None outstanding. The three decisions that were genuinely open — whether to block template deletion while people are assigned, how total a person deletion should be, and how strong the confirmation should be — were settled with the user before this document was written.
