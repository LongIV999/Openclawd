# Debug Report: Google Gemini Auth 403 Forbidden

## Bug Characterization
| Attribute    | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Description  | HTTP 403 Forbidden error when accessing `cloudcode-pa.googleapis.com` |
| Severity     | High (Blocks bot operation)                                           |
| Reproduction | Run `node scripts/run-node...`                                        |

## Root Cause
**Google Account Validation Required**
The Google account used for authentication requires verification (likely a session timeout or security check). The API response explicitly returns `VALIDATION_REQUIRED` and provides a URL to complete the verification.

## Fix
1.  **Stop the running process**: You need to stop the current `node` process if it's in a loop.
2.  **Verify Account**: open the validation URL in a browser where you are logged into the Google account.
3.  **Restart**: After verification, restart the bot.

## Verification
- [ ] User completes verification in browser.
- [ ] Process restarts without 403 error.
