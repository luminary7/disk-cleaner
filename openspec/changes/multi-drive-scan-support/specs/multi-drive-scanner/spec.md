## ADDED Requirements

### Requirement: Scanner accepts drives parameter
The scan engine SHALL accept a drives parameter specifying which drives to scan.

#### Scenario: startScan with multiple drives
- **WHEN** `startScan(['C:\\', 'D:\\'])` is called
- **THEN** the scanner scans cache/temp directories on both C: and D: drives
- **THEN** results from all drives are merged into a single result set

#### Scenario: Default fallback to C:
- **WHEN** `startScan()` is called without drives parameter
- **THEN** the scanner defaults to scanning C: drive only (backward compatible)

### Requirement: Path adaptation for multi-drive
The scanner SHALL adapt scan target paths to the selected drives.

#### Scenario: User temp path per drive
- **WHEN** drive D: is selected
- **THEN** `os.tmpdir()` path is adapted from `C:\Users\<user>\AppData\Local\Temp` to `D:\Users\<user>\AppData\Local\Temp`
- **THEN** similarly, browser cache and app data paths are adapted using the same logic: keep the relative path suffix, only replace the drive letter prefix

#### Scenario: Non-existent paths are skipped
- **WHEN** a derived path does not exist on a selected drive
- **THEN** that path is silently skipped (via `fs.access` check, same as current behavior)

### Requirement: Large file scan supports multiple drives
The large file scanner SHALL accept and scan multiple drives.

#### Scenario: Large file scan on multiple drives
- **WHEN** `startLargeFileScan(['C:\\', 'D:\\', 'E:\\'])` is called
- **THEN** all three drives' root directories are scanned for files >50MB
- **THEN** results from all drives are merged into a single result set (sorted by size descending)

#### Scenario: Large file scan default
- **WHEN** `startLargeFileScan()` is called without drives
- **THEN** defaults to `['C:\\']` (backward compatible)

### Requirement: Rule engine supports multi-drive exclusions
The rule engine SHALL handle paths from any drive, not only C:.

#### Scenario: System directory excluded on any drive
- **WHEN** a file path like `D:\Windows\System32\config.log` is evaluated
- **THEN** it is recognized as a system path and excluded (marked as `keep`)
- **THEN** similarly for `E:\Program Files\anything` etc.

#### Scenario: Exclusion patterns are drive-agnostic
- **WHEN** evaluating exclusion rules
- **THEN** patterns match any drive letter, not just C:

### Requirement: Scan progress reports per-drive
The scan engine SHALL report progress in a way that reflects multi-drive scanning.

#### Scenario: Progress includes drive info
- **WHEN** scanning multiple drives
- **THEN** progress messages include which drive is currently being scanned (e.g., "正在扫描 [C:] Chrome 缓存...")
- **THEN** total progress counts all targets across all selected drives
