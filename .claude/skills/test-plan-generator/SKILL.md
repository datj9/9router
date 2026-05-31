---
name: test-plan-generator
description: Reads PRD acceptance criteria from a Notion epic, generates structured test cases (positive, negative, edge), and creates them in Testmo via MCP, organized into per-Epic folders. Use when the user says "generate test cases", "test plan for EP-...", "Testmo cases", "QA plan", or links to a finalized PRD and asks for tests.
version: 1.1.0
author: Ringkas Engineering
tools:
  - Notion MCP (notion-search, notion-fetch)
  - Testmo MCP (list_projects, list_folders, create_folders, create_cases, list_cases)
---

# Test Plan Generator

Read a Ringkas Epic from Notion, derive test cases from acceptance criteria, and push them to Testmo.

> **Language rule**: All test case titles, steps, and expected results must be written in English.

## Prerequisites

### Notion MCP
```bash
claude mcp add notion --url https://mcp.notion.com/mcp
claude mcp login notion
```

### Testmo MCP
Install the community Testmo MCP server:
```bash
pip install mcp-testmo
# OR clone: git clone https://github.com/strelec00/testmo-mcp.git
```

Add to Claude Code:
```bash
claude mcp add testmo -- python -m testmo_mcp
```

Required environment variables:
```
TESTMO_URL=https://ringkas.testmo.net
TESTMO_API_KEY=<your-api-key>
```

Generate API key: Testmo → Profile (avatar) → API access → Add key.

See `setup/testmo-mcp-setup.md` for full instructions.

---

## Step 1 — Fetch the Epic from Notion

1. Accept Epic ID (EP-XXX), title, or Notion URL.
2. Use `notion-fetch` to load the full page.
3. Extract:
   - `Epic Name`, `ID` (EP-XXX), `Platform`, `Complexity`
   - All User Stories with their Acceptance Criteria
   - For AI PRDs: also extract Trigger Examples and Error Handling tables

---

## Step 2 — Derive Test Cases

For each User Story, generate test cases from:

### From Acceptance Criteria (1 AC → 1+ test cases)
Each acceptance criterion becomes at least one test case. If the AC covers multiple conditions, split into separate cases.

### From Edge Cases (always generate these)
For every User Story, create test cases for:
- **Happy path**: normal flow as described in Main flow
- **Empty state**: what happens with no data
- **Error state**: API failure, validation error, timeout
- **Boundary values**: min/max inputs, empty strings, special characters
- **Permission**: unauthorized user, expired session

### From AI PRD sections (if applicable)
- **Per Trigger Example**: one test case per trigger → expected AI response
- **Per Error Handling row**: one test case per error condition → expected AI behavior
- **Conversation Flow**: test cases for each branch in the flow

### Test Case Format

Each test case must have:

| Field | Content |
|-------|---------|
| **Title** | `[EP-XXX][US_YY] {action being tested}` |
| **Priority** | Mapped from US Priority: P0→Critical, P1→High, P2→Medium |
| **Steps** | Numbered list: Step text + Expected result per step |
| **Tags** | Epic ID, User Story code, Platform value |

**Step writing rules:**
- Each step = one user action
- Each expected result = one observable outcome
- No compound steps ("Click X and then Y and verify Z" → split into 3 steps)
- Include specific test data where possible

---

## Step 3 — Organize in Testmo

### Folder Structure

Ask the user which Testmo project to use (list projects via Testmo MCP if needed).

Create folder hierarchy:
```
{Epic Name} (EP-XXX)/
├── US_01 — {User Story Title}/
│   ├── TC: [EP-XXX][US_01] Happy path - {description}
│   ├── TC: [EP-XXX][US_01] {AC-derived test case}
│   ├── TC: [EP-XXX][US_01] Error - {error condition}
│   └── TC: [EP-XXX][US_01] Edge - {edge case}
├── US_02 — {User Story Title}/
│   └── ...
└── Regression/
    └── TC: [EP-XXX] Cross-US regression - {description}
```

1. Use Testmo MCP `list_folders` to check if the Epic folder already exists.
2. If not, create it with `create_folders`.
3. Create sub-folders per User Story.
4. Create a `Regression` sub-folder for cross-cutting test cases.

### Create Test Cases

Use Testmo MCP `create_cases` (batch up to 100 per call):

For each test case:
```json
{
  "name": "[EP-XXX][US_01] Happy path - user submits valid form",
  "folder_id": "<US_01 folder id>",
  "custom_priority": "high",
  "custom_steps": [
    {"text": "Navigate to /loan-application", "expected": "Form page loads with all fields visible"},
    {"text": "Fill in all required fields with valid data", "expected": "No validation errors shown"},
    {"text": "Click Submit", "expected": "Success message displayed, application status changes to 'Submitted'"}
  ],
  "tags": ["EP-XXX", "US_01", "AI Agent"]
}
```

---

## Step 4 — Generate Summary

After creating all test cases, output:

```
## Test Plan: EP-XXX — {title}

**Testmo Project**: {project name}
**Folder**: {Epic folder name}

| User Story | Happy Path | AC-derived | Error/Edge | Total |
|-----------|-----------|-----------|-----------|-------|
| US_01     | 1         | N         | N         | N     |
| US_02     | 1         | N         | N         | N     |
| Regression| -         | -         | -         | N     |
| **Total** |           |           |           | **N** |

**Test cases created**: N
**Testmo folder link**: {link}
```

---

## Step 5 — Post Summary to Notion

Use `notion-create-comment` on the Epic page to post:
```
Test plan generated in Testmo:
- {N} test cases across {M} user stories
- Project: {name}, Folder: {Epic folder}
- Covers: happy path, acceptance criteria, error/edge cases
```

This keeps traceability between the PRD and its test plan.
