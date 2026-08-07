## 1. The rule, stated once

- [x] 1.1 `visibilityFrom` computes an establishment set in the same walk it already does: a grant spreads into it only when its own node is `SECTION`/`DOMAIN`/`CENTER` and its level is EDIT; the Admin gets every node, as with `levelOf`
- [x] 1.2 Expose it as `mayEstablishAt(nodeId)` on `Visibility` — named apart from `canEdit` on purpose, because the distinction is invisible if the two read alike
- [x] 1.3 No second copy of the subtree walk anywhere; the doc comment on `visibilityFrom` says why, and this change is exactly the temptation it warns about

## 2. The guards

- [x] 2.1 `requireEstablishForNode(nodeId)` in `authz.ts`, beside `requireEditForNode` — Admin passes, otherwise `mayEstablishAt` decides
- [x] 2.2 `requireEstablishForPerson(personId)` — resolves their team, and falls back to `requireAdmin` when the person has no team, keeping the shape `requireEditForPerson` already has
- [x] 2.3 `createPerson` switches from `requireEditForNode(teamId)` to the establishment guard; `removePerson` switches from `requireAdmin()` to it
- [x] 2.4 `updatePerson` is deliberately untouched — a team commander keeps correcting details, which is the half of the request that needs no code

## 3. What the interface offers

- [x] 3.1 `enrollableTeams(visibility)` beside `getEditableTeams` — teams filtered by the same predicate the action enforces, so the picker cannot present a choice the server refuses
- [x] 3.2 `/people/new` uses it, and refuses to render for a user with no enrollable team rather than showing an empty picker
- [x] 3.3 The "עובד חדש" link renders on whether the viewer may enrol, not unconditionally
- [x] 3.4 `PeopleTable` takes the right to delete per row from the same predicate instead of the `admin` flag, and the person card's delete control follows

## 4. Verification

- [x] 4.1 Extend `verify-delete-authz.ts`: a team-level EDIT grant is refused create and delete, a section-level one is accepted for both, a view grant at any level is refused both, the Admin is accepted everywhere, and a person with no team is Admin-only
- [x] 4.2 Assert the two readers agree — for a fixture user, every team `enrollableTeams` offers is one `requireEstablishForNode` accepts, and no accepted team is withheld. This is the drift the change exists to prevent, so it is checked mechanically rather than by reading both call sites
- [x] 4.3 Prove the split: the same team-level user who is refused create can still update a person on that team
- [x] 4.4 `npm run build` and the affected verify suites pass
