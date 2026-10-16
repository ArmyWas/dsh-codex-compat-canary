import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import test from 'node:test'
import { codexErrorVariants, serverRequestMethods, CodexSchemaError } from '../src/schema.js'

const fixture = version => resolve('test/fixtures/schemas', `codex-${version}`)

test('reads the observed Codex 0.162.1 anyOf union and records its open fallback', async () => {
  const values = await codexErrorVariants(fixture('0.162.1'))
  assert.equal(values.strings.length, 15)
  assert.equal(values.objects.length, 5)
  assert.ok(values.strings.includes('rateLimitExceeded'))
  assert.ok(values.strings.includes('tooManyDenials'))
  assert.deepEqual(values.openTypes, ['object', 'string'])
  assert.equal((await serverRequestMethods(fixture('0.162.1'))).length, 10)
  assert.deepEqual((await codexErrorVariants(fixture('0.147.0'))).openTypes, [])
})

test('unsupported union members fail closed instead of becoming an empty successful comparison', async t => {
  const root = await mkdtemp(join(tmpdir(), 'canary-schema-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'v2'))
  const original = JSON.parse(await readFile(join(fixture('0.162.1'), 'v2/ErrorNotification.json'), 'utf8'))
  for (const invalid of [{ $ref: '#/definitions/Unknown' }, { type: 'string', enum: ['other', 42] }, { type: 'object', required: ['a', 'b'] }]) {
    const payload = structuredClone(original)
    payload.definitions.CodexErrorInfo.anyOf.push(invalid)
    await writeFile(join(root, 'v2/ErrorNotification.json'), JSON.stringify(payload))
    await assert.rejects(codexErrorVariants(root), CodexSchemaError)
  }
  await writeFile(join(root, 'ServerRequest.json'), JSON.stringify({ oneOf: [{ properties: { method: { type: 'string' } } }] }))
  await assert.rejects(serverRequestMethods(root), CodexSchemaError)
})
