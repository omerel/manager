## Why

Who may add a person to the registry, and who may remove one, currently follows from neither of the two things the organisation actually recognises. Creating requires EDIT anywhere over the target team — so a team commander can enrol people. Deleting requires being the Admin — so nobody in the chain of command can, however senior. Both are accidents of how the guards were first written, not decisions about responsibility.

Enrolling and removing a person are establishment acts: they change who the unit consists of. They belong at section level and above, where that responsibility sits. Correcting someone's details is different work — it is the daily business of the commander closest to them, and a team commander should keep it.

## What Changes

- **Creating a person requires EDIT at section level or above.** A team commander can no longer enrol; a section, domain or centre commander can. **BREAKING** for team commanders, deliberately.
- **Deleting a person requires the same authority**, replacing today's Admin-only rule. **BREAKING** in the widening direction: the chain of command gains an act it did not have.
- **Editing a person's details stays where it is** — EDIT over their team, which a team commander holds. This is the half of the request that requires no change, and stating it matters: the point is the split, not a blanket tightening.
- **The team picker on the new-person form offers only teams the user may enrol into**, so the form cannot present a choice the server will refuse.
- **The controls follow the same rule as the actions.** The "עובד חדש" link and the delete control appear when the viewer may perform them — not, as today, when the viewer is the Admin.
- **The Admin keeps every act**, including on a person with no team, who has no commander to answer for them.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `access-control`: a third question joins visibility and edit rights — whether a user's authority over a team comes from a grant at section level or above.
- `people-registry`: creating and deleting a person require that authority; editing details does not.

## Impact

- `src/lib/access.ts` — visibility gains the level at which each grant sits, which `canEdit` alone cannot express
- `src/lib/authz.ts` — a guard for the establishment acts, beside `requireEditForNode`
- `src/lib/person-actions.ts` — `createPerson` and `removePerson` change guard; `updatePerson` deliberately does not
- `src/lib/people.ts` — `getEditableTeams` gains a sibling for "teams I may enrol into"
- `src/app/people/page.tsx`, `src/components/PeopleTable.tsx`, `src/app/people/new/page.tsx` — controls follow the rule
- `scripts/verify-delete-authz.ts` — extended to the new rule
- No schema change, no migration
