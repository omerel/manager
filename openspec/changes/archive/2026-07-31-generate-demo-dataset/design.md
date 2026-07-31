## Context

Two population paths already exist and neither fits:

```
prisma/seed.ts        wipes everything, then writes a 6-person baseline
                      — currently broken: no name parts, no birth dates,
                        writes the retired END_OF_SERVICE stop mode
backup import         restores a bundle wholesale, also destructive,
                      and needs a bundle to exist in the first place
```

What is missing is an additive path: put a realistic organisation *next to* what is already there. The Admin has manually created people, photos and plans while testing, and those must survive.

The data model makes "realistic" concrete. A person's gap state is derived from `recruitmentDate` + assigned plan + recorded progress, so the distribution of gap states is not something to be set — it has to be *arranged*, by choosing recruitment dates and deciding what progress to record against them. The card schema is Admin-defined (currently nine fields: two numbers, four enums, three texts), so field values cannot be hard-coded without breaking the moment a field is added.

## Goals / Non-Goals

**Goals:**

- Enough volume and variety to judge the dashboard, rollups, list filtering, scoped views and the diagram.
- Additive: nothing already in the database is modified or removed.
- Reproducible: the same run produces the same people, so a defect found is a defect findable again.
- Removable later without a hunt, even though removal itself is out of scope.
- Repairs `prisma/seed.ts` so first boot works.

**Non-Goals:**

- A purge command. Deferred by explicit decision; this design only ensures it stays cheap to add.
- An in-app "generate demo data" button. A script is the right shape for something an operator runs deliberately.
- Photos for generated people. Binary assets belong to real records; the initials avatar already covers the empty case, and it is worth seeing on a populated list.
- Faker or any other data-generation dependency — air-gap constraint, and the name pools needed are Hebrew and small.

## Decisions

### D1 — A dedicated center is the container, and the removal handle

Everything generated hangs off one new center. This is not cosmetic:

```
מרכז <demo>                     ← one node
  ├── domains → sections → teams
  └── people attached to those teams
```

Deleting that center removes the whole subtree and unassigns its people — behaviour that already exists and was verified when cascade delete shipped. So the deferred "how do we delete it" question has an answer that costs nothing to preserve now: keep everything under one root. A marker column on `Person` was the alternative and was rejected — it needs a migration and a second source of truth for something the tree already expresses.

Generated plans are templates and live outside the tree; they are named distinctly so they are recognisable in the plans list.

### D2 — Refuse to run twice rather than deduplicate

If the demo center already exists, the script stops and says how to remove it. Additive generation is not idempotent by nature — a second run would double the population — and silently skipping would be just as confusing as silently duplicating. Refusing is the honest option, and it makes the failure recoverable in one step.

### D3 — Deterministic pseudo-randomness, not `Math.random`

A small seeded generator (a linear congruential step over a fixed seed) drives every choice: names, dates, statuses, field values, which progress is recorded. Two runs on an equivalent database produce identical people.

This matters more than it looks. Without it, "the dashboard shows a wrong count for one person" becomes unreproducible the moment the database is reset, which is exactly the situation where generated data is most tempting to blame.

### D4 — Field values are derived from the card schema at runtime

The generator reads `PersonFieldDef` and produces a value per field by type: `ENUM` picks from that field's own options, `NUMBER` a plausible number, `DATE` a plausible date, `TEXT` from a small pool chosen by the field's label where one is recognised (city, education, phone) and a generic value otherwise.

Hard-coding today's nine fields would produce a generator that silently stops filling cards the moment an Admin adds a field — the failure would be invisible, since a card with an empty field looks like a card someone did not finish.

### D5 — Gap states are arranged, not randomised

The spread is designed backwards from what the dashboard should show:

| Intended state | How it is produced |
|---|---|
| 🟢 healthy | recent recruitment, or older with progress recorded and metrics above target |
| 🟡 approaching | a checkpoint or occurrence falling within the approaching window |
| 🔴 overdue | older recruitment with milestones left incomplete, or a metric short of a passed target |
| no plan | a slice of people left unassigned |
| departed | end-of-service set, exercising the occurrence clipping added in the previous change |

Roughly a fifth of people are left without a plan, and a couple are departed. Both are states the UI must handle and both are easy to forget when populating by hand.

### D6 — Three plans differing in shape, not just in name

- **Milestone-led** — many point events, one metric, short horizon: exercises card-heavy diagrams and point-progress gaps.
- **Metric-led** — several cumulative metrics with multiple checkpoints each: exercises the value axis, and enough metrics to show the soft palette cycling.
- **Evaluation-led** — two or three recurring events at different intervals over a long horizon: exercises occurrence unrolling, the fanned diagram markers, and the new rule that markers are drawn only across the span of concrete events.

Different horizons (roughly two, four and six years) mean the diagram's ordinal axis is exercised at different slot counts.

### D7 — Seed repair is minimal

`prisma/seed.ts` gains name parts, birth dates and an explicit recurring stop month. It keeps its clean-slate semantics and its small size: it is the baseline a fresh environment boots with, not a demo. Growing it into the demo dataset would make first boot in the air-gapped environment produce forty fictional people, which is the opposite of useful.

## Risks / Trade-offs

- **Generated people are indistinguishable from real ones inside the app** → mitigated by the dedicated center and recognisable plan names; accepted knowingly, since a marker column was rejected in D1. Worth stating plainly: on a production database this data would need removing before real use.
- **A fixed seed makes every environment's demo data identical** → intended, and the reason the option was chosen; anyone wanting variety can change the seed constant.
- **Volume slows the dashboard** → that is a finding, not a risk. Discovering it at 40 people is the point.
- **The generator drifts from the schema as the model evolves** → reduced by D4 for card fields; the core person fields would still need updating, which is exactly what happened to `seed.ts` and is why it is being repaired here.

## Migration Plan

None — the script only inserts. Running it on a database that already has a demo center stops with an explanatory message (D2).

Removal, when it is designed, is a cascade delete of the demo center plus deletion of the generated plan templates; nothing in this change forecloses that.

## Open Questions

None. Decided before writing: additive rather than destructive, no purge command in this change, and `prisma/seed.ts` repaired as part of it.
