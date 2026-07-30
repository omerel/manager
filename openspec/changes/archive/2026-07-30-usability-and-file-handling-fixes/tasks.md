## 1. Schema & data migration

- [x] 1.1 Person: add `firstName`, `lastName`, `birthDate` (nullable in DB, required in forms); keep `fullName` maintained from the two parts on every write
- [x] 1.2 Add `color` to `CumulativeMetric` and `RecurringEvent`
- [x] 1.3 Data migration: split existing `fullName` on the first space; backfill colors from the soft palette; move "יום הולדת לועזי" values into `birthDate` and delete that field definition — `scripts/migrate-usability-fixes.ts` (idempotent)
- [x] 1.4 Age helper: years + months from `birthDate` (derived, never stored)

## 2. Document text extraction (the agent bugs)

- [x] 2.1 Dockerfile: add `poppler-utils` and `tesseract-ocr` + `tesseract-ocr-heb`/`-eng`
- [x] 2.2 `src/lib/doc-text.ts`: extract text per type (pdftotext / mammoth / SheetJS / plain), reporting the method used
- [x] 2.3 OCR fallback when extraction yields near-no text or the file is an image (pdftoppm → tesseract heb+eng), with a time cap
- [x] 2.4 Wire into document analysis (`materializeDocument`) so PDFs work with a non-multimodal model
- [x] 2.5 Wire into the agent snapshot: write a `.txt` sidecar beside every attachment and point `people.json` at it
- [x] 2.6 Confirm the agent toolset stays read-only (no Bash) and clear failures surface as "לא ניתן לחלץ טקסט"

## 3. Uploads persistence

- [x] 3.1 `UPLOADS_DIR` env in `storage.ts` (default `<cwd>/uploads`), traversal guards resolved against it
- [x] 3.2 Image sets `UPLOADS_DIR=/app/uploads`; env examples + README/dist guide state that a persistent volume (PVC) must be mounted there

## 4. Editing existing records

- [x] 4.1 Hierarchy: edit a framework (name, kind, parent) with tree validation — wrong parent kind, cycles, kind changes that break children/people
- [x] 4.2 Hierarchy: cascade delete — client confirmation with real counts, then subtree deletion in one transaction (people become unassigned)
- [x] 4.3 Plans: edit point events (label, offset)
- [x] 4.4 Plans: edit cumulative metrics (name, unit) and their checkpoints (target, offset)
- [x] 4.5 Plans: edit recurring events (label, interval, stop condition)
- [x] 4.6 Apply per-event colors on the plan page cards and in the career-path diagram

## 5. UI affordances

- [x] 5.1 Shared `FileDrop` component (drag-and-drop + click-to-browse + selected filename)
- [x] 5.2 Use it on: profile photo, evaluation attachments, document analysis, new-person document, logo, backup import
- [x] 5.3 Dashboard: collapsible tree nodes + collapse/expand-all-teams control
- [x] 5.4 Person card: click photo → enlarged centered overlay
- [x] 5.5 Person forms and card: first/last name, birth date, derived age (read-only)

## 6. Verification

- [x] 6.1 Agent over documents: PDF analysis proposes fields (יונתן / אלמוג / 1994-09-04 / 2021-07-01 + card fields); an Excel attachment question answered in 17s with the real numbers and no permission prompt
- [x] 6.2 OCR path: image-only PDF and PNG go through pdftoppm → OCR → assembled text (verified with a tesseract stand-in; the real binary ships in the image); missing OCR reports "OCR אינו זמין בסביבה זו" instead of crashing
- [x] 6.3 Hierarchy: valid edits apply; invalid parent kind / center-with-parent rejected inline with the reason (no page error); own subtree excluded from the parent list so cycles are unreachable; cascade delete confirms with the subtree list then removes it
- [x] 6.4 Plans: all four item types edit correctly; metric cards and recurring rows have distinct soft colors, the diagram fans per-event markers in matching colors, colors stay stable when a sibling is deleted; PDF export still 200/valid
- [x] 6.5 Person: created from first/last name + birth date, age renders "34 שנים ו-8 חודשים", photo lightbox opens centered and closes on Escape, edit form round-trips the fields
- [x] 6.6 Dashboard collapse-all-teams and per-node chevron both hide/restore the people beneath; a real drop event on the photo field lands the file on the hidden input so the form submits it
- [x] 6.7 Backup export → import round-trip: bundle carries firstName/lastName/birthDate and item colors, import restores all 7 people, config export byte-identical afterwards
