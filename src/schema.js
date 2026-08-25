import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

async function filesRecursively(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(current, entry.name)
    return entry.isDirectory() ? filesRecursively(root, path) : [relative(root, path).replaceAll('\\', '/')]
  }))
  return nested.flat().sort()
}

export async function generateCodexSchema(version, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true })
  const bundledNpm = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const executable = process.platform === 'win32' && existsSync(bundledNpm) ? process.execPath : 'npm'
  const prefix = executable === process.execPath ? [bundledNpm] : []
  const result = spawnSync(executable, [
    ...prefix,
    'exec',
    '--yes',
    `--package=@openai/codex@${version}`,
    '--',
    'codex',
    'app-server',
    'generate-json-schema',
    '--out',
    outputDirectory,
  ], {
    encoding: 'utf8',
    timeout: 300_000,
    windowsHide: true,
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`
    throw new Error(`Codex ${version} schema generation failed: ${detail}`)
  }
}

export async function schemaInventory(root) {
  const paths = (await filesRecursively(root)).filter(path => path.endsWith('.json'))
  const entries = await Promise.all(paths.map(async path => {
    const bytes = await readFile(join(root, path))
    return [path, createHash('sha256').update(bytes).digest('hex')]
  }))
  return new Map(entries)
}

function stringEnums(variant) {
  return variant?.type === 'string' && Array.isArray(variant.enum)
    ? variant.enum.filter(value => typeof value === 'string')
    : []
}

export async function codexErrorVariants(root) {
  const payload = JSON.parse(await readFile(join(root, 'v2', 'ErrorNotification.json'), 'utf8'))
  const variants = payload.definitions?.CodexErrorInfo?.oneOf
  if (!Array.isArray(variants)) throw new Error('Codex schema does not expose definitions.CodexErrorInfo.oneOf')
  const strings = variants.flatMap(stringEnums)
  const objects = variants.flatMap(variant => {
    if (variant?.type !== 'object' || !Array.isArray(variant.required) || variant.required.length !== 1) return []
    const key = variant.required[0]
    return typeof key === 'string' ? [key] : []
  })
  return {
    strings: [...new Set(strings)].sort(),
    objects: [...new Set(objects)].sort(),
  }
}

export async function serverRequestMethods(root) {
  const payload = JSON.parse(await readFile(join(root, 'ServerRequest.json'), 'utf8'))
  if (!Array.isArray(payload.oneOf)) throw new Error('Codex schema does not expose ServerRequest.oneOf')
  const methods = payload.oneOf.flatMap(variant => stringEnums(variant?.properties?.method))
  return [...new Set(methods)].sort()
}

export function compareInventories(baseline, target) {
  const added = [...target.keys()].filter(path => !baseline.has(path)).sort()
  const removed = [...baseline.keys()].filter(path => !target.has(path)).sort()
  const changed = [...target.keys()].filter(path => baseline.has(path) && baseline.get(path) !== target.get(path)).sort()
  return { added, removed, changed }
}
