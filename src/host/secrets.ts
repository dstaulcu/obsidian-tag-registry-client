import { PLUGIN_ID } from '../brand'
import type { SourceSetting } from '../settings'

interface SecretStorage {
  getSecret(id: string): string | null
  setSecret(id: string, value: string): void
}

/** The slice of `App` this module needs, so tests can pass a fake. */
export interface SecretHost {
  secretStorage?: unknown
}

export const secretId = (src: Pick<SourceSetting, 'id'>) => `${PLUGIN_ID}-token-${src.id}`

/** Obsidian's secret storage exists only on newer versions; older ones fall back to data.json. */
function store(app: SecretHost): SecretStorage | null {
  const s = app.secretStorage as Partial<SecretStorage> | undefined
  return s && typeof s.getSecret === 'function' && typeof s.setSecret === 'function' ? (s as SecretStorage) : null
}

export function hasSecretStorage(app: SecretHost): boolean {
  return store(app) !== null
}

export function getToken(app: SecretHost, src: SourceSetting): string {
  return store(app)?.getSecret(secretId(src)) || src.token
}

/** Mutates `src.token`; the caller saves settings. */
export function setToken(app: SecretHost, src: SourceSetting, value: string): void {
  const s = store(app)
  if (s) {
    s.setSecret(secretId(src), value)
    src.token = ''
  } else {
    src.token = value
  }
}

export function clearToken(app: SecretHost, src: SourceSetting): void {
  setToken(app, src, '')
}
