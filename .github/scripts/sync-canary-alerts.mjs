import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { buildIssueBody, decideAlertTransition, ISSUE_TITLE, LEGACY_ISSUE_TITLE } from '../../src/alert-state.js'
import { buildExecutionIssueBody, decideExecutionTransition, EXECUTION_ISSUE_TITLE } from '../../src/execution-alert.js'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validators = new Map()

async function validateReport(report) {
  const name = report.reportType === 'execution-error'
    ? 'dsh-codex-execution-failure.schema.json'
    : 'dsh-codex-compat-report.schema.json'
  if (!validators.has(name)) {
    const schema = JSON.parse(await readFile(new URL(`../../schemas/${name}`, import.meta.url), 'utf8'))
    validators.set(name, ajv.compile(schema))
  }
  if (!validators.get(name)(report)) throw new Error('Unsupported canary report; no issue state was changed')
  if (report.reportType !== 'execution-error') {
    const breaking = report.findings.filter(item => item.severity === 'breaking').length
    const review = report.findings.filter(item => item.severity === 'review').length
    const expected = breaking > 0 ? 'incompatible' : review > 0 ? 'review' : 'compatible'
    if (report.summary.status !== expected || report.summary.findingCounts.breaking !== breaking
      || report.summary.findingCounts.review !== review) {
      throw new Error('Inconsistent canary report; no issue state was changed')
    }
  }
}

export async function syncRunAlerts({ report, github, context, core }) {
  await validateReport(report)
  const incomplete = report.reportType === 'execution-error'
  const repo = { owner: context.repo.owner, repo: context.repo.repo }
  const runUrl = `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`
  const issues = await github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'all', per_page: 100 })
  const findIssue = titles => issues.find(issue => !issue.pull_request && titles.includes(issue.title))
  const executionIssue = findIssue([EXECUTION_ISSUE_TITLE])

  async function upsert(existing, title, body) {
    if (existing) {
      await github.rest.issues.update({ ...repo, issue_number: existing.number, state: 'open', title, body })
    } else {
      await github.rest.issues.create({ ...repo, title, body })
    }
  }

  async function close(existing, title, body) {
    await github.rest.issues.createComment({ ...repo, issue_number: existing.number, body })
    await github.rest.issues.update({ ...repo, issue_number: existing.number, state: 'closed', title })
  }

  if (incomplete) {
    const transition = decideExecutionTransition({ report, existingIssue: executionIssue })
    if (transition.shouldUpdate) {
      await upsert(executionIssue, EXECUTION_ISSUE_TITLE, buildExecutionIssueBody(report, runUrl))
    }
    core.warning(`Compatibility check incomplete (${report.error.stage}); execution alert: ${transition.kind}`)
    core.setOutput('should_fail', String(transition.shouldFail))
    core.setOutput('transition', `execution-${transition.kind}`)
    return
  }

  const existing = findIssue([ISSUE_TITLE, LEGACY_ISSUE_TITLE])
  const transition = decideAlertTransition({ report, existingIssue: existing })
  if (transition.kind === 'resolved') {
    await close(existing, ISSUE_TITLE, `The implemented compatibility checks are green again. [Workflow run and JSON artifact](${runUrl})`)
  } else if (transition.shouldUpdate) {
    await upsert(existing, ISSUE_TITLE, buildIssueBody(report, runUrl))
  }
  if (executionIssue?.state === 'open') {
    await close(executionIssue, EXECUTION_ISSUE_TITLE, `The canary completed again. The compatibility result is **${report.summary.status}**. [Workflow run and JSON artifact](${runUrl})`)
  }
  core.notice(`Compatibility status: ${report.summary.status}; alert transition: ${transition.kind}`)
  core.setOutput('should_fail', String(transition.shouldFail))
  core.setOutput('transition', transition.kind)
}
