# Codex 0.165.0 regression fixture provenance

Collected on 2026-10-29 without model requests, provider credentials or a user
Codex home. The exact official npm CLIs generated the full schemas using
`codex app-server generate-json-schema`. Only the consumed error-union and
server-request discriminators are projected into the fixtures; descriptions,
nested payload schemas and unrelated definitions are deliberately omitted.

| CLI version | Full generated file | SHA-256 |
| --- | --- | --- |
| 0.153.4 | v2/ErrorNotification.json | d77732536ef8864799e4fbb5bf6965a9f1970a6195e523f144252a82287c08e7 |
| 0.153.4 | ServerRequest.json | 31f580ad468fbd18766eb7adb12744be4e3790e3357b58bd4413c0108c4f65d0 |
| 0.163.0 | v2/ErrorNotification.json | 63518d8faae38b8eb73518d59b113f77603d238dd0cf36260b4232f381f43f8c |
| 0.163.0 | ServerRequest.json | f339be472737a0003efa25fba2e6e6c9237e621cd065b6d6995c51256e9dc1fb |
| 0.165.0 | v2/ErrorNotification.json | b8e15869d27dcb1403f6a45732d30e5137ae4d0920ac1ac4c1917f6908af0693 |
| 0.165.0 | ServerRequest.json | f339be472737a0003efa25fba2e6e6c9237e621cd065b6d6995c51256e9dc1fb |

These hashes identify the full generated inputs, not the smaller projections.
The adapter fixture projects the exact handled discriminators read from
[official wire.ts at f3803c9](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/subagent/subagent-codex/src/wire.ts)
and the same revision's package version and Codex pin. It is parsed as text,
never compiled or executed as Harness code.

The exact 0.163.0 control was freshly generated on the same date; the
alert-transition regression does not substitute an earlier version's fixture.
The negative control adds a fixture mapping for `modelNotFound`; it proves the
detector stops flagging a handled value while preserving other gaps. It is not
an upstream fix or a live-model reproduction. The complete real-schema run and
its evidence boundary are described in
[the verification report](../../docs/PROTOCOL_REGRESSION_2026-10-29.md).
