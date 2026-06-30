## ADDED Requirements

### Requirement: One-click scan
The system SHALL provide a single prominent button to start scanning C drive for cleanable items.

#### Scenario: Start scan from simple mode
- **WHEN** user clicks the "开始扫描" button on the home screen
- **THEN** the system starts scanning cached directories and shows a progress animation

#### Scenario: Real-time progress display
- **WHEN** scanning is in progress
- **THEN** the system SHALL display a progress bar with estimated time remaining and current item being scanned

### Requirement: Scan results summary
The system SHALL display total cleanable space after scan completes.

#### Scenario: Scan complete
- **WHEN** scanning finishes
- **THEN** the system SHALL display "可清理 XX GB" with a prominent "一键清理" button

#### Scenario: Zero cleanable space
- **WHEN** scanning finishes and no cleanable items are found
- **THEN** the system SHALL display "没有找到可清理的项目" and a "再扫一次" button

### Requirement: One-click clean
The system SHALL clean all safe items with a single button click.

#### Scenario: Execute one-click clean
- **WHEN** user clicks "一键清理"
- **THEN** the system SHALL move all 🟢-rated items to the recycle bin
- **THEN** the system SHALL show real-time cleaning progress

#### Scenario: Clean complete
- **WHEN** cleaning finishes
- **THEN** the system SHALL display "已释放 XX GB" with a celebration animation and a "再扫一次" button

### Requirement: Entry to advanced mode
The system SHALL provide an obvious entry point to advanced mode from simple mode.

#### Scenario: Navigate to advanced mode
- **WHEN** user clicks "进入高级模式" link at the bottom of simple mode page
- **THEN** the system SHALL switch to the advanced mode interface
