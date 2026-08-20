// ---------------------------------------------------------------------------
// NBA Carousel — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (PayPalMastercardPromo —
// Figma node Card.NBA.Carousel, 24:1855, "PayPal Cashback Mastercard"). This
// file has no dependency on the rest of that app — drop it into another
// React + Tailwind project as-is.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. Fonts — the header uses `font-display` (PayPal Pro Black, weight 900)
//    and body/labels use `font-text` (Plain). If the target project doesn't
//    already define these Tailwind classes, either register equivalent
//    @font-face rules and map them to these class names, or delete the
//    classNames below and let text fall back to your project's default
//    stack.
//
// 2. Images — copy these 10 files from oslo-home-prototype/public/images/
//    into the target project's public dir (paths below assume they land at
//    the same /images/... path; update IMAGE_BASE if you place them
//    elsewhere):
//      lighting-front.svg   lighting-middle.svg   lighting-back.svg
//      mastercard-logo.svg  mastercard-digital.svg  mastercard-digital-2.svg
//      paypal-logo-2.svg    paypal-logo-line.svg
//      text-credit.svg      text-debit.svg
//
// 3. Apply button — decorative in the source app (no onClick). This export
//    adds an optional `onApply` prop so you can wire it to whatever the
//    target prototype needs.
//
// 4. No nav-context dependency otherwise — the chip/contactless/PayPal "P"
//    monogram artwork on the front card is drawn inline as SVG, not sourced
//    from an image, so it needs no extra asset.
// ---------------------------------------------------------------------------

import { useState, useRef } from 'react'

const IMAGE_BASE = '/images'

// Three card variants per Figma 24:1855.
// "front" → dark-navy w/ chip+contactless+large PayPal P monogram (a unique
//   illustrated treatment built inline as SVG)
// "cyan"  → cyan bg with full "PayPal" wordmark in black + small "Credit"
//   label + Mastercard digital logo at right
// "navy"  → dark-blue bg with full "PayPal" wordmark in cyan + small "Debit"
//   label + Mastercard logo at right
type MCVariant = 'front' | 'cyan' | 'navy'
type MCDesign = { variant: MCVariant; bg: string; lighting: string }
const MC_DESIGNS: MCDesign[] = [
  { variant: 'front', bg: '#152045', lighting: `${IMAGE_BASE}/lighting-front.svg` },
  { variant: 'cyan', bg: '#60cdff', lighting: `${IMAGE_BASE}/lighting-middle.svg` },
  { variant: 'navy', bg: '#002991', lighting: `${IMAGE_BASE}/lighting-back.svg` },
]

// Slot 0 = front, 1 = middle, 2 = back. Each slot has fixed visual props.
const MC_SLOTS = [
  { y: 6, w: 244.444, h: 154, radius: 9.208, z: 3, shadow: true },
  { y: -16, w: 225.397, h: 142, radius: 8.521, z: 2, shadow: true },
  { y: -38, w: 206.349, h: 130, radius: 7.844, z: 1, shadow: false },
]

// Front card content — chip+waves + large PayPal P monogram, drawn inline
// so the outer silhouette is white and the inner highlights are light blue
// (matches the PayPal Cashback Mastercard art).
const FrontCardContent = ({ scale }: { scale: number }) => (
  <>
    {/* Logo group is centered in the card. */}
    <div
      className="absolute"
      style={{
        left: '50%',
        top: 'calc(50% - 2.13px * var(--s))',
        transform: 'translate(-50%, -50%)',
        width: 244.408 * scale,
        height: 83.321 * scale,
        ['--s' as never]: scale,
      }}
    >
      {/* Chip + contactless waves — drawn inline. The EMV chip uses the
          canonical 3-2-3 pad layout: top "Y" gap (two diagonals meeting at
          center + vertical drop) → ~30% horizontal → middle vertical →
          ~70% horizontal → inverted "Y" at the bottom. Contactless = 3
          thin concentric arcs. */}
      <svg
        viewBox="0 0 38.223 19.901"
        preserveAspectRatio="xMidYMid meet"
        className="absolute"
        style={{
          left: 29.85 * scale,
          top: 31.71 * scale,
          width: 38.223 * scale,
          height: 19.901 * scale,
          overflow: 'visible',
        }}
        aria-hidden
      >
        <defs>
          <clipPath id="emv-chip-body">
            <rect x="0.4" y="2.4" width="13.0" height="15.1" rx="2.2" ry="2.2" />
          </clipPath>
        </defs>
        {/* Silver chip body */}
        <rect x="0.4" y="2.4" width="13.0" height="15.1" rx="2.2" ry="2.2" fill="#DCDFE2" />
        {/* Navy gap pattern — clipped to the rounded chip body */}
        <g
          clipPath="url(#emv-chip-body)"
          stroke="#152045"
          strokeWidth="0.55"
          fill="none"
          strokeLinejoin="miter"
          strokeLinecap="butt"
        >
          {/* Top "Y" — two diagonals from the top edge meeting at center */}
          <path d="M 3.4 2.4 L 6.9 5.0 L 10.4 2.4" />
          {/* Vertical stem of top Y → ~30% horizontal */}
          <path d="M 6.9 5.0 L 6.9 7.0" />
          {/* ~30% horizontal gap */}
          <path d="M 0.0 7.0 L 13.8 7.0" />
          {/* Middle vertical (between the two horizontal gaps) */}
          <path d="M 6.9 7.0 L 6.9 13.0" />
          {/* ~70% horizontal gap */}
          <path d="M 0.0 13.0 L 13.8 13.0" />
          {/* Vertical stem of bottom Y */}
          <path d="M 6.9 13.0 L 6.9 15.0" />
          {/* Bottom inverted "Y" — two diagonals from center down to bottom edge */}
          <path d="M 3.4 17.5 L 6.9 15.0 L 10.4 17.5" />
        </g>
        {/* Contactless waves — 3 thin concentric arcs to the right of chip */}
        <g fill="none" stroke="#ffffff" strokeWidth="0.85" strokeLinecap="round">
          <path d="M 18.0 7.7 Q 19.2 9.95 18.0 12.2" />
          <path d="M 20.4 6.0 Q 22.5 9.95 20.4 13.9" />
          <path d="M 22.8 4.3 Q 25.8 9.95 22.8 15.6" />
        </g>
      </svg>
      {/* PayPal P monogram — inlined so the outer silhouette is white and
          the inner highlights are light blue (PayPal Cashback Mastercard art) */}
      <svg
        viewBox="0 0 13.695 16.5"
        preserveAspectRatio="xMidYMid meet"
        className="absolute"
        style={{
          left: 97.73 * scale,
          top: 0.53 * scale,
          width: 69.727 * scale,
          height: 82.258 * scale,
          overflow: 'visible',
        }}
        aria-hidden
      >
        {/* Outer "P" silhouette — white */}
        <path
          d="M11.6813 3.795C11.6813 5.83875 9.795 8.25 6.94125 8.25H4.1925L4.0575 9.10125L3.41625 13.2H0L2.055 0H7.59C9.45375 0 10.92 1.03875 11.46 2.4825C11.6138 2.89125 11.6888 3.33375 11.6813 3.795Z"
          fill="#ffffff"
        />
        {/* Mid blue highlight — light blue */}
        <path
          d="M13.6486 7.58992C13.2698 9.87742 11.3011 11.5499 8.97234 11.5499H7.06359L6.26859 16.4999H2.87109L3.41484 13.1999L4.05609 9.10117L4.19109 8.24992H6.93984C9.78984 8.24992 11.6798 5.83867 11.6798 3.79492C13.0823 4.51867 13.8998 5.98117 13.6486 7.58992Z"
          fill="#B8D0F2"
        />
        {/* Inner accent — lighter blue */}
        <path
          d="M11.6802 3.79505C11.0914 3.48755 10.3789 3.30005 9.60266 3.30005H4.96766L4.19141 8.25005H6.94016C9.79016 8.25005 11.6802 5.8388 11.6802 3.79505Z"
          fill="#D9E5F5"
        />
      </svg>
    </div>
    {/* Mastercard logo bottom-right (SVG uses preserveAspectRatio="none",
        so width AND height must be explicit) */}
    <img
      src={`${IMAGE_BASE}/mastercard-logo.svg`}
      alt=""
      aria-hidden
      className="absolute"
      style={{
        right: 9 * scale,
        bottom: 8 * scale,
        width: 51.747 * scale,
        height: 32.066 * scale,
      }}
    />
  </>
)

// Cyan / Navy back cards content — full "PayPal" wordmark across top
// (paypal-logo-2 is black-filled for cyan bg, paypal-logo-line is cyan-filled
// for navy bg) + small Credit/Debit text + Mastercard digital logo at right
const SecondaryCardContent = ({
  variant,
  scale,
}: {
  variant: 'cyan' | 'navy'
  scale: number
}) => {
  const logo = variant === 'cyan' ? `${IMAGE_BASE}/paypal-logo-2.svg` : `${IMAGE_BASE}/paypal-logo-line.svg`
  const logoW = variant === 'cyan' ? 209.708 : 193.066
  const logoH = variant === 'cyan' ? 69.906 : 64.359
  const textLabel = variant === 'cyan' ? `${IMAGE_BASE}/text-credit.svg` : `${IMAGE_BASE}/text-debit.svg`
  const mcDigital =
    variant === 'cyan' ? `${IMAGE_BASE}/mastercard-digital-2.svg` : `${IMAGE_BASE}/mastercard-digital.svg`
  return (
    <>
      {/* PayPal wordmark logo, full width across the top */}
      <img
        src={logo}
        alt=""
        aria-hidden
        className="absolute max-w-none"
        style={{
          left: (variant === 'cyan' ? 7.85 : 7.23) * scale,
          top: (variant === 'cyan' ? 7.64 : 7.03) * scale,
          width: logoW * scale,
          height: logoH * scale,
        }}
      />
      {/* Credit/Debit text label (preserveAspectRatio="none" → explicit dims) */}
      <img
        src={textLabel}
        alt=""
        aria-hidden
        className="absolute max-w-none"
        style={{
          right: (variant === 'cyan' ? 19 : 16) * scale,
          bottom: (variant === 'cyan' ? 25 : 22) * scale,
          height: (variant === 'cyan' ? 5.889 : 8.663) * scale,
          width: (variant === 'cyan' ? 19.708 : 18.212) * scale,
        }}
      />
      {/* Mastercard digital logo (preserveAspectRatio="none" → explicit dims) */}
      <img
        src={mcDigital}
        alt=""
        aria-hidden
        className="absolute"
        style={{
          right: 8 * scale,
          bottom: 8 * scale,
          width: (variant === 'cyan' ? 47.886 : 44.171) * scale,
          height: (variant === 'cyan' ? 29.673 : 27.371) * scale,
        }}
      />
    </>
  )
}

// Big dark-navy promo card with a 3-card swipable carousel, caption,
// pagination dots, and footer with $0-interest copy + Apply button.
//
// Each card has its own design. The active card occupies the FRONT slot
// (largest, on top); the next/previous cards sit in the MID and BACK
// slots. Drag horizontally to rotate the deck, vertical drags pass through
// to the page so the feed keeps scrolling.
export const NbaCarousel = ({ onApply }: { onApply?: () => void }) => {
  const [active, setActive] = useState(0)
  const N = MC_DESIGNS.length
  const dragRef = useRef<{
    startX: number
    startY: number
    dragging: boolean
    consumed: boolean
  }>({ startX: 0, startY: 0, dragging: false, consumed: false })

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      dragging: true,
      consumed: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragRef.current
    if (!s.dragging || s.consumed) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    // Vertical intent → release the gesture so the page scroll handles it
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      s.dragging = false
      return
    }
    if (Math.abs(dx) > 56) {
      setActive((prev) => (prev + (dx < 0 ? 1 : -1) + N) % N)
      s.consumed = true
    }
  }
  const onPointerEnd = (e: React.PointerEvent) => {
    dragRef.current.dragging = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Slot for each design = (designIdx - active + N) % N. 0 = front.
  const slotFor = (designIdx: number) => (designIdx - active + N) % N

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        margin: '0 auto',
        height: 514,
        borderRadius: 24,
        background: 'rgb(16, 26, 51)',
      }}
    >
      {/* Header — "Get the most out / of PayPal" */}
      <div className="absolute" style={{ left: 16, top: 16, width: 338, height: 72 }}>
        <div className="absolute" style={{ left: 2, top: 8, width: 334, height: 64 }}>
          <h2
            className="absolute font-display text-center text-white"
            style={{
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: 302,
              fontSize: 32,
              lineHeight: '32px',
              letterSpacing: '-1px',
              fontWeight: 900,
              margin: 0,
            }}
          >
            <span>Get the most out</span>
            <br />
            <span style={{ color: '#60cdff' }}>of PayPal</span>
          </h2>
        </div>
      </div>

      {/* Swipable cards deck */}
      <div
        className="absolute select-none touch-pan-y"
        style={{ left: 16, top: 104, width: 338, height: 338, cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div className="relative w-full h-full">
          {/* Cards container — 338×238 starting at top:28 */}
          <div className="absolute" style={{ left: 0, top: 28, width: 338, height: 238 }}>
            {MC_DESIGNS.map((design, i) => {
              const slot = slotFor(i)
              const cfg = MC_SLOTS[slot]
              // Each design has its own native Figma dimensions:
              // front=244×154, cyan=225×142, navy=206×130. We render the
              // content at NATIVE size and use CSS transform to fit the
              // current slot — this preserves the relative proportions of
              // all elements (chip, logos, Mastercard) as the cards rotate.
              const nativeW =
                design.variant === 'front' ? 244.444 : design.variant === 'cyan' ? 225.397 : 206.349
              const nativeH =
                design.variant === 'front' ? 154 : design.variant === 'cyan' ? 142 : 130
              const scaleX = cfg.w / nativeW
              const scaleY = cfg.h / nativeH
              // Use the smaller scale so content fits proportionally
              const scale = Math.min(scaleX, scaleY)
              return (
                <div
                  key={i}
                  className="absolute overflow-hidden"
                  style={{
                    left: '50%',
                    top: `calc(50% + ${cfg.y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: cfg.w,
                    height: cfg.h,
                    background: design.bg,
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: cfg.radius,
                    boxShadow: cfg.shadow
                      ? '0 59.7px 59.7px -23.9px rgba(0,0,0,0.48)'
                      : undefined,
                    zIndex: cfg.z,
                    transition:
                      'top 380ms cubic-bezier(0.22, 0.85, 0.25, 1), width 380ms cubic-bezier(0.22, 0.85, 0.25, 1), height 380ms cubic-bezier(0.22, 0.85, 0.25, 1), background 280ms ease, opacity 220ms ease',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Lighting glow overlay — subtle radial highlight. SVG
                      is square (425×429), preserveAspectRatio="none" so we
                      give explicit width AND height. */}
                  <img
                    src={design.lighting}
                    alt=""
                    aria-hidden
                    className="absolute pointer-events-none max-w-none"
                    style={{
                      left: -49 * scale,
                      top: -47 * scale,
                      width: cfg.w + 100 * scale,
                      height: cfg.h + 100 * scale,
                      opacity: 0.6,
                    }}
                  />
                  {design.variant === 'front' ? (
                    <FrontCardContent scale={scale} />
                  ) : (
                    <SecondaryCardContent variant={design.variant} scale={scale} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Label + pagination dots */}
          <div className="absolute" style={{ left: 0, top: 294, width: 338, height: 44 }}>
            <p
              className="absolute font-text text-center text-white"
              style={{
                left: 16,
                right: 16,
                top: 0,
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                margin: 0,
              }}
            >
              PayPal Cashback Mastercard
            </p>
            <div
              className="absolute flex items-center"
              style={{ left: 0, right: 0, top: 32, justifyContent: 'center', gap: 8 }}
            >
              {MC_DESIGNS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={`Card ${i + 1}`}
                  aria-pressed={i === active}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: i === active ? '#fff' : '#808080',
                    transition: 'background 200ms ease',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — caption + Apply button */}
      <div className="absolute" style={{ left: 16, top: 458, width: 338, height: 40 }}>
        <div
          className="absolute font-text"
          style={{
            left: 0,
            top: 0,
            width: 254,
            height: 40,
            fontSize: 14,
            lineHeight: '20px',
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          <p style={{ margin: 0 }}>$0 interest if paid in full in 6 months</p>
          <p style={{ margin: 0 }}>on all purchases of $149+</p>
        </div>
        <button
          type="button"
          onClick={onApply}
          className="absolute flex items-center justify-center text-white"
          style={{
            left: 266,
            top: 0,
            width: 72,
            height: 40,
            background: 'rgba(204,204,204,0.28)',
            border: '1px solid rgba(129,129,129,0.2)',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
