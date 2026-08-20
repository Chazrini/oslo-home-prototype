// ---------------------------------------------------------------------------
// Account Snapshot — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (AccountSnapshot — Figma
// node 1:21, first screen of the Home flow). This file has no dependency on
// the rest of that app — drop it into another React + Tailwind project as-is.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. Fonts — tile amounts use `font-display` (PayPal Pro Black, weight 900).
//    Everything else is plain default body text (no `font-text` class here).
//    If the target project doesn't already define `font-display`, either
//    register an equivalent @font-face and map it to that class name, or
//    delete the className and let it fall back to your project's default.
//
// 2. Images — copy these 8 files from oslo-home-prototype/public/images/
//    into the target project's public dir (paths below assume they land at
//    the same /images/... path; update IMAGE_BASE if you place them
//    elsewhere):
//      card-debit.png        card-credit.png
//      icon-calendar.svg      paypal-monogram.svg
//      icon-crypto-snap.svg   icon-bank.svg
//      icon-card.svg          icon-plus.svg
//
// 3. Horizontal scroll behavior — this component owns its own drag-to-scroll
//    + shift-wheel-to-pan hook (`useHScroll`, inlined below), the same one
//    used by every horizontally-scrolling row in the source app. It only
//    hijacks vertical wheel scroll when Shift is held, so it won't fight
//    the page's normal scroll.
//
// 4. Callbacks — the "Crypto" tile and the "Add more" button are
//    interactive in the source app (opens the Crypto overview page / opens
//    an add-account flow via nav context). This export replaces those with
//    optional `onOpenCrypto` / `onAddAccount` props — both no-ops if
//    omitted. Every other tile (PayPal balance, Pay Later, PayPal+, PayPal
//    credit card) is static/decorative in the source app too.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react'

const IMAGE_BASE = '/images'

// Adds click-and-drag scrolling (desktop mouse) plus shift+wheel panning to
// a horizontal row, without hijacking a plain vertical wheel scroll — only
// an explicit shift+wheel pans the row; otherwise vertical scroll passes
// through to the page. Touch is left untouched (native momentum applies).
const useHScroll = () => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (horizontalIntent) return
      if (!e.shiftKey) return
      const max = el.scrollWidth - el.clientWidth
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft >= max && e.deltaY > 0
      if (atStart || atEnd) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    let dragging = false
    let startX = 0
    let startLeft = 0
    let moved = false

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      dragging = true
      moved = false
      startX = e.clientX
      startLeft = el.scrollLeft
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > 4) {
        moved = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {}
        el.style.cursor = 'grabbing'
        el.style.userSelect = 'none'
      }
      if (moved) {
        e.preventDefault()
        el.scrollLeft = startLeft - dx
      }
    }
    const finish = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      } catch {}
      el.style.cursor = ''
      el.style.userSelect = ''
      if (moved) {
        const stop = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        el.addEventListener('click', stop, { capture: true, once: true })
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
    }
  }, [])
  return ref
}

const HScroll = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => {
  const ref = useHScroll()
  return (
    <div
      ref={ref}
      // overflow-y-hidden pins the implicit auto-overflow the spec gives
      // overflow-y when overflow-x isn't `visible` — without it every row
      // becomes a hair-thin vertical scroll container that can steal drags.
      className={`flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar cursor-grab touch-pan-x ${className}`}
    >
      {children}
    </div>
  )
}

// 225×127 tile shell — every Account Snapshot card shares this exact size
// and background. `onClick` swaps in a <button> so the tile becomes
// keyboard/click accessible without changing its appearance.
const AcctTile = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) => {
  const baseStyle: React.CSSProperties = {
    width: 225,
    height: 127,
    borderRadius: 12,
    background: 'rgba(129,129,129,0.2)',
    border: '0.5px solid rgba(129,129,129,0.2)',
  }
  if (!onClick) {
    return (
      <div className="shrink-0 relative overflow-hidden" style={baseStyle}>
        {children}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 relative overflow-hidden text-left transition active:scale-[0.985]"
      style={{ ...baseStyle, cursor: 'pointer', padding: 0 }}
    >
      {children}
    </button>
  )
}

// Card.Header — label + optional trailing icon/logo, 12px inset from the
// tile edges, sits at the top of every tile.
const AcctHeader = ({ label, trailing }: { label: string; trailing?: React.ReactNode }) => (
  <div className="absolute" style={{ left: 12, top: 12, right: 12, height: 32 }}>
    <p
      className="absolute text-white"
      style={{ left: 0, top: 8, fontSize: 12, lineHeight: '16px', fontWeight: 500, margin: 0 }}
    >
      {label}
    </p>
    {trailing && (
      <div className="absolute" style={{ right: 0, top: 0 }}>
        {trailing}
      </div>
    )}
  </div>
)

// Card.Footer — big amount + small subtitle, anchored to the bottom 48px
// of the tile (12px bottom inset).
const AcctFooter = ({ amount, sub, subColor }: { amount: string; sub: string; subColor?: string }) => (
  <div className="absolute" style={{ left: 12, top: 67, right: 12, height: 48 }}>
    <p
      className="absolute font-display text-white"
      style={{
        left: 0,
        top: 0,
        fontSize: 20,
        lineHeight: '32px',
        letterSpacing: '-1px',
        fontWeight: 900,
        margin: 0,
      }}
    >
      {amount}
    </p>
    <p
      className="absolute"
      style={{
        left: 0,
        top: 32,
        fontSize: 12,
        lineHeight: '16px',
        color: subColor ?? 'rgba(255,255,255,0.72)',
        margin: 0,
      }}
    >
      {sub}
    </p>
  </div>
)

export const AccountSnapshot = ({
  onOpenCrypto,
  onAddAccount,
}: {
  /** Called when the Crypto tile is tapped. No-op if omitted. */
  onOpenCrypto?: () => void
  /** Called when the "Add more" plus button is tapped. No-op if omitted. */
  onAddAccount?: () => void
}) => {
  return (
    <div id="account" className="px-4 mt-4">
      <HScroll className="-mx-4 px-4 pb-1">
        {/* PayPal balance */}
        <AcctTile>
          <AcctHeader
            label="PayPal balance"
            trailing={
              <div
                className="overflow-hidden"
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: 4,
                  border: '0.5px solid rgba(204,204,204,0.28)',
                  background: 'rgba(129,129,129,0.2)',
                }}
              >
                <img src={`${IMAGE_BASE}/card-debit.png`} alt="" className="w-full h-full object-cover" />
              </div>
            }
          />
          <AcctFooter amount="$125.56" sub="Available balance" />
        </AcctTile>

        {/* Pay Later */}
        <AcctTile>
          <AcctHeader
            label="Pay Later"
            trailing={
              <div
                className="flex items-center justify-center"
                style={{ width: 33, height: 33, borderRadius: 8, background: 'rgba(129,129,129,0.2)' }}
              >
                <img src={`${IMAGE_BASE}/icon-calendar.svg`} alt="" style={{ width: 16, height: 16 }} />
              </div>
            }
          />
          <AcctFooter amount="$1,500.00" sub="Spending Power" subColor="#73e6ab" />
        </AcctTile>

        {/* PayPal+ */}
        <AcctTile>
          <AcctHeader
            label="PayPal+"
            trailing={
              <div
                className="flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 8, background: '#fff' }}
              >
                <img src={`${IMAGE_BASE}/paypal-monogram.svg`} alt="" style={{ width: 22, height: 22 }} />
              </div>
            }
          />
          <AcctFooter amount="10,380 points" sub="Available to use" />
        </AcctTile>

        {/* PayPal credit card */}
        <AcctTile>
          <AcctHeader
            label="PayPal credit card"
            trailing={
              <div
                className="overflow-hidden"
                style={{ width: 48, height: 32, borderRadius: 4, border: '0.4px solid rgba(204,204,204,0.28)' }}
              >
                <img src={`${IMAGE_BASE}/card-credit.png`} alt="" className="w-full h-full object-cover" />
              </div>
            }
          />
          <AcctFooter amount="$245.72" sub="Payment due Mar, 30" />
        </AcctTile>

        {/* Crypto — opens the Crypto overview page in the source app */}
        <AcctTile onClick={onOpenCrypto}>
          <AcctHeader
            label="Crypto"
            trailing={
              <div
                className="flex items-center justify-center"
                style={{ width: 33, height: 33, borderRadius: 8, background: 'rgba(129,129,129,0.2)' }}
              >
                <img src={`${IMAGE_BASE}/icon-crypto-snap.svg`} alt="" style={{ width: 16, height: 16 }} />
              </div>
            }
          />
          {/* Custom footer with a "% up" pill instead of a plain subtitle,
              same 12px insets as AcctFooter. */}
          <div className="absolute" style={{ left: 12, top: 67, right: 12, height: 48 }}>
            <p
              className="absolute font-display text-white"
              style={{
                left: 0,
                top: 0,
                fontSize: 20,
                lineHeight: '32px',
                letterSpacing: '-1px',
                fontWeight: 900,
                margin: 0,
              }}
            >
              $388.32
            </p>
            <p
              className="absolute"
              style={{ left: 0, top: 32, fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)', margin: 0 }}
            >
              Available balance
            </p>
            <div
              className="absolute flex items-center justify-center"
              style={{ right: 0, top: 24, width: 63, height: 24, borderRadius: 999, background: 'rgba(0,82,67,0.25)' }}
            >
              <span style={{ fontSize: 12, color: '#73e6ab', fontWeight: 500, lineHeight: '16px' }}>↑ 3.56%</span>
            </div>
          </div>
        </AcctTile>

        {/* Banks and cards — dashed-border "add account" tile */}
        <div
          className="shrink-0 relative overflow-hidden"
          style={{
            width: 225,
            height: 127,
            borderRadius: 12,
            background: 'rgba(129,129,129,0.2)',
            border: '1px dashed rgba(204,204,204,0.28)',
          }}
        >
          <div className="absolute" style={{ left: 11, top: 11, right: 11, height: 32 }}>
            <p
              className="absolute text-white"
              style={{ left: 0, top: 8, fontSize: 12, lineHeight: '16px', fontWeight: 500, margin: 0 }}
            >
              Banks and cards
            </p>
            <div className="absolute" style={{ right: 0, top: 0, width: 56, height: 32 }}>
              <div
                className="absolute flex items-center justify-center"
                style={{ left: 0, top: 0, width: 32, height: 32, borderRadius: 999, background: 'rgba(204,204,204,0.28)' }}
              >
                <img src={`${IMAGE_BASE}/icon-bank.svg`} alt="" style={{ width: 16, height: 16 }} />
              </div>
              <div
                className="absolute flex items-center justify-center"
                style={{ left: 24, top: 0, width: 32, height: 32, borderRadius: 999, background: 'rgba(204,204,204,0.28)' }}
              >
                <img src={`${IMAGE_BASE}/icon-card.svg`} alt="" style={{ width: 16, height: 16 }} />
              </div>
            </div>
          </div>
          <div className="absolute" style={{ left: 11, top: 81, right: 11, height: 33 }}>
            <p
              className="absolute text-white"
              style={{ left: 0, top: 17, fontSize: 12, lineHeight: '16px', fontWeight: 400, margin: 0 }}
            >
              Add more
            </p>
            <button
              type="button"
              onClick={onAddAccount}
              className="absolute flex items-center justify-center"
              style={{
                right: 0,
                top: 0,
                width: 33,
                height: 33,
                borderRadius: 999,
                background: 'rgba(204,204,204,0.28)',
                border: '1px solid rgba(129,129,129,0.2)',
              }}
            >
              <img src={`${IMAGE_BASE}/icon-plus.svg`} alt="Add" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </HScroll>
    </div>
  )
}
