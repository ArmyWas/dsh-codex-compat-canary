function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`cannot locate ${label} in the DeepSeek Harness Codex adapter`)
  }
  return source.slice(start, end)
}

function cases(source) {
  return [...source.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(match => match[1])
}

export function inspectWireSource(source) {
  const stringBlock = sliceBetween(
    source,
    "if (typeof info === 'string')",
    'return info !== null',
    'string error mapping',
  )
  const objectBlock = sliceBetween(
    source,
    'function objectFailureInfo',
    'function failureInfo',
    'object error mapping',
  )
  const requestBlock = sliceBetween(
    source,
    'private handleServerRequest',
    'private handleNotification',
    'server request handler',
  )
  return {
    stringErrors: [...new Set(cases(stringBlock))].sort(),
    objectErrors: [...new Set(cases(objectBlock))].sort(),
    serverRequests: [...new Set(cases(requestBlock))].sort(),
  }
}
