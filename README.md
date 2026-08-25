# dsh-codex-compat-canary

[![CI](https://github.com/ArmyWas/dsh-codex-compat-canary/actions/workflows/ci.yml/badge.svg)](https://github.com/ArmyWas/dsh-codex-compat-canary/actions/workflows/ci.yml)
[![Weekly canary](https://github.com/ArmyWas/dsh-codex-compat-canary/actions/workflows/weekly-canary.yml/badge.svg)](https://github.com/ArmyWas/dsh-codex-compat-canary/actions/workflows/weekly-canary.yml)
[![npm](https://img.shields.io/npm/v/dsh-codex-compat-canary)](https://www.npmjs.com/package/dsh-codex-compat-canary)

Detect Codex App Server protocol drift that DeepSeek Harness cannot safely interpret.

The first real run found one concrete incompatibility between DeepSeek Harness `0.1.1-rc.2` and Codex `0.149.1`: Codex added `misalignmentPolicyViolation`, while the pinned Harness adapter maps that value to `unknown`. The [reproducible experiment](docs/EXPERIMENT_2026-08-25.md) records the baseline, failure, minimal repair, and duplicate-work check.

[简体中文](README.zh-CN.md)

## Why this exists

DeepSeek Harness currently pins `@openai/codex` inside its Codex subagent package. A dependency update can preserve startup, handshake, approval, cancellation, and process cleanup while still losing a newly added protocol value. A normal smoke test can therefore pass even though the user-facing diagnosis became less useful.

This canary reads the official adapter without executing Harness source, generates the pinned and target Codex JSON schemas through the official Codex CLI, and checks the protocol values that the adapter explicitly consumes. It is an external CLI because a compatibility diagnostic should still run when the in-process integration is the failing component.

## Quick start

```sh
npx dsh-codex-compat-canary@latest
```

The default run compares the Codex version pinned by the official DeepSeek Harness `master` branch with the latest published `@openai/codex` version. It exits with code `1` when an implemented breaking check fails.

Inspect a local checkout or a fixed target release:

```sh
npx dsh-codex-compat-canary@latest \
  --dsh-source /path/to/deepseek-harness \
  --codex-version 0.149.1 \
  --json canary-report.json
```

Use `--dsh-ref <branch|tag|commit>` for a reproducible official-source run. Use `--format json` for JSON on standard output and `--fail-on review` when review-level drift should also fail CI.

## What v0.1 checks

- String and object variants in Codex `CodexErrorInfo` against the exact cases handled by the Harness adapter.
- Newly added Codex server-request methods against the adapter's unattended request handler.
- Added, removed, and changed generated schema files for review context.
- The exact Harness source commit, package version, Codex pin, and target Codex version in a machine-readable report.

The canary does not claim complete behavioral compatibility. It does not call a model, read Codex or DeepSeek credentials, edit Harness, install a plugin into a user profile, or automatically publish a report.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | No finding met the selected `--fail-on` threshold. |
| `1` | A compatibility finding met the threshold. |
| `2` | The canary could not complete, such as a network, source, schema, or argument error. |

## Automation

This repository's weekly workflow runs the released logic against the current official Harness `master` and latest Codex package, preserves the JSON report as an artifact, and opens or updates one repository issue when a detected incompatibility persists. It closes that issue after the implemented checks return to compatible.

## Safety and privacy

The report contains version, commit, schema, and protocol-value metadata, not prompts, session content, credentials, or absolute local source paths. Schema generation executes the selected published `@openai/codex` npm package; pin an exact version and review your package-source policy in sensitive environments. See [SECURITY.md](SECURITY.md).

## Project boundary

This is a compatibility canary, not a Codex bridge, alternate UI, auto-updater, general Harness doctor, or production patcher. DeepSeek Harness already provides the Codex subagent and Codex Hooks bridge. New checks are added only after an observed protocol drift demonstrates that a narrower existing check cannot catch it.

## License

MIT
