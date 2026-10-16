import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
  assert.equal(report.findings[0].id, 'codex-error-string-forward-unhandled')
  assert.equal(report.findings[0].scope, 'forward')
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

test('distinguishes an error already missing from the pinned baseline', async () => {
  const source = await loadDshSource({ dshSource: fixture('dsh'), dshRef: null })
  const report = await analyzeCompatibility({
    dsh: { ...source, codexPin: '0.149.1' },
    targetVersion: '0.149.1',
    baselineSchema: fixture('schemas', 'codex-0.149.1'),
    targetSchema: fixture('schemas', 'codex-0.149.1'),
  })

  assert.equal(report.summary.status, 'incompatible')
  assert.equal(report.findings.length, 1)
  assert.equal(report.findings[0].id, 'codex-error-string-pinned-unhandled')
  assert.equal(report.findings[0].scope, 'baseline')
  assert.deepEqual(report.findings[0].values, ['misalignmentPolicyViolation'])
  assert.deepEqual(report.protocol.codexErrors.added, { strings: [], objects: [] })
})

test('an open union requires review even when the adapter handles every enumerated value', async () => {
  const source = await loadDshSource({ dshSource: fixture('dsh'), dshRef: null })
  const report = await analyzeCompatibility({
    dsh: source,
    targetVersion: '0.162.1',
    baselineSchema: fixture('schemas', 'codex-0.162.1'),
    targetSchema: fixture('schemas', 'codex-0.162.1'),
  })
  // Remove the fixture adapter's intentional gaps to isolate the open union.
  const completeSource = {
    ...source,
    wireSource: source.wireSource.replace("case 'other':", "case 'rateLimitExceeded': case 'flexUnavailable': case 'misalignmentPolicyViolation': case 'tooManyDenials': case 'other':"),
  }
  const covered = await analyzeCompatibility({
    dsh: completeSource,
    targetVersion: '0.162.1',
    baselineSchema: fixture('schemas', 'codex-0.162.1'),
    targetSchema: fixture('schemas', 'codex-0.162.1'),
  })
  assert.equal(report.summary.status, 'incompatible')
  assert.equal(covered.summary.status, 'review')
  assert.equal(covered.findings.length, 1)
  assert.equal(covered.findings[0].id, 'codex-error-open-baseline')
  assert.deepEqual(covered.findings[0].values, ['object', 'string'])
  assert.equal(shouldFail(covered, 'review'), true)
})

test('only newly open types are forward coverage drift', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'canary-open-types-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const baseline = resolve(directory, 'baseline')
  const target = resolve(directory, 'target')
  const source = await loadDshSource({ dshSource: fixture('dsh'), dshRef: null })
  const schema = JSON.parse(await readFile(fixture('schemas', 'codex-0.162.1', 'v2', 'ErrorNotification.json'), 'utf8'))
  const server = await readFile(fixture('schemas', 'codex-0.162.1', 'ServerRequest.json'), 'utf8')
  for (const path of [baseline, target]) {
    await mkdir(resolve(path, 'v2'), { recursive: true })
    await writeFile(resolve(path, 'ServerRequest.json'), server)
  }
  const writeUnion = async (path, types) => {
    const value = structuredClone(schema)
    value.definitions.CodexErrorInfo.anyOf.pop()
    if (types.length > 0) value.definitions.CodexErrorInfo.anyOf.push({ type: types })
    await writeFile(resolve(path, 'v2', 'ErrorNotification.json'), JSON.stringify(value))
  }
  await writeUnion(baseline, ['string'])
  for (const [types, expected] of [[['string'], []], [['string', 'object'], ['object']], [[], []]]) {
    await writeUnion(target, types)
    const report = await analyzeCompatibility({ dsh: source, targetVersion: '0.162.1', baselineSchema: baseline, targetSchema: target })
    assert.deepEqual(report.findings.find(item => item.id === 'codex-error-open-forward')?.values ?? [], expected)
  }
})
