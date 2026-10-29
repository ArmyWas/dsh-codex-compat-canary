# Exact-version protocol and package verification

## Inputs and method

On 2026-10-29, fresh schemas were generated with the exact official npm CLIs
`@openai/codex@0.153.4`, `@openai/codex@0.163.0`, and `@openai/codex@0.165.0`. Generation follows the
[official App Server schema command](https://learn.chatgpt.com/docs/app-server#message-schema),
whose output is specific to the CLI version used.

The processes received an allowlisted environment, an empty temporary Codex
home, and an independent npm cache/config path. No model credential, provider
request, user session or real-model scenario was used. The official Harness
source was fetched as text and not executed.

Fixed Harness input: `0.2.2-alpha.2` at
`f3803c96974ad4a94195fb97e5c637e9c2a3afe3`, which pins Codex `0.153.4`.
The [full comparison report](canary-report-20261029.json) contains only public
version, source, schema and protocol metadata.

## Completed comparison

- Current pinned-baseline mapping gap: `rateLimitExceeded`.
- Forward string mapping gaps against target `0.165.0`: `flexUnavailable`,
  `modelNotFound`, and `tooManyDenials`.
- Forward coverage review: the schema also permits non-enumerable string and
  object error values.
- Full schema inventory: 304 baseline files, 320 target files; 18 added,
  2 removed, and 58 changed. Server-request method discriminators are unchanged.

Only `modelNotFound` is new relative to the previous `0.163.0` weekly finding.
The other mapping gaps and open fallback remain known findings. The
[scheduled artifact](https://github.com/ArmyWas/dsh-codex-compat-canary/actions/runs/40667346556)
independently records the same input pair and result.

A fresh full-schema 0.163.0 control on the same fixed Harness source reproduces
the earlier two forward values; its projected fixture is used directly in the
alert-transition regression. The 0.163.0 and 0.165.0 comparison therefore does
not depend on substituting the older 0.162.1 fixture.

The completed comparison exits **1**, intentionally. This is a protocol-value
coverage finding, not an execution failure, an actual user task failure, or
proof of complete behavioral compatibility. Forward gaps do not claim that
Harness currently runs the target Codex version.

## Published-package negative control

The public `dsh-codex-compat-canary@0.2.0` tarball was downloaded from npm and
tested against the same full generated schemas. Its reader rejects the target
with `Codex schema does not expose definitions.CodexErrorInfo.oneOf` and CLI
exit **2**. The previously merged repository reader completes the comparison
instead. This release closes that source-versus-npm delivery gap; no additional
adapter classifier or arbitrary new compatibility rule was required.

The 0.2.1 candidate also has deterministic projections of the observed schema
branches and adapter discriminators. A negative control adds a fixture mapping
for `modelNotFound` and checks that only this forward value disappears, while
the baseline gap and other forward values remain. Another regression verifies
one changed alert followed by quiet identical repeats. Fixtures are metadata
projections, not captured user sessions or an executable Harness replacement.

## Reproduce after installing 0.2.1

```sh
npx dsh-codex-compat-canary@0.2.1 \
  --dsh-ref f3803c96974ad4a94195fb97e5c637e9c2a3afe3 \
  --codex-version 0.165.0 \
  --json canary-report.json
```

Expect a completed incompatible report and exit 1. Never substitute an empty
result, suppress the finding, or treat a deduplicated green workflow as an
upstream repair. The existing official Discussion remains the appropriate
place for the minimal adapter-mapping decision.
