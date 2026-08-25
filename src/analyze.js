import { codexErrorVariants, compareInventories, schemaInventory, serverRequestMethods } from './schema.js'
import { inspectWireSource } from './wire.js'

function difference(left, right) {
  const rightSet = new Set(right)
  return left.filter(value => !rightSet.has(value)).sort()
}

function finding(id, severity, title, values, remediation) {
  return { id, severity, title, values, remediation }
}

export async function analyzeCompatibility({ dsh, targetVersion, baselineSchema, targetSchema, now = new Date() }) {
  const [baselineInventory, targetInventory, baselineErrors, targetErrors, baselineRequests, targetRequests] = await Promise.all([
    schemaInventory(baselineSchema),
    schemaInventory(targetSchema),
    codexErrorVariants(baselineSchema),
    codexErrorVariants(targetSchema),
    serverRequestMethods(baselineSchema),
    serverRequestMethods(targetSchema),
  ])
  const wire = inspectWireSource(dsh.wireSource)
  const schemaDiff = compareInventories(baselineInventory, targetInventory)
  const findings = []

  const unhandledStringErrors = difference(targetErrors.strings, wire.stringErrors)
  if (unhandledStringErrors.length > 0) {
    findings.push(finding(
      'codex-error-string-unhandled',
      'breaking',
      'Codex string error categories degrade to unknown',
      unhandledStringErrors,
      'Map every target Codex error category in failureInfo() and add union-completeness coverage.',
    ))
  }

  const unhandledObjectErrors = difference(targetErrors.objects, wire.objectErrors)
  if (unhandledObjectErrors.length > 0) {
    findings.push(finding(
      'codex-error-object-unhandled',
      'breaking',
      'Codex object error categories degrade to unknown',
      unhandledObjectErrors,
      'Parse every target object error category in objectFailureInfo() and preserve its safe fields.',
    ))
  }

  const addedRequests = difference(targetRequests, baselineRequests)
  const addedUnhandledRequests = difference(addedRequests, wire.serverRequests)
  if (addedUnhandledRequests.length > 0) {
    findings.push(finding(
      'codex-server-request-new-unhandled',
      'review',
      'New Codex server requests are not handled by the one-shot adapter',
      addedUnhandledRequests,
      'Confirm whether the selected Codex configuration can emit each request, then add a safe unattended response or explicit compatibility decision.',
    ))
  }

  const baselineUnhandledStrings = difference(baselineErrors.strings, wire.stringErrors)
  const baselineUnhandledObjects = difference(baselineErrors.objects, wire.objectErrors)
  const counts = {
    breaking: findings.filter(item => item.severity === 'breaking').length,
    review: findings.filter(item => item.severity === 'review').length,
  }
  const status = counts.breaking > 0 ? 'incompatible' : counts.review > 0 ? 'review' : 'compatible'

  return {
    schemaVersion: '1.0',
    generatedAt: now.toISOString(),
    source: dsh.source,
    dsh: {
      packageVersion: dsh.packageVersion,
      codexPin: dsh.codexPin,
    },
    codex: { targetVersion },
    summary: {
      status,
      findingCounts: counts,
      schemaFiles: {
        baseline: baselineInventory.size,
        target: targetInventory.size,
        added: schemaDiff.added.length,
        removed: schemaDiff.removed.length,
        changed: schemaDiff.changed.length,
      },
    },
    findings,
    protocol: {
      codexErrors: {
        baseline: baselineErrors,
        target: targetErrors,
        handledByDsh: {
          strings: wire.stringErrors,
          objects: wire.objectErrors,
        },
        baselineUnhandled: {
          strings: baselineUnhandledStrings,
          objects: baselineUnhandledObjects,
        },
      },
      serverRequests: {
        baseline: baselineRequests,
        target: targetRequests,
        added: addedRequests,
        handledByDsh: wire.serverRequests,
      },
      schemaDiff,
    },
  }
}

export function shouldFail(report, failOn) {
  if (failOn === 'never') return false
  if (failOn === 'review') return report.summary.findingCounts.breaking > 0 || report.summary.findingCounts.review > 0
  return report.summary.findingCounts.breaking > 0
}
