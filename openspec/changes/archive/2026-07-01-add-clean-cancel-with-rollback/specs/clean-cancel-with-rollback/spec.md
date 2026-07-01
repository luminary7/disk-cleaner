## ADDED Requirements

### Requirement: User can cancel an in-progress clean operation
The system SHALL allow the user to cancel an active clean operation at any time.
Once cancelled, all remaining items that have not yet been processed SHALL NOT be moved to the recycle bin.
The system SHALL collect the list of items that were successfully cleaned before the cancellation.

#### Scenario: Cancel during cleaning
- **WHEN** user clicks "Cancel" button during cleaning
- **THEN** the system stops processing remaining items
- **THEN** the system collects the list of items already moved to recycle bin

#### Scenario: Cancel when no items cleaned yet
- **WHEN** user clicks "Cancel" button immediately after clean started
- **THEN** the system stops the clean process
- **THEN** no items were processed, so rollback list is empty

### Requirement: System restores cancelled items from recycle bin
After a clean cancellation, the system SHALL attempt to restore all items that were already moved to the recycle bin back to their original locations.
The system SHALL use the Windows Shell.Application COM interface via PowerShell to identify and restore files in the recycle bin by their original path.

#### Scenario: Successful rollback
- **WHEN** clean was cancelled after some items were trashed
- **WHEN** the rollback process runs
- **THEN** each trashed file is restored from recycle bin to its original path
- **THEN** user sees a success message with the count of restored items

#### Scenario: Partial rollback failure
- **WHEN** clean was cancelled
- **WHEN** some files cannot be restored from recycle bin (e.g. deleted by user or locked)
- **THEN** the system reports which files succeeded and which failed
- **THEN** the system provides an option for user to manually open the recycle bin

### Requirement: Frontend shows cancel button during cleaning
The renderer SHALL display a "Cancel" button whenever the `cleaning` state is active.
The button SHALL replace the "Clean" button during the cleaning operation.

#### Scenario: Cancel button visible in SimpleMode
- **WHEN** SimpleMode enters `cleaning` phase
- **THEN** a "Cancel" button is visible alongside the progress indicator
- **WHEN** user clicks the "Cancel" button
- **THEN** the system calls `cancelClean()` API
- **THEN** the system transitions to rollback state

#### Scenario: Cancel button visible in CleanItems
- **WHEN** CleanItems has `cleaning` set to true
- **THEN** a "Cancel" button is visible
- **WHEN** user clicks the "Cancel" button
- **THEN** the system calls `cancelClean()` API
- **THEN** the cleaning process stops

### Requirement: Frontend shows rollback progress and result
The system SHALL display rollback progress to the user after cancellation.
The system SHALL show the final result of the rollback operation (how many files were restored vs failed).

#### Scenario: Rollback progress display
- **WHEN** rollback is in progress after cancellation
- **THEN** user sees a progress indicator showing current/total restore count
- **THEN** each file being restored is shown by name

#### Scenario: Rollback result display
- **WHEN** rollback completes
- **THEN** user sees a summary: "Restored X files, Y files failed"
- **THEN** if any files failed, a "Open Recycle Bin" button is shown
