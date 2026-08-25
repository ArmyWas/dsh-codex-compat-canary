import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { isExactVersion } from './args.js'

const PACKAGE_PATH = 'packages/subagent/subagent-codex/package.json'
const WIRE_PATH = 'packages/subagent/subagent-codex/src/wire.ts'

function codexPin(packageJson) {
  const value = packageJson.dependencies?.['@openai/codex']
    ?? packageJson.devDependencies?.['@openai/codex']
    ?? packageJson.optionalDependencies?.['@openai/codex']
  if (typeof value !== 'string' || !isExactVersion(value)) {
    throw new Error('DeepSeek Harness does not declare an exact @openai/codex version')
  }
  return value
}

async function readLocal(root) {
  const packageText = await readFile(resolve(root, PACKAGE_PATH), 'utf8')
  const wireSource = await readFile(resolve(root, WIRE_PATH), 'utf8')
  const packageJson = JSON.parse(packageText)
  const git = spawnSync('git', ['-C', resolve(root), 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  return {
    source: { kind: 'local', ref: null, commit: git.status === 0 ? git.stdout.trim() : null },
    packageVersion: packageJson.version ?? null,
    codexPin: codexPin(packageJson),
    wireSource,
  }
}

function githubHeaders() {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'dsh-codex-compat-canary',
    ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  }
}

async function githubJson(url, fetchImpl) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) return response.json()
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`GitHub returned HTTP ${response.status}`)
      }
      lastError = new Error(`GitHub returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`GitHub API request failed for ${url}: ${message}`)
}

async function fetchRepositoryFile(path, ref, fetchImpl) {
  const url = `https://api.github.com/repos/deepseek-ai/deepseek-harness/contents/${path}?ref=${encodeURIComponent(ref)}`
  const payload = await githubJson(url, fetchImpl)
  if (payload?.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new Error(`GitHub did not return base64 file content for ${path}`)
  }
  return Buffer.from(payload.content.replaceAll('\n', ''), 'base64').toString('utf8')
}

async function resolveCommit(ref, fetchImpl) {
  const payload = await githubJson(
    `https://api.github.com/repos/deepseek-ai/deepseek-harness/commits/${encodeURIComponent(ref)}`,
    fetchImpl,
  )
  return typeof payload.sha === 'string' ? payload.sha : null
}

async function readOfficial(ref, fetchImpl) {
  const [packageText, wireSource, commit] = await Promise.all([
    fetchRepositoryFile(PACKAGE_PATH, ref, fetchImpl),
    fetchRepositoryFile(WIRE_PATH, ref, fetchImpl),
    resolveCommit(ref, fetchImpl),
  ])
  const packageJson = JSON.parse(packageText)
  return {
    source: { kind: 'github', ref, commit },
    packageVersion: packageJson.version ?? null,
    codexPin: codexPin(packageJson),
    wireSource,
  }
}

export async function loadDshSource(options, fetchImpl = fetch) {
  return options.dshSource === null
    ? readOfficial(options.dshRef, fetchImpl)
    : readLocal(options.dshSource)
}
