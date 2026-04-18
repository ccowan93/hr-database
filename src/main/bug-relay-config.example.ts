/**
 * Bug-report relay configuration.
 *
 * Copy this file to `bug-relay-config.ts` and fill in the two constants. That
 * file is gitignored so the shared secret never enters source control.
 *
 * The constants are read at runtime by `bug-report.ts` when submitting a
 * report. If either is empty, the Dialog falls back to "Save diagnostic bundle"
 * mode (no auto-submit).
 */
export const BUG_RELAY_URL = ''; // e.g. 'https://hr-database-bug-relay.<account>.workers.dev'
export const BUG_RELAY_SECRET = ''; // must match APP_SECRET in the Worker
