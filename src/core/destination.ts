export const DEST_ERROR = 'Choose a normal vault folder (no hidden folders)'

/** Folder with surrounding slashes and whitespace removed. */
export function normalizeDest(dest: string): string {
  return dest.trim().replace(/^\/+|\/+$/g, '')
}

/** Reject destinations that are empty, absolute, contain `..`, or have a hidden segment (nothing is written to hidden folders). */
export function destError(dest: string): string | null {
  const raw = dest.trim()
  if (/^[/\\]/.test(raw) || /^[a-zA-Z]:/.test(raw) || raw.includes('\\')) return DEST_ERROR
  const d = normalizeDest(raw)
  if (!d) return DEST_ERROR
  if (d.split('/').some((s) => !s || s === '..' || s.startsWith('.'))) return DEST_ERROR
  return null
}
