# Experiment: Codex 0.147.0 to 0.149.1 protocol drift

## Question

Does the Codex App Server release newer than DeepSeek Harness's pinned dependency introduce a protocol value that the Harness Codex subagent cannot preserve?

## Fixed inputs

| Input | Value |
|---|---|
| DeepSeek Harness source | `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` |
| Harness package | `@deepseek-ai/dsh-subagent-codex@0.1.1-rc.2` |
| Pinned Codex | `@openai/codex@0.147.0` |
| Target Codex | `@openai/codex@0.149.1` |
| Platform | Windows, Node.js 24.14.1 |

The official Codex CLI generated both App Server JSON schema bundles. No model credential was needed for schema generation or the keyless real-product suite.

## Results

| Check | Result |
|---|---|
| Official keyless real-product suite at pinned `0.147.0` | 7 of 7 passed |
| Same suite after changing only the Codex package and expected version to `0.149.1` | 6 of 7 passed; schema-union evidence rejected the new value |
| Same suite after recognizing the new schema value in test evidence | 7 of 7 passed |
| Focused production-mapping unit case for the new value | Failed: expected `misalignmentPolicyViolation`, received `unknown` |
| Same focused case after adding one production mapping branch | Passed |
| Canary against the untouched official adapter | One breaking finding: `misalignmentPolicyViolation` |
| Canary against the minimal repaired adapter | Compatible for the implemented checks |

The schema bundles contain 285 JSON files at `0.147.0` and 291 at `0.149.1`: 6 files were added, 45 shared files changed, and none were removed. The new string member appears in `definitions.CodexErrorInfo.oneOf` in `v2/ErrorNotification.json`.

## Interpretation

Handshake, unattended approval, cancellation, failure transport, and process cleanup remain compatible in the exercised keyless scenarios. Those passing scenarios do not emit the new policy error, so they cannot prove that every target error remains observable.

The production adapter uses an explicit allow-list for string error categories and falls back to `unknown`. Codex `0.149.1` adds `misalignmentPolicyViolation`, but the official DeepSeek Harness source at the fixed commit does not include that case. The focused test and one-line mapping repair establish both the failure and its cause.

The complete machine-readable output from the public-source run is preserved in [`live-canary-report.json`](live-canary-report.json).

## Duplicate-work check

On 2026-08-25, exact GitHub repository searches for a DeepSeek Harness Codex protocol canary or differential lab returned no matching project. Open DeepSeek Harness pull requests contained no Codex subagent upgrade, `0.149.1`, or `misalignmentPolicyViolation` change. Adjacent projects cover broad source watching, model-quality A/B comparison, Codex bridging, or runtime packaging; none compare generated Codex protocol values with the official Harness adapter.

[`dsh-compat-guard`](https://github.com/Shizuku-keop/dsh-compat-guard) is the closest new adjacent project. It gates Harness and plugin upgrades, fingerprints storage formats, maintains a compatibility matrix, and provides backup and rollback. This Canary does not gate or perform an upgrade: it inspects drift in the external Codex App Server protocol against the official in-tree Codex adapter. The two tools therefore address different failure boundaries.

## Contribution decision

DeepSeek Harness's current `CONTRIBUTING.md` says external pull requests are not accepted. The result is therefore published as an independent compatibility canary and a minimal Discussion report rather than an unsolicited upstream PR. The local source patch remains experiment evidence and is not represented as a mergeable official contribution.

## Limits

This experiment proves one compatibility gap, not complete incompatibility between the two releases. It does not compare model quality and does not use the same model behind two harnesses. The Canary deliberately reports only explicit checks and labels newly added unhandled server requests for review instead of assuming every schema change is reachable.
