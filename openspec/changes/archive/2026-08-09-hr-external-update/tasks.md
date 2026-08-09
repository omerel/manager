## 1. Data model

- [x] 1.1 `ImportMapping` (headersHash unique, mapping Json, dateFormats Json) and `ImportSnapshot` (filename, uploadedAt, uploadedBy, headersHash, rows Json, filePath); migration via `migrate diff`, read before applying
- [x] 1.2 Prove against the database: one mapping per signature (second insert refused), snapshot rows round-trip, deleting the uploader keeps the snapshot readable

## 2. Targets and mapping

- [x] 2.1 Extend `ColumnTarget` with `point:<label>` / `metric:<label>`; the chooser lists labels across plan TEMPLATES, multi-select per column; evaluations and recurring events absent
- [x] 2.2 Header-signature normalisation + hash — same signature, same mapping, filename irrelevant
- [x] 2.3 The structure-changed gate: diff of appeared/vanished headers, explicit user consent, known columns keep their mapping, new ones go through recognition + the agent
- [x] 2.4 A mapping-health check on the review screen: a `point:`/`metric:` label no template carries any more is flagged on the mapping, not silently dead

## 3. The diff and the proposals

- [x] 3.1 The two-stage diff: file-vs-snapshot (absent snapshot = everything passes), then value-vs-system per target kind — card field, point completion date, metric value — through the Israeli date gate with the saved formats
- [x] 3.2 Proposal generation per person in scope: current → proposed items, deletion items only for may-be-empty targets, required-cell emptiness as a row warning; unknown people silently skipped
- [x] 3.3 Multi-target columns resolve per person against their own plan; inapplicable targets are not noise

## 4. Applying

- [x] 4.1 `applyItem` learns `point:<label>` — find the event by label in the person's assigned plan, upsert `PointProgress` with the approved date; deletion removes the progress row
- [x] 4.2 `applyItem` learns `metric:<label>` — upsert `MetricReading` value; deletion removes the reading
- [x] 4.3 Deletion of a configurable field empties its value; required core fields never reach here by construction

## 5. The review screen

- [x] 5.1 The update part of `/hr`: upload with PendingButton, the structure gate when needed, the mapping editor with multi-select, then the review
- [x] 5.2 Review grouped by person: expandable rows, current → proposed per field, approve/reject each, deletion proposals unchecked by default, per-person approve and approve-all-marked
- [x] 5.3 Conclusion: file saved under uploads, `ImportSnapshot` written, becoming the next diff base; abandonment leaves the previous base standing

## 6. Verification

- [x] 6.1 `scripts/verify-hr-update.ts` — the engine: signature stability, the two-stage diff including the hand-correction-survives case and the first-run-no-snapshot case, multi-target per-plan resolution, deletion only where legal, required-cell warning, unknown-person silence, out-of-scope silence
- [x] 6.2 Prove the apply paths on real plan copies — covered in the E2E through the real proposal action (the point completion lands on the person's own copy, dated from the file); applyItem is deliberately NOT exported, since an exported server-action becomes a callable endpoint that would bypass requireEditForPerson
- [x] 6.3 E2E: first upload → map (multi-select one column) → approve fields on one person and reject on another → conclude → re-upload a changed file → only the changes surface → structure change asks first; existing suites stay green
- [x] 6.4 Both suites twice, `npx tsc --noEmit`, `npm run build`

## 7. Usability refinements (user feedback on the first demo)

- [x] 7.1 The mapping editor became a searchable checkbox picker (`TargetPicker`): a search field per column, ✓ marks instead of ctrl-click, and "nothing ticked" IS ignore — which also removed the duplicated «התעלם» entry
- [x] 7.2 Every target names its SOURCE — כרטיס עובד, or the career plans carrying the label (`careerTargetSources`)
- [x] 7.3 The last concluded file downloads from the history line (`/hr/last-import`, role-gated), so the HR user can inspect the master system's latest format
- [x] 7.4 Part 1 got its own section heading — «ייבוא טבלת אנשים» — under the page title, mirroring part 2's
