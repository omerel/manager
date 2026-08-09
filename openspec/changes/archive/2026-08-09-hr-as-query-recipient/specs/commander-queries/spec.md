## REMOVED Requirements

### Requirement: An HR user only asks

**Reason**: Replaced — an HR user now receives queries as well as sending them. The claim "no framework addresses a person" is withdrawn: a commander addresses the HR person who tends their framework.
**Migration**: The one-panel page becomes the standard two-panel page for HR users too; the recipient chooser gains an HR section. No stored data changes meaning.

## MODIFIED Requirements

### Requirement: Who may send and who receives

<!-- One sentence changed: "SHALL NOT send queries" became "SHALL NOT address
     frameworks", pointing at the HR channel. Recorded here because the blanket
     refusal is contradicted by the requirement added below; everything else in
     the requirement is untouched. -->

A team commander — the lowest level — SHALL NOT address frameworks; their only sending channel is the HR user who tends their framework, defined in its own requirement. Any commander MAY receive a query: receiving follows from being addressed, not from rank, so the for-me section exists for every commander, including a center commander.

#### Scenario: A team commander still cannot address frameworks

- **WHEN** a team commander submits a query naming a framework recipient
- **THEN** the send is refused — the unlock is the HR channel, not the framework chain

## ADDED Requirements

### Requirement: A commander may address the HR user who tends their framework

Any commander — team level included — SHALL be able to address a query to an HR user who holds an **edit** grant covering the commander's framework, directly or by inheritance from an ancestor grant. View-level coverage SHALL NOT qualify, and a MANAGER with edit coverage SHALL NOT be addressable: the channel is to the HR role, whose work is the people.

For a team commander this SHALL be the only way to send — teams still do not address frameworks — so their create form offers the HR chooser alone, and explains itself when no HR user qualifies.

Eligibility SHALL be enforced by the action at send time, not only reflected by the form.

#### Scenario: A team commander asks their HR

- **WHEN** a team commander sends a query to an HR user holding an edit grant over their team
- **THEN** the query is created with that person as its target, and the HR user is notified by mail at their own address

#### Scenario: Coverage may be inherited

- **WHEN** an HR user's edit grant sits on the section above the commander's team
- **THEN** they qualify as a recipient for that team's commander

#### Scenario: View coverage does not qualify

- **WHEN** an HR user holds only a view grant over the commander's framework
- **THEN** they are not offered and an attempt to address them is refused

#### Scenario: A team commander with no eligible HR

- **WHEN** no HR user holds an edit grant covering the team
- **THEN** the create form says so plainly instead of offering an empty chooser

#### Scenario: A higher commander may combine recipients

- **WHEN** a domain commander addresses two sections and their covering HR user in one query
- **THEN** three target rows are created — two frameworks, one person — and the tally counts all three

### Requirement: A person-target belongs to the person

A target row addressed to an HR user SHALL record the user as its endpoint. Only that user MAY answer it, and they SHALL answer as themselves. Sibling separation holds as it does for frameworks: the HR user sees their own row, never the other recipients' answers.

The row SHALL live and die with the person: deleting the user removes their target rows as deleting a framework removes its own, while the query itself survives with its remaining targets. Losing the qualifying grant after the send SHALL NOT revoke the row — eligibility is a condition of appointment, not a standing condition — and the sender SHALL see that the coverage lapsed rather than having it silently repaired.

#### Scenario: The HR user answers as themselves

- **WHEN** the addressed HR user answers
- **THEN** the answer is recorded under their name and the sender sees it in place, like any other answer

#### Scenario: Nobody else may answer a person-target

- **WHEN** any other user — commander or HR — attempts to answer that row
- **THEN** they are refused; the row is not theirs

#### Scenario: The grant lapses mid-query

- **WHEN** the qualifying edit grant is removed while the query is open
- **THEN** the HR user may still answer, and the sender's row shows that the coverage has lapsed

#### Scenario: The person is deleted

- **WHEN** the addressed HR user is deleted
- **THEN** their target row disappears with them, and the query survives with its remaining targets

### Requirement: An HR user is asked and answers on the same page

An HR user's query page SHALL show both panels: the queries they sent laterally, and the queries addressed to them. The queries badge SHALL count what awaits their answer alongside the unread answers to their own, and mail for a person-target SHALL go to the person's own address with no framework-commander resolution.

#### Scenario: The for-me panel appears

- **WHEN** a commander addresses an HR user for the first time
- **THEN** the HR user's page gains the for-me panel with that query in it, open queries first, closed ones folded

#### Scenario: The badge counts for them

- **WHEN** an HR user has two open queries awaiting their answer
- **THEN** the queries badge shows them, exactly as it does for a commander
