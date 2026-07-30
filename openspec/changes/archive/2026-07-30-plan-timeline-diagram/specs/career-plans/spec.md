## ADDED Requirements

### Requirement: Visual career-path diagram with PDF export

The plan detail page SHALL present the plan as a schematic career-path diagram: a large upward arrow from recruitment (base) toward end of service (tip), with events placed proportionally to their month offsets — point events and metric checkpoints as labeled, iconed cards alternating sides of the arrow, and recurring events as cadence markers with a legend. The user SHALL be able to export the diagram as a PDF suitable for presentations.

#### Scenario: Viewing the diagram

- **WHEN** a user opens a plan's detail page
- **THEN** the timeline section renders the upward-arrow diagram with all plan events positioned by their offsets

#### Scenario: Exporting to PDF

- **WHEN** the user clicks the PDF export button
- **THEN** a PDF of the same diagram downloads, rendered locally (no external services)

#### Scenario: Air-gap safety

- **WHEN** the system runs in the air-gapped image
- **THEN** the diagram and its PDF export work with no network access and no packages beyond those already baked
