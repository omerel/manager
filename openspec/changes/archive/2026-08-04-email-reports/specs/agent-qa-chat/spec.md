## ADDED Requirements

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
