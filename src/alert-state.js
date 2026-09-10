import { createHash } from 'node:crypto'

export const ISSUE_TITLE = '[canary] Codex adapter compatibility finding'
export const LEGACY_ISSUE_TITLE = '[canary] Codex App Server protocol drift detected'

const FINGERPRINT_PATTERN = /<!-- dsh-codex-canary-fingerprint: ([a-f0-9]{64}) -->/

function normalizedFindings(report) {
  return report.findings
    .map(item => ({
      id: item.id,
      scope: item.scope,
      severity: item.severity,
      values: [...item.values].sort(),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

export function findingsFingerprint(report) {
  return createHash('sha256')
    .update(JSON.stringify(normalizedFindings(report)))
    .digest('hex')
}

export function readFindingsFingerprint(body = '') {
  return String(body ?? '').match(FINGERPRINT_PATTERN)?.[1] ?? null
}

export function decideAlertTransition({ report, existingIssue, fingerprint = findingsFingerprint(report) }) {
  if (report.summary.status === 'compatible') {
    return existingIssue?.state === 'open'
      ? { kind: 'resolved', shouldFail: false, shouldUpdate: true }
      : { kind: 'clean', shouldFail: false, shouldUpdate: false }
  }
  if (!existingIssue) return { kind: 'created', shouldFail: true, shouldUpdate: true }
  if (existingIssue.state !== 'open') return { kind: 'reopened', shouldFail: true, shouldUpdate: true }
  if (readFindingsFingerprint(existingIssue.body) === fingerprint) {
    return { kind: 'known', shouldFail: false, shouldUpdate: false }
  }
  return { kind: 'changed', shouldFail: true, shouldUpdate: true }
}

function issueSummary(report) {
  const scopes = new Set(report.findings.map(item => item.scope))
  if (scopes.has('baseline') && scopes.has('forward')) {
    return 'The canary found both a gap in the currently pinned Codex protocol and forward drift in the selected target version.'
  }
  if (scopes.has('baseline')) {
    return 'The canary found protocol values already present in DeepSeek Harness\'s pinned Codex dependency that its adapter does not preserve.'
  }
  return 'The canary found forward protocol drift in the selected target Codex version that the current DeepSeek Harness adapter does not preserve.'
}

export function buildIssueBody(report, runUrl, fingerprint = findingsFingerprint(report)) {
  const values = report.findings.map(item => (
    `- **${item.severity} / ${item.scope}** \`${item.id}\`: ${item.values.map(value => `\`${value}\``).join(', ')}`
  )).join('\n')

  return [
    issueSummary(report),
    '',
    `- DeepSeek Harness: \`${report.dsh.packageVersion ?? 'unknown'}\` at \`${report.source.commit ?? report.source.ref ?? 'unknown'}\``,
    `- Codex baseline: \`${report.dsh.codexPin}\``,
    `- Codex target: \`${report.codex.targetVersion}\``,
    `- Status: **${report.summary.status}**`,
    '',
    values || '- No detailed finding was recorded.',
    '',
    `[Workflow run and JSON artifact](${runUrl})`,
    '',
    `<!-- dsh-codex-canary-fingerprint: ${fingerprint} -->`,
  ].join('\n')
}
