## Context

Access is a position in the tree, not a permission list. `visibilityFrom` walks each grant's subtree and records the **effective level per node**, EDIT winning over VIEW on overlap:

```
grant EDIT on מדור ראייה
        │
        ├─ צוות פיקסל   → level EDIT
        └─ צוות עדשה    → level EDIT

grant EDIT on צוות פיקסל
        └─ צוות פיקסל   → level EDIT
```

Both users answer `canEdit("צוות פיקסל") === true`, and the result is indistinguishable. The map remembers *what* they may do at a node, never *where the grant that allowed it sits*. So the requested rule — "at section level or above" — is not expressible with today's API, and that, not the guards, is the substance of this change.

The two guards being changed sit in `authz.ts`:

| act | guard today | after |
|---|---|---|
| create | `requireEditForNode(teamId)` — any EDIT over the team | EDIT from section or above |
| delete | `requireAdmin()` | EDIT from section or above |
| update | `requireEditForPerson(id)` → EDIT over their team | unchanged |

## Goals / Non-Goals

**Goals:**

- Express "authority derived from a grant at section level or above" once, and let guards, the team picker and the UI all read that one definition.
- Keep detail-editing exactly where it is, so the change reads as a split of responsibility rather than a tightening.
- Refuse on the server whatever the form does not offer, and offer nothing the server would refuse.

**Non-Goals:**

- Moving these acts onto the command chain (`commandsNodeId`). Considered and rejected — see D1.
- Reworking `AccessLevel`. A third level ("establishment") would put the rank into the grant, where the tree already expresses it.
- Touching who may *see* a person. Visibility is unchanged; this is about acts.

## Decisions

### D1 — Authority comes from the grant's position, not from command

The system keeps command and access deliberately apart: `commander.ts` says in its own header that command *requires* access and *confers* none, and that a change writing `AccessGrant` there has lost the design. Routing establishment acts through `commandsNodeId` would have made the two answer the same question, and would also have left the Admin — who commands nothing — unable to act, contrary to the decision that the Admin keeps everything.

So the rule reads from grants, and the rank comes from the **kind of the node the grant sits on**: `SECTION`, `DOMAIN` or `CENTER` qualifies; `TEAM` does not. This is the tree already expressing seniority, which is what it is for.

### D2 — Visibility reports where each grant sits

`visibilityFrom` gains one derived set alongside `nodeIds` and `levelOf`: the nodes for which the user holds establishment authority — computed in the same walk, by only spreading a grant's subtree into that set when the grant's own node is a section or above and its level is EDIT.

Computing it in the same walk rather than in a second helper matters: `visibilityFrom` exists precisely because there was once a second copy of the subtree walk, and its doc comment says so. Admins get every node, as they do for `levelOf`.

The predicate reads `mayEstablishAt(nodeId)` — deliberately not `canEditAt`, because the distinction it draws is invisible if the two are named alike.

### D3 — One definition, three readers

The guard, the team picker and the UI controls all call the same predicate rather than re-deriving the rule:

```
visibility.mayEstablishAt(teamId)
        │
        ├─ authz:   requireEstablishForNode / …ForPerson   (the server's refusal)
        ├─ people:  enrollableTeams(visibility)            (what the form offers)
        └─ pages:   whether the control is rendered at all
```

The failure this avoids is the one the project has hit three times: a rule stated in two places drifting apart. Here the drift would be a form offering a team the action refuses, or a delete button that errors on click.

### D4 — A person with no team stays Admin-only

`requireEditForPerson` already falls back to `requireAdmin` when `teamId` is null, and the establishment guard keeps that shape. There is no section above a person who belongs to no team, so there is no one to derive authority from; the Admin is the only correct answer, and it is also what the Admin-keeps-everything decision requires.

### D5 — The controls follow the rule, and this is a visible loosening

Today the delete control renders when the viewer is the Admin, and the new-person link renders unconditionally. Both become "render when the viewer may perform the act". A section commander will now see a delete control they never saw; a team commander will lose the new-person link they had. Both are the intent, and both are worth stating because they are the first thing anyone will notice.

## Risks / Trade-offs

- **Team commanders lose enrolment, which they can do today** → intended, and the reason the change is worth making; the migration is a conversation, not code. Nothing they created is affected.
- **Delete widens from one Admin to every section commander and above** → the act already carries a confirmation listing exactly what will be destroyed, and now writes an activity entry naming the actor. Widening an irreversible act is a real risk, held in check by the trail rather than by scarcity.
- **A fourth reader of the rule could appear and re-derive it** → mitigated by the predicate living on `Visibility`, where anyone asking the question already is.

## Migration Plan

None in data. Existing grants keep their meaning; what changes is which acts they authorise. Worth telling section-and-above commanders that deletion is now theirs, and team commanders that enrolment is not.

## Open Questions

None. Settled before writing: authority derives from an EDIT grant at section level or above rather than from command, and the Admin retains every act including on people with no team.
