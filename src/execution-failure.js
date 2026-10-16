import { CodexSchemaError } from './schema.js'

const STAGE_MESSAGES = {
  source: 'Could not read the selected DeepSeek Harness source.',
  registry: 'Could not resolve the selected Codex version.',
  'schema-generation': 'Could not generate the selected Codex schema.',
  analysis: 'Could not complete the implemented protocol checks.',
  report: 'Could not write the requested compatibility report.',
}

function failureCategory(error) {
  const chain = [error, error?.cause, error?.cause?.cause].filter(Boolean)
  for (const item of chain) {
    if (item instanceof CodexSchemaError) return item.code
    if (item instanceof SyntaxError) return 'invalid-json'
    if (item.name === 'TimeoutError' || item.code === 'ETIMEDOUT') return 'timeout'
    if (item.name === 'AbortError') return 'aborted'
    if (Number.isInteger(item.status) && item.status >= 100 && item.status <= 599) return `http-${item.status}`
    if (Number.isInteger(item.exitCode)) return `process-exit-${item.exitCode}`
    if (['ENOENT', 'EACCES', 'EPERM', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ERR_INVALID_ARG_VALUE'].includes(item.code)) {
      return item.code.toLowerCase()
    }
  }
  return 'unexpected'
}

export function buildExecutionFailure({ stage, dsh = null, targetVersion = null, error, now = new Date() }) {
  return {
    schemaVersion: '1.0',
    reportType: 'execution-error',
    generatedAt: now.toISOString(),
    source: dsh?.source ?? null,
    dsh: {
      packageVersion: dsh?.packageVersion ?? null,
      codexPin: dsh?.codexPin ?? null,
    },
    codex: { targetVersion },
    summary: { status: 'incomplete' },
    error: {
      stage,
      code: `canary-${stage}-${failureCategory(error)}`,
      // Only messages constructed by our schema reader are safe to publish.
      // Arbitrary OS, provider, npm and fetch errors can contain local paths or secrets.
      message: error instanceof CodexSchemaError ? error.message : STAGE_MESSAGES[stage],
    },
  }
}
