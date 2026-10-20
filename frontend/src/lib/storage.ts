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
