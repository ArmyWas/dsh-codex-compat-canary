import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parse as parseYaml } from 'yaml'
import { analyzeCompatibility } from '../src/analyze.js'
import { loadDshSource } from '../src/source.js'

const root = dirname(fileURLToPath(import.meta.url))
const project = resolve(root, '..')
const fixture = (...parts) => resolve(root, 'fixtures', ...parts)

test('generated reports satisfy the published JSON schema', async () => {
  const schema = JSON.parse(await readFile(resolve(project, 'schemas', 'dsh-codex-compat-report.schema.json'), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  const dsh = await loadDshSource({ dshSource: fixture('dsh'), dshRef: null })
  const report = await analyzeCompatibility({
    dsh,
    targetVersion: '0.149.1',
    baselineSchema: fixture('schemas', 'codex-0.147.0'),
    targetSchema: fixture('schemas', 'codex-0.149.1'),
  })
  assert.equal(validate(report), true, JSON.stringify(validate.errors))
})

test('GitHub workflow files are valid YAML documents', async () => {
  for (const name of ['ci.yml', 'weekly-canary.yml']) {
    const source = await readFile(resolve(project, '.github', 'workflows', name), 'utf8')
    const workflow = parseYaml(source)
    assert.equal(typeof workflow, 'object')
    assert.ok(workflow.on)
    assert.ok(workflow.jobs)
  }
})
