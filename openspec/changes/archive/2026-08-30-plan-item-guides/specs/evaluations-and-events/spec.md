# evaluations-and-events — delta

## ADDED Requirements

### Requirement: The house format for an interview summary

The system SHALL hold one file as the format for interview summaries, uploaded and replaced by the Admin under system settings, and SHALL offer it for download beside the interview form on every person's card. Where no file is configured, nothing is offered and the form reads as it does today. Replacing the file SHALL NOT retain the one it replaced, and the Admin SHALL be able to remove it entirely.

Unlike a plan item's guideline, this one belongs to no plan: it is the house's format, one for everybody.

#### Scenario: The Admin publishes the format

- **WHEN** the Admin uploads an interview-summary format under system settings
- **THEN** every person's card offers it for download beside the interview form

#### Scenario: No format configured

- **WHEN** no interview format has been uploaded
- **THEN** the interview form is presented without a download, exactly as before

#### Scenario: Replacing and removing

- **WHEN** the Admin replaces the format, and later removes it
- **THEN** the new file is offered in place of the old, the old is not retained, and after removal nothing is offered
