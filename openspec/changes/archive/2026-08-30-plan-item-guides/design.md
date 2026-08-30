# Design: plan-item-guides

## Approach

Two files with two different owners, so two different mechanisms — chosen to match how each is actually decided:

```
   a plan item's guideline        the interview format
   ────────────────────────       ────────────────────
   authored per item, in the      one for the house, in
   plan editor                    system settings
        │                              │
   columns on the item            AppSetting rows
        │                              │
   read LIVE through the          read directly
   copy's source pointer
```

## Decisions

1. **Columns, not a table.** One file per item, so `guideName / guidePath / guideMime / guideSize` on `PointEvent` and `RecurringEvent`. A `PlanGuide` row would buy a second lookup and a join for something that is a single optional attachment.

2. **`sourceEventId` on the copy is what makes "live" possible.** Copies currently carry no pointer to the template item they came from — the plan carries `sourceTemplateId`, the items carry nothing. Adding a nullable self-relation on each of the two models lets a person's event resolve its guideline through the template at read time. `onDelete: SetNull`, so deleting the template item leaves the copy intact and simply guideline-less, which is exactly the deletion behaviour the requirement asks for.

3. **No backfill, by decision.** Existing copies keep `sourceEventId = null` and are offered nothing. Matching on (label, offset) would be a guess wearing the clothes of a fact, and a wrong guess here hands someone the wrong form.

4. **Storage reuses what exists**, unchanged: `saveUpload("plan-guides", file)` — the same helper the logo already calls with `"branding"`, where the first argument is a directory rather than a person. `deleteUpload` on replacement and on item deletion. Nothing in the uploads layer changes.

5. **Serving: one route, signed-in users.** A guideline is reference material, not personal data — the plans page is already open to every signed-in user, so gating a guideline more tightly than the plan it describes would be theatre. The route refuses without a session and streams with the original filename.

6. **The interview format is an `AppSetting` trio** (`interviewFormatName / Path / Mime`), following the login link's shape exactly — including "empty value deletes the row", so removal is the same act as clearing. It is read once on the person card and turned into a link beside the interview form.

7. **Recurring occurrences share one file.** The guideline hangs on the event, and the slot list reads it from there; nothing is stored per occurrence.

8. **The guideline is not drawn on the career vector.** The drawing answers "where am I"; a download belongs in the list, where the acting happens. (This is the same split the card already makes between the picture and the lists.)

## Risks

- **A file outliving its row.** Deletion is best-effort by design in this codebase (`deleteUpload` never fails an action). A guideline left on disk is unreferenced and harmless; the database stays the source of truth.
- **Two upload surfaces, one storage root.** The guides directory and the branding directory are siblings; `deleteUploadDir(personId)` walks only a person's directory and cannot reach either — asserted in the suite, since a wrong path there would delete house documents when a person is removed.

## Verification

`web/scripts/verify-plan-guides.ts`:
- authoring: attach a file to a template point event and to a recurring one; assert the columns hold it and the stored file exists;
- the live rule: assign a person, then REPLACE the template's file — the person's card offers the new one, and the replaced file is gone from disk;
- reach: the file is offered at the point event and at every occurrence of the recurring one; a metric offers none; a personal event offers none; a copy without a source pointer offers none;
- deletion: deleting the template item deletes the file and the card stops offering it;
- serving: the route streams the file to a signed-in user with the original filename, and refuses without a session;
- interview format: set, replace and clear it through the settings action; the card offers it only while set;
- isolation: deleting a person leaves both the guides and the branding directories untouched.
