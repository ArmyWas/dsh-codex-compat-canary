import { createHash } from 'node:crypto'

export const EXECUTION_ISSUE_TITLE = '[canary] Compatibility check could not complete'
const PATTERN = /<!-- dsh-codex-execution-fingerprint: ([a-f0-9]{64}) -->/

export function executionFingerprint(report) {
  return createHash('sha256').update(JSON.stringify({
    baseline: report.dsh.codexPin,
    target: report.codex.targetVersion,
    error: report.error,
  })).digest('hex')
}

export function decideExecutionTransition({ report, existingIssue }) {
  if (!existingIssue) return { kind: 'created', shouldFail: true, shouldUpdate: true }
  if (existingIssue.state !== 'open') return { kind: 'reopened', shouldFail: true, shouldUpdate: true }
  if (String(existingIssue.body ?? '').match(PATTERN)?.[1] === executionFingerprint(report)) {
    return { kind: 'known', shouldFail: false, shouldUpdate: false }
  }
  return { kind: 'changed', shouldFail: true, shouldUpdate: true }
}

export function buildExecutionIssueBody(report, runUrl) {
  return [
    'The canary could not complete its compatibility comparison. Existing adapter compatibility findings retain their previous state.',
    '',
    '- Status: **incomplete**',
    `- Stage: \`${report.error.stage}\``,
    `- Error: \`${report.error.code}\` — ${report.error.message}`,
    `- DeepSeek Harness: \`${report.dsh.packageVersion ?? 'unresolved'}\` at \`${report.source?.commit ?? report.source?.ref ?? 'unresolved'}\``,
    `- Codex baseline: \`${report.dsh.codexPin ?? 'unresolved'}\``,
    `- Codex target: \`${report.codex.targetVersion ?? 'unresolved'}\``,
    '',
    'Inspect the failed stage, repair or retry it, and rerun the canary. A later completed comparison resolves this execution alert independently of its compatibility result.',
    '',
    `[Workflow run and incomplete-check JSON artifact](${runUrl})`,
    '',
    `<!-- dsh-codex-execution-fingerprint: ${executionFingerprint(report)} -->`,
  ].join('\n')
}
