import { isExactVersion } from './args.js'

export async function resolveCodexVersion(requested, fetchImpl = fetch) {
  if (requested !== 'latest') return requested
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl('https://registry.npmjs.org/@openai%2Fcodex/latest', {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) {
        const payload = await response.json()
        if (typeof payload.version !== 'string' || !isExactVersion(payload.version)) {
          throw new Error('npm registry returned an invalid @openai/codex version')
        }
        return payload.version
      }
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`npm registry returned HTTP ${response.status} for @openai/codex/latest`)
      }
      lastError = new Error(`npm registry returned HTTP ${response.status} for @openai/codex/latest`)
    } catch (error) {
      lastError = error
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`npm registry request failed: ${message}`)
}
