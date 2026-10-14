/** Error cases the interface tells apart to offer the right action (the others stay a raw message). */
export type ErrorCode = 'cancelled' | 'unreadable-file' | 'engine-missing' | 'write-failed' | 'profile-missing'

/** Error whose code crosses the IPC: the interface derives a title, an explanation and an action from it. */
export class CodedError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ErreurCodee'
    this.code = code
  }
}
