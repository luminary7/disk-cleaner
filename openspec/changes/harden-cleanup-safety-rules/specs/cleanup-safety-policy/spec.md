## ADDED Requirements

### Requirement: Safety levels are enforceable cleanup policy
The system SHALL define safety levels as cleanup policy, not only display labels.

- `safe` means the item is eligible for default cleanup.
- `caution` means the item requires explicit user review and explicit caution cleanup permission.
- `keep` means the item is blocked from ordinary cleanup.

#### Scenario: Default cleanup includes only safe items
- **WHEN** the user starts the default one-click cleanup flow
- **THEN** only items with safety `safe` SHALL be submitted for cleanup
- **AND** items with safety `caution` or `keep` SHALL NOT be included

#### Scenario: Caution cleanup requires explicit permission
- **WHEN** the user selects one or more `caution` items for cleanup
- **THEN** the UI SHALL require explicit confirmation that caution items are included
- **AND** the cleanup request SHALL carry an explicit caution-cleanup option

#### Scenario: Keep items are blocked from ordinary cleanup
- **WHEN** an item has safety `keep`
- **THEN** ordinary cleanup actions SHALL NOT submit the item for deletion
- **AND** backend cleanup validation SHALL reject the item if it is submitted without an explicit force option

### Requirement: Standard scan targets exclude broad user-data folders
The standard scan engine SHALL scan only known cleanup-oriented directories and SHALL NOT treat broad user-data folders as cache.

#### Scenario: Social app document folders are excluded from standard cleanup
- **WHEN** the standard scan target list is built
- **THEN** broad folders such as `Documents\WeChat Files` and `Documents\Tencent Files` SHALL NOT be included as app cache targets
- **AND** files under those broad folders SHALL NOT be labeled `safe` by standard app-cache age rules

#### Scenario: Known cache-like app subdirectories are allowed
- **WHEN** a supported app has known cache-like subdirectories
- **THEN** the scanner MAY include subdirectories whose purpose is cache, temp, log, thumbnail, crash, or webview cache
- **AND** missing subdirectories SHALL be skipped without failing the scan

#### Scenario: Unknown app data remains protected
- **WHEN** the scanner encounters an app data path whose purpose is not known to be cleanup-oriented
- **THEN** the path SHALL be skipped or its items SHALL be classified no lower than `caution`

### Requirement: Rule engine protects unknown and user-data files
The rule engine SHALL classify unknown file types and user-data paths conservatively.

#### Scenario: Unknown extension is keep
- **WHEN** a scanned file has no extension or an extension outside the known policy list
- **THEN** the rule engine SHALL return `keep`

#### Scenario: User-data path is not safe by age alone
- **WHEN** a file is under a user-data marker path such as Documents, Desktop, Downloads, Pictures, Videos, Music, cloud-sync folders, project folders, game folders, dependency folders, or virtual-environment folders
- **THEN** the rule engine SHALL NOT return `safe` only because the file is old
- **AND** the result SHALL be `caution` or `keep` depending on file type and path risk

#### Scenario: System critical paths remain excluded
- **WHEN** a path matches a protected system exclusion
- **THEN** the scanner SHALL skip it
- **AND** cleanup validation SHALL reject it

### Requirement: Large-file analysis is discovery-first
The large-file scanner SHALL treat large-file results as candidates for user review, not default cleanup.

#### Scenario: Archive and installer files outside cache are caution
- **WHEN** a large file is an archive, installer, or disk image outside an explicit cache or temp path
- **THEN** the rule engine SHALL return `caution`, not `safe`

#### Scenario: High-risk large files are keep
- **WHEN** a large file appears to be a virtual disk, game resource, project dependency, environment, system component, or unknown extension
- **THEN** the rule engine SHALL return `keep`

#### Scenario: Large files are not included in one-click cleanup
- **WHEN** the standard one-click cleanup flow is executed
- **THEN** large-file analyzer results SHALL NOT be included unless the user explicitly selected them in the large-file workflow

### Requirement: Backend cleanup validates every item before deletion
The backend cleanup layer SHALL be the final safety boundary before moving any item to the recycle bin.

#### Scenario: Cleanup revalidates submitted item
- **WHEN** `clean:execute` or `clean:single` receives an item
- **THEN** the backend SHALL validate the normalized path against protected exclusions
- **AND** the backend SHALL re-evaluate the current safety level before deletion

#### Scenario: Backend blocks disallowed safety levels
- **WHEN** backend validation evaluates an item as `keep`
- **THEN** deletion SHALL be rejected unless a force option is explicitly provided
- **WHEN** backend validation evaluates an item as `caution`
- **THEN** deletion SHALL be rejected unless the cleanup request explicitly allows caution items

#### Scenario: Cleanup uses recycle bin only
- **WHEN** an item passes backend validation
- **THEN** the system SHALL move it to the recycle bin
- **AND** the system SHALL NOT permanently delete it

#### Scenario: Blocked items are reported
- **WHEN** backend cleanup rejects an item
- **THEN** the cleanup result SHALL include a failure entry or error message explaining that the item was blocked by safety policy

### Requirement: AI analysis cannot lower rule-engine protection
AI analysis SHALL be advisory and SHALL NOT make protected items eligible for ordinary deletion.

#### Scenario: Effective safety is conservative
- **WHEN** both rule-engine safety and AI safety are available for an item
- **THEN** the effective safety SHALL be the more conservative level using `keep` greater than `caution` greater than `safe`

#### Scenario: AI cannot downgrade keep
- **WHEN** the rule engine classifies an item as `keep`
- **AND** AI returns `safe` or `caution`
- **THEN** the item SHALL remain effectively `keep`
- **AND** ordinary delete selection SHALL stay disabled or blocked

#### Scenario: AI may raise risk
- **WHEN** the rule engine classifies an item as `safe` or `caution`
- **AND** AI returns a more conservative level
- **THEN** the UI SHALL display the more conservative effective safety for delete decisions

### Requirement: Cleanup UI communicates safe and review-required space separately
The renderer SHALL distinguish default safe cleanup from review-required cleanup.

#### Scenario: Simple mode safe primary action
- **WHEN** a scan completes in simple mode
- **THEN** the primary cleanup action SHALL represent only `safe` item size and count
- **AND** `caution` item size and count SHALL be shown as review-required rather than default cleanup

#### Scenario: Keep item controls are not ordinary delete controls
- **WHEN** a `keep` item is displayed
- **THEN** ordinary delete controls for that item SHALL be disabled, hidden, or require a separate explicit force path not used by default cleanup

#### Scenario: Scan rules page matches actual policy
- **WHEN** the user opens the scan rules page
- **THEN** the displayed scan scope, safety meanings, large-file behavior, AI limitation, and backend validation behavior SHALL match the implemented policy

### Requirement: Restore point setting is not misleading
The system SHALL either wire the restore-point setting into cleanup or clearly avoid claiming that it protects ordinary file deletion.

#### Scenario: Restore point is attempted when enabled
- **WHEN** cleanup starts and the restore-point setting is enabled
- **THEN** the system SHALL attempt to create a Windows restore point before risky cleanup categories if implementation supports it
- **AND** restore-point success or failure SHALL be visible to the user when it affects cleanup confidence

#### Scenario: Restore point copy distinguishes system restore from recycle bin
- **WHEN** restore-point behavior is described in settings or cleanup confirmation
- **THEN** the UI SHALL NOT imply that Windows restore points can reliably recover ordinary user files moved to the recycle bin

### Requirement: Rule policy has focused verification
The project SHALL include focused verification for representative cleanup policy samples.

#### Scenario: Rule verification covers high-risk examples
- **WHEN** the rule verification command is run
- **THEN** it SHALL assert expected safety for protected system paths, temp files, recent files, social-app user documents, archive files, game resources, virtual disks, unknown extensions, and user-data paths

#### Scenario: Verification passes before completion
- **WHEN** this change is implemented
- **THEN** the rule verification command and the existing production build SHALL pass before the task is considered complete
