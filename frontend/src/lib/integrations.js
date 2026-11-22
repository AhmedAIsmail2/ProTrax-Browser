// Settings → Integrations (v1.4.4): which cards the directory shows on this device, and what each
// one says. Pure, so the rules ("Apple Health lives in the iPhone app") are tested here and the page only draws them.
//
// The directory stays focused on integrations available in this build.
//
// Names of services are names, not translated. Everything else is an English key for t().

export const CATEGORIES = [
  { id: 'health', title: 'Health & devices' },
  { id: 'training', title: 'Training apps' },
  { id: 'automation', title: 'Automation' },
  { id: 'ai', title: 'AI & API' },
]

// `syncs`: the lines of "What it does" in the detail sheet.
export const CARDS = [
  {
    id: 'apple-health', cat: 'health', name: 'Apple Health', icon: 'heart', tint: 'var(--red)',
    desc: 'Workouts and weigh-ins out, heart rate and scale readings in.',
    syncs: ['Finished workouts and weigh-ins go to Apple Health.', 'Heart rate from your watch fills in each set.', 'Weigh-ins from your smart scale land here.'],
  },
  {
    id: 'health-connect', cat: 'health', name: 'Health Connect', icon: 'heart', tint: 'var(--red)',
    desc: 'Workouts and weigh-ins out, heart rate and scale readings in.',
    syncs: ['Finished workouts and weigh-ins go to Health Connect.', 'Heart rate from your watch fills in each set.', 'Weigh-ins from your smart scale land here.'],
  },
  {
    id: 'hevy', cat: 'training', name: 'Hevy', icon: 'key', tint: 'var(--teal)',
    desc: 'Bring your Hevy history over with a Pro API key.',
    syncs: ['Workouts, routines and weigh-ins, once.', 'The key is used for this import and then forgotten.'],
  },
  {
    id: 'files', cat: 'training', name: 'Import a file', translate: true, icon: 'download', tint: 'var(--teal)',
    desc: 'Strong, FitNotes, Hevy CSV, GymMane or an Apple Health export.',
    syncs: ['Reads the export file of another app, once.', 'Exercises are matched to the library, you check the rest.'],
  },
  {
    id: 'csv', cat: 'training', name: 'Spreadsheet (CSV)', translate: true, icon: 'share', tint: 'var(--green)',
    desc: 'Every set, weigh-in and measurement, for Excel and friends.',
    syncs: ['One row per set, plus body weight and measurements.', 'ProTraX can read it back in later.'],
  },
  {
    id: 'coach', cat: 'ai', name: 'AI Coach', translate: true, icon: 'sparkles', tint: 'var(--green)',
    desc: 'Plans and reviews from the model you pick.',
    syncs: ['Reads your plan and the last weeks of training when you ask.', 'Set up on its own page.'],
  },
]
export const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]))

// Apps people asked about that reach ProTraX through the phone's health store. `reads` is what
// ProTraX gets from them that way: heart rate, weigh-ins or both. No fake Connect buttons.
export const WORKS_WITH = [
  { name: 'Garmin', glyph: 'watch', reads: 'hr' },
  { name: 'COROS', glyph: 'watch', reads: 'hr' },
  { name: 'Polar', glyph: 'watch', reads: 'hr' },
  { name: 'Fitbit', glyph: 'watch', reads: 'hr' },
  { name: 'Samsung Health', glyph: 'watch', reads: 'both' },
  { name: 'Oura', glyph: 'ring', reads: 'hr' },
  { name: 'Withings', glyph: 'scale', reads: 'weight' },
  { name: 'Renpho', glyph: 'scale', reads: 'weight' },
]

// The status pill, in the words the card shows.
export const PILL = {
  connected: 'Connected',
  off: 'Off',
  attention: 'Needs attention',
  device: 'Not available on this device',
}

const healthOn = h => !!(h && (h.on || h.readHr || h.readWeight))
const healthTrouble = h => !!(h && ((h.on && h.error === 'permission') || (healthOn(h) && h.readError === 'permission')))

/**
 * What a card shows here, or null when it does not show at all.
 * ctx: { mobile, platform ('ios' | 'android' | null), user, demo, admin,
 *        health: { status, on, readHr, readWeight, error, readError } | null  (this phone's store)
 *        server: { providers: [id], connections: [..] } | null  (GET /api/integrations)
 *        offered: [provider ids] (config.integrations.providers), coach: bool, coachMode }
 * Answers { status: key of PILL | null, action: 'connect' | 'manage' | 'import' | 'export' | 'open' | null }.
 */
export function cardState(id, ctx) {
  const phone = ctx.mobile ? ctx.platform : null
  switch (id) {
    case 'apple-health':
    case 'health-connect': {
      const mine = id === 'apple-health' ? 'ios' : 'android'
      // The other platform's store is no use here: not shown at all on a phone.
      if (ctx.mobile && phone && phone !== mine) return null
      if (!ctx.mobile) return { status: 'device', action: null }
      const h = ctx.health
      if (!h || h.status === 'unsupported') return { status: 'device', action: null }
      if (h.status === 'missing' || h.status === 'update') return { status: 'off', action: 'connect' }
      if (healthTrouble(h)) return { status: 'attention', action: 'manage' }
      return healthOn(h) ? { status: 'connected', action: 'manage' } : { status: 'off', action: 'connect' }
    }
    case 'hevy':
    case 'files':
      return ctx.demo && id === 'hevy' ? null : { status: null, action: 'import' }
    case 'csv':
      return { status: null, action: 'export' }
    case 'coach':
      if (ctx.mobile) return { status: ctx.coachMode ? 'connected' : 'off', action: ctx.coachMode ? 'manage' : 'connect' }
      return ctx.coach ? { status: 'connected', action: 'open' } : null
    default:
      return null
  }
}

// The module (lib/modules.js) a card belongs to: with it off, the card is not in the directory.
export const CARD_MODULE = { 'apple-health': 'health', 'health-connect': 'health', coach: 'coach' }

/** The directory for this device: categories with their visible cards, empty ones left out.
 *  `ctx.mod(id)` says whether a module is on (absent: all on). */
export function directory(ctx) {
  return CATEGORIES.map(cat => ({
    ...cat,
    cards: CARDS.filter(c => c.cat === cat.id && !(CARD_MODULE[c.id] && ctx.mod && !ctx.mod(CARD_MODULE[c.id]))).map(c => ({ ...c, state: cardState(c.id, ctx) })).filter(c => c.state),
  })).filter(cat => cat.cards.length)
}

