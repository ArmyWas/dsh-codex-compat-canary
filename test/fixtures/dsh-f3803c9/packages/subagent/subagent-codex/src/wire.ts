// Discriminator-only projection of the official f3803c9 adapter.
// This is a parser fixture, not an executable Harness implementation.
function objectFailureInfo(value: unknown) {
  switch (String(value)) {
    case 'httpConnectionFailed':
    case 'responseStreamConnectionFailed':
    case 'responseStreamDisconnected':
    case 'responseTooManyFailedAttempts':
    case 'activeTurnNotSteerable':
      return { category: 'fixture' }
  }
}

function failureInfo(info: unknown) {
  if (typeof info === 'string') {
    switch (info) {
      case 'contextWindowExceeded':
      case 'sessionBudgetExceeded':
      case 'usageLimitExceeded':
      case 'serverOverloaded':
      case 'internalServerError':
      case 'cyberPolicy':
      case 'misalignmentPolicyViolation':
      case 'unauthorized':
      case 'badRequest':
      case 'threadRollbackFailed':
      case 'other':
      case 'sandboxError':
        return { category: 'fixture' }
    }
  }
  return info !== null ? objectFailureInfo(info) : { category: 'unknown' }
}

class Wire {
  private handleServerRequest(method: string) {
    switch (method) {
      case 'item/commandExecution/requestApproval':
      case 'item/fileChange/requestApproval':
      case 'item/permissions/requestApproval':
      case 'item/tool/requestUserInput':
      case 'mcpServer/elicitation/request':
        return true
    }
  }

  private handleNotification() {}
}
