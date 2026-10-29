# Changelog

## 0.2.1 - 2026-10-29

- Read the observed Codex 0.162.1/0.163.0 `anyOf` error union while retaining historical `oneOf` support.
- Report open error fallbacks as review-level coverage limits and reject unrecognized schema members.
- Preserve a privacy-trimmed incomplete-check artifact on execution errors while retaining CLI exit code 2.
- Track and deduplicate execution failures independently of compatibility findings; resolve execution alerts only after a completed comparison.
- Cover the observed Codex 0.165.0 `modelNotFound` forward drift with exact-version schema projections, a handled-value negative control, and once-only alert regression coverage.
- Publish the previously merged schema-reader and incomplete-check repairs; the earlier npm 0.2.0 release cannot read the newer `anyOf` error representation.
- Refresh the development-only fast-uri lock to 3.1.9 for newly disclosed URI-normalization advisories; the published CLI still has no production npm dependencies.

## 0.2.0 - 2026-09-10

- Distinguish adapter gaps already present in Harness's pinned Codex baseline from forward drift in a newer target release.
- Add a machine-readable `scope` to findings and update the report schema to `1.1`.
- Fingerprint scheduled findings so a new or changed incompatibility alerts once while an identical known finding stays green and quiet.
- Close the tracking issue with one resolution notice when implemented checks recover.

## 0.1.0 - 2026-08-25

- Compare generated Codex error variants with DeepSeek Harness's explicit adapter mappings.
- Flag newly added unhandled server-request methods for review.
- Record schema inventory changes and reproducible source/version metadata.
- Support official GitHub refs, local Harness checkouts, reusable schema directories, text output, JSON output, and configurable CI thresholds.
- Add a weekly compatibility workflow and cross-platform test workflow.
