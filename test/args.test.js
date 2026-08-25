import assert from 'node:assert/strict'
import test from 'node:test'
import { ArgumentError, parseArgs } from '../src/args.js'

test('uses safe defaults', () => {
  assert.deepEqual(parseArgs([]), {
    dshSource: null,
    dshRef: 'master',
    codexVersion: 'latest',
    baselineSchema: null,
    targetSchema: null,
    format: 'text',
    jsonPath: null,
    failOn: 'breaking',
    keepTemp: false,
    help: false,
    version: false,
  })
})

test('requires paired offline schema paths', () => {
  assert.throws(() => parseArgs(['--baseline-schema', 'one']), ArgumentError)
  assert.throws(() => parseArgs(['--baseline-schema', 'one', '--target-schema', 'two']), ArgumentError)
})

test('rejects package tags other than latest', () => {
  assert.throws(() => parseArgs(['--codex-version', 'next']), ArgumentError)
})

test('local source replaces the remote ref', () => {
  const options = parseArgs(['--dsh-source', 'repo', '--codex-version', '0.149.1', '--fail-on', 'review'])
  assert.equal(options.dshSource, 'repo')
  assert.equal(options.dshRef, null)
  assert.equal(options.codexVersion, '0.149.1')
  assert.equal(options.failOn, 'review')
})
