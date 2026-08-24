# Proposal: import-end-of-service

## Why

«תאריך סיום שירות» (`endOfServiceDate`) is a core card column — on the person form, on the card, applied by the document-extraction flow — yet the HR import's target list stops at seven core fields, so the column cannot be mapped at all: not in the mapping dropdown, not by header recognition, not by the agent. The same gap silences it in the weekly external update. It is core-but-unmappable — every other card field is reachable by one path or the other.

## What Changes

- `endOfServiceDate` becomes the eighth core `ColumnTarget`: recognition variants («תאריך סיום שירות», «תת״ש», «סיום שירות»…), the mapping dropdown option, and the agent's target list.
- The import treats it as an **optional, nullable** date: absent or unreadable never blocks the row (soft-drop with a warning, like placement date — but with no fallback value).
- The external update proposes changes to it like the other card dates, and — because the column is nullable — an emptied cell proposes a **deletion**, which `applyItem` learns to honor by nulling the column.
- No schema change (the column exists), no new packages.

## Capabilities

### Modified

- `hr-workspace`: the import's core field set gains the service-end date, optional and nullable, in both the table import and the external update.

## Impact

- `web/src/lib/hr-import.ts` — `ColumnTarget`, `CORE_VARIANTS`, agent targets, `classifyRows` date loop, `RowPlan` data.
- `web/src/lib/hr-import-actions.ts` — person creation carries the date when present.
- `web/src/app/hr/page.tsx` — the dropdown option.
- `web/src/lib/hr-update.ts` — `compareTarget` branch + `LoadedPerson`.
- `web/src/lib/extract-actions.ts` — `applyItem` deletion of a nullable core date.
