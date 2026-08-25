const BADGES = { breaking: 'BREAKING', review: 'REVIEW' }

export function formatText(report) {
  const lines = [
    `DSH Codex compatibility: ${report.summary.status.toUpperCase()}`,
    `DeepSeek Harness: ${report.dsh.packageVersion ?? 'unknown'} (${report.source.commit ?? report.source.ref ?? report.source.kind})`,
    `Codex baseline: ${report.dsh.codexPin}`,
    `Codex target:   ${report.codex.targetVersion}`,
    `Schema files: ${report.summary.schemaFiles.added} added, ${report.summary.schemaFiles.removed} removed, ${report.summary.schemaFiles.changed} changed`,
  ]
  if (report.findings.length === 0) {
    lines.push('', 'No compatibility findings in the implemented checks.')
  } else {
    lines.push('')
    for (const item of report.findings) {
      lines.push(`[${BADGES[item.severity]}] ${item.title}`)
      lines.push(`  Values: ${item.values.join(', ')}`)
      lines.push(`  Action: ${item.remediation}`)
    }
  }
  lines.push('', 'This canary detects implemented protocol checks; it is not proof of complete behavioral compatibility.')
  return `${lines.join('\n')}\n`
}
