## Why

The system currently holds 8 people, 3 teams and 1 career plan — enough to prove a feature works, not enough to judge whether it works *well*. Questions that only a populated system can answer stay open: does the gap dashboard stay readable when a domain holds forty people, does the rollup actually distinguish a struggling section from a healthy one, does the people list need better filtering, does the career-path diagram hold up across plans of different shapes, does a manager's scoped view feel right.

Populating that by hand is hours of clicking, and the result is not reproducible: a bug found on one person's data cannot be re-created after a database reset.

Separately, `prisma/seed.ts` is stale and would now produce broken records. It writes only `fullName`, leaving the `firstName` / `lastName` / `birthDate` fields that became mandatory empty, and it still writes the `END_OF_SERVICE` stop mode that was retired. A first boot in the air-gapped environment relies on that script.

## What Changes

- A **demo-dataset generator** — `npm run demo:data` — that adds a realistic organisation to the existing database without touching anything already there.
- **At least 30 people** spread unevenly across a multi-level framework, with recruitment dates spanning several years, plausible Hebrew names, birth dates, and values for every field the Admin has defined on the person card — read from the card schema rather than hard-coded, so the generator keeps working when the schema changes.
- **Three additional career plans**, deliberately different in shape — milestone-led, metric-led and evaluation-led, over different horizons — so the gap engine and the career-path diagram are each exercised on more than one kind of plan.
- **A deliberate spread of gap states.** Progress is recorded for some people and not others, some metric readings clear their target and some fall short, some evaluation occurrences are filed and some are not, and a few people have already left. The point is that the dashboard shows green, amber and red rather than one uniform colour.
- **Managers with scoped grants** over parts of the generated tree, so permission-clipped views can be judged with real volume behind them.
- The dataset is **reproducible**: a fixed random seed means two runs on an empty database produce byte-identical people, so a defect found in it can be found again.
- Everything generated hangs off **one dedicated center**, which is what will make removing it later a single cascade delete rather than a hunt.
- `prisma/seed.ts` is **brought back in line** with the current schema.

## Capabilities

### New Capabilities

- `demo-data`: the project provides a reproducible, additive way to populate a representative organisation for evaluating and demonstrating the system.

### Modified Capabilities

_None._ No product behaviour changes; this adds tooling and repairs an existing script.

## Impact

- `web/scripts/generate-demo-data.ts` — new generator
- `web/package.json` — `demo:data` script entry
- `web/prisma/seed.ts` — repaired: name parts, birth dates, explicit recurring stop month
- No schema change, no new dependency, no change to the running application or the air-gap image
- Writes to `Person`, `PersonFieldValue`, `OrgNode`, `CareerPlan` and its event tables, `PointProgress`, `MetricReading`, `EvalEntry`, `User`, `AccessGrant`
