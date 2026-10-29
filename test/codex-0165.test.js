import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { analyzeCompatibility } from '../src/analyze.js'
import { buildIssueBody, decideAlertTransition, findingsFingerprint } from '../src/alert-state.js'
import { loadDshSource } from '../src/source.js'

const root = dirname(fileURLToPath(import.meta.url))
const fixture = (...parts) => resolve(root, 'fixtures', ...parts)

async function observedReport(targetVersion = '0.165.0', transform = value => value) {
  const source = await loadDshSource({ dshSource: fixture('dsh-f3803c9'), dshRef: null })
  return analyzeCompatibility({
    dsh: transform(source),
    targetVersion,
    baselineSchema: fixture('schemas', 'codex-0.153.4'),
    targetSchema: fixture('schemas', `codex-${targetVersion}`),
    now: new Date('2026-10-29T00:00:00.000Z'),
  })
}

test('observed 0.165.0 discriminators preserve the pinned gap and new modelNotFound forward gap', async () => {
  const report = await observedReport()
  assert.equal(report.summary.status, 'incompatible')
  assert.equal(report.dsh.codexPin, '0.153.4')
  assert.deepEqual(report.protocol.codexErrors.baselineUnhandled.strings, ['rateLimitExceeded'])
  assert.deepEqual(report.findings.find(item => item.id === 'codex-error-string-forward-unhandled').values,
    ['flexUnavailable', 'modelNotFound', 'tooManyDenials'])
  assert.deepEqual(report.findings.find(item => item.id === 'codex-error-open-forward').values, ['object', 'string'])
  assert.equal(report.findings.some(item => item.id.includes('server-request')), false)
})

test('covering modelNotFound alone removes only that forward finding value', async () => {
  const report = await observedReport('0.165.0', source => ({
    ...source,
    wireSource: source.wireSource.replace("case 'other':", "case 'modelNotFound': case 'other':"),
  }))
  assert.deepEqual(report.protocol.codexErrors.baselineUnhandled.strings, ['rateLimitExceeded'])
  assert.deepEqual(report.findings.find(item => item.id === 'codex-error-string-forward-unhandled').values,
    ['flexUnavailable', 'tooManyDenials'])
  assert.deepEqual(report.findings.find(item => item.id === 'codex-error-open-forward').values, ['object', 'string'])
})

test('the newly observed modelNotFound value changes the alert once and identical repeats remain quiet', async () => {
  const previous = await observedReport('0.163.0')
  const current = await observedReport()
  assert.notEqual(findingsFingerprint(previous), findingsFingerprint(current))
  const oldIssue = { state: 'open', body: buildIssueBody(previous, 'https://github.com/ArmyWas/dsh-codex-compat-canary/issues/1') }
  assert.deepEqual(decideAlertTransition({ report: current, existingIssue: oldIssue }),
    { kind: 'changed', shouldFail: true, shouldUpdate: true })
  const currentIssue = { state: 'open', body: buildIssueBody(current, 'https://github.com/ArmyWas/dsh-codex-compat-canary/issues/1') }
  assert.deepEqual(decideAlertTransition({ report: current, existingIssue: currentIssue }),
    { kind: 'known', shouldFail: false, shouldUpdate: false })
})
