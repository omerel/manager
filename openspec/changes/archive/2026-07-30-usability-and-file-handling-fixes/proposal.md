## Why

A round of fixes from real use. Three are genuine bugs with a shared root cause worth naming:

- **Document analysis fails** (`cannot identify image`) because uploaded PDFs are handed to the agent *as files* and its Read tool treats them as images — which only works with a multimodal model. The deployment runs a non-multimodal model.
- **The agent asks for permission to run Python** when a question touches an Excel attachment: the snapshot copies attachments as raw binaries, so the only way to read them would be scripting — which the read-only toolset (rightly) forbids.
- **Uploaded images vanished after a pod crash**: the image declares an anonymous `VOLUME /app/uploads`, which does not survive pod replacement unless a PVC is mounted there, and the path is hard-coded in code.

The rest are usability gaps: records that can be created but not edited (frameworks, plan events), a destructive delete that throws a page error instead of asking, missing person-card fields (first/last name, birth date, age), no drag-and-drop, a dashboard tree that can't be collapsed, and photos that can't be enlarged.

## What Changes

**Reading documents (the agent):**
- **Server-side text extraction before the model ever sees a file** — one extractor handles PDF (pdftotext), Word (mammoth), Excel (SheetJS), and text/CSV, producing plain text. Applied in **both** paths: the "נתח מסמך" analysis flow *and* the agent snapshot, where every attachment now also gets a readable `.txt` sidecar.
- **OCR fallback** for scanned PDFs and image attachments: when native extraction yields no meaningful text, the file goes through Hebrew+English OCR (tesseract, baked into the image).
- The agent stays **strictly read-only** (Read/Grep/Glob) — pre-extraction removes any reason to run scripts, so the permission prompt disappears rather than being granted.

**File handling:**
- **Drag-and-drop** on every upload surface (profile photo, evaluation attachments, document analysis, new-person document, logo, backup import), with click-to-browse preserved.
- **Uploads live at an env-configured path** (`UPLOADS_DIR`), so OpenShift can mount a PVC there; deployment docs updated — this is what makes uploads survive a pod restart.

**Frameworks (hierarchy page):**
- **Edit an existing framework**: name, kind, and parent, with validation that refuses changes which would break the tree (wrong parent kind, cycles, a kind change that orphans children).
- **Deleting a framework with sub-frameworks** now asks for confirmation stating exactly what will be removed (N sub-frameworks, N people becoming unassigned) and then deletes the whole subtree — instead of throwing a page error.

**Career plans:**
- **Edit existing events**: point events, cumulative metrics (and their checkpoints), and recurring events.
- **Distinct colors**: each recurring event and each cumulative metric gets a stable color auto-assigned from a soft palette, so they are visually distinguishable on the page and in the career-path diagram.

**Person card:**
- **First name and last name** as separate fields (existing records split on the first space; both editable afterwards).
- **Birth date** as a core field (required on new records), and **age** derived from it and displayed in years and months — read-only, never stored.
- The existing custom "יום הולדת לועזי" field is migrated into the new core birth date and removed, so the card has no duplicate.

**Dashboard & people:**
- Org-tree nodes are **collapsible**, plus a **collapse/expand-all-teams** control (teams are where the people hang).
- Clicking a person's photo **opens it enlarged in a centered overlay**.

## Capabilities

### New Capabilities
- `file-handling`: uploading files (drag-and-drop) and turning any uploaded document into text the agent can read, including OCR fallback for scans.

### Modified Capabilities
- `org-structure`: framework editing and confirmed cascade deletion.
- `career-plans`: editing existing events; distinct per-event colors.
- `people-registry`: first/last name, core birth date, derived age; photo enlargement.
- `gap-engine`: the rollup dashboard becomes collapsible.
- `deployment`: uploads path is configured by environment so a persistent volume can be mounted.

## Impact

- **Schema** (additive migrations): `Person.firstName/lastName/birthDate`, `color` on `CumulativeMetric` and `RecurringEvent`; `fullName` stays as the maintained display/sort field. Data migration backfills names by first space and moves the custom birthday values.
- **Image**: adds `poppler-utils` and `tesseract-ocr` (+ Hebrew/English data) — roughly a few hundred MB, still fully offline.
- **Code**: new `doc-text` extractor and shared `FileDrop` component; edits across hierarchy, plans, person card, dashboard, snapshot builder, storage, Dockerfile and deployment docs.
- **Air-gap**: everything resolved at build time; the two new packages are apt, baked in.
