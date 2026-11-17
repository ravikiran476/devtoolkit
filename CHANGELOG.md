# Changelog

## 0.2.0

### Fixes

- **Regex Tester** runs patterns in a Web Worker and stops them after 1 s. A pattern with catastrophic backtracking (such as `(a+)+$`) used to freeze the tab and lose every tool's input; now it shows a message, keeps your input and the page stays usable.
- **JSON formatting** no longer changes data: integers beyond 2^53 are no longer rounded and duplicate keys are no longer dropped, because formatting and minifying now work on the text. Values that `JSON.parse` would change are listed with their line numbers.
- **JSON diff** aligns array items, so inserting an item at the top is one addition instead of a change at every later index. A changed item between unchanged ones shows field-level changes.
- A crash in one tool shows the error and a reset button instead of blanking the whole app.

### New

- The production build has a Content-Security-Policy with `connect-src 'none'`: the browser blocks every network request from the page, which enforces "nothing leaves this page".
- Cron Helper: next runs in any time zone, handling daylight-saving gaps and repeats.

### Dependencies

- Vitest 5 and an in-range Vite update: `npm audit` reports 0 vulnerabilities (the critical advisories were in the test runner, not the app).
- CI (GitHub Actions) runs the type check, tests and build.

## 0.1.0

First release.
