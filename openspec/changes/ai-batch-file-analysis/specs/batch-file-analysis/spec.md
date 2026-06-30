## ADDED Requirements

### Requirement: User can trigger batch AI analysis on large files
The system SHALL provide a button in the LargeFiles page to start batch AI analysis on all currently filtered files. The button SHALL be disabled if AI is not configured (mode === 'disabled' or no API key). Clicking the button SHALL send the file list to a dedicated IPC channel for batch processing.

#### Scenario: Start batch analysis
- **WHEN** user clicks "AI 批量分析" button and AI is configured
- **THEN** system sends all filtered files to `ai:analyze-batch` IPC channel
- **THEN** analysis starts with 3 concurrent requests

#### Scenario: Button disabled when AI not configured
- **WHEN** AI mode is 'disabled' or API key is missing
- **THEN** the "AI 批量分析" button SHALL be disabled
- **THEN** tooltip SHALL indicate "请先配置 AI"

### Requirement: Progress feedback during batch analysis
The system SHALL display real-time progress during batch analysis, including current count, total count, and current file name. The main process SHALL send `ai:batch-progress` event after each file completes.

#### Scenario: Progress display
- **WHEN** batch analysis is running
- **THEN** button text changes to "AI 分析中 ({current}/{total})"
- **THEN** progress text shows current file name

### Requirement: User can cancel batch analysis
The system SHALL allow cancelling an ongoing batch analysis. A module-level flag in the main process SHALL control cancellation. Cancelled results for already-completed files SHALL still be displayed.

#### Scenario: Cancel during analysis
- **WHEN** user clicks "取消" during batch analysis
- **THEN** main process stops processing remaining files
- **THEN** already analysed files' results SHALL remain visible

### Requirement: Analysis results display in table
Each file's AI analysis result SHALL be stored in `singleAnalysisMap` and displayed in the "AI 建议" column. Clicking "查看建议" SHALL open the existing analysis detail modal (reuse current implementation).

#### Scenario: View analysis result
- **WHEN** a file has been analysed by AI
- **THEN** "AI 建议" column shows "查看建议" button
- **WHEN** user clicks "查看建议"
- **THEN** existing analysis detail modal opens with AI results

#### Scenario: Skip already analysed files
- **WHEN** batch analysis is triggered
- **THEN** files that already have an entry in `singleAnalysisMap` SHALL be skipped
- **THEN** progress count SHALL only include files being analysed

### Requirement: Batch analysis IPC protocol
The system SHALL define a dedicated IPC channel `ai:analyze-batch` that accepts a file list and returns analysis results. The main process SHALL:
- Process files with 3 concurrent workers
- Send `ai:batch-progress` event after each file
- Check `batchCancelRequested` flag before each file
- Return all results when complete or cancelled

#### Scenario: IPC success path
- **WHEN** `ai:analyze-batch` is invoked with a file list
- **THEN** each file is analysed via `fileDetail.getFileDetail()` then `aiProvider.analyzeSingleFile()`
- **THEN** results are returned as `Array<{ fileId, analysis }>`

#### Scenario: IPC cancel path
- **WHEN** `ai:batch-cancel` is invoked during batch analysis
- **THEN** `batchCancelRequested` flag is set to true
- **THEN** workers exit after completing current file
- **THEN** `ai:analyze-batch` returns partial results with `{ cancelled: true }`
