import { readFile, rm, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { analyzeCompatibility, shouldFail } from './analyze.js'
import { ArgumentError, HELP, parseArgs } from './args.js'
import { formatText } from './format.js'
import { resolveCodexVersion } from './registry.js'
import { generateCodexSchema } from './schema.js'
import { loadDshSource } from './source.js'

const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

async function packageVersion() {
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'))
  return manifest.version
}

function write(stream, value) {
  stream.write(value.endsWith('\n') ? value : `${value}\n`)
}

export async function runCli(argv, io) {
  let temporaryRoot = null
  try {
    const options = parseArgs(argv)
    if (options.help) {
      write(io.stdout, HELP)
      return 0
    }
    if (options.version) {
      write(io.stdout, await packageVersion())
      return 0
    }

    const dsh = await loadDshSource(options)
    const targetVersion = await resolveCodexVersion(options.codexVersion)
    let baselineSchema = options.baselineSchema === null ? null : resolve(options.baselineSchema)
    let targetSchema = options.targetSchema === null ? null : resolve(options.targetSchema)

    if (baselineSchema === null) {
      temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-codex-canary-'))
      baselineSchema = join(temporaryRoot, `codex-${dsh.codexPin}`)
      targetSchema = dsh.codexPin === targetVersion
        ? baselineSchema
        : join(temporaryRoot, `codex-${targetVersion}`)
      write(io.stderr, `Generating Codex ${dsh.codexPin} schema...`)
      await generateCodexSchema(dsh.codexPin, baselineSchema)
      if (targetSchema !== baselineSchema) {
        write(io.stderr, `Generating Codex ${targetVersion} schema...`)
        await generateCodexSchema(targetVersion, targetSchema)
      }
    }

    const report = await analyzeCompatibility({
      dsh,
      targetVersion,
      baselineSchema,
      targetSchema,
    })
    write(io.stdout, options.format === 'json' ? JSON.stringify(report, null, 2) : formatText(report))

    if (options.jsonPath !== null) {
      const output = resolve(options.jsonPath)
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      write(io.stderr, `Wrote report to ${output}`)
    }
    if (options.keepTemp && temporaryRoot !== null) {
      write(io.stderr, `Kept generated schemas at ${temporaryRoot}`)
      temporaryRoot = null
    }
    return shouldFail(report, options.failOn) ? 1 : 0
  } catch (error) {
    const prefix = error instanceof ArgumentError ? 'argument error' : 'error'
    write(io.stderr, `dsh-codex-canary ${prefix}: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  } finally {
    if (temporaryRoot !== null) await rm(temporaryRoot, { recursive: true, force: true })
  }
}
