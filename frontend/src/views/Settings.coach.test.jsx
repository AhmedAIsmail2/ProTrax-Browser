// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.__APP_VERSION__ ??= 'test'

const state = vi.hoisted(() => {
  return {
    S: {},
    coachLocal: { mode: 'byok', provider: 'anthropic', model: 'claude-opus-5', baseUrl: null },
    keys: {
      'coach.apiKey.anthropic': 'sk-ant-test',
      'coach.apiKey.compatible': null,
      'hevy.apiKey': 'hevy-pro-key',
    },
    ui: {
      toast: vi.fn(),
      openSheet: vi.fn(),
    },
  }
})

vi.mock('../store/useStore.js', () => {
  const snapshot = () => ({
    S: state.S,
    user: null,
    coachLocal: state.coachLocal,
    setCoachLocal: vi.fn(async patch => {
      Object.assign(state.coachLocal, patch)
    }),
    update: vi.fn(),
    replaceState: vi.fn(),
    setUser: vi.fn(),
    pullState: vi.fn(),
    pushState: vi.fn(),
    signOut: vi.fn(),
    signOutAll: vi.fn(),
    resetDemo: vi.fn(),
    disconnectServer: vi.fn(),
  })
  const useStore = selector => (selector ? selector(snapshot()) : snapshot())
  useStore.getState = snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})

vi.mock('../store/useUI.js', () => {
  const snap = () => ({
    toast: state.ui.toast,
    openSheet: state.ui.openSheet,
  })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})

vi.mock('../lib/coach-secrets.js', () => ({
  getApiKey: vi.fn(async (provider = null) => {
    return state.keys[provider ? `coach.apiKey.${provider}` : 'coach.apiKey'] || null
  }),
  setApiKey: vi.fn(async (val, provider = null) => {
    state.keys[provider ? `coach.apiKey.${provider}` : 'coach.apiKey'] = val
  }),
  clearApiKey: vi.fn(async (provider = null) => {
    delete state.keys[provider ? `coach.apiKey.${provider}` : 'coach.apiKey']
  }),
  hasApiKey: vi.fn(async (provider = null) => {
    return !!state.keys[provider ? `coach.apiKey.${provider}` : 'coach.apiKey']
  }),
  getHevyApiKey: vi.fn(async () => state.keys['hevy.apiKey'] || null),
  setHevyApiKey: vi.fn(async val => { state.keys['hevy.apiKey'] = val }),
  clearHevyApiKey: vi.fn(async () => { delete state.keys['hevy.apiKey'] }),
}))

vi.mock('../lib/import-hevy.js', () => ({
  testHevyApiKey: vi.fn(async k => (k === 'valid-hevy' ? { ok: true } : { ok: false, error: 'auth' })),
}))

vi.mock('../lib/coach-local.js', () => ({
  localModels: vi.fn(async () => ({ ok: true, models: ['model-1', 'model-2'] })),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(),
  webauthnOK: () => false,
  passkeyLogin: vi.fn(),
  passkeyRegister: vi.fn(),
  IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({
  pushSupported: () => false,
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  sendTestPush: vi.fn(),
}))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({
  MOBILE: false,
  isAndroid: () => Promise.resolve(false),
  shareExport: vi.fn(),
  syncReminder: vi.fn(),
}))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  loadStarterPlan: vi.fn(),
  starterPlanSheet: vi.fn(),
  confirmSheet: vi.fn(),
  importFromApp: vi.fn(),
  importFromHevy: vi.fn(),
  importHubSheet: vi.fn(),
  equipmentProfileSheet: vi.fn(),
  menuSheet: vi.fn(),
}))
vi.mock('../components/TutorialDialog.jsx', () => ({ openTutorial: vi.fn() }))
vi.mock('../components/UpdateDialog.jsx', () => ({ startAppUpdate: vi.fn() }))
vi.mock('../lib/update.js', () => ({ checkForUpdate: vi.fn(), downloadAndInstall: vi.fn() }))

let host, root

beforeEach(() => {
  state.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  state.coachLocal = { mode: 'byok', provider: 'anthropic', model: 'claude-opus-5', baseUrl: null }
  state.keys = {
    'coach.apiKey.anthropic': 'sk-ant-test',
    'coach.apiKey.compatible': null,
    'hevy.apiKey': 'hevy-pro-key',
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = async component => {
  await act(async () => {
    root.render(component)
  })
  await act(async () => {
    await new Promise(r => setTimeout(r, 30))
  })
}

describe('removed integrations', () => {
  it('does not show Coach or API-key management controls in Settings', async () => {
    await mount(<Settings />)
    expect(host.textContent).not.toContain('AI Coach & API Keys')
    expect(host.textContent).not.toContain('Manage API Keys')
    expect(host.textContent).not.toContain('Hevy API key')
    expect(host.textContent).toContain('Import from another app')
  })
})