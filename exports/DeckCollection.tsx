// ---------------------------------------------------------------------------
// Deck Collection — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (DeckCarousel, aliased
// HeroCarousel there). This file has no dependency on the rest of that app —
// drop it into another React + Tailwind project as-is.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. Fonts — the card header uses `font-display` (PayPal Pro Black, weight
//    900) and body text uses `font-text` (Plain). If the target project
//    doesn't already define these Tailwind classes, either:
//      a) register equivalent @font-face rules and map them to these class
//         names, or
//      b) delete `font-display`/`font-text` from the className props below
//         and let the fontFamily/fontWeight fall back to your project's
//         default stack. Sizing (fontSize/lineHeight/letterSpacing) was
//         tuned against PayPal Pro / Plain's metrics, so other fonts may
//         need minor adjustment.
//
// 2. Images — copy these 9 files from oslo-home-prototype/public/images/
//    into the target project's public dir (paths below assume they land at
//    the same /images/... path; update IMAGE_BASE if you place them
//    elsewhere):
//      deck-img-nike.png     deck-brand-nike.png
//      deck-img-apple.png    deck-brand-apple.png
//      deck-img-sony.png     deck-brand-sony.png
//
// 3. Shop button — the original wires this to an in-app "open browser"
//    sheet via a shared nav context. That's stripped out here in favor of
//    a plain `onShop?: (cardId: string) => void` prop on <DeckCollection />
//    — wire it to whatever your target app needs (open a URL, open a
//    modal, no-op, etc).
//
// 4. Tailwind utility classes used (relative, absolute, overflow-hidden,
//    flex, items-center, justify-center, text-center, text-white,
//    transition-transform, active:scale-[0.96]) are all stock Tailwind —
//    no custom config required beyond the two font classes above.
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'

const IMAGE_BASE = '/images'

// ----- Data -----------------------------------------------------------

type DeckCard = {
  id: string
  baseColor: string
  gradient: string
  productImage: string
  productStyleFront: CSSProperties
  productStyleBack: CSSProperties
  titleLine1: string
  titleLine2?: string
  badgeLabel: string
  brandName: string
  brandLogo: string
  brandLogoBg?: string
}

const DECK_CARDS: DeckCard[] = [
  {
    id: 'nike',
    baseColor: 'rgb(15, 19, 33)',
    gradient:
      'radial-gradient(ellipse 262.5% 180% at 12% -20%, rgba(146,52,28,1) 28%, rgba(112,13,13,0.29) 86%)',
    productImage: `${IMAGE_BASE}/deck-img-nike.png`,
    productStyleFront: { height: '34.67%', left: '8.75%', top: '39.84%', width: '82.39%' },
    productStyleBack: { height: '34.67%', left: '8.75%', top: '42%', width: '82.39%' },
    titleLine1: 'New season,',
    titleLine2: 'new energy',
    badgeLabel: '5% off',
    brandName: 'Nike',
    brandLogo: `${IMAGE_BASE}/deck-brand-nike.png`,
    brandLogoBg: '#000',
  },
  {
    id: 'apple',
    baseColor: 'rgb(1, 10, 19)',
    gradient:
      'radial-gradient(ellipse 262.5% 180% at 12% -20%, rgba(157,157,157,0.4) 32%, rgba(128,128,128,0.329) 49%, rgba(99,99,99,0.258) 66%, rgba(70,70,70,0.187) 83%, rgba(41,41,41,0.116) 100%)',
    productImage: `${IMAGE_BASE}/deck-img-apple.png`,
    productStyleFront: { height: '62%', left: '5%', top: '30%', width: '90%' },
    productStyleBack: { height: '62.76%', left: '-8%', top: '37.02%', width: '59.27%' },
    titleLine1: 'Find your',
    titleLine2: 'sound',
    badgeLabel: '5% off',
    brandName: 'Apple',
    brandLogo: `${IMAGE_BASE}/deck-brand-apple.png`,
    brandLogoBg: '#fff',
  },
  {
    id: 'sony',
    baseColor: 'rgb(31, 31, 55)',
    gradient:
      'radial-gradient(ellipse 262.5% 180% at 12% -20%, rgba(200,70,49,1) 0%, rgba(150,53,37,0.75) 15%, rgba(100,35,25,0.5) 30%, rgba(50,18,12,0.25) 46%, rgba(0,0,0,0) 61%)',
    productImage: `${IMAGE_BASE}/deck-img-sony.png`,
    productStyleFront: { height: '52%', left: '14%', top: '36%', width: '72%' },
    productStyleBack: { height: '61.98%', left: '24.76%', top: '24.12%', width: '50.96%' },
    titleLine1: 'Hear the sound',
    titleLine2: 'of silence',
    badgeLabel: '5% off',
    brandName: 'Sony',
    brandLogo: `${IMAGE_BASE}/deck-brand-sony.png`,
    brandLogoBg: '#000',
  },
]

// Slot geometry keyed by offset-from-front (range -1..+1). Card centres
// are expressed relative to the centre of the front card, which itself
// sits centred horizontally within the 370px container.
type DeckSlotGeom = {
  x: number
  y: number
  w: number
  h: number
  rotate: number
  z: number
  isFront: boolean
  scaleFooter: number // 1 = native; back cards scale their footer + header to match the smaller card.
}
const DECK_SLOT_GEOM: Record<number, DeckSlotGeom> = {
  [-1]: { x: -28, y: 56, w: 280, h: 374, rotate: -8, z: 1, isFront: false, scaleFooter: 280 / 320 },
  [0]: { x: 0, y: 0, w: 320, h: 427, rotate: 0, z: 3, isFront: true, scaleFooter: 1 },
  [1]: { x: 28, y: 56, w: 280, h: 374, rotate: 8, z: 1, isFront: false, scaleFooter: 280 / 320 },
}

// ----- Presentational card -----------------------------------------------

// One card rendered into a slot. Pure presentation; the parent
// component owns the slot/offset state and drag handling.
const DeckCardView = ({
  card,
  slot,
  scaleHeader,
  onShop,
}: {
  card: DeckCard
  slot: DeckSlotGeom
  scaleHeader: number
  onShop?: (cardId: string) => void
}) => {
  const fs = scaleHeader
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: slot.w,
        height: slot.h,
        borderRadius: slot.isFront ? 24 : 21,
        border: '0.5px solid rgba(204,204,204,0.28)',
        background: card.baseColor,
        boxShadow: slot.isFront
          ? '0 32px 32px -4px rgba(0,0,0,0.25)'
          : '0 28px 28px -3.5px rgba(0,0,0,0.25)',
      }}
    >
      {/* Radial gradient overlay — sits above the base colour. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: card.gradient }}
      />
      {/* Product image — different position per slot. Front cards use
          the centred FRONT style; back cards use the BACK style which
          crops/offsets the product for the smaller fan position. */}
      <img
        src={card.productImage}
        alt=""
        aria-hidden
        className="absolute max-w-none pointer-events-none"
        style={{
          objectFit: 'contain',
          ...(slot.isFront ? card.productStyleFront : card.productStyleBack),
        }}
      />
      {/* Header — title + badge */}
      <div
        className="absolute"
        style={{
          left: 15.5 * scaleHeader,
          top: 15.5 * scaleHeader,
          width: 288 * scaleHeader,
          height: 108 * scaleHeader,
        }}
      >
        <h3
          className="absolute text-center text-white font-display"
          style={{
            left: '50%',
            top: 4 * scaleHeader,
            width: 280 * scaleHeader,
            transform: 'translateX(-50%)',
            fontSize: 32 * fs,
            lineHeight: `${32 * fs}px`,
            fontWeight: 900,
            letterSpacing: `${-1 * fs}px`,
            margin: 0,
          }}
        >
          {card.titleLine1}
          {card.titleLine2 && (
            <>
              <br />
              {card.titleLine2}
            </>
          )}
        </h3>
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: '50%',
            top: 80 * scaleHeader,
            transform: 'translateX(-50%)',
            paddingLeft: 8 * scaleHeader,
            paddingRight: 8 * scaleHeader,
            height: 24 * scaleHeader,
            background: '#002991',
            borderRadius: 4 * scaleHeader,
          }}
        >
          <span
            className="font-text"
            style={{
              fontSize: 12 * fs,
              lineHeight: `${16 * fs}px`,
              color: '#60cdff',
              fontWeight: 500,
            }}
          >
            {card.badgeLabel}
          </span>
        </div>
      </div>
      {/* Footer — brand avatar + name + Pay Later + Shop button */}
      <div
        className="absolute"
        style={{
          left: 15.5 * scaleHeader,
          top: (slot.isFront ? 366.5 : 320.9) * scaleHeader,
          width: 288 * scaleHeader,
          height: 44 * scaleHeader,
        }}
      >
        <div
          className="absolute overflow-hidden"
          style={{
            left: 0,
            top: 2 * scaleHeader,
            width: 40 * scaleHeader,
            height: 40 * scaleHeader,
            background: card.brandLogoBg ?? '#000',
            borderRadius: 999,
            border: '1px solid rgba(204,204,204,0.28)',
          }}
        >
          <img
            src={card.brandLogo}
            alt={card.brandName}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        </div>
        <div
          className="absolute"
          style={{
            left: 52 * scaleHeader,
            top: 0,
            width: 157 * scaleHeader,
            height: 44 * scaleHeader,
          }}
        >
          <p
            className="absolute font-text text-white"
            style={{
              left: 0,
              top: 0,
              fontSize: 16 * fs,
              lineHeight: `${24 * fs}px`,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {card.brandName}
          </p>
          <p
            className="absolute font-text"
            style={{
              left: 0,
              top: 24 * scaleHeader,
              fontSize: 14 * fs,
              lineHeight: `${20 * fs}px`,
              color: 'rgba(255,255,255,0.72)',
              margin: 0,
            }}
          >
            Pay Later
          </p>
        </div>
        <button
          type="button"
          className="absolute flex items-center justify-center transition-transform active:scale-[0.96]"
          style={{
            left: 221 * scaleHeader,
            top: 2 * scaleHeader,
            width: 67 * scaleHeader,
            height: 40 * scaleHeader,
            background: 'rgba(204,204,204,0.28)',
            border: '1px solid rgba(129,129,129,0.2)',
            borderRadius: 24,
            // Only the front-most deck card's Shop is interactive — the
            // back cards are decorative and have pointer-events:none on
            // their parent already, but we still guard here.
            cursor: slot.isFront ? 'pointer' : 'default',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            if (slot.isFront) onShop?.(card.id)
          }}
          aria-label={`Shop ${card.brandName}`}
        >
          <span
            className="font-text text-white"
            style={{ fontSize: 14 * fs, lineHeight: `${20 * fs}px`, fontWeight: 500 }}
          >
            Shop
          </span>
        </button>
      </div>
    </div>
  )
}

// ----- Carousel -------------------------------------------------------

// 3-card stack with the front card centred, two back cards fanned out
// behind at ±8°. Horizontal drag (or tap a pagination dot) swaps the
// deck — each tile keeps its identity and animates between slot
// positions.
export const DeckCollection = ({
  onShop,
}: {
  /** Called when the Shop button on the front card is tapped. */
  onShop?: (cardId: string) => void
}) => {
  const [active, setActive] = useState(0)
  const prevActiveRef = useRef(active)
  // While a tile is wrapping (jumping >1 slot) we render it briefly at
  // the new position with opacity 0 so the snap is invisible.
  const [wrapping, setWrapping] = useState<Set<number>>(new Set())
  const N = DECK_CARDS.length

  // Shortest-path offset for tile `i` relative to current `a`. For N=3
  // valid offsets are {−1, 0, +1}.
  const offsetFor = (i: number, a: number) => {
    let d = i - a
    if (d > N / 2) d -= N
    if (d < -N / 2) d += N
    return d
  }

  useEffect(() => {
    if (prevActiveRef.current === active) return
    const next = new Set<number>()
    DECK_CARDS.forEach((_, i) => {
      const prevOff = offsetFor(i, prevActiveRef.current)
      const newOff = offsetFor(i, active)
      if (Math.abs(newOff - prevOff) > 1) next.add(i)
    })
    if (next.size) {
      setWrapping(next)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWrapping(new Set()))
      })
    }
    prevActiveRef.current = active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // --- Motion design for drag / hold / release ---------------------
  //
  // 1. DRAG — the front card follows the finger 1:1. Back cards move
  //    at ~14% of the drag (parallax). Beyond a commit threshold the
  //    motion rubber-bands so the card resists rather than running
  //    off-screen — same easing iOS uses on overscroll.
  // 2. HOLD — on pointer-down the front card lifts: a subtle scale-up
  //    plus an enhanced drop shadow. While the finger is down it stays
  //    "picked up." A tiny tilt in the direction of motion adds extra
  //    weight as you swipe.
  // 3. RELEASE — the gesture commits if EITHER the drag distance OR
  //    the release velocity exceeds threshold. So a quick flick works
  //    even if you barely moved the card; a slow drag still commits if
  //    you pulled far enough. Otherwise the card springs back home.
  const COMMIT_PX = 64           // drag distance that triggers commit
  const FLICK_VELOCITY = 0.5     // px/ms — fast flick still commits
  const MAX_RUBBER_BAND = 140    // px — visible drag past commit
  const PRESS_SCALE = 1.025      // front-card lift on pointer down
  const PARALLAX_BACK = 0.14     // back cards' share of the drag
  const TILT_PER_100PX = 4       // degrees of tilt per 100 px drag

  const [dragX, setDragX] = useState(0)
  const [pressed, setPressed] = useState(false)
  // During an active drag we kill the card transitions so the card
  // tracks the finger without lag. On release we turn transitions back
  // on so the spring-back / commit animates with the spring easing.
  const [transitioning, setTransitioning] = useState(true)

  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    active: false,
    locked: 'none' as 'none' | 'horizontal' | 'vertical',
    // Live, rubber-banded drag value — read in onPointerEnd because the
    // React state setter is async / closure-captured.
    currentDx: 0,
  })

  // iOS-style rubber band — 1:1 within the commit window, then a
  // diminishing return curve so the card "fights back" the further
  // you pull. MAX_RUBBER_BAND is the asymptote the resistance approaches.
  const rubberBand = (x: number) => {
    const absX = Math.abs(x)
    if (absX <= COMMIT_PX) return x
    const overshoot = absX - COMMIT_PX
    const span = MAX_RUBBER_BAND - COMMIT_PX
    const resisted = overshoot / (1 + overshoot / span)
    return Math.sign(x) * (COMMIT_PX + resisted)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastTime: performance.now(),
      velocity: 0,
      active: true,
      locked: 'none',
      currentDx: 0,
    }
    setPressed(true)
    setTransitioning(false)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragRef.current
    if (!s.active) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY

    // Decide axis once the user has moved enough to declare intent.
    // Horizontal → drive the deck. Vertical → let the page scroll.
    if (s.locked === 'none') {
      // Bias toward 'horizontal' so a natural diagonal wobble at the start
      // of a swipe doesn't prematurely kill the deck drag.
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        s.locked = Math.abs(dy) > Math.abs(dx) * 1.5 ? 'vertical' : 'horizontal'
      }
    }
    if (s.locked === 'vertical') {
      s.active = false
      setPressed(false)
      setTransitioning(true)
      setDragX(0)
      s.currentDx = 0
      return
    }
    if (s.locked !== 'horizontal') return

    // Velocity sample for the release decision.
    const now = performance.now()
    const dt = Math.max(1, now - s.lastTime)
    s.velocity = (e.clientX - s.lastX) / dt
    s.lastX = e.clientX
    s.lastTime = now

    const next = rubberBand(dx)
    s.currentDx = next
    setDragX(next)
  }

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = dragRef.current
    const wasActive = s.active
    s.active = false
    setPressed(false)
    setTransitioning(true)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
    if (!wasActive) {
      setDragX(0)
      return
    }
    const dx = s.currentDx
    const v = s.velocity
    const commitByDistance = Math.abs(dx) >= COMMIT_PX
    const commitByFlick =
      Math.abs(v) >= FLICK_VELOCITY && (Math.sign(v) === Math.sign(dx) || dx === 0)
    if (commitByDistance || commitByFlick) {
      // Drag/flick LEFT advances; RIGHT goes back. Use velocity when
      // dx is tiny (a pure flick with no drag) so direction stays right.
      const dir = (dx === 0 ? -Math.sign(v) : dx < 0 ? 1 : -1) as -1 | 1
      setActive((prev) => (prev + dir + N) % N)
    }
    // In either branch dragX returns to 0; CSS transition on the card
    // transform handles the spring-back / settle-into-new-slot motion.
    setDragX(0)
    s.currentDx = 0
  }

  return (
    <div className="mx-auto relative" style={{ width: 370, height: 497 }}>
      {/* Drag surface covers the whole card stack. Cards themselves
          are pointer-events:none so taps fall through to this surface
          (except the Shop button which stops propagation). */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: 370,
          height: 445,
          touchAction: 'pan-y',
          cursor: 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Card layer — each card animates between slot positions. */}
        <div className="relative w-full h-full">
          {DECK_CARDS.map((card, i) => {
            const off = offsetFor(i, active)
            const slot = DECK_SLOT_GEOM[off]
            if (!slot) return null
            const isWrapping = wrapping.has(i)
            const isFront = slot.isFront
            // Front card tracks the finger 1:1; back cards travel at
            // PARALLAX_BACK (~14%) so depth reads naturally.
            const liveDx = isFront ? dragX : dragX * PARALLAX_BACK
            // Subtle tilt in the direction of travel — adds weight to
            // the front card without disturbing the fan rotation of
            // the back cards (back rotation stays at the slot's fixed
            // ±8°).
            const liveRot = slot.rotate + (isFront ? (dragX / 100) * TILT_PER_100PX : 0)
            // Press scale only lifts the FRONT card. Back cards are
            // untouched so the depth hierarchy reads cleanly.
            const pressScale = pressed && isFront ? PRESS_SCALE : 1
            // Spring eases. Pull/release on the FRONT card uses an
            // elastic curve with a touch of overshoot; back cards
            // travel with the slower fan-swap easing they already
            // had. While dragging or wrapping, transitions are off
            // so the card tracks the finger pixel-for-pixel.
            const transition =
              isWrapping || !transitioning
                ? 'none'
                : isFront
                ? 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease, filter 220ms ease, box-shadow 220ms ease'
                : 'transform 480ms cubic-bezier(0.22, 0.85, 0.25, 1), width 440ms cubic-bezier(0.22, 0.85, 0.25, 1), height 440ms cubic-bezier(0.22, 0.85, 0.25, 1), opacity 240ms ease'
            return (
              <div
                key={card.id}
                className="absolute"
                style={{
                  left: '50%',
                  top: 0,
                  width: slot.w,
                  height: slot.h,
                  // Order matters: translate (slot + live drag) →
                  // rotate (slot + tilt) → scale (press lift). That
                  // keeps the press lift symmetric around the card's
                  // visible centre, even while it's translated and
                  // tilted by the drag.
                  transform: `translate(calc(-50% + ${slot.x + liveDx}px), ${slot.y}px) rotate(${liveRot}deg) scale(${pressScale})`,
                  transformOrigin: 'center center',
                  transition,
                  opacity: isWrapping ? 0 : 1,
                  zIndex: slot.z,
                  willChange: 'transform, opacity, filter',
                  // Pressed-state drop shadow lifts the front card
                  // off the back of the deck without disturbing its
                  // overflow-hidden clip (filter: drop-shadow respects
                  // the rounded corner mask; box-shadow would clip).
                  filter:
                    pressed && isFront
                      ? 'drop-shadow(0 20px 32px rgba(0,0,0,0.36))'
                      : undefined,
                  pointerEvents: isFront ? 'auto' : 'none',
                }}
              >
                <DeckCardView
                  card={card}
                  slot={slot}
                  scaleHeader={slot.scaleFooter}
                  onShop={onShop}
                />
              </div>
            )
          })}
        </div>
      </div>
      {/* Pagination — 3 dots, centred horizontally below the stack. */}
      <div
        className="absolute flex"
        style={{ left: '50%', top: 461, gap: 8, transform: 'translateX(-50%)' }}
        // Don't let dot taps trigger the drag surface above.
        onPointerDown={(e) => e.stopPropagation()}
      >
        {DECK_CARDS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className="transition-colors"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: i === active ? '#fff' : '#808080',
              padding: 0,
            }}
            aria-label={`Show card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
