// A one-line input's Done/Enter key dismisses the keyboard. Keep multiline fields
// untouched so Enter still inserts a newline; callers can preventDefault first
// when Enter has a more specific action.
const KEYBOARD_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number'])

export function dismissKeyboardOnEnter(event) {
  if (event.key !== 'Enter' || event.defaultPrevented) return false
  const input = event.target
  if (!input || input.tagName !== 'INPUT' || !KEYBOARD_INPUT_TYPES.has((input.type || 'text').toLowerCase())) return false
  event.preventDefault()
  input.blur()
  return true
}

