# Codex subagent: Codex 0.149.1 adds an error category that is reported as `unknown`

## Summary

DeepSeek Harness `@deepseek-ai/dsh-subagent-codex@0.1.1-rc.2` pins `@openai/codex@0.147.0`. Testing the same integration contract against Codex `0.149.1` found one new `CodexErrorInfo` string member, `misalignmentPolicyViolation`. The current adapter's explicit string allow-list does not include it, so `failureInfo()` returns `unknown` for that terminal failure.

中文摘要：当前 Codex 子代理固定使用 `0.147.0`。Codex `0.149.1` 新增错误分类 `misalignmentPolicyViolation`，而 Harness 的显式映射尚未包含它，因此该失败会被降级显示为 `unknown`。下面的复现不需要模型凭证，并已验证最小映射修复能恢复原始分类。

## Reproduction

Fixed inputs:

- DeepSeek Harness commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- Harness package: `@deepseek-ai/dsh-subagent-codex@0.1.1-rc.2`
- Baseline Codex: `0.147.0`
- Target Codex: `0.149.1`
- Platform used for the initial reproduction: Windows, Node.js 24.14.1

Observed evidence:

1. The official keyless real-product suite passes 7/7 at the pinned `0.147.0` baseline.
2. With the dependency and expected product version changed to `0.149.1`, the schema-evidence assertion detects the new enum member.
3. After updating only that schema evidence, the real-product suite passes 7/7 because its scenarios do not emit the new policy failure.
4. Adding `misalignmentPolicyViolation` to the existing complete-string-union unit case fails against production code: expected the category name, received `unknown`.
5. Adding the corresponding `case` to `failureInfo()` makes the focused regression pass.

Codex schema inventory changed from 285 to 291 JSON files: 6 added, 45 shared files changed, none removed. No server-request method was added between these versions.

## Minimal compatibility decision

Preserve `misalignmentPolicyViolation` alongside the other string categories in `failureInfo()` and include it in the complete-union test when the pinned Codex dependency is upgraded. The existing safe diagnostic already emits only the category name, so this does not require copying upstream message text or new fields.

## Reusable canary

I published a small external checker with the complete report and fixtures:

- Repository: https://github.com/ArmyWas/dsh-codex-compat-canary
- Experiment: https://github.com/ArmyWas/dsh-codex-compat-canary/blob/main/docs/EXPERIMENT_2026-08-25.md
- Machine-readable report: https://github.com/ArmyWas/dsh-codex-compat-canary/blob/main/docs/live-canary-report.json

It compares generated Codex error variants and newly added server-request methods with the exact cases handled by the Harness adapter. It does not execute Harness source, call a model, read credentials, modify a profile, or treat every schema diff as breaking.

I also checked the new [`dsh-compat-guard` discussion](https://github.com/deepseek-ai/deepseek-harness/discussions/4487). That project gates Harness/plugin upgrades and protects user data with compatibility metadata, snapshots, migration, and rollback. This report is narrower and complementary: it checks external Codex App Server protocol values against the official in-tree Codex adapter, without performing or gating a Harness upgrade.

Since the contribution guide currently says external pull requests are not accepted, I am reporting the tested change here rather than opening a PR. I would appreciate confirmation of whether this category should be preserved in the next Codex dependency update and whether this style of compatibility report is useful to maintainers.
