/**
 * Switchable storage adapter for Supabase Auth.
 *
 * Behavior:
 *  - When the "remember me" flag is true (default) → uses window.localStorage,
 *    the session survives browser restarts.
 *  - When false → uses window.sessionStorage, the session is wiped when the
 *    tab/window closes (good for shared computers).
 *
 * The active flag itself is persisted in localStorage so the right storage is
 * picked up on every page load — even after the original tab is closed.
 */

const REMEMBER_KEY = 'alto:remember-me'
const SUPABASE_TOKEN_PREFIX = 'sb-'

const memoryStorage: Storage = (() => {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => { store.delete(k) },
    setItem: (k: string, v: string) => { store.set(k, v) },
  }
})()

function isRememberMe(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const value = window.localStorage.getItem(REMEMBER_KEY)
    // Default to true (= persistent) so existing users aren't logged out.
    return value !== '0'
  } catch {
    return true
  }
}

function getActiveStorage(): Storage {
  if (typeof window === 'undefined') return memoryStorage
  return isRememberMe() ? window.localStorage : window.sessionStorage
}

/**
 * Adapter conforming to Supabase Auth `storage` option.
 * Every call picks the currently-active storage so the flag can flip at runtime.
 */
export const altoAuthStorage = {
  getItem: (key: string): string | null => getActiveStorage().getItem(key),
  setItem: (key: string, value: string): void => getActiveStorage().setItem(key, value),
  removeItem: (key: string): void => getActiveStorage().removeItem(key),
}

/**
 * Toggle the "remember me" preference.
 *
 * To avoid a stale session leaking from the previous storage, we proactively
 * remove all `sb-*` tokens from the storage we're switching AWAY from.
 */
export function setRememberMe(remember: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')

    const stale = remember ? window.sessionStorage : window.localStorage
    for (let i = stale.length - 1; i >= 0; i -= 1) {
      const key = stale.key(i)
      if (key && key.startsWith(SUPABASE_TOKEN_PREFIX)) {
        stale.removeItem(key)
      }
    }
  } catch (err) {
    // localStorage unavailable (private mode, quota) — silent fail.
    console.warn('[altoAuthStorage] could not persist remember-me flag', err)
  }
}

export function getRememberMe(): boolean {
  return isRememberMe()
}
