// ---------------------------------------------------------------------------
// Fanned Collection — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (StreamCards, rendered under
// the "Stream more. Pay less." heading — Figma node Card.Collection.Fanned,
// 15:1666). This file has no dependency on the rest of that app — drop it
// into another React + Tailwind project as-is.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. Fonts — the title uses `font-display` (PayPal Pro Black, weight 900)
//    and tile labels use `font-text` (Plain). If the target project doesn't
//    already define these Tailwind classes, either:
//      a) register equivalent @font-face rules and map them to these class
//         names, or
//      b) delete `font-display`/`font-text` from the className props below
//         and let the fontFamily/fontWeight fall back to your project's
//         default stack.
//
// 2. Color — the blue half of the title uses the `text-link` Tailwind class,
//    which in the source project is a custom color defined in
//    tailwind.config.ts: `colors.link = '#60cdff'`. Either add that to the
//    target project's Tailwind config, or replace `text-link` below with an
//    inline `style={{ color: '#60cdff' }}`.
//
// 3. Images — copy these 5 files from oslo-home-prototype/public/images/
//    into the target project's public dir (paths below assume they land at
//    the same /images/... path; update IMAGE_BASE if you place them
//    elsewhere). Despite the generic filenames, the brand mapping was
//    verified visually — don't reorder without re-checking the art:
//      stream-1.png       → Sling
//      stream-3.png       → Disney+
//      stream-netflix.png → Netflix
//      stream-2.png       → Spotify
//      stream-4.png       → Hulu
//
// 4. No nav/callback dependency — unlike Deck Collection, this component has
//    no interactive buttons beyond the drag surface and pagination dots, so
//    there's nothing else to wire up.
//
// 5. Tailwind utility classes used (relative, absolute, overflow-hidden,
//    flex, items-start, justify-between, touch-pan-y, select-none) are all
//    stock Tailwind — no custom config required beyond font-display/
//    font-text/text-link above.
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react'
import type { ReactElement } from 'react'

const IMAGE_BASE = '/images'

// ----- Title ------------------------------------------------------------

// Minimal stand-in for the source project's generic SectionTitle — trimmed
// to just the two props this component actually uses (a white line and a
// blue line, stacked).
const FannedTitle = ({ white, blue }: { white: string; blue: string }) => (
  <div className="flex items-start justify-between gap-3 mb-3">
    <h2
      className="text-[24px] font-black font-display"
      style={{ lineHeight: '28px', letterSpacing: '-1px', margin: 0 }}
    >
      <span className="text-white">{white}</span>
      <br />
      <span className="text-link">{blue}</span>
    </h2>
  </div>
)

// ----- Data ---------------------------------------------------------------

// Five black 2:3 tiles arranged in a fan, each with a circular
// streaming-service logo. Front tile: 175×271, rotation 0. 2nd ring
// (±8°): 167.7×256. 3rd ring (±16°): 157.9×241.
type StreamTileData = { src: string; name: string; back: string }
const STREAM_TILES: StreamTileData[] = [
  { src: `${IMAGE_BASE}/stream-1.png`, name: 'Sling', back: '5% back' },
  { src: `${IMAGE_BASE}/stream-3.png`, name: 'Disney+', back: '2% back' },
  { src: `${IMAGE_BASE}/stream-netflix.png`, name: 'Netflix', back: '3% back' },
  { src: `${IMAGE_BASE}/stream-2.png`, name: 'Spotify', back: '4% back' },
  { src: `${IMAGE_BASE}/stream-4.png`, name: 'Hulu', back: '3% back' },
]

// Slot geometry keyed by offset-from-front (range -2..+2). Each slot's
// translate (x,y) puts the tile center at the appropriate fan position.
// -3 and +3 are off-screen positions used only during wrap transitions so
// a back-row tile can slide off one side while a duplicate slides in from
// the opposite side — they're further out + more rotated than -2/+2 so
// they stay clipped by the section's overflow:hidden.
type SlotGeom = {
  x: number
  y: number
  w: number
  h: number
  rotate: number
  z: number
  isFront: boolean
  shadow?: 'mid' | 'strong'
}
const SLOT_GEOM: Record<number, SlotGeom> = {
  [-3]: { x: -260, y: 24, w: 148, h: 226, rotate: -24, z: 0, isFront: false },
  [-2]: { x: -161.17, y: 9.55, w: 157.868, h: 241.083, rotate: -16, z: 1, isFront: false },
  [-1]: { x: -79.38, y: -8.83, w: 167.742, h: 256.029, rotate: -8, z: 2, isFront: false, shadow: 'mid' },
  [0]: { x: 0.5, y: -9.2, w: 175, h: 271, rotate: 0, z: 4, isFront: true, shadow: 'strong' },
  [1]: { x: 79.17, y: -8.83, w: 167.742, h: 256.029, rotate: 8, z: 2, isFront: false, shadow: 'mid' },
  [2]: { x: 161.16, y: 9.42, w: 157.973, h: 241.106, rotate: 16, z: 1, isFront: false },
  [3]: { x: 260, y: 24, w: 148, h: 226, rotate: 24, z: 0, isFront: false },
}

// Wrap state per tile: which way it wraps (its OLD slot was on the left or
// right side) and whether we're still in the pre-paint snap frame or have
// kicked off the off-screen slide-in / slide-out transitions.
type WrapEntry = { dir: 'left' | 'right'; phase: 'snap' | 'fly' }

// ----- Carousel -------------------------------------------------------

// Properly animated fan carousel: each tile keeps its identity and
// animates between fan slots as `active` changes. Drag the deck
// horizontally — the front tile slides into the back-left/right position
// while the next tile rotates forward to become the new front. A
// wrap-around tile fades through its transition to avoid a visible
// cross-screen jump.
export const FannedCollection = () => {
  const [active, setActive] = useState(2) // tile in the front position
  const prevActiveRef = useRef(active)
  // Tiles mid-wrap: rendered as a "ghost" sliding off-screen the old side
  // and a "main" sliding in from the opposite off-screen side, so neither
  // back slot is ever empty during the transition.
  const [wrapMap, setWrapMap] = useState<Map<number, WrapEntry>>(new Map())
  const N = STREAM_TILES.length

  // Find a tile's signed offset from the active position, taking the
  // shortest path around the ring so transitions don't cross the whole
  // carousel.
  const offsetFor = (i: number, a: number) => {
    let d = i - a
    if (d > N / 2) d -= N
    if (d < -N / 2) d += N
    return d
  }

  // When active changes, detect tiles whose offset jumped by more than 2
  // slots (i.e. they wrapped around the ring). For each, set up a dual
  // render: a "ghost" copy stays at the OLD slot then slides off-screen
  // the same side, while the "main" copy snaps off-screen the OPPOSITE
  // side and slides in to its new slot. Slot ±3 is the off-screen target.
  //
  // Phase 'snap' is the pre-paint frame where the main copy is positioned
  // at its off-screen start (transition disabled). Phase 'fly' is set on
  // the next two RAFs to trigger CSS transitions for both copies.
  useEffect(() => {
    if (prevActiveRef.current === active) return
    const newWraps = new Map<number, WrapEntry>()
    STREAM_TILES.forEach((_, i) => {
      const prevOff = offsetFor(i, prevActiveRef.current)
      const newOff = offsetFor(i, active)
      if (Math.abs(newOff - prevOff) > 2) {
        const dir: 'left' | 'right' = prevOff < 0 ? 'right' : 'left'
        newWraps.set(i, { dir, phase: 'snap' })
      }
    })
    prevActiveRef.current = active
    if (!newWraps.size) return
    setWrapMap(newWraps)
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setWrapMap((prev) => {
          const next = new Map<number, WrapEntry>()
          prev.forEach((v, k) => next.set(k, { ...v, phase: 'fly' }))
          return next
        })
      })
    })
    const cleanup = window.setTimeout(() => setWrapMap(new Map()), 480)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(cleanup)
    }
  }, [active])

  // --- Motion: live-tracking drag (mirrors the Deck Collection) -----
  //
  // Front tile tracks the finger live, back tiles parallax subtly,
  // release commits on EITHER distance or velocity threshold.
  const COMMIT_PX = 56
  const FLICK_VELOCITY = 0.5 // px/ms — fast flick still commits
  const MAX_RUBBER_BAND = 120 // px — visible drag past commit
  const PRESS_SCALE = 1.02 // front-tile lift on press
  const PARALLAX_BACK = 0.22 // back tiles' share of the drag
  const TILT_PER_100PX = 2 // degrees of additional front tilt
  // Unified release spring for every tile. Five tiles re-balancing
  // simultaneously must arrive together, so they share one curve and
  // one duration. Includes width/height/box-shadow so a back tile that
  // becomes the front (or vice versa) grows/shrinks SMOOTHLY in sync
  // with its translate. The curve is damped (no overshoot) so the five
  // tiles don't visually compete. `filter` runs on its own snappier
  // 220ms because the press-lift drop shadow is a property of the
  // foreground tile only and should feel responsive, not springy.
  const RELEASE_SPRING =
    'transform 460ms cubic-bezier(0.22, 0.85, 0.25, 1), width 460ms cubic-bezier(0.22, 0.85, 0.25, 1), height 460ms cubic-bezier(0.22, 0.85, 0.25, 1), box-shadow 460ms cubic-bezier(0.22, 0.85, 0.25, 1), opacity 320ms ease, filter 220ms ease'

  const [dragX, setDragX] = useState(0)
  const [pressed, setPressed] = useState(false)
  // While the user is actively dragging we turn transitions OFF so the
  // front tile tracks the finger pixel-for-pixel. On release we turn
  // them back ON so the spring-back / commit animates smoothly.
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
    currentDx: 0,
  })

  // iOS-style rubber band — 1:1 within commit window, then resisted.
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

    if (s.locked === 'none') {
      // Bias toward 'horizontal' so a natural diagonal wobble at the start
      // of a swipe doesn't prematurely kill the drag (see Deck Collection).
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
      const dir = (dx === 0 ? -Math.sign(v) : dx < 0 ? 1 : -1) as -1 | 1
      setActive((prev) => (prev + dir + N) % N)
    }
    setDragX(0)
    s.currentDx = 0
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        margin: '0 auto',
        height: 442.626,
        borderRadius: 24,
        background: 'rgba(129,129,129,0.2)',
      }}
    >
      <div className="px-4 pt-4">
        <FannedTitle white="Stream more." blue="Pay less." />
      </div>
      {/* Drag surface */}
      <div
        className="absolute touch-pan-y select-none"
        style={{ left: 16, top: 88, width: 338, height: 338.626, cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div className="relative w-full h-full">
          {/* The fan container — tiles are positioned relative to its center */}
          <div className="absolute" style={{ left: -101, top: 12, width: 540, height: 294.626 }}>
            {STREAM_TILES.flatMap((tile, i) => {
              const baseOff = offsetFor(i, active)
              const wrap = wrapMap.get(i)

              // Build a tile DOM node for the given slot + opacity. Used for
              // both the "main" and the "ghost" copy during a wrap. The
              // live drag offset + press scale only apply to the front tile
              // (offset 0); back tiles get a small parallax share so the
              // fan reads as drifting with the gesture without competing
              // with the front tile.
              const buildTile = (
                key: string,
                slotIdx: number,
                opacity: number,
                noTransition: boolean,
                isFront: boolean,
              ) => {
                const slot = SLOT_GEOM[slotIdx]
                if (!slot) return null
                const liveDx = isFront ? dragX : dragX * PARALLAX_BACK
                const liveRot =
                  slot.rotate + (isFront ? (dragX / 100) * TILT_PER_100PX : 0)
                const pressScale = pressed && isFront ? PRESS_SCALE : 1
                // Active drag: transitions off so the front tile tracks
                // the finger 1:1. Wrap snap: transitions off for the
                // off-screen pre-paint placement. Otherwise every tile
                // uses the SAME release spring so the five tiles arrive
                // together (no overshoot, no width/height pop).
                const tileTransition =
                  noTransition || !transitioning ? 'none' : RELEASE_SPRING
                return (
                  <div
                    key={key}
                    className="absolute"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: slot.w,
                      height: slot.h,
                      transform: `translate(calc(-50% + ${slot.x + liveDx}px), calc(-50% + ${slot.y}px)) rotate(${liveRot}deg) scale(${pressScale})`,
                      transition: tileTransition,
                      willChange: 'transform, opacity, filter',
                      opacity,
                      zIndex: slot.z,
                      background: '#101010',
                      borderRadius: isFront ? 24 : 22,
                      border: '0.5px solid rgba(204,204,204,0.28)',
                      overflow: 'hidden',
                      boxShadow:
                        slot.shadow === 'strong'
                          ? '0 0 48px 16px rgba(0,0,0,0.25)'
                          : slot.shadow === 'mid'
                          ? '0 0 45.257px 15.086px rgba(0,0,0,0.25)'
                          : undefined,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      className="absolute overflow-hidden"
                      style={{
                        left: '8.86%',
                        top: '7.2%',
                        width: '81.7%',
                        aspectRatio: '1 / 1',
                        borderRadius: 999,
                      }}
                    >
                      <img
                        src={tile.src}
                        alt={tile.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                    <div
                      className="absolute"
                      style={{
                        left: 15.5,
                        bottom: 16,
                        width: 143,
                        opacity: isFront ? 1 : 0,
                        transition: 'opacity 260ms ease',
                      }}
                    >
                      <p
                        className="font-text text-white"
                        style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500, margin: 0 }}
                      >
                        {tile.name}
                      </p>
                      <p
                        className="font-text"
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: 'rgba(255,255,255,0.7)',
                          margin: 0,
                        }}
                      >
                        {tile.back}
                      </p>
                    </div>
                  </div>
                )
              }

              // Default (no wrap): one tile at its natural slot.
              if (!wrap) {
                const node = buildTile(`${i}-main`, baseOff, 1, false, baseOff === 0)
                return node ? [node] : ([] as ReactElement[])
              }

              // Wrap in progress — dual render.
              // Main copy: starts snapped off-screen on the OPPOSITE side
              // (no transition, opacity 0), then on the next paint flips
              // to its natural slot with full transition + opacity 1.
              let mainSlotIdx = baseOff
              let mainOpacity = 1
              let mainNoTransition = false
              if (wrap.phase === 'snap') {
                mainSlotIdx = wrap.dir === 'right' ? 3 : -3
                mainOpacity = 0
                mainNoTransition = true
              }

              // Ghost copy: snaps to the OLD slot, then on next paint
              // transitions to the off-screen position on the SAME side
              // while fading out. The user sees a tile slide off one
              // side and another slide in from the other side — exactly
              // matches an infinite carousel.
              let ghostSlotIdx: number
              let ghostOpacity: number
              let ghostNoTransition: boolean
              if (wrap.phase === 'snap') {
                ghostSlotIdx = wrap.dir === 'right' ? -2 : 2
                ghostOpacity = 1
                ghostNoTransition = true
              } else {
                ghostSlotIdx = wrap.dir === 'right' ? -3 : 3
                ghostOpacity = 0
                ghostNoTransition = false
              }

              const mainNode = buildTile(
                `${i}-main`,
                mainSlotIdx,
                mainOpacity,
                mainNoTransition,
                baseOff === 0,
              )
              const ghostNode = buildTile(
                `${i}-ghost`,
                ghostSlotIdx,
                ghostOpacity,
                ghostNoTransition,
                false,
              )
              return [mainNode, ghostNode].filter((n): n is ReactElement => n != null)
            })}
          </div>
        </div>
      </div>
      {/* Pagination — OUTSIDE the drag surface so clicks aren't swallowed
          by pointer capture. */}
      <div
        className="absolute flex"
        style={{ left: 16 + 133, top: 88 + 318.63, gap: 8, zIndex: 5 }}
      >
        {STREAM_TILES.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show ${t.name}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: i === active ? '#fff' : 'rgba(255,255,255,0.63)',
              transition: 'background 200ms ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
