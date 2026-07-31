## 1. Generator skeleton

- [x] 1.1 `web/scripts/generate-demo-data.ts` with a seeded pseudo-random generator (fixed constant) driving every choice — no `Math.random`
- [x] 1.2 Guard: stop with an explanatory message if the demo center already exists, writing nothing
- [x] 1.3 `demo:data` entry in `package.json`
- [x] 1.4 Hebrew name pools (46 first names, 32 surnames) with a uniqueness check, so 32 people never repeat a full name

## 2. Organisation

- [x] 2.1 One dedicated center → 3 domains → 5 sections → 9 teams
- [x] 2.2 Team sizes deliberately uneven (1 to 6), so rollups differ between branches
- [x] 2.3 Three managers — `demo.algo` (EDIT on a domain), `demo.infra` (EDIT on a section), `demo.viewer` (VIEW on the center)

## 3. Career plans

- [x] 3.1 Milestone-led "מסלול קליטה מואץ": 6 point events, 1 metric, 24-month horizon
- [x] 3.2 Metric-led "מסלול מומחה טכנולוגי": 4 metrics with 2–3 checkpoints each, 48 months — enough metrics to show the palette cycling
- [x] 3.3 Evaluation-led "מסלול פיקוד וניהול": 3 recurring events at 6/9/24-month intervals, 72 months
- [x] 3.4 All recurring events carry an explicit stop month; colours assigned as the application assigns them

## 4. People

- [x] 4.1 32 people: first and last name, birth dates giving ages 22–55, recruitment dates spread over six years
- [x] 4.2 Card values generated from `PersonFieldDef` by type — enum options taken from the field itself, city/education/phone recognised by label
- [x] 4.3 Statuses: 30 active, 1 planned-end, 1 departed with an end-of-service date
- [x] 4.4 25 of 32 assigned an independent plan copy, mixed across all four templates; 7 left unassigned

## 5. Progress, arranged for a spread of states

- [x] 5.1 Point progress recorded per profile rather than at random — the first attempt used random diligence and produced 21 red of 27, because a person's status is the worst of all their items
- [x] 5.2 Metric readings clear the binding target for on-track profiles and fall short for slipping ones
- [x] 5.3 Occurrences filed for on-track profiles, skipped for slipping ones, none for neglected — producing real overdue occurrences
- [x] 5.4 Free-form evaluation entries for a quarter of the people
- [x] 5.5 Verified the mix: 🟢 MET 1 · ⬜ FUTURE 8 · 🟡 APPROACHING 4 · 🔴 OVERDUE 12 · no plan 7. The approaching state is produced deliberately, by deriving the recruitment date so a plan item falls due in about two weeks — it is not reachable by chance

## 6. Seed repair

- [x] 6.1 `prisma/seed.ts`: writes `firstName` / `lastName` / `birthDate`, with `fullName` composed from the parts
- [x] 6.2 `prisma/seed.ts`: the retired `END_OF_SERVICE` replaced with an explicit 72-month stop
- [x] 6.3 Ran migrations + seed against a scratch database (`manager_scratch`, created and dropped): 6 people all with name parts, matching `fullName` and birth dates; every recurring event `UNTIL_OFFSET/72`

## 7. Verification

- [x] 7.1 Ran on the live database: people 8 → 40, nodes 8 → 26, templates 1 → 4, users 5 → 8, while photos (2) and attachments (2) stayed exactly as they were
- [x] 7.2 32 people added, all under the one center (18 nodes)
- [x] 7.3 Second run refused with an explanatory message and wrote nothing — counts unchanged
- [x] 7.4 Reproducibility: generated, captured all 32 people with dates/status/plan, removed, regenerated — byte-identical
- [x] 7.5 Dashboard: the demo center rolls up, 19 red and 9 amber badges, 27 collapsible nodes, collapse-all still works at this volume
- [x] 7.6 People list renders all 40 rows; search narrows 40 → 2
- [x] 7.7 All three plans listed; diagrams differ in shape (7 ticks/+24/856px · 6 ticks/+48/856px · 15 ticks/+72/1448px); PDF export works
- [x] 7.8 Scoped views: `demo.algo` sees 13 of 40 people and only their own domain, `demo.infra` 8, `demo.viewer` all 32 with a dashboard limited to the demo center
- [x] 7.9 All 288 field values present (32 people × 9 fields); every enum value within its field's options
- [x] 7.10 A departed person's recurring occurrences stop at their end-of-service month
