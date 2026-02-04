---
description: Structured bug fixing workflow with root cause analysis
---

# Bug Fixing Workflow

Trigger this workflow with `/bugfix [issue_description]` to systematically diagnose and fix bugs using Sequential Thinking and code search.

## Steps

1. **Reproduction & Triage**
   - Ask: "How can I reproduce this issue?" or "Do you have a stack trace / error log?"
   - If steps are unclear, guide the user to provide them.
   - Create a reproduction script/test case if possible.

2. **Root Cause Analysis (RCA)**
   - **Tool**: `sequential-thinking`
   - Analyze the symptoms.
   - Hypothesize causes.
   - **Search**: Use `grep_search` or `search_code` to find relevant code sections.
   - Verify hypotheses by reading code or adding logs (if running locally).
   - **Goal**: Identify the exact lines of code causing the issue.

3. **Fix Proposal**
   - **Tool**: `task_boundary` (Mode: PLANNING)
   - Draft a plan to fix the bug.
   - Check for side effects.
   - **Review**: Present the fix to the user.

4. **Implementation**
   - **Tool**: `task_boundary` (Mode: EXECUTION)
   - Apply the fix using `replace_file_content` or `multi_replace_file_content`.

5. **Validation**
   - **Tool**: `task_boundary` (Mode: VERIFICATION)
   - Run the reproduction script/test case again.
   - Run existing tests to ensure no regressions (`npm test`).
   - Create `walkthrough.md` with "Before/After" evidence.

6. **Regression Testing**
   - Add a new permanent test case to the test suite to prevent future regressions.

## Example

User: `/bugfix "Login fails with 500 error when password contains special chars"`

Agent:
1. "Can you provide a sample password that fails?"
2. Agent searches `auth.ts` and `validation.ts`.
3. Agent uses `sequential-thinking`: "Regex in validation only allows alphanumeric... that's the bug."
4. Agent proposes regex update.
5. User admits.
6. Agent updates `validation.ts`.
7. Agent runs `auth.test.ts`.
