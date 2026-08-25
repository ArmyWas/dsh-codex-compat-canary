# Product brief: dsh-codex-compat-canary

## One-line promise

Turn “the Codex dependency updated” into a reproducible answer about protocol values DeepSeek Harness will preserve, reject, or silently degrade.

## User and job

Primary users are DeepSeek Harness maintainers, Codex integration authors, plugin authors, and reviewers deciding whether a dependency update is safe. Their job is to distinguish ordinary schema movement from a change that reaches the adapter's explicit protocol assumptions.

The painful case is partial compatibility: the process starts and common end-to-end tests pass, but a new terminal error or server request follows an unrecognized branch only in production.

## Product decision

The first release is an external CLI and scheduled GitHub canary, not an in-process Harness plugin. A protocol diagnostic must run independently of the integration it examines and must not mutate a user's profile or dependency lock.

The unit of analysis is a generated Codex App Server schema pair plus the exact DeepSeek Harness Codex adapter source. The canary reports only checks it actually implements; schema-file counts remain review context rather than proof of incompatibility.

## Core loop

1. Resolve the exact Harness source revision and pinned Codex version.
2. Resolve an exact target Codex version.
3. Generate both official Codex schema bundles.
4. Compare consumed error variants and newly introduced server requests with the adapter's handled cases.
5. Emit a redacted, machine-readable report and a concise terminal summary.
6. Fail CI only at the configured severity threshold.

## Non-goals for 0.1

- Calling either model or comparing model quality, cost, or intelligence.
- Copying Codex features into DeepSeek Harness.
- Replacing the existing Codex subagent or Hooks bridge.
- Editing Harness source, dependency locks, profiles, or credentials.
- Treating every schema diff as breaking.
- Claiming complete protocol or behavioral compatibility.

## Success measures

- Reproduce the verified `misalignmentPolicyViolation` degradation on Windows, Linux, and macOS.
- Produce no absolute local paths, credentials, prompts, or session content in reports.
- Keep an exact-version offline mode for reviewing historical evidence.
- Convert at least one canary finding into an acknowledged upstream Discussion or release fix.
- Add a new compatibility rule only after a real protocol change demonstrates its value.

## Roadmap, gated by evidence

1. **0.1:** Error-union coverage, newly added server-request review, schema inventory, JSON report, weekly workflow.
2. **0.2:** Add notification or request-shape checks only if a real drift bypasses v0.1.
3. **0.3:** Optional keyless real-product scenario runner only if static checks and official smoke tests leave a demonstrated gap.
4. **Upstream:** Offer the report and minimal reproduction through GitHub Discussions while external pull requests remain closed.
