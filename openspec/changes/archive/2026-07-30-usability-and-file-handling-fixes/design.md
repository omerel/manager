## Context

A fix round over a working system. Investigation pinned the three bugs precisely:

- `materializeDocument` passes PDFs through untouched, and the agent snapshot copies attachments as raw binaries; both rely on the agent's Read tool interpreting binary/image content. That only holds for a multimodal model — the deployed one is not, hence `cannot identify image` and the Python-permission prompt.
- The agent's toolset is `Read,Grep,Glob` (no shell). That boundary is correct and worth keeping; the fix belongs on the server side of it.
- `UPLOADS_ROOT` is `process.cwd()/uploads` and the image declares an anonymous `VOLUME /app/uploads` — nothing guarantees persistence under pod replacement.

The rest are missing edit paths and UI affordances over existing data.

## Goals / Non-Goals

**Goals:** documents readable by a text-only model, in both agent paths; uploads that survive restarts; editable frameworks and plan events; the person card's identity fields (first/last name, birth date, age); collapsible dashboard tree; drag-and-drop and photo enlargement. All offline-capable.

**Non-Goals:** admin-chosen event colors (auto palette only), Hebrew-calendar dates, OCR tuning/layout reconstruction, per-page document previews, editing a plan copy already assigned to a person (templates only), reworking how progress is recorded.

## Decisions

**D1 — One extractor, used by both agent paths.**
A single `doc-text.ts` exposes `extractText(buffer|path, filename) → { text, method }`. It is called by the document-analysis flow *and* by the snapshot builder, which now writes, next to every copied attachment, a `<name>.txt` sidecar and points `people.json` at it. *Why both:* the two bugs are the same bug in two places; one module means one behavior and one place to fix.

**D2 — Extraction tiers, with OCR as a fallback rather than a default.**
`.pdf` → `pdftotext -layout`; `.docx` → mammoth; `.xlsx` → SheetJS CSV per sheet; `.txt/.md/.csv` → as-is. If the result is below a small text threshold (a scanned PDF yields near-nothing), or the file is an image, fall back to OCR (`tesseract -l heb+eng`; PDFs rasterized with `pdftoppm` first). Both tiers report which method was used so failures read clearly ("לא ניתן לחלץ טקסט"). *Why fallback, not default:* native extraction is instant and exact; OCR is seconds-per-page and approximate.

**D3 — The new tooling is apt, not npm.**
`poppler-utils` (pdftotext, pdftoppm) and `tesseract-ocr` + `tesseract-ocr-heb/eng` are baked into the image. *Why:* far more reliable on Hebrew PDFs than pure-JS parsers, and consistent with how Chromium/fonts are already handled. `package.json` gains nothing; the image grows a few hundred MB.

**D4 — `fullName` stays as a maintained derived column.**
Store `firstName` + `lastName` as the source of truth, and keep writing `fullName = firstName + " " + lastName` on every create/update. *Why:* `fullName` is read in ~20 places (sorting, search, diagram, snapshot, portability bundles, PDF footers); keeping it removes that churn and preserves DB-level ordering/filtering. Backfill splits existing names on the first space — all current records are two-word names, and both parts stay editable.

**D5 — Age is computed, never stored.**
`birthDate` is the only stored fact; a helper renders "N שנים ו-M חודשים" from today. Stored ages rot silently; derived ones cannot.

**D6 — Colors: stored at creation, auto-assigned, stable.**
A `color` column on `CumulativeMetric` and `RecurringEvent`, filled at creation by cycling a soft palette based on the current count within the plan. *Why stored rather than derived by index:* an index-derived color shifts every time a sibling is deleted; a stored one never moves. Existing rows are backfilled.

**D7 — Framework edits are validated against the tree, not just the row.**
Reject: a parent whose kind is not the expected one for the new kind; a parent that is the node itself or one of its descendants (cycle); a kind change that leaves existing children of the wrong kind or attached people on a non-team. Each rejection returns a specific message rather than a generic failure.

**D8 — Cascade delete: server-computed impact, client confirmation, one transaction.**
The page already computes subtree headcounts; the delete control is a small client component that confirms with those exact numbers ("N תת-מסגרות, N אנשים יעברו ל'ללא שיוך'"). The action then collects the subtree and deletes it depth-first in a single transaction; people detach via the existing `ON DELETE SET NULL`. *Why client-side confirm:* keeps the destructive step one deliberate click away without inventing a modal framework.

**D9 — `UPLOADS_DIR` env, absolute in production.**
`storage.ts` reads `process.env.UPLOADS_DIR ?? <cwd>/uploads`. The image sets it to `/app/uploads` and documents that OpenShift must mount a PVC there — the missing piece that made images disappear. Path-traversal guards continue to resolve against the configured root.

**D10 — Interactivity as small client components over plain data.**
The dashboard tree becomes a client component receiving the already-serializable `GapTreeNode[]`, holding a `Set` of collapsed ids plus a collapse-all-teams toggle; `FileDrop` wraps a hidden input with drag handlers and shows the chosen filename; the photo lightbox is a click-to-open fixed overlay. No new dependencies.

## Risks / Trade-offs

- **Image size** grows with poppler + tesseract + Hebrew data → accepted; it buys reading scanned documents entirely offline. Noted in the deployment docs.
- **OCR latency** (seconds per page) → all document work already runs as background jobs with progress UI, so it lands in the right place; a hard cap keeps a pathological file from hanging a job.
- **Name split heuristic** may mis-split compound surnames → both fields are editable, and the split only ever runs once, on existing rows.
- **Cascade delete is destructive** → explicit confirmation with real numbers, plus the backup/export capability as the safety net.
- **Schema touches portability** → the export inventory dumps whole rows, so new columns ride along, but a backup round-trip must be re-verified after the migration.
- **Renaming/moving frameworks affects grants** → grants reference node ids, which are unchanged by an edit, so access is preserved by construction; worth an explicit check.

## Migration Plan

1. Schema + data migration (names, birth date, colors) and the custom-birthday field migration.
2. Extraction module + Dockerfile tooling, wired into both agent paths.
3. Uploads path via env + deployment docs.
4. Editing UIs (frameworks, plan events) and cascade-delete confirmation.
5. UI affordances (drag-and-drop, dashboard collapse, photo lightbox).
6. Verification, including a backup round-trip and an agent question over a PDF and an Excel attachment.

## Open Questions

- The migrated custom field was named "יום הולדת לועזי" (*Gregorian* birthday), which hints a Hebrew-calendar date may also be tracked. The new core field is the Gregorian one; if the Hebrew date matters it can stay/return as a custom field — worth confirming before the field is removed.
