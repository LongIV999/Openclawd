---
description: Deployment workflow with pre-flight checks and Netlify integration
---

# Deployment Workflow

Trigger this workflow with `/deploy [environment]` (default: staging) to safely build and deploy the application.

## Steps

1. **Pre-flight Check**
   - **Git Status**: Check for uncommitted changes (`git status`).
   - **Tests**: Run the full test suite (`npm test` or `pnpm test`).
   - **Build**: specific build verification (`npm run build`).
   - If any check fails, abort and notify user.

2. **Environment Selection**
   - Validate environment: `staging` vs `production`.
   - **Production Safety**: If `production`, require explicit confirmation: "Are you sure you want to deploy to PRODUCTION?"

3. **Deployment Execution**
   - **Netlify**: Use `netlify` tool if available, or run build command.
   - **Command**:
     ```bash
     # Example
     netlify deploy --prod --dir=dist # if production
     netlify deploy --dir=dist # if staging
     ```
   - Stream the output to the user.

4. **Post-Deployment Verification**
   - Run a health check (curl request to the deployed URL).
   - Check logs (`supabase-mcp-server` logs or Netlify logs) for startup errors.

5. **Notification**
   - Output the deployed URL.
   - Suggest checking the live site.

## Example

User: `/deploy staging`

Agent:
1. Runs `pnpm test`. Success.
2. Runs `pnpm build`. Success.
3. Runs `netlify deploy`.
4. Returns: "Deployed to https://staging-site.netlify.app. Health check passed (200 OK)."
