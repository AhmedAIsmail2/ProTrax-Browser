// @vitest-environment happy-dom
// /api/config carries account-server settings. loadConfig() caches them for a boot;
// refreshConfig() asks again when the app returns to the foreground.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))

import { api } from '../lib/api.js'
import { useStore } from './useStore.js'

beforeEach(() => { api.mockReset(); useStore.setState({ config: null }) })
afterEach(() => { useStore.setState({ config: null }) })

describe('server config', () => {
  it('loadConfig fetches once and then answers from the cache', async () => {
    api.mockResolvedValue({ invite_only: true, allow_guest: false })
    expect(await useStore.getState().loadConfig()).toEqual({ invite_only: true, allow_guest: false })
    expect(await useStore.getState().loadConfig()).toMatchObject({ invite_only: true })
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('/api/config')
  })

  it('refreshConfig always fetches the latest server settings', async () => {
    api.mockResolvedValueOnce({ invite_only: true, allow_guest: false })
    await useStore.getState().loadConfig()

    api.mockResolvedValueOnce({ invite_only: false, allow_guest: true })
    await useStore.getState().refreshConfig()
    expect(useStore.getState().config).toEqual({ invite_only: false, allow_guest: true })
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('an unreachable server leaves the cached config alone', async () => {
    useStore.setState({ config: { invite_only: true, allow_guest: false } })
    api.mockRejectedValueOnce(new Error('offline'))
    expect(await useStore.getState().refreshConfig()).toBeNull()
    expect(useStore.getState().config).toEqual({ invite_only: true, allow_guest: false })
  })
})

