# agent-qa-chat

## Purpose

דף שאלות: צ'אט read-only חסר-מצב על נתוני הקריירה שבראות המשתמש, עם ראיות חובה וגשר 'שמור כחוק'.

## Requirements

### Requirement: Interactive read-only Q&A over career data

The system SHALL provide a chat page (דף שאלות) where a user asks questions in natural language about people and careers, answered by the same read-only reasoning core as the rules engine. Answers are live and ephemeral, scoped to the user's visibility, and the agent MUST NOT modify any career data.

#### Scenario: Asking about gaps

- **WHEN** a user asks "who is behind this year?"
- **THEN** the agent SHALL answer from current career data within the user's scope, without persisting or mutating any record

#### Scenario: Asking an aggregate question

- **WHEN** a user asks "how many finished their grant?"
- **THEN** the agent SHALL compute and return the answer over the current data in scope

### Requirement: Answers over both structured data and unstructured content

The chat SHALL answer questions over **structured data** (dates, metrics, gap states, org placement) and over **unstructured content** (the prose of evaluations and the contents of attached files).

#### Scenario: Structured question

- **WHEN** a user asks "which team has the most gaps?"
- **THEN** the agent SHALL answer from structured gap data

#### Scenario: Content question

- **WHEN** a user asks "who was described as outstanding in their evaluation?"
- **THEN** the agent SHALL reason over evaluation prose and attached files to answer

### Requirement: Every answer must carry its evidence

Every chat answer SHALL include the underlying records it was derived from (the specific people/items), so the user can verify it. An answer SHALL also convey its scope and its as-of date where relevant.

#### Scenario: Evidence accompanies an aggregate

- **WHEN** the agent answers "5 people are behind"
- **THEN** it SHALL also list those 5 people and the reason each is behind

#### Scenario: Scope and time are conveyed

- **WHEN** the agent answers a question that depends on the user's scope or on today's date
- **THEN** the answer SHALL make the scope ("within your domain") and as-of date explicit

### Requirement: Chat is stateless in this version

For this version the chat SHALL treat each question as standalone, without conversational memory or follow-up context between questions.

#### Scenario: No cross-question memory

- **WHEN** a user asks a question and then asks another that refers back to the first ("and how many of those are in team Beta?")
- **THEN** the system is not required to resolve the reference from prior context; each question is answered on its own

### Requirement: Promote a useful question into a rule

The system SHALL allow a user to save a useful chat question as a rule on their rules page (making it schedulable and pinnable), bridging the ephemeral chat surface and the saved rules surface. The approved chat answer MAY serve as the candidate golden example for pinning.

#### Scenario: Saving a question as a rule

- **WHEN** a user finds a chat answer useful and chooses "save as rule"
- **THEN** the system SHALL create a corresponding rule on that user's rules page

### Requirement: An answer can be emailed to the asker

The questions page SHALL offer, alongside its download controls, a way to email an answer to the signed-in user's own address. What is sent SHALL be the same markdown and title the download produces, so an emailed answer and a downloaded one cannot differ.

The result of the attempt SHALL be shown in response to the action: sent, or failed with a reason.

#### Scenario: Emailing an answer

- **WHEN** a user chooses to email an answer
- **THEN** the same markdown the download button produces is sent to their own address, and the page confirms it was sent

#### Scenario: The send fails

- **WHEN** the send does not succeed
- **THEN** the page says so beside the control, rather than appearing to have sent it

#### Scenario: Emailed and downloaded agree

- **WHEN** the same answer is both downloaded and emailed
- **THEN** the two carry identical content

### Requirement: The agent can answer about the user's own queries

The questions page and the rules engine SHALL be able to answer about commander queries the signed-in user is a party to — those their framework sent and those it was asked — including titles, bodies, answers, deadlines and who has not responded.

This scope is a second axis, separate from career visibility: it follows the query relationship, not the org tree. The agent SHALL NOT be given a query the user is not a party to, even where the framework involved lies within their career visibility.

#### Scenario: Summarising answers received

- **WHEN** a domain commander asks "סכם לי את התשובות שקיבלתי על השאילתא האחרונה"
- **THEN** the agent answers from the answers to that query, which only they can see

#### Scenario: Asking who is late

- **WHEN** a commander asks which frameworks have not answered
- **THEN** the agent answers from the target rows of their own queries

#### Scenario: Another commander's exchange stays out of reach

- **WHEN** a center commander asks about queries a domain beneath them exchanged with its sections
- **THEN** the agent has no such data and says so, even though those frameworks are within the center commander's career visibility

#### Scenario: Career questions are unaffected

- **WHEN** a user asks a question about people and gaps
- **THEN** it is answered from career data scoped as before, unchanged by the presence of queries

### Requirement: The agent knows everything the person card knows

The data the agent answers from SHALL carry every core field of the person card, including the date of birth and the age derived from it. A field a user can read on a person's card SHALL NOT be absent from what the agent can read.

The age SHALL be computed by the same function the card uses, and carried alongside the date rather than left for the agent to derive, so that the two surfaces cannot disagree about a person's age.

#### Scenario: Asking about birthdays

- **WHEN** a user asks for a list of birthdays
- **THEN** the agent answers from the recorded dates of birth, for the people in their scope who have one

#### Scenario: Asking by age

- **WHEN** a user asks who is over a given age
- **THEN** the agent answers using the same age the person card shows

#### Scenario: A person with no date recorded

- **WHEN** a person has no date of birth
- **THEN** they are reported as having none, rather than being silently omitted from the count

### Requirement: The agent knows which fields exist, not only which are filled

The data the agent answers from SHALL include the definitions of the configurable person-card fields — their labels, their types, and the permitted options where a field offers a choice — separately from the values recorded against people.

Without this the agent cannot distinguish a field that does not exist from a field nobody has filled in, and answers both with "there is no such field". These are different answers and SHALL be given differently.

#### Scenario: A field nobody has filled

- **WHEN** a user asks about a configured field that no person has a value for
- **THEN** the agent reports that the field exists and holds no values, rather than that it does not exist

#### Scenario: A field that does not exist

- **WHEN** a user asks about something that is not a field at all
- **THEN** the agent reports that no such field is defined

#### Scenario: The options of a choice field

- **WHEN** a user asks what values a choice field can take
- **THEN** the agent can answer from the definitions, without inferring them from the values that happen to be in use

### Requirement: One date convention throughout the agent's data

Every date in the data the agent answers from SHALL be written in ISO form, including the values of configurable fields of date type, which are stored as they were typed. The agent's copy SHALL NOT mix day-first and ISO dates.

#### Scenario: A configurable date field

- **WHEN** a person has a value in a configurable field of date type
- **THEN** the agent reads it in the same ISO form as every other date, not in the day-first form it was entered in

#### Scenario: An unreadable stored value

- **WHEN** a stored date value cannot be read as a date
- **THEN** it is carried through as it stands rather than being guessed at

### Requirement: The card and the agent's data are checked against each other

There SHALL be a check that compares the core fields of the person card against the data exported for the agent, and fails when a field exists in one and not the other.

The check SHALL be a comparison of the two, not an assertion about any particular field, so that a core field added to the card in future and not to the agent's data is caught rather than quietly missing.

#### Scenario: A core field is added to the card only

- **WHEN** a core field is added to the person card and not to the agent's data
- **THEN** the check fails, naming the field

#### Scenario: Both are in step

- **WHEN** every core field of the card is represented in the agent's data
- **THEN** the check passes
