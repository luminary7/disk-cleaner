## ADDED Requirements

### Requirement: Built-in rule engine
The system SHALL include an offline rule engine that evaluates each scanned item's safety level without requiring an API key.

#### Scenario: Rule-based safety classification
- **WHEN** scanning completes and no AI API key is configured
- **THEN** each scanned item SHALL be classified as 🟢 safe / 🟡 caution / 🔴 keep based on built-in rules
- **THEN** the system SHALL display the rule-based safety rating for each item

#### Scenario: Rule engine categories
- **WHEN** evaluating items against the rule engine
- **THEN** temp files older than 24h SHALL be rated 🟢
- **THEN** browser cache older than 7 days SHALL be rated 🟢
- **THEN** recycle bin contents SHALL be rated 🟢
- **THEN** running application cache SHALL be rated 🟡
- **THEN** files in system-managed directories SHALL be rated 🔴

### Requirement: AI API integration
The system SHALL support connecting to AI APIs compatible with the OpenAI chat completion format.

#### Scenario: Configure preset AI provider
- **WHEN** user selects a preset provider (DeepSeek / MiniMax / 硅基流动)
- **THEN** the API endpoint and default model SHALL be auto-filled
- **THEN** user only needs to enter an API Key

#### Scenario: Configure custom AI provider
- **WHEN** user selects "自定义 OpenAI 兼容"
- **THEN** the system SHALL require manual entry of: Endpoint, API Key, and Model name

#### Scenario: Test API connection
- **WHEN** user clicks "测试连接"
- **THEN** the system SHALL send a test request to the configured API
- **THEN** the system SHALL show "连接成功" or an error message

### Requirement: AI analysis on scan results
When an API key is configured, the system SHALL combine AI analysis with rule engine results.

#### Scenario: AI enhanced scan results
- **WHEN** scanning completes and an API key is configured
- **THEN** the system SHALL send scan summary (file names, sizes, paths) to the AI API
- **THEN** the system SHALL display AI suggestions alongside rule engine ratings

#### Scenario: AI suggestion display
- **WHEN** viewing itemized cleanup with AI enabled
- **THEN** selected items SHALL show an "AI 建议" badge with a tooltip containing AI's natural language analysis

### Requirement: AI chat assistant
The system SHALL provide a chat interface for users to ask questions about their C drive and cleanup.

#### Scenario: Ask AI a question
- **WHEN** user types a question in the AI 助手 chat panel (e.g., "微信的缓存可以清吗")
- **THEN** the system SHALL send the question plus relevant scan context to the AI API
- **THEN** the system SHALL display the AI's response in a chat bubble

#### Scenario: Privacy disclosure
- **WHEN** user first opens the AI chat panel
- **THEN** the system SHALL display a privacy notice: "仅发送文件名和路径，不发送文件内容"
