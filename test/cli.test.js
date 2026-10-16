import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const root = dirname(fileURLToPath(import.meta.url))
const project = resolve(root, '..')
const fixture = (...parts) => resolve(root, 'fixtures', ...parts)

function run(extra = []) {
  return spawnSync(process.execPath, [
    resolve(project, 'bin', 'dsh-codex-canary.js'),
    '--dsh-source', fixture('dsh'),
    '--codex-version', '0.149.1',
    '--baseline-schema', fixture('schemas', 'codex-0.147.0'),
    '--target-schema', fixture('schemas', 'codex-0.149.1'),
    ...extra,
  ], { encoding: 'utf8', windowsHide: true })
}

test('returns one for a breaking compatibility finding', () => {
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /INCOMPATIBLE/)
  assert.match(result.stdout, /misalignmentPolicyViolation/)
})

test('emits machine-readable JSON without changing the requested policy', () => {
  const result = run(['--format', 'json', '--fail-on', 'never'])
  assert.equal(result.status, 0)
  const report = JSON.parse(result.stdout)
  assert.equal(report.schemaVersion, '1.1')
  assert.equal(report.summary.status, 'incompatible')
})

test('prints package version', () => {
  const result = spawnSync(process.execPath, [resolve(project, 'bin', 'dsh-codex-canary.js'), '--version'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), '0.2.0')
})

test('schema failure returns exit 2 and writes an incomplete JSON artifact', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'canary-cli-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = resolve(directory, 'report.json')
  const result = run(['--target-schema', fixture('missing-private-schema-directory'), '--json', output, '--format', 'json', '--fail-on', 'never'])
  assert.equal(result.status, 2)
  const report = JSON.parse(await readFile(output, 'utf8'))
  assert.deepEqual(JSON.parse(result.stdout), report)
  assert.equal(report.summary.status, 'incomplete')
  assert.equal(report.reportType, 'execution-error')
  assert.equal(report.error.stage, 'analysis')
  assert.equal(report.findings, undefined)
  assert.doesNotMatch(JSON.stringify(report), /missing-private-schema-directory/)
  assert.doesNotMatch(result.stderr, /missing-private-schema-directory/)
})
