// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// There is no backend: nothing to sign in to, everything lives on the phone. Unlike guest
// mode in a browser, this is the user's only copy of their training log, so it can't depend
// on WebView localStorage alone (iOS evicts that under storage pressure). Every persist()
// therefore also lands in a JSON file in the app's private data directory, and boot()
// restores from it. The workout reminder uses native local notifications scheduled per future
// calendar date — no server involved, unlike Web Push in the self-hosted version.
//
// Like the demo build, MOBILE is replaced at build time, so all of this folds away in
// web bundles; the Capacitor plugins are only ever imported behind it.
import { t } from './i18n-core.js'
import { isoOf, todayISO } from './format.js'
import { effectiveRoutineId } from './history.js'

// The iPhone PWA is a separate web build. It shares the mobile-first UI, but uses browser storage
// and web capabilities. Android builds keep using only VITE_MOBILE and their native plugins.
export const IPHONE_PWA = import.meta.env.VITE_IPHONE_PWA === '1'
export const MOBILE = import.meta.env.VITE_MOBILE === '1' || IPHONE_PWA

// Some features only make sense on Android. The in-app updater downloads an .apk and hands it
// to the system package installer — there is no equivalent on iOS (App Store only) or on the
// web build. On anything but a native Android shell this must stay off.
//
// @capacitor/core is imported dynamically (like every other Capacitor dependency here) so it
// never lands in the web bundle. Capacitor.getPlatform() returns 'android' | 'ios' | 'web'.
export async function isAndroid() {
  if (!MOBILE) return false
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.getPlatform() === 'android'
  } catch (e) {
    return false
  }
}

const FILE = 'smitrix-state.json'

export async function nativeLoad() {
  if (IPHONE_PWA) return null
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    try {
      const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
      return JSON.parse(r.data)
    } catch {
      const r = await Filesystem.readFile({ path: 'fittrix-state.json', directory: Directory.Data, encoding: Encoding.UTF8 })
      return JSON.parse(r.data)
    }
  } catch (e) { return null }   // first launch, or unreadable — localStorage copy takes over
}

export async function nativeSave(state) {
  if (IPHONE_PWA) return
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data: JSON.stringify(state), encoding: Encoding.UTF8 })
  } catch (e) { /* keep the localStorage copy */ }
}

// Keep enough dates queued to cover normal app use between foregrounds without creating an
// unbounded notification list. The next sync cancels and replaces this whole window.
export const REMINDER_WINDOW_DAYS = 60
const REMINDER_ID_BASE = 1000
const LEGACY_REMINDER_IDS = Array.from({ length: 7 }, (_, d) => ({ id: 100 + d }))

// Pure date expansion for the native reminder. `now` is injectable so the calendar boundary,
// completed-day suppression, and today's past-time rule stay deterministic in tests.
export function buildReminderNotifications(S, now = new Date()) {
  const r = S?.reminder
  if (!r?.on) return []
  const routines = Array.isArray(S.routines) ? S.routines : []
  const completed = new Set((S.workouts || []).map(w => w.d))
  const state = { ...S, routines, week: S.week || {}, dayPlan: S.dayPlan || {} }
  const [hour, minute] = (r.time || '08:00').split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return []
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  const notifications = []
  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset++) {
    const day = new Date(date)
    day.setDate(date.getDate() + offset)
    const iso = isoOf(day)
    if (completed.has(iso)) continue
    const rid = effectiveRoutineId(state, iso)
    const routine = routines.find(x => x.id === rid)
    if (!routine) continue
    const at = new Date(day)
    at.setHours(hour, minute, 0, 0)
    if (at <= now) continue
    notifications.push({
      id: REMINDER_ID_BASE + offset,
      title: t('Workout day'),
      body: t('{0} is on the plan today — let’s go!', routine.name),
      channelId: 'workout-reminders',
      schedule: { at, allowWhileIdle: true },
    })
  }
  return notifications
}

let actionListenerRegistered = false
export async function initNotificationListeners() {
  if (!MOBILE || IPHONE_PWA || actionListenerRegistered) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    actionListenerRegistered = true
    await LocalNotifications.addListener('localNotificationActionPerformed', async action => {
      if (action.actionId === 'ADD_30') {
        const { useUI } = await import('../store/useUI.js')
        useUI.getState().addRest(30)
      } else if (action.actionId === 'SKIP') {
        const { useUI } = await import('../store/useUI.js')
        useUI.getState().stopRest()
      }
    })
  } catch (e) { /* */ }
}

export async function setupNotificationChannels() {
  if (!MOBILE || IPHONE_PWA) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: 'rest-timer',
      name: 'Rest Timer',
      description: 'Rest timer countdown and rest completion alerts',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#30D158',
    }).catch(() => {})
    await LocalNotifications.createChannel({
      id: 'workout-reminders',
      name: 'Workout Reminders',
      description: 'Daily training reminders and scheduled routine alerts',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#30D158',
    }).catch(() => {})
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'REST_TIMER_ACTIONS',
          actions: [
            { id: 'ADD_30', title: '+30s', foreground: false },
            { id: 'SKIP', title: 'Skip', foreground: false, destructive: true },
          ],
        },
      ],
    }).catch(() => {})
    await initNotificationListeners()
  } catch (e) { /* channels are Android only */ }
}

export async function checkNotificationPermission() {
  if (!MOBILE) return 'granted'
  if (IPHONE_PWA) return 'denied'
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    return perm.display || 'prompt'
  } catch (e) {
    return 'denied'
  }
}

export async function requestNotificationPermission() {
  if (!MOBILE) return 'granted'
  if (IPHONE_PWA) return 'denied'
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await setupNotificationChannels()
    await initNotificationListeners()
    const perm = await LocalNotifications.requestPermissions()
    return perm.display || 'denied'
  } catch (e) {
    return 'denied'
  }
}

export async function sendTestNotification() {
  if (!MOBILE || IPHONE_PWA) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let perm = await checkNotificationPermission()
    if (perm !== 'granted') {
      perm = await requestNotificationPermission()
    }
    if (perm !== 'granted') return false
    await setupNotificationChannels()
    await LocalNotifications.schedule({
      notifications: [{
        id: 8888,
        title: 'ProTraX Active 🏋️',
        body: 'Notifications are working! You will see rest timers and workout reminders here.',
        channelId: 'workout-reminders',
        schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
      }],
    })
    return true
  } catch (e) {
    return false
  }
}

// (Re)schedule the workout-day reminder: one one-off notification per future calendar date in
// the bounded window. Cheap enough to run after any state change — the plan or the reminder time
// may just have been edited. `interactive` gates the OS permission prompt to the Settings toggle;
// a background resync never pops a dialog.
export async function syncReminder(S, interactive = false) {
  if (IPHONE_PWA) return true
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [
      ...LEGACY_REMINDER_IDS,
      ...Array.from({ length: REMINDER_WINDOW_DAYS }, (_, d) => ({ id: REMINDER_ID_BASE + d })),
    ] }).catch(() => {})
    const r = S.reminder
    if (!r?.on) return true
    await setupNotificationChannels()
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted' && interactive) perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false
    const notifications = buildReminderNotifications(S)
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    return true
  } catch (e) { return false }
}

const REST_TIMER_NOTIFICATION_ID = 9999
const REST_TIMER_ACTIVE_ID = 9998

export async function showRestTimerNotification(sec) {
  if (!MOBILE || IPHONE_PWA || !(sec > 0)) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions()
    }
    if (perm.display !== 'granted') return
    await setupNotificationChannels()
    await LocalNotifications.cancel({
      notifications: [
        { id: REST_TIMER_NOTIFICATION_ID },
        { id: REST_TIMER_ACTIVE_ID },
      ],
    }).catch(() => {})

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_TIMER_ACTIVE_ID,
          title: `Rest: ${sec}s`,
          body: 'Resting between sets · Tap to return to workout',
          channelId: 'rest-timer',
          actionTypeId: 'REST_TIMER_ACTIONS',
          ongoing: true,
          autoCancel: false,
          schedule: { at: new Date(Date.now() + 200), allowWhileIdle: true },
        },
        {
          id: REST_TIMER_NOTIFICATION_ID,
          title: 'Rest over — next set!',
          body: 'Time to crush your next set! 💪',
          channelId: 'rest-timer',
          schedule: { at: new Date(Date.now() + sec * 1000), allowWhileIdle: true },
        },
      ],
    })
  } catch (e) { /* non-critical */ }
}

export async function cancelRestTimerNotification() {
  if (!MOBILE || IPHONE_PWA) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({
      notifications: [
        { id: REST_TIMER_NOTIFICATION_ID },
        { id: REST_TIMER_ACTIVE_ID },
      ],
    }).catch(() => {})
  } catch (e) { /* non-critical */ }
}

// Capacitor emits appStateChange when the native shell returns to the foreground. The visibility
// listener also covers WebView/browser transitions, and both are harmless on a non-mobile build.
let reminderSyncStarted = false
export function initReminderSync(getState) {
  if (!MOBILE || IPHONE_PWA || reminderSyncStarted) return
  reminderSyncStarted = true
  const resync = () => {
    if (document.visibilityState === 'hidden') return
    syncReminder(getState()).catch(() => {})
  }
  document.addEventListener('visibilitychange', resync)
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) resync() })
  }).catch(() => {})
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json, filename) {
  if (IPHONE_PWA) {
    const file = new File([json], filename, { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Keep the object URL alive long enough for Safari to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, url: w.uri })
}

// Share a generated workout image through Android's native share sheet.
export async function shareWorkoutCard(blob, filename, title, text) {
  if (!MOBILE || IPHONE_PWA) return false
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Could not read share image'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(blob)
  })
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const file = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: base64 })
  await Share.share({ title, text, url: file.uri, dialogTitle: title })
  return true
}

// "Auto-backup on changes" (Settings): a dated snapshot dropped into the Documents folder —
// visible in Files (iOS) / a file manager (Android), unlike the private mirror nativeSave keeps
// — so whatever the user points at that folder (a sync app, a manual copy) always has something
// recent. One file per day; later triggers the same day just overwrite it.
export async function writeAutoBackup(state) {
  if (IPHONE_PWA) return
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: `protrax-backup-${todayISO()}.json`,
      directory: Directory.Documents,
      data: JSON.stringify(state),
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch (e) { /* best effort — the private mirror in Directory.Data still has the data */ }
}

