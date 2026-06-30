## ADDED Requirements

### Requirement: Large file scan
The system SHALL scan the C drive for files larger than 50 MB.

#### Scenario: Start large file scan
- **WHEN** user navigates to "大文件分析" tab and clicks "开始扫描"
- **THEN** the system SHALL recursively scan C drive (excluding system blacklisted directories)
- **THEN** the system SHALL show real-time scan progress with current file count found

#### Scenario: Scan exclusion list
- **WHEN** scanning for large files
- **THEN** the following directories SHALL be excluded: `C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`, `C:\ProgramData`

#### Scenario: Cancel scan
- **WHEN** user clicks "取消扫描"
- **THEN** the system SHALL stop scanning and SHALL show results found so far

### Requirement: Large file list display
The system SHALL display scanned large files in a sortable, filterable list.

#### Scenario: View large file list
- **WHEN** scan is complete
- **THEN** the system SHALL display files in a table sorted by size (largest first)
- **THEN** each row SHALL show: file name, full path, size (in GB/MB), last modified date, file type

#### Scenario: Filter by file type
- **WHEN** viewing the large file list
- **THEN** user SHALL be able to filter by file type (video, archive, log, disk image, other)
- **THEN** the list SHALL update to show only matching files

#### Scenario: Open file location
- **WHEN** user clicks "打开所在文件夹" on a file
- **THEN** the system SHALL open Windows Explorer at the file's parent directory

### Requirement: Large file deletion
The system SHALL allow users to select and delete large files with safety precautions.

#### Scenario: Delete selected large files
- **WHEN** user selects files and clicks "删除选中文件"
- **THEN** the system SHALL show a confirmation dialog listing all files to be deleted
- **THEN** if confirmed, the system SHALL move files to recycle bin
- **THEN** the system SHALL display deletion results

#### Scenario: Delete system-located files
- **WHEN** user attempts to delete a file located in a system directory
- **THEN** the system SHALL show a warning and require explicit checkbox confirmation
