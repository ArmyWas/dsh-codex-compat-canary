import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildIssueBody,
  decideAlertTransition,
  findingsFingerprint,
  readFindingsFingerprint,
} from '../src/alert-state.js'

function report(status = 'incompatible', values = ['rateLimitExceeded']) {
  return {
    source: { commit: 'abc123' },
    dsh: { packageVersion: '0.1.5-rc.1', codexPin: '0.153.4' },
    codex: { targetVersion: '0.154.0' },
    summary: { status },
    findings: status === 'compatible' ? [] : [{
      id: 'codex-error-string-pinned-unhandled',
      severity: 'breaking',
      scope: 'baseline',
      values,
    }],
  }
}

test('fingerprint is deterministic and embedded in the issue body', () => {
  const first = report('incompatible', ['z', 'a'])
  const second = report('incompatible', ['a', 'z'])
  const fingerprint = findingsFingerprint(first)

  assert.equal(fingerprint, findingsFingerprint(second))
  const forward = structuredClone(first)
  forward.findings[0].scope = 'forward'
  assert.notEqual(fingerprint, findingsFingerprint(forward))
  const body = buildIssueBody(first, 'https://example.test/run', fingerprint)
  assert.equal(readFindingsFingerprint(body), fingerprint)
  assert.equal(readFindingsFingerprint(null), null)
  assert.match(body, /already present in DeepSeek Harness's pinned Codex dependency/)
})

test('new, changed, and repeated findings have different alert transitions', () => {
  const current = report()
  const fingerprint = findingsFingerprint(current)

  assert.deepEqual(decideAlertTransition({ report: current, existingIssue: null, fingerprint }), {
    kind: 'created', shouldFail: true, shouldUpdate: true,
  })
  assert.deepEqual(decideAlertTransition({
    report: current,
    existingIssue: { state: 'open', body: `<!-- dsh-codex-canary-fingerprint: ${fingerprint} -->` },
    fingerprint,
  }), { kind: 'known', shouldFail: false, shouldUpdate: false })
  assert.deepEqual(decideAlertTransition({
    report: current,
    existingIssue: { state: 'open', body: '' },
    fingerprint,
  }), { kind: 'changed', shouldFail: true, shouldUpdate: true })
  assert.deepEqual(decideAlertTransition({
    report: current,
    existingIssue: { state: 'closed', body: '' },
    fingerprint,
  }), { kind: 'reopened', shouldFail: true, shouldUpdate: true })
})

test('compatibility closes an open alert once and then stays quiet', () => {
  const compatible = report('compatible')
  assert.deepEqual(decideAlertTransition({
    report: compatible,
    existingIssue: { state: 'open', body: '' },
  }), { kind: 'resolved', shouldFail: false, shouldUpdate: true })
  assert.deepEqual(decideAlertTransition({
    report: compatible,
    existingIssue: { state: 'closed', body: '' },
  }), { kind: 'clean', shouldFail: false, shouldUpdate: false })
})
