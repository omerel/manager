## ADDED Requirements

### Requirement: Replacing a person's photo takes effect immediately

When a person's profile photo is uploaded or replaced, the new image SHALL be displayed everywhere that person's photo appears — their card and the people list — without the user reloading, clearing the browser cache, or waiting for a cache window to expire. A previously displayed image SHALL NOT be shown once it has been replaced.

#### Scenario: Replacing an existing photo

- **WHEN** an edit-level Manager uploads a new photo for a person who already has one
- **THEN** the person's card shows the new photo immediately after the upload completes

#### Scenario: The list reflects the change too

- **WHEN** the photo has been replaced
- **THEN** the person's avatar in the people list shows the new photo, not the previous one

#### Scenario: Reloading never shows the old image

- **WHEN** the user reloads any page showing that person after the replacement
- **THEN** the new photo is displayed, with no dependence on a hard refresh or on elapsed time

### Requirement: A replaced photo file is not retained

Uploading a replacement photo SHALL remove the file it replaced from storage, so repeated replacements do not accumulate unreferenced files on the uploads volume. Failure to remove the old file SHALL NOT fail the upload.

#### Scenario: Replacing a photo several times

- **WHEN** a person's photo is replaced repeatedly
- **THEN** only the current photo remains in storage for that person

#### Scenario: Removal fails

- **WHEN** the previous file cannot be deleted
- **THEN** the upload still succeeds and the new photo is the one displayed
