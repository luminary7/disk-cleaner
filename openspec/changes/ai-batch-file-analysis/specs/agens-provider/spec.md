## ADDED Requirements

### Requirement: System provides agens as a preset AI provider
The system SHALL include agens as a built-in preset provider in the AI configuration. The preset SHALL include:
- Provider name: "agens" (display name: "Agnes AI（免费）")
- Endpoint: `https://apihub.agnes-ai.com/v1/`
- Default model: `agnes-2.0-flash`

#### Scenario: agens appears in provider list
- **WHEN** user opens AI configuration page
- **THEN** "Agnes AI（免费）" SHALL appear as a selectable provider option

#### Scenario: agens presets are pre-filled
- **WHEN** user selects agens provider
- **THEN** endpoint is pre-filled with `https://apihub.agnes-ai.com/v1/`
- **THEN** model is pre-filled with `agnes-2.0-flash`
- **THEN** user only needs to enter API Key

### Requirement: agens provider info links
The AI configuration page SHALL display reference links for the agens provider:
- Official website: https://agnes-ai.com/
- API documentation: https://agnes-ai.com/zh-Hans/docs/agnes-20-flash

#### Scenario: Provider links visible
- **WHEN** user selects agens provider
- **THEN** "官网" link to https://agnes-ai.com/ is displayed
- **THEN** "API 文档" link to https://agnes-ai.com/zh-Hans/docs/agnes-20-flash is displayed
