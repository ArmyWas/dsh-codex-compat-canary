import { codexErrorVariants, compareInventories, schemaInventory, serverRequestMethods } from './schema.js'
import { inspectWireSource } from './wire.js'

function difference(left, right) {
  const rightSet = new Set(right)
  return left.filter(value => !rightSet.has(value)).sort()
}

function finding(id, severity, scope, title, values, remediation) {
  return { id, severity, scope, title, values, remediation }
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

  const baselineUnhandledStrings = difference(baselineErrors.strings, wire.stringErrors)
  if (baselineUnhandledStrings.length > 0) {
    findings.push(finding(
      'codex-error-string-pinned-unhandled',
      'breaking',
      'baseline',
      'Pinned Codex string error categories degrade to unknown',
      baselineUnhandledStrings,
      'Map every string error category already present in the pinned Codex dependency in failureInfo() and add union-completeness coverage.',
    ))
  }

  const baselineUnhandledObjects = difference(baselineErrors.objects, wire.objectErrors)
  if (baselineUnhandledObjects.length > 0) {
    findings.push(finding(
      'codex-error-object-pinned-unhandled',
      'breaking',
      'baseline',
      'Pinned Codex object error categories degrade to unknown',
      baselineUnhandledObjects,
      'Parse every object error category already present in the pinned Codex dependency in objectFailureInfo() and preserve its safe fields.',
    ))
  }

  const addedStringErrors = difference(targetErrors.strings, baselineErrors.strings)
  const addedUnhandledStringErrors = difference(addedStringErrors, wire.stringErrors)
  if (addedUnhandledStringErrors.length > 0) {
    findings.push(finding(
      'codex-error-string-forward-unhandled',
      'breaking',
      'forward',
      'New target Codex string error categories would degrade to unknown',
      addedUnhandledStringErrors,
      'Before updating the Codex pin, map every new target string error category in failureInfo() and add union-completeness coverage.',
    ))
  }

  const addedObjectErrors = difference(targetErrors.objects, baselineErrors.objects)
  const addedUnhandledObjectErrors = difference(addedObjectErrors, wire.objectErrors)
  if (addedUnhandledObjectErrors.length > 0) {
    findings.push(finding(
      'codex-error-object-forward-unhandled',
      'breaking',
      'forward',
      'New target Codex object error categories would degrade to unknown',
      addedUnhandledObjectErrors,
      'Before updating the Codex pin, parse every new target object error category in objectFailureInfo() and preserve its safe fields.',
    ))
  }

  const addedRequests = difference(targetRequests, baselineRequests)
  const addedUnhandledRequests = difference(addedRequests, wire.serverRequests)
  if (addedUnhandledRequests.length > 0) {
    findings.push(finding(
      'codex-server-request-new-unhandled',
      'review',
      'forward',
      'New Codex server requests are not handled by the one-shot adapter',
      addedUnhandledRequests,
      'Confirm whether the selected Codex configuration can emit each request, then add a safe unattended response or explicit compatibility decision.',
    ))
  }

  const counts = {
    breaking: findings.filter(item => item.severity === 'breaking').length,
    review: findings.filter(item => item.severity === 'review').length,
  }
  const status = counts.breaking > 0 ? 'incompatible' : counts.review > 0 ? 'review' : 'compatible'

  return {
    schemaVersion: '1.1',
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
        added: {
          strings: addedStringErrors,
          objects: addedObjectErrors,
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
