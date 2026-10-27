import { describe, expect, it, vi } from 'vitest'
import { dismissKeyboardOnEnter } from './input-keyboard.js'

function keyEvent(key, target, defaultPrevented = false) {
  return { key, target, defaultPrevented, preventDefault: vi.fn(() => { defaultPrevented = true }) }
}

describe('dismissKeyboardOnEnter', () => {
  it('dismisses one-line text and number inputs without moving focus', () => {
    const input = { tagName: 'INPUT', type: 'text', blur: vi.fn() }
    const event = keyEvent('Enter', input)

    expect(dismissKeyboardOnEnter(event)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(input.blur).toHaveBeenCalledOnce()
    input.type = 'number'
    expect(dismissKeyboardOnEnter(keyEvent('Enter', input))).toBe(true)
  })

  it('does not intercept multiline fields or a handler that already used Enter', () => {
    const textarea = { tagName: 'TEXTAREA', blur: vi.fn() }
    const multiline = keyEvent('Enter', textarea)
    expect(dismissKeyboardOnEnter(multiline)).toBe(false)
    expect(multiline.preventDefault).not.toHaveBeenCalled()

    const input = { tagName: 'INPUT', type: 'text', blur: vi.fn() }
    const handled = keyEvent('Enter', input, true)
    expect(dismissKeyboardOnEnter(handled)).toBe(false)
    expect(handled.preventDefault).not.toHaveBeenCalled()
  })

  it('ignores non-Enter keys', () => {
    const input = { tagName: 'INPUT', type: 'text', blur: vi.fn() }
    const event = keyEvent('ArrowDown', input)
    expect(dismissKeyboardOnEnter(event)).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})

