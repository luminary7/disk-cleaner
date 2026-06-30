## ADDED Requirements

### Requirement: Category-based space overview
The system SHALL display C drive space usage grouped by category with a chart.

#### Scenario: View space distribution
- **WHEN** user navigates to the space overview tab in advanced mode
- **THEN** the system SHALL display a pie chart showing space distribution by category (system temp, browser cache, app cache, large files, other)
- **THEN** the system SHALL display a top 10 list of largest categories

### Requirement: Itemized cleanup list
The system SHALL present a list of all cleanable items grouped by category with individual safety ratings.

#### Scenario: View cleanup items
- **WHEN** scanning is complete in advanced mode
- **THEN** the system SHALL show a categorized list of cleanable items
- **THEN** each item SHALL display: icon, name, size, safety rating (🟢/🟡/🔴), and a checkbox

#### Scenario: Safety rating display
- **WHEN** displaying a cleanable item
- **THEN** 🟢 items SHALL be pre-checked
- **THEN** 🟡 items SHALL be unchecked with a "需注意" label
- **THEN** 🔴 items SHALL be unchecked with a "建议保留" label and require confirmation dialog when manually checked

#### Scenario: Batch select by safety level
- **WHEN** user clicks "全选安全项目"
- **THEN** all 🟢-rated items SHALL be checked

#### Scenario: Execute selected cleanup
- **WHEN** user clicks "清理选中项目"
- **THEN** only checked items SHALL be moved to recycle bin
- **THEN** results SHALL show how many items were cleaned and how much space was freed

### Requirement: Scan progress for each category
The system SHALL show individual scan progress for each category being scanned.

#### Scenario: Category-level progress
- **WHEN** scanning each category (e.g., browser cache, temp files)
- **THEN** the system SHALL show which category is currently being scanned and its file count
