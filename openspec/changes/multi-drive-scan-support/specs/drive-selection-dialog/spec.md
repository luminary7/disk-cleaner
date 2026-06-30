## ADDED Requirements

### Requirement: System detects available drives
The system SHALL detect all available fixed drives on Windows before scanning.

#### Scenario: Detect drives on typical Windows machine
- **WHEN** user triggers a scan operation
- **THEN** system detects all available fixed drives (e.g., C:, D:, E:) by checking drive roots A:\ through Z:\
- **THEN** drives that are inaccessible (e.g., empty drive slots, disconnected network drives) are filtered out

### Requirement: Drive selection dialog
The system SHALL display a modal dialog for drive selection before starting any scan operation.

#### Scenario: Dialog appears before scan
- **WHEN** user clicks "开始扫描" in SimpleMode
- **THEN** a modal dialog appears showing all available drives as checkboxes
- **THEN** the scan only starts after user confirms selection

#### Scenario: Dialog appears before large file scan
- **WHEN** user clicks "开始扫描" in LargeFiles page
- **THEN** a modal dialog appears showing all available drives as checkboxes
- **THEN** the large file scan only starts after user confirms selection

### Requirement: Drive dialog shows drive labels
The dialog SHALL display each drive with its letter and volume label.

#### Scenario: Drives displayed with labels
- **WHEN** drive detection completes
- **THEN** each drive is displayed as "C: (系统)" or "D: (数据)" etc.
- **THEN** if label cannot be read, display just the drive letter

### Requirement: Minimum one drive required
The user MUST select at least one drive to proceed with scanning.

#### Scenario: User tries to confirm with no selection
- **WHEN** user clicks confirm with no drives selected
- **THEN** the button is disabled OR an error message is shown
- **THEN** the scan does not start

### Requirement: C: drive is pre-selected by default
C: drive SHALL be checked by default in the drive selection dialog.

#### Scenario: Dialog opens with C: pre-selected
- **WHEN** the drive selection dialog opens
- **THEN** C: drive checkbox is pre-checked
- **THEN** other drives are unchecked by default

### Requirement: Dialog supports cancel action
The user SHALL be able to cancel the drive selection dialog.

#### Scenario: User cancels dialog
- **WHEN** user clicks cancel or closes the dialog
- **THEN** no scan is started
- **THEN** application returns to idle state
