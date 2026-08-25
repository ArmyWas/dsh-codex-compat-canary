# Contributing

Bug reports should include the canary version, exact Harness ref or commit, exact Codex target version, operating system, exit code, and a redacted JSON report. Never attach credentials, prompts, session exports, or private source.

A new compatibility rule needs a real upstream schema change, a minimal fixture that fails without the rule, a clear severity decision, and a negative test that prevents broad false positives. General model comparison, auto-update, bridge, UI, and Harness-doctor features are outside this project's scope.

Run the focused local checks before opening a pull request:

```sh
npm ci
npm run check
npm run pack:check
```
