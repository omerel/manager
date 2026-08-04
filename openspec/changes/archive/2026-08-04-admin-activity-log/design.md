## Context

Every mutation in this system goes through a server action — 64 of them across twelve `*-actions.ts` files — and each already resolves the acting user through `getSessionUser()` / `requireAdmin()` / `requireEditForPerson()` before it writes. So the actor is in hand at exactly the moment the act happens; nothing new is needed to know who did what.

What does not exist is any record of the act. `AgentRun` logs agent executions, but nothing logs a person editing, deleting or granting.

The system also has a standing habit worth respecting: it does not keep data it cannot explain. Backups are for recovering content; this log is for answering "who did this, and when".

## Goals / Non-Goals

**Goals:**

- An Admin can see what users did, newest first, and narrow it by user or by kind.
- Each entry reads as a sentence a person understands without knowing the schema.
- The table does not grow without bound.
- Logging can never break the thing it observes.

**Non-Goals:**

- Before/after values, or any ability to undo. That is what backups are for, and storing old values would turn a light trail into a second copy of the database.
- Covering all 64 actions. Reads, logins-by-the-minute and internal bookkeeping are noise in an investigation.
- Tamper-proofing. This is an operational trail for a trusted Admin, not a security audit log; claiming otherwise would be a promise the design does not keep.
- A scheduler. Retention is enforced on write.

## Decisions

### 1. One rendered sentence, written at the moment of the act

`ActivityLog` stores `actorId`, `actorName`, `action` (a small enum-ish string like `person.delete`), `description` (Hebrew, already composed), optional `subjectType` + `subjectId`, and `createdAt`.

**`actorName` and `description` are snapshots, deliberately denormalised.** A log that renders itself by joining to live rows would say "מחק את (נמחק)" once the subject is gone — which is exactly the case an investigation is about — and would silently rewrite its own history when a person is renamed. The whole value of the entry is what was true when it was written.

`subjectId` is kept as a plain string with **no foreign key**, for the same reason: the most interesting entries point at rows that no longer exist, and a real FK would either block the deletion or cascade the evidence away.

*Alternative considered — store structured fields and render at read time.* Cleaner in the abstract, wrong here: it makes the log's readability depend on data the log exists to outlive.

### 2. Explicit logging in meaningful actions, not a data-layer hook

The user chose explicit. It is also the only option that produces the sentence above: a Prisma-level hook sees `careerPlan.create` twenty times for one plan assignment and cannot know that the act was "שייך את דנה כהן למסלול פיקוד".

The known cost is drift — a future action that forgets to log. It is mitigated, not pretended away: `logActivity` is one function with one call shape, the recorded set is listed in the spec so "should this be logged?" has an answer, and verification asserts that a representative action from each family writes exactly one entry.

### 3. Logging never fails the action

`logActivity` swallows its own errors. An action that succeeded must not be reported as failed because the trail could not be written — the user's edit is the product; the log is an observation of it.

It is also written **after** the action's own work, so a failed action leaves no entry claiming something happened.

### 4. Retention is a month, from an environment variable, enforced on write

`ACTIVITY_LOG_DAYS`, default 30 (the user's decision). Entries older than the window are deleted opportunistically as new ones are written, so the system needs no scheduler and no cron for it.

The cleanup runs on a sampled basis rather than on every single write — deleting on every insert would put a range delete in the path of every edit for no benefit. The window is a retention promise, not a guarantee of deletion the instant it lapses, and the spec says so rather than implying precision the implementation does not have.

Setting the variable to `0` keeps everything, for an environment that wants that.

### 5. Admin only, enforced in the page and the reader

`isAdmin()` decides whether the entry point renders; the page redirects a non-admin; and the reader function itself calls `requireAdmin()`. The last one is what matters — a page is presentation, a data function is reachable.

## Risks / Trade-offs

- **A new action forgets to log** → the recorded set is enumerated in the spec, `logActivity` has a single call shape, and verification checks one action per family. Accepted as the cost of readable entries, which was the point.
- **The log says what happened but not what changed** → deliberate. Investigation starts with "who touched this and when"; the content lives in backups.
- **A busy day makes the page long** → filters by actor and by action kind, newest first, and a bounded page size.
- **Retention deletes evidence of an old incident** → a month was chosen by the user and is configurable; an environment that needs longer sets the variable.
- **It is not tamper-proof** → stated plainly rather than implied. An Admin can delete rows like any other data; this is an operational trail, not a security control.

## Migration Plan

One additive migration for the `ActivityLog` table. No backfill — history before this ships does not exist and will not be invented. Rollback is reverting the commit; the table can be dropped.

## Open Questions

None. Capture method and retention were settled with the user before this document.
