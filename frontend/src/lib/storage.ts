// localStorage can throw (private mode, blocked storage); the app works without it.
const LAST_WORKSPACE = 'farm.lastWorkspace'

export function getLastWorkspace(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_WORKSPACE))
    return Number.isInteger(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function setLastWorkspace(id: number) {
  try {
    localStorage.setItem(LAST_WORKSPACE, String(id))
  } catch {
    // ignore
  }
}

export function getFlag(key: string): boolean {
  try {
    return localStorage.getItem(`farm.${key}`) === '1'
  } catch {
    return false
  }
}

export function setFlag(key: string) {
  try {
    localStorage.setItem(`farm.${key}`, '1')
  } catch {
    // ignore
  }
}
