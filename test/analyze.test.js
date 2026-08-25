import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { analyzeCompatibility, shouldFail } from '../src/analyze.js'
import { loadDshSource } from '../src/source.js'

const root = dirname(fileURLToPath(import.meta.url))
const fixture = (...parts) => resolve(root, 'fixtures', ...parts)

test('finds the real Codex 0.149.1 error-union drift', async () => {
  const dsh = await loadDshSource({ dshSource: fixture('dsh'), dshRef: null })
  const report = await analyzeCompatibility({
    dsh,
    targetVersion: '0.149.1',
    baselineSchema: fixture('schemas', 'codex-0.147.0'),
    targetSchema: fixture('schemas', 'codex-0.149.1'),
    now: new Date('2026-08-25T00:00:00.000Z'),
  })

  assert.equal(report.summary.status, 'incompatible')
  assert.equal(report.summary.findingCounts.breaking, 1)
  assert.equal(report.summary.findingCounts.review, 1)
  assert.deepEqual(report.findings[0].values, ['misalignmentPolicyViolation'])
  assert.deepEqual(report.findings[1].values, ['item/new/request'])
  assert.equal(report.summary.schemaFiles.added, 1)
  assert.equal(shouldFail(report, 'breaking'), true)
  assert.equal(shouldFail(report, 'never'), false)
})

test('reports no baseline error gaps for the fixture adapter', async () => {
  const dsh = await loadDshSource({ dshSource: fixture('dsh'), dshRef: null })
  const report = await analyzeCompatibility({
    dsh,
    targetVersion: '0.147.0',
    baselineSchema: fixture('schemas', 'codex-0.147.0'),
    targetSchema: fixture('schemas', 'codex-0.147.0'),
  })
  assert.equal(report.summary.status, 'compatible')
  assert.deepEqual(report.protocol.codexErrors.baselineUnhandled, { strings: [], objects: [] })
})
