import { LOG_TAG } from '../brand'
import { createLogger, Logger, LogSink } from '../core/log'

/** Console sink. Debug/info use console.log because devtools hides console.debug under "Verbose" by default. */
export const consoleSink: LogSink = (level, message, data, error) => {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  const args: unknown[] = [`[${LOG_TAG}] ${level}: ${message}`]
  if (data) args.push(data)
  if (error !== undefined) args.push(error)
  fn(...args)
}

/** Reads the setting on every call, so toggling debug logging needs no reload. */
export function makeLogger(settings: { debugLogging: boolean }): Logger {
  return createLogger(consoleSink, () => settings.debugLogging)
}
