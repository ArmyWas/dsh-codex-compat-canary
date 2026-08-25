import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import test from 'node:test'

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
  assert.equal(report.schemaVersion, '1.0')
  assert.equal(report.summary.status, 'incompatible')
})

test('prints package version', () => {
  const result = spawnSync(process.execPath, [resolve(project, 'bin', 'dsh-codex-canary.js'), '--version'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), '0.1.0')
})
