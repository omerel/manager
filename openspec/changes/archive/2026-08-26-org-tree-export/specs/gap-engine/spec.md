# gap-engine — delta

## ADDED Requirements

### Requirement: Exporting the dashboard tree

The dashboard's org-tree section SHALL offer an export of the currently displayed tree — narrowing included — to PowerPoint and to PDF. Before generating, the user SHALL choose, via a checkbox tree of the displayed forest, which branches to include (every node toggleable; unchecking a node prunes its whole subtree; the synthetic «לא משויכים» node participates and is included by default), and whether to show the commander name and the people count.

The output SHALL be a top-down pyramid of frameworks only, titled «עץ מבנה <שם המסגרת הגבוהה ביותר בייצוא>». Each box SHALL carry the framework's name, its commander beneath (blank where none, keeping box sizes uniform), and its rolled-up people count; pruning hides branches but SHALL NOT alter a shown count. The PowerPoint SHALL be built of editable shapes, not an image. The server SHALL rebuild the tree from the requesting user's own visibility rather than trusting a submitted tree, and SHALL record the export in the activity log.

#### Scenario: Exporting a narrowed tree

- **WHEN** a manager narrows the dashboard to one domain and exports with all branches ticked
- **THEN** the file shows a pyramid rooted at that domain, titled «עץ מבנה <שם התחום>», each box with name, commander (or blank) and rolled-up count

#### Scenario: Pruning a branch does not change the numbers

- **WHEN** the user unchecks one section before exporting
- **THEN** that section and everything under it are absent from the drawing, while its parent's shown count still includes its people

#### Scenario: The display toggles

- **WHEN** the user turns off the commander name and the people count
- **THEN** the boxes carry framework names only

#### Scenario: The PowerPoint is editable

- **WHEN** the exported PPTX is opened in PowerPoint
- **THEN** each framework is a real shape whose text and position can be edited

#### Scenario: A wide organization rearranges rather than shrinking to a strip

- **WHEN** the exported tree is too wide to fit the page while remaining readable (many frameworks at one level)
- **THEN** the lower levels are laid out as indented vertical columns instead of side by side, so the drawing keeps a page-like proportion; a tree that already fits keeps the plain pyramid

#### Scenario: Text never outgrows its box

- **WHEN** any tree is exported, dense or sparse
- **THEN** every label is sized in proportion to the box drawn around it and is clipped with an ellipsis where it is too long — never rendered larger than the shape holding it
