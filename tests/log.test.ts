import { createLogger, LogLevel, nullLogger } from '../src/core/log'

describe('logger', () => {
  it('always emits warn/error; gates debug/info on the live flag', () => {
    const seen: LogLevel[] = []
    let on = false
    const log = createLogger((l) => void seen.push(l), () => on)
    log.debug('a')
    log.info('b')
    log.warn('c')
    log.error('d')
    expect(seen).toEqual(['warn', 'error'])
    on = true
    log.debug('a')
    log.info('b')
    expect(seen).toEqual(['warn', 'error', 'debug', 'info'])
  })
  it('nullLogger swallows everything', () => {
    expect(() => (nullLogger.debug('x'), nullLogger.warn('y'))).not.toThrow()
  })
})
