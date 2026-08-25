import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDshSource } from '../src/source.js'

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('reads official source through the GitHub API without executing it', async () => {
  const calls = []
  const manifest = JSON.stringify({ version: '0.1.1-rc.2', dependencies: { '@openai/codex': '0.147.0' } })
  const wire = 'export const marker = true'
  const fetchImpl = async url => {
    calls.push(url)
    if (url.includes('/commits/')) return jsonResponse({ sha: 'abc123' })
    const content = url.includes('package.json') ? manifest : wire
    return jsonResponse({ encoding: 'base64', content: Buffer.from(content).toString('base64') })
  }

  const result = await loadDshSource({ dshSource: null, dshRef: 'master' }, fetchImpl)
  assert.equal(result.source.kind, 'github')
  assert.equal(result.source.commit, 'abc123')
  assert.equal(result.codexPin, '0.147.0')
  assert.equal(result.wireSource, wire)
  assert.equal(calls.length, 3)
  assert.ok(calls.every(url => url.startsWith('https://api.github.com/')))
})

test('retries transient GitHub API failures', async () => {
  let failures = 0
  const manifest = JSON.stringify({ version: '0.1.1-rc.2', dependencies: { '@openai/codex': '0.147.0' } })
  const fetchImpl = async url => {
    if (url.includes('/commits/')) return jsonResponse({ sha: 'abc123' })
    if (url.includes('package.json') && failures++ === 0) return jsonResponse({}, 503)
    const content = url.includes('package.json') ? manifest : 'wire'
    return jsonResponse({ encoding: 'base64', content: Buffer.from(content).toString('base64') })
  }
  const result = await loadDshSource({ dshSource: null, dshRef: 'master' }, fetchImpl)
  assert.equal(result.codexPin, '0.147.0')
  assert.equal(failures, 2)
})
