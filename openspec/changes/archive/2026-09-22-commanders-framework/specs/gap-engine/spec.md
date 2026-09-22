## MODIFIED Requirements

### Requirement: Rollup gap dashboard

The system SHALL provide a rollup dashboard that reports gap counts at any level of the org tree (team, commanders framework, section, domain, center), with the ability to drill from an aggregate into the underlying people. The dashboard SHALL present compliance visually: a compliance gauge, a per-framework comparison, and a needs-attention list of the people in gap state. The org tree SHALL be **collapsible**: each framework can be collapsed or expanded individually, and a single control SHALL collapse or expand all people-holding nodes at once — teams and commanders frameworks alike, those being where individual people are listed. Where a framework has a commander appointed, the tree SHALL label the framework with the commander's name.

A commanders framework SHALL appear in the tree as an ordinary people-holding node: its people are listed beneath it, its gaps roll up into its parent, and it is presented first among its siblings. It carries no commander label of its own, having no commander.

When the viewer's visibility includes a root center, the tree SHALL carry a synthetic «לא משויכים» node under that center holding every person assigned to no framework, gap-computed like anyone else and rolled up into the center's counts; the node is presentation only — it exists in no other screen and cannot be edited, commanded or targeted. The «אנשים תחת ניהולי» figure SHALL include these people and note their count in parentheses when it is above zero.

#### Scenario: Dashboard at domain level

- **WHEN** a manager views the dashboard for a domain
- **THEN** the system SHALL show the domain's aggregate gap counts and allow drilling down into sections, teams, and individual people in gap state

#### Scenario: Compliance shown as a gauge

- **WHEN** a manager opens the dashboard
- **THEN** the compliance percentage is rendered as a visual gauge whose color reflects that high compliance is positive

#### Scenario: Comparing frameworks at a glance

- **WHEN** the manager's scope contains more than one framework
- **THEN** the dashboard shows a per-framework compliance comparison (e.g. bars), clipped to the manager's visibility

#### Scenario: Needs-attention list

- **WHEN** people in the manager's scope are in gap state
- **THEN** the dashboard lists them with their gap summary, each linking directly to the person's card

#### Scenario: Collapsing a framework

- **WHEN** a manager collapses a framework in the tree
- **THEN** its descendants are hidden while its rolled-up counts remain visible

#### Scenario: Collapsing all teams at once

- **WHEN** a manager uses the collapse-all control
- **THEN** every team and every commanders framework collapses so its people are hidden, leaving the framework structure visible; the same control expands them again

#### Scenario: A commanders framework rolls up like any other

- **WHEN** a section holds a commanders framework whose people carry gaps
- **THEN** those gaps are counted in the section's rolled-up figures, and the people are listed under the commanders framework when it is expanded

#### Scenario: A commander sees their subordinates' cards but not their own

- **WHEN** a section commander opens the dashboard, their own card sitting in the commanders framework of the domain above
- **THEN** the cards of their team commanders appear beneath their section's commanders framework, and their own card appears nowhere in their tree

#### Scenario: A commanded framework names its commander

- **WHEN** a user views the dashboard's org tree and a visible framework has a commander appointed
- **THEN** the commander's name appears as a label beside the framework's name, and frameworks without a commander show no such label

#### Scenario: Unassigned people appear under the center

- **WHEN** the Admin opens the dashboard while two people belong to no framework
- **THEN** the tree shows «לא משויכים» under the center with the two listed, their gaps rolled into the center's counts, and the «אנשים תחת ניהולי» figure includes them with «(מתוכם 2 ללא שיוך)» noted

#### Scenario: A scoped manager sees no unassigned node

- **WHEN** a manager whose visibility covers only a domain opens the dashboard
- **THEN** no «לא משויכים» node appears and their figures are unchanged — people outside every framework are not under their management
