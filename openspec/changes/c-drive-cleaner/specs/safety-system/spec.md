## ADDED Requirements

### Requirement: System directory exclusion
The system SHALL hard-code a list of protected system directories that are never scanned or cleaned.

#### Scenario: Protected directories
- **WHEN** the scan engine starts
- **THEN** the following directories SHALL be excluded from all scan and delete operations:
  - `C:\Windows`
  - `C:\Program Files`
  - `C:\Program Files (x86)`
  - `C:\ProgramData`
  - `C:\Boot`
  - `C:\System Volume Information`
  - `C:\$Recycle.Bin`

#### Scenario: Double validation on delete
- **WHEN** attempting to delete any file
- **THEN** the file path SHALL be validated against the exclusion list before deletion
- **THEN** if the path matches the exclusion list, deletion SHALL be blocked

### Requirement: Recycle bin first
The system SHALL move all deleted files to the recycle bin instead of permanent deletion.

#### Scenario: Move to recycle bin
- **WHEN** user performs any cleanup operation
- **THEN** the system SHALL use `shell.moveItemToTrash()` or equivalent API to move files to recycle bin
- **THEN** the system SHALL NOT permanently delete any file

### Requirement: System restore point
The system SHALL optionally create a Windows system restore point before cleaning.

#### Scenario: Create restore point before cleanup
- **WHEN** user initiates cleanup and the restore point setting is enabled
- **THEN** the system SHALL attempt to create a restore point via Windows SystemRestore API
- **THEN** if successful, display "已创建系统还原点"
- **THEN** if failed, continue cleanup silently

#### Scenario: Toggle restore point
- **WHEN** user opens settings
- **THEN** there SHALL be a toggle "清理前创建系统还原点"
- **THEN** the default SHALL be enabled

### Requirement: Operation log
The system SHALL log all cleanup operations to a local file.

#### Scenario: Write operation log
- **WHEN** a cleanup operation completes
- **THEN** the system SHALL write to `logs/clean-{yyyy-MM-dd}.log` with: timestamp, file path, operation type, file size
- **THEN** the log file SHALL be viewable from within the app's settings

### Requirement: Confirmation for high-risk items
The system SHALL require explicit confirmation before cleaning 🔴-rated items.

#### Scenario: Confirm high-risk deletion
- **WHEN** user checks a 🔴-rated item in the cleanup list
- **THEN** the system SHALL display a modal dialog: "该项建议保留，确认要清理吗？"
- **THEN** the system SHALL only proceed if user clicks "确认清理"
- **THEN** if user clicks "取消", the checkbox SHALL remain unchecked
