import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCodexVersion } from '../src/registry.js'

test('returns an exact requested Codex version without network access', async () => {
  let called = false
  const version = await resolveCodexVersion('0.149.1', async () => {
    called = true
    throw new Error('unexpected')
  })
  assert.equal(version, '0.149.1')
  assert.equal(called, false)
})

test('retries transient npm registry failures before resolving latest', async () => {
  let calls = 0
  const version = await resolveCodexVersion('latest', async () => {
    calls += 1
    return calls === 1
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ version: '0.149.1' }), { status: 200 })
  })
  assert.equal(version, '0.149.1')
  assert.equal(calls, 2)
})
