export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Scalars only, so a log line cannot carry an object that happens to hold a token, URL or note text. */
export type LogData = Record<string, string | number | boolean>

export type LogSink = (level: LogLevel, message: string, data?: LogData, error?: unknown) => void

export interface Logger {
  debug(message: string, data?: LogData): void
  info(message: string, data?: LogData): void
  warn(message: string, error?: unknown): void
  error(message: string, error?: unknown): void
}

/** `warn`/`error` always reach the sink; `debug`/`info` only while `isDebug()` is true (read per call, so toggling is live). */
export function createLogger(sink: LogSink, isDebug: () => boolean): Logger {
  return {
    debug: (m, d) => isDebug() && sink('debug', m, d),
    info: (m, d) => isDebug() && sink('info', m, d),
    warn: (m, e) => sink('warn', m, undefined, e),
    error: (m, e) => sink('error', m, undefined, e),
  }
}

export const nullLogger: Logger = createLogger(() => undefined, () => false)
