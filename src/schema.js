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
    throw Object.assign(new Error(`Codex ${version} schema generation failed: ${detail}`), { exitCode: result.status })
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

export class CodexSchemaError extends Error {
  constructor(file, detail) {
    super(`${file}: ${detail}`)
    this.name = 'CodexSchemaError'
    this.code = 'codex-schema-unsupported'
  }
}

async function readSchema(root, file) {
  let text
  try {
    text = await readFile(join(root, file), 'utf8')
  } catch {
    throw new CodexSchemaError(file, 'could not read the generated schema file')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new CodexSchemaError(file, 'the generated schema is not valid JSON')
  }
}

function unionVariants(schema, file, label) {
  const keys = ['oneOf', 'anyOf'].filter(key => Object.hasOwn(schema ?? {}, key))
  if (keys.length !== 1 || !Array.isArray(schema[keys[0]]) || schema[keys[0]].length === 0) {
    throw new CodexSchemaError(file, `${label} must expose one non-empty oneOf or anyOf union`)
  }
  return schema[keys[0]]
}

export async function codexErrorVariants(root) {
  const file = 'v2/ErrorNotification.json'
  const payload = await readSchema(root, file)
  const variants = unionVariants(payload.definitions?.CodexErrorInfo, file, 'CodexErrorInfo')
  const strings = []
  const objects = []
  const openTypes = []
  for (const variant of variants) {
    if (variant?.type === 'string' && Array.isArray(variant.enum)
      && variant.enum.length > 0 && variant.enum.every(value => typeof value === 'string')) {
      strings.push(...variant.enum)
    } else if (variant?.type === 'object' && Array.isArray(variant.required)
      && variant.required.length === 1 && typeof variant.required[0] === 'string'
      && (variant.properties === undefined || Object.hasOwn(variant.properties, variant.required[0]))) {
      objects.push(variant.required[0])
    } else {
      const types = Array.isArray(variant?.type) ? variant.type : [variant?.type]
      const allowedKeys = ['type', 'title', 'description', '$comment']
      if (types.length > 0 && types.every(type => type === 'string' || type === 'object')
        && Object.keys(variant).every(key => allowedKeys.includes(key))) {
        openTypes.push(...types)
      } else {
        throw new CodexSchemaError(file, 'CodexErrorInfo contains an unsupported union member')
      }
    }
  }
  return {
    strings: [...new Set(strings)].sort(),
    objects: [...new Set(objects)].sort(),
    openTypes: [...new Set(openTypes)].sort(),
  }
}

export async function serverRequestMethods(root) {
  const file = 'ServerRequest.json'
  const payload = await readSchema(root, file)
  const variants = unionVariants(payload, file, 'ServerRequest')
  const methods = variants.flatMap(variant => {
    const values = stringEnums(variant?.properties?.method)
    if (values.length === 0 || values.length !== variant.properties.method.enum.length) {
      throw new CodexSchemaError(file, 'ServerRequest contains an unsupported method discriminator')
    }
    return values
  })
  return [...new Set(methods)].sort()
}

export function compareInventories(baseline, target) {
  const added = [...target.keys()].filter(path => !baseline.has(path)).sort()
  const removed = [...baseline.keys()].filter(path => !target.has(path)).sort()
  const changed = [...target.keys()].filter(path => baseline.has(path) && baseline.get(path) !== target.get(path)).sort()
  return { added, removed, changed }
}
