const FAIL_LEVELS = new Set(['breaking', 'review', 'never'])
const FORMATS = new Set(['text', 'json'])

export class ArgumentError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ArgumentError'
  }
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new ArgumentError(`${flag} requires a value`)
  }
  return value
}

function validateRef(ref) {
  if (!/^[A-Za-z0-9._/-]+$/.test(ref) || ref.includes('..') || ref.startsWith('/')) {
    throw new ArgumentError('--dsh-ref must be a branch, tag, or commit name')
  }
}

export function isExactVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)
}

export function parseArgs(argv) {
  const options = {
    dshSource: null,
    dshRef: 'master',
    codexVersion: 'latest',
    baselineSchema: null,
    targetSchema: null,
    format: 'text',
    jsonPath: null,
    failOn: 'breaking',
    keepTemp: false,
    help: false,
    version: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    switch (flag) {
      case '--dsh-source':
        options.dshSource = takeValue(argv, index, flag)
        options.dshRef = null
        index += 1
        break
      case '--dsh-ref':
        options.dshRef = takeValue(argv, index, flag)
        options.dshSource = null
        validateRef(options.dshRef)
        index += 1
        break
      case '--codex-version':
        options.codexVersion = takeValue(argv, index, flag)
        if (options.codexVersion !== 'latest' && !isExactVersion(options.codexVersion)) {
          throw new ArgumentError('--codex-version must be latest or an exact semantic version')
        }
        index += 1
        break
      case '--baseline-schema':
        options.baselineSchema = takeValue(argv, index, flag)
        index += 1
        break
      case '--target-schema':
        options.targetSchema = takeValue(argv, index, flag)
        index += 1
        break
      case '--format':
        options.format = takeValue(argv, index, flag)
        if (!FORMATS.has(options.format)) throw new ArgumentError('--format must be text or json')
        index += 1
        break
      case '--json':
        options.jsonPath = takeValue(argv, index, flag)
        index += 1
        break
      case '--fail-on':
        options.failOn = takeValue(argv, index, flag)
        if (!FAIL_LEVELS.has(options.failOn)) throw new ArgumentError('--fail-on must be breaking, review, or never')
        index += 1
        break
      case '--keep-temp':
        options.keepTemp = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      case '--version':
      case '-v':
        options.version = true
        break
      default:
        throw new ArgumentError(`unknown option ${flag}`)
    }
  }

  if ((options.baselineSchema === null) !== (options.targetSchema === null)) {
    throw new ArgumentError('--baseline-schema and --target-schema must be used together')
  }
  if (options.baselineSchema !== null && options.codexVersion === 'latest') {
    throw new ArgumentError('--codex-version must be exact when reusing schema directories')
  }
  return options
}

export const HELP = `Usage: dsh-codex-canary [options]

Compare DeepSeek Harness's pinned Codex App Server contract with a target Codex release.

Options:
  --dsh-ref <ref>             Official Harness branch, tag, or commit (default: master)
  --dsh-source <path>         Read a local deepseek-harness checkout instead
  --codex-version <version>   Exact @openai/codex version or latest (default: latest)
  --baseline-schema <path>    Reuse a generated baseline schema (requires exact target version)
  --target-schema <path>      Reuse a generated target schema (requires exact target version)
  --format <text|json>        Standard output format (default: text)
  --json <path>               Also write the complete JSON report to a file
  --fail-on <level>           breaking, review, or never (default: breaking)
  --keep-temp                 Keep generated schema directories for inspection
  -h, --help                  Show help
  -v, --version               Show version
`
