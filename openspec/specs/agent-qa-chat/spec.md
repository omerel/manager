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
