# Codex error-schema regression and verification

The [2026-10-14 weekly run](https://github.com/ArmyWas/dsh-codex-compat-canary/actions/runs/38538009754) passed 20 local tests, then exited with CLI code 2 because the reader assumed `definitions.CodexErrorInfo.oneOf`.

On 2026-10-16, the official CLI generated fresh schemas for exact npm versions `@openai/codex@0.153.4`, `0.162.1`, and `0.163.0` using `codex app-server generate-json-schema`. No model, provider, session, or model credential was used. The `v2/ErrorNotification.json` files for 0.162.1 and 0.163.0 were byte-identical, SHA-256 `63518d8faae38b8eb73518d59b113f77603d238dd0cf36260b4232f381f43f8c`.

The new `CodexErrorInfo` uses `anyOf`: one string enum, five tagged object branches, and an open `type: ["string", "object"]` fallback. `ServerRequest` still uses `oneOf` and enumerates ten methods. The checked-in 0.162.1 fixture projects those discriminators and union branches; nested payloads, descriptions, titles, and unrelated definitions are omitted. It is schema metadata, not a captured session.

The reader now extracts the finite categories from either union form, retains explicit open types as a review finding, and rejects unsupported members. This prevents an unknown schema representation from silently becoming an empty successful comparison.

With full generated schemas and official Harness commit `86a402200d95fecef4529d969836f1fe13c6cb0d` (`0.2.1-alpha.4`, Codex pin `0.153.4`), the fixed canary completed against Codex `0.163.0`:

- Pinned string mapping gap: `rateLimitExceeded`.
- Forward string mapping gaps: `flexUnavailable`, `tooManyDenials`.
- Forward review: open string/object error fallback.
- Schema inventory: 16 added files, 2 removed, 55 changed.

Exit code 1 represents these completed comparison findings. The detector repair does not repair the Harness adapter or establish complete behavioral compatibility.

Execution errors now produce a separate `execution-error` artifact with status `incomplete`. The workflow preserves the compatibility issue during an incomplete check, creates or updates one separate execution issue, deduplicates identical failures, and resolves that execution issue after a completed comparison. Recovery of execution and the result of compatibility comparison are tracked independently.

Regression coverage includes the observed schema, historical schemas, unsupported members, non-enumerable fallback coverage, a failing CLI artifact, privacy trimming, alert creation/change/reopen/deduplication, and completed-but-incompatible recovery. GitHub writes are tested with an in-memory client.
