import { create } from 'zustand'
import { api } from '../lib/api.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { MOBILE, initReminderSync, nativeLoad, nativeSave, syncReminder, writeAutoBackup } from '../lib/mobile.js'

import { WC_DEFAULT } from '../lib/workout-controls.js'

const KEY = 'gym_state_v1'
export const DEF = {
  unit: 'kg', restSec: 90, restPauseSec: 15, sound: true, restChime: 'bell', timerFlash: false, keepAwake: true, lang: 'en',
  theme: 'dark', accent: 'sky', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, weekExtra: [], weekCycleStart: null, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // How the active workout is laid out — 'cards' (one exercise at a time with Prev/Next)
  // or 'list' (every exercise stacked and scrollable). Purely presentational: profiles
  // written before this setting existed overlay onto DEF and keep the 'cards' behaviour.
  workoutView: 'cards',
  // Active workout spacing density: 'spacious' (generous touch targets) or 'compact' (dense display)
  workoutDensity: 'spacious',
  // Which controls the workout screen shows besides the sets themselves. The default is the
  // lean layout: one "more" button per exercise and a menu on each set number. Every switch
  // brings one of the old always-visible button groups back (Settings → During a workout).
  wc: { ...WC_DEFAULT },
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null, autoBackup: false,
  // Equipment profiles (issue: filter Library/picker/routines by what you actually own —
  // e.g. "Home" vs "Gym" — building on the session-only equipment filter from issue #6).
  equipProfiles: [], activeEquipId: null, equipFilterOn: false,
  // Standing per-exercise notes, keyed by exercise id: the gym-specific facts that are true
  // every time you do the movement ("seat 4, pin 7"). Distinct from a routine's `note`, which
  // belongs to one exercise in one plan, and from a session note, which belongs to one day.
  exNotes: {},
  // Favourite exercise ids (issue #6) — sorted to the top of the picker/Library. Personal and never part of a shared plan bundle (lib/favourites.js).
  favEx: [],
  // First day of the week as a getDay() index — 1 Monday, 0 Sunday. Monday is the default so
  // every profile written before this setting existed keeps the week it has been looking at.
  // See lib/format.js: nothing reads this field directly, everything goes through the helpers.
  weekStart: 1,
  // Per-exercise bar weight overrides, keyed by exercise id, in the profile unit (see
  // lib/bar.js). Personal equipment, so it syncs with the account but never travels in a
  // shared plan. Logged weights stay the total — this only feeds the plate math.
  barWeights: {},
  // Gym check-in cards (see views/CheckIn.jsx). Each is a membership
  // code shown as a QR/barcode at the gym's turnstile — added by typing it, importing a photo
  // of the card, or scanning it. We only ever keep the code's VALUE, never a photo: the image
  // is regenerated from `value` every time it's shown (lib/qr.js). `fmt` is the barcode symbology
  // ('qrcode' | 'ean13' | 'code128' | … — lower-cased BarcodeFormat) so it renders as the same
  // kind of code the gym issued. Just data, so it backs up like everything else.
  //   [{ id, label, value, fmt }]
  gymCards: [],
  // Whether the check-in feature is on at all (Settings toggle). Off hides the Home
  // card and the /checkin route; the saved gymCards stay so turning it back on restores them.
  // Defaults on; an older profile without the key reads as on (`!== false`).
  checkIn: true,
}
const clone = o => JSON.parse(JSON.stringify(o))

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

export function restoredStateFor(local, remote, dirty = false) {
  if (!remote || (hasData(local) && (dirty || (remote._ts || 0) < (local._ts || 0)))) return null
  const next = Object.assign(clone(DEF), remote)
  if (local.active) next.active = local.active
  return next
}

export const useStore = create((set, get) => {
  let saveTm = null
  let pushTm = null

  initReminderSync(() => get().S)

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S) }, 800)
  }

  const persist = (S, push = true) => {
    S._ts = Date.now()
    registerCustom(S.customEx)
    localStorage.setItem(KEY, JSON.stringify(S))
    set({ S })
    if (MOBILE) nativePersist()
    if (!__LOCAL_ONLY_BUILD__ && push && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(get().S)
      syncReminder(get().S)
    }
    if (!__LOCAL_ONLY_BUILD__ && pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  })

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => {
      if (MOBILE || DEMO) return null
      try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null }
    })(),
    ready: false,
    config: null,
    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) { persist(clone(S), push) },

    // Fires after the moments where losing local data would actually hurt — a workout just
    // logged, a routine just edited — not on every keystroke. No-op off mobile or with the
    // setting off; the private file mirror (nativePersist, above) already covers every change.
    autoBackupNow() {
      const S = get().S
      if (MOBILE && S.autoBackup) writeAutoBackup(S)
    },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    ...(!__LOCAL_ONLY_BUILD__ ? {
      async loadConfig() {
        if (get().config) return get().config
        return get().refreshConfig()
      },
      async refreshConfig() {
        try { const c = await api('/api/config'); set({ config: c }); return c }
        catch { return null }
      },
      setUser(u) {
        if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
        else localStorage.removeItem('gym_user')
        set({ user: u })
      },
      async pushState() {
        if (!get().user) return
        clearTimeout(pushTm)
        try {
          await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: get().S }) })
          localStorage.removeItem('gym_dirty')
        } catch {
          localStorage.setItem('gym_dirty', '1')
          const { enqueuePushState } = await import('../lib/sync-queue.js')
          enqueuePushState(get().S)
        }
      },
      async pullState() {
        try {
          const { state } = await api('/api/data')
          const restored = restoredStateFor(get().S, state, localStorage.getItem('gym_dirty') === '1')
          if (restored) persist(restored, false)
          else if (hasData(get().S)) await get().pushState()
          const { flushSyncQueue } = await import('../lib/sync-queue.js')
          flushSyncQueue().catch(() => {})
        } catch { /* offline — keep local */ }
      },
      async signOut() {
        try { await get().pushState(); await api('/api/logout', { method: 'POST', body: '{}' }) } catch { /* offline */ }
        get().setUser(null)
        localStorage.removeItem('gym_guest')
        localStorage.removeItem('gym_dirty')
        localStorage.removeItem(KEY)
        const { clearQueue } = await import('../lib/sync-queue.js')
        clearQueue()
        persist(clone(DEF), false)
      },
      async signOutAll() {
        await get().pushState()
        await api('/api/logout/all', { method: 'POST', body: '{}' })
        await get().signOut()
      },
    } : {}),

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(Object.assign(clone(DEF), buildDemoState()), false)
    },

    // Android and the static site stay local. Only the self-hosted web build loads accounts.
    async boot() {
      if (__LOCAL_ONLY_BUILD__) {
        if (MOBILE) {
          const saved = await nativeLoad()
          const local = get().S
          if (saved && (!hasData(local) || (saved._ts || 0) >= (local._ts || 0))) {
            persist(Object.assign(clone(DEF), saved), false)
          } else if (hasData(local)) {
            nativeSave(local)
          }
        }
        if (DEMO && !localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        localStorage.setItem('gym_guest', '1')
        if (MOBILE) syncReminder(get().S)
        set({ ready: true })
        return
      }

      const cfg = await get().loadConfig()
      if (!guestAllowed(cfg)) get().setGuest(false)
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    },
  }
})

export { hasData }

