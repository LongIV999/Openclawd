---
description: Structured feature development workflow from requirements to implementation
---

# Feature Development Workflow

Trigger this workflow with `/feature [feature_name]` to guide the entire feature lifecycle: requirements, planning, implementation, and testing.

## Steps

1. **Requirements Gathering**
   - If description is minimal, key questions to ask:
     - "What is the primary goal of this feature?"
     - "Who is the target user?"
     - "Are there specific constraints or dependencies?"
     - "What does 'done' look like?"
   - Create a `requirements.md` (temporary or in proper doc folder) if complex.

2. **Implementation Planning**
   - **Tool**: `task_boundary` (Mode: PLANNING)
   - Draft an `implementation_plan.md` artifact.
   - **Sections**:
     - **Goal**: Clear problem/solution statement.
     - **Proposed Changes**: File-by-file breakdown. [NEW], [MODIFY], [DELETE].
     - **Verification**: How to test (Automated vs Manual).
   - **Review**: Ask user to review the plan using `notify_user`.

3. **Approvals**
   - Wait for user `LGTM` or feedback.
   - Iterate on the plan if needed.

4. **Execution**
   - **Tool**: `task_boundary` (Mode: EXECUTION)
   - Execute the plan step-by-step.
   - Use `write_to_file`, `replace_file_content` etc.
   - Update `task.md` (if exists) or the task boundary status frequently.

5. **Testing & Verification**
   - **Tool**: `task_boundary` (Mode: VERIFICATION)
   - Run automated tests: `npm test`, `pnpm test`, etc.
   - Create a valid test case if one doesn't exist.
   - Manual verification steps if UI is involved.
   - Create `walkthrough.md` to demonstrate the feature (screenshots/logs).

6. **Completion**
   - Commit changes (if git workflow is active).
   - Notify user "Feature [Name] is ready for review."

## Example

User: `/feature "Add Dark Mode Toggle"`

Agent:
1. Asks: "Should this persist in local storage? Does it need system preference sync?"
2. Creates `implementation_plan.md` detailing Tailwind config changes and new Toggle component.
3. User approves.
4. Agent writes code for `ThemeContext.tsx` and `DarkModeToggle.tsx`.
5. Agent runs app, verifies class switching on `html` element.
6. Agent creates `walkthrough.md` showing the toggle in action.
