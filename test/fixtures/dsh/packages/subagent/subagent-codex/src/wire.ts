function objectFailureInfo(value: unknown) {
  const category = String(value)
  switch (category) {
    case 'httpConnectionFailed':
    case 'responseStreamConnectionFailed':
    case 'responseStreamDisconnected':
    case 'responseTooManyFailedAttempts':
    case 'activeTurnNotSteerable':
      return { category }
    default:
      return { category: 'unknown' }
  }
}

function failureInfo(info: unknown) {
  if (typeof info === 'string') {
    switch (info) {
      case 'contextWindowExceeded':
      case 'sessionBudgetExceeded':
      case 'usageLimitExceeded':
      case 'serverOverloaded':
      case 'cyberPolicy':
      case 'internalServerError':
      case 'unauthorized':
      case 'badRequest':
      case 'threadRollbackFailed':
      case 'sandboxError':
      case 'other':
        return { category: info }
    }
  }
  return info !== null ? objectFailureInfo(info) : { category: 'unknown' }
}

class Wire {
  private handleServerRequest(method: string) {
    switch (method) {
      case 'item/commandExecution/requestApproval':
      case 'item/fileChange/requestApproval':
        return true
      default:
        throw new Error('unsupported')
    }
  }

  private handleNotification() {}
}
