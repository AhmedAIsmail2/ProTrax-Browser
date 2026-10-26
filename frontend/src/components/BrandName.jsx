/** Branded wordmark; the X follows the user's selected accent color. */
import protraxXMask from '../assets/protrax-x-mask.png'

export default function BrandName() {
  return (
    <span
      aria-label="ProTraX"
      className="brand-name"
      style={{ '--brand-x-mask': `url("${protraxXMask}")` }}
    >
      <span className="brand-name-word">ProTra</span>
      <span aria-hidden="true" className="brand-name-x" />
    </span>
  )
}
