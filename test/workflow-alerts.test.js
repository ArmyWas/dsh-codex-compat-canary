import assert from 'node:assert/strict'
import test from 'node:test'
import { syncRunAlerts } from '../.github/scripts/sync-canary-alerts.mjs'
import { ISSUE_TITLE, buildIssueBody } from '../src/alert-state.js'
import { EXECUTION_ISSUE_TITLE, buildExecutionIssueBody } from '../src/execution-alert.js'
import { buildExecutionFailure } from '../src/execution-failure.js'
import { CodexSchemaError } from '../src/schema.js'
import { analyzeCompatibility } from '../src/analyze.js'
import { loadDshSource } from '../src/source.js'
import { resolve } from 'node:path'

const context = { repo: { owner: 'test', repo: 'canary' }, serverUrl: 'https://github.com', runId: 1 }
const complete = await analyzeCompatibility({
  dsh: await loadDshSource({ dshSource: resolve('test/fixtures/dsh'), dshRef: null }),
  targetVersion: '0.149.1',
  baselineSchema: resolve('test/fixtures/schemas/codex-0.147.0'),
  targetSchema: resolve('test/fixtures/schemas/codex-0.149.1'),
})
const failure = buildExecutionFailure({
  stage: 'analysis', dsh: { ...complete.dsh, source: complete.source }, targetVersion: '0.162.1',
  error: new CodexSchemaError('v2/ErrorNotification.json', 'unsupported union'),
})

async function run(report, issues = []) {
  const writes = []
  const outputs = {}
  const warnings = []
  const github = {
    paginate: async () => issues,
    rest: { issues: Object.fromEntries(['listForRepo', 'create', 'update', 'createComment'].map(method => [method, async payload => { writes.push({ method, ...payload }) }])) },
  }
  const core = { setOutput: (key, value) => { outputs[key] = value }, notice() {}, warning: message => warnings.push(message) }
  await syncRunAlerts({ report, github, context, core })
  return { writes, outputs, warnings }
}

test('incomplete check opens its own alert and preserves an existing compatibility finding', async () => {
  const result = await run(failure, [{ number: 1, title: ISSUE_TITLE, state: 'open' }])
  assert.equal(result.writes.length, 1)
  assert.equal(result.writes[0].method, 'create')
  assert.equal(result.writes[0].title, EXECUTION_ISSUE_TITLE)
  assert.match(result.writes[0].body, /Status: \*\*incomplete\*\*/)
  assert.equal(result.outputs.should_fail, 'true')
})

test('identical incomplete checks stay quiet; changed and reopened failures alert', async () => {
  const issue = { number: 2, title: EXECUTION_ISSUE_TITLE, state: 'open', body: buildExecutionIssueBody(failure, 'https://example.test/run') }
  const known = await run({ ...failure, generatedAt: new Date().toISOString() }, [issue])
  assert.equal(known.writes.length, 0)
  assert.equal(known.outputs.should_fail, 'false')
  assert.equal(known.outputs.transition, 'execution-known')
  assert.equal(known.warnings.length, 1)
  const changed = await run({ ...failure, codex: { targetVersion: '0.163.0' } }, [issue])
  assert.equal(changed.outputs.should_fail, 'true')
  assert.equal(changed.writes[0].issue_number, 2)
  const reopened = await run(failure, [{ ...issue, state: 'closed' }])
  assert.equal(reopened.outputs.transition, 'execution-reopened')
})

test('a completed incompatible check resolves only the execution alert and preserves known adapter gaps', async () => {
  const result = await run(complete, [
    { number: 1, title: ISSUE_TITLE, state: 'open', body: buildIssueBody(complete, 'https://example.test/run') },
    { number: 2, title: EXECUTION_ISSUE_TITLE, state: 'open', body: buildExecutionIssueBody(failure, 'https://example.test/run') },
  ])
  assert.deepEqual(result.writes.map(item => [item.method, item.issue_number]), [['createComment', 2], ['update', 2]])
  assert.match(result.writes[0].body, /incompatible/)
  assert.equal(result.writes[1].state, 'closed')
  assert.equal(result.outputs.transition, 'known')
})

test('failure artifacts never publish arbitrary exception text', () => {
  const report = buildExecutionFailure({ stage: 'registry', error: new Error('private-token=secret-value C:/private/account') })
  assert.doesNotMatch(JSON.stringify(report), /secret-value|C:\/private/)
})

test('malformed reports cannot resolve or update issues', async () => {
  await assert.rejects(run({ summary: { status: 'incomplete' } }), /Unsupported canary report/)
  await assert.rejects(run({ summary: { status: 'compatible' }, findings: [] }, [{ number: 1, title: ISSUE_TITLE, state: 'open' }]), /Unsupported canary report/)
  await assert.rejects(run({ ...complete, summary: { ...complete.summary, status: 'compatible' } }), /Inconsistent canary report/)
  await assert.rejects(run({ ...complete, protocol: {}, findings: [], summary: { ...complete.summary, status: 'compatible', findingCounts: { breaking: 0, review: 0 } } }), /Unsupported canary report/)
})

test('completed recovery closes both alerts once and then stays quiet', async () => {
  const clean = { ...complete, summary: { ...complete.summary, status: 'compatible', findingCounts: { breaking: 0, review: 0 } }, findings: [] }
  const issues = [
    { number: 1, title: ISSUE_TITLE, state: 'open' },
    { number: 2, title: EXECUTION_ISSUE_TITLE, state: 'open' },
  ]
  const result = await run(clean, issues)
  assert.deepEqual(result.writes.filter(item => item.method === 'update').map(item => [item.issue_number, item.state]), [[1, 'closed'], [2, 'closed']])
  const repeat = await run(clean, issues.map(issue => ({ ...issue, state: 'closed' })))
  assert.equal(repeat.writes.length, 0)
})

test('different safe failure categories trigger changed execution alerts', async () => {
  const first = buildExecutionFailure({ stage: 'schema-generation', error: Object.assign(new Error('private A'), { code: 'ETIMEDOUT' }) })
  const second = buildExecutionFailure({ stage: 'schema-generation', error: Object.assign(new Error('private B'), { exitCode: 1 }) })
  const issue = { number: 2, title: EXECUTION_ISSUE_TITLE, state: 'open', body: buildExecutionIssueBody(first, 'https://example.test') }
  const result = await run(second, [issue])
  assert.equal(result.outputs.transition, 'execution-changed')
  assert.equal(result.outputs.should_fail, 'true')
  assert.doesNotMatch(JSON.stringify(result), /private A|private B/)
})
