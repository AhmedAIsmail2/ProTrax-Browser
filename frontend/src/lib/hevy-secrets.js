import { MOBILE } from './mobile.js'

const KEY = 'hevy.apiKey'
const memory = new Map()
const NATIVE_TIMEOUT_MS = 4000

function localGet(k) {
  try { return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage.getItem(k) : null } catch { return null }
}
function localSet(k, v) {
  try { if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.setItem(k, v) } catch { /* ignore */ }
}
function localRemove(k) {
  try { if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.removeItem(k) } catch { /* ignore */ }
}

let pluginPromise = null
function plugin() {
  if (!MOBILE) return Promise.resolve(null)
  if (!pluginPromise) {
    pluginPromise = import('@aparajita/capacitor-secure-storage')
      .then(m => {
        const s = m && m.SecureStorage
        if (!s || typeof s.get !== 'function') return null
        return { get: k => s.get(k), set: (k, v) => s.set(k, v), remove: k => s.remove(k) }
      })
      .catch(() => null)
  }
  return pluginPromise
}

const withTimeout = promise => new Promise((resolve, reject) => {
  const tm = setTimeout(() => reject(new Error('secure storage timed out')), NATIVE_TIMEOUT_MS)
  promise.then(v => { clearTimeout(tm); resolve(v) }, e => { clearTimeout(tm); reject(e) })
})

export async function getHevyApiKey() {
  const p = await plugin()
  if (p) {
    try { const v = await withTimeout(p.get(KEY)); return typeof v === 'string' && v ? v : null } catch { /* fall through */ }
  }
  return memory.get(KEY) || localGet(KEY) || null
}
export async function setHevyApiKey(value) {
  const v = String(value || '').trim()
  if (!v) return clearHevyApiKey()
  const p = await plugin()
  if (p) {
    try { await withTimeout(p.set(KEY, v)); memory.delete(KEY); localRemove(KEY); return } catch { /* fall through */ }
  }
  memory.set(KEY, v)
  localSet(KEY, v)
}
export async function clearHevyApiKey() {
  const p = await plugin()
  if (p) { try { await withTimeout(p.remove(KEY)) } catch { /* nothing to clear */ } }
  memory.delete(KEY)
  localRemove(KEY)
}
