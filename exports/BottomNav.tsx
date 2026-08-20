// ---------------------------------------------------------------------------
// Bottom Nav — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (BottomNav — Figma node
// 93:2445, "Bottom Navigation"). This file has no dependency on the rest of
// that app — drop it into another React + Tailwind project as-is.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. Fonts — tab labels use `font-text` (Plain). If the target project
//    doesn't already define this Tailwind class, either register an
//    equivalent @font-face and map it to `font-text`, or delete the
//    className and let it fall back to your project's default stack.
//
// 2. Icons — copy these 5 SVGs from oslo-home-prototype/public/images/ into
//    the target project's public dir (paths below assume they land at the
//    same /images/... path; update ICON_BASE if you place them elsewhere):
//      icon-home.svg
//      icon-transfer.svg
//      icon-trophy.svg   (labeled "PayPal+" — 4th tab)
//      icon-person.svg   (labeled "Me")
//      icon-qr.svg       (standalone QR scan button, not part of the tab pill)
//
// 3. Backdrop blur — the glass material uses `backdropFilter: blur(28px)
//    saturate(180%)`. This needs a semi-opaque/blurred surface BEHIND the
//    nav to read correctly (it's transparent on its own) — in the source
//    app that's the phone's dark background scrolling underneath. Render
//    this over real content, not a flat background, or the blur has
//    nothing to sample.
//
// 4. Fully controlled — no internal nav state. The parent owns `active`
//    and passes `onSelect` to update it, same as the source component.
// ---------------------------------------------------------------------------

import { useState, useRef, useLayoutEffect } from 'react'
import type { CSSProperties } from 'react'

const ICON_BASE = '/images'

export type TabKey = 'home' | 'transfer' | 'paypalplus' | 'me'

// Per-icon insets straight from Figma (node 22:8118 / 22:8119 / 22:8121).
// Each icon's outer slot is 24×24; the SVG renders inside that with these
// padding percentages so the visible glyph matches the Figma proportions
// (e.g. the person icon is narrower → larger horizontal inset).
const NAV_TABS: {
  key: TabKey
  label: string
  icon: string
  inset: { top: string; right: string; bottom: string; left: string }
}[] = [
  {
    key: 'home',
    label: 'Home',
    icon: `${ICON_BASE}/icon-home.svg`,
    inset: { top: '7.51%', right: '8.33%', bottom: '8.32%', left: '8.34%' },
  },
  {
    key: 'transfer',
    label: 'Transfer',
    icon: `${ICON_BASE}/icon-transfer.svg`,
    inset: { top: '8.35%', right: '10.28%', bottom: '8.32%', left: '10.4%' },
  },
  {
    key: 'paypalplus',
    label: 'PayPal+',
    icon: `${ICON_BASE}/icon-trophy.svg`,
    inset: { top: '8.4%', right: '6.17%', bottom: '9.3%', left: '6.44%' },
  },
  {
    key: 'me',
    label: 'Me',
    icon: `${ICON_BASE}/icon-person.svg`,
    inset: { top: '8.35%', right: '18.75%', bottom: '8.32%', left: '18.75%' },
  },
]

export const BottomNav = ({
  active,
  onSelect,
  onScanQr,
}: {
  active: TabKey
  onSelect: (k: TabKey) => void
  /** Called when the QR scan button is tapped. No-op if omitted. */
  onScanQr?: () => void
}) => {
  // Refs for each tab button so we can measure their layout positions
  // and slide the indicator pill between them.
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Indicator pill geometry — position + width follow the active tab.
  // `mounted` defers the first measurement so the pill doesn't briefly
  // render at left:0 before the layout effect resolves.
  const [pill, setPill] = useState({ left: 0, width: 0, mounted: false })
  // Tracks the most recent tap so we can briefly squash the pill in the
  // travel direction — a subtle "liquid" cue that the surface is
  // morphing rather than teleporting.
  const [travel, setTravel] = useState<'left' | 'right' | 'none'>('none')
  const prevIdxRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const idx = NAV_TABS.findIndex((t) => t.key === active)
    const el = tabRefs.current[idx]
    if (!el) return
    // Direction of travel for the liquid squash. First mount = no
    // squash (we're just positioning, not moving).
    const prev = prevIdxRef.current
    if (prev != null && prev !== idx) {
      setTravel(idx > prev ? 'right' : 'left')
      // Reset squash after the pill has nearly arrived so it springs
      // back to its natural width at the destination.
      window.setTimeout(() => setTravel('none'), 220)
    }
    prevIdxRef.current = idx
    setPill({ left: el.offsetLeft, width: el.offsetWidth, mounted: true })
  }, [active])

  // iOS Liquid Glass easing — a smooth elastic curve with a gentle
  // overshoot. Feels like a damped spring without being bouncy.
  const PILL_EASE = 'cubic-bezier(0.34, 1.36, 0.64, 1)'
  // Horizontal squash applied while the pill is in flight — only on the
  // X axis, scale-Y stays at 1 so the pill keeps its pill shape.
  const pillScaleX = travel === 'none' ? 1 : 1.06 // stretch slightly along travel axis
  const pillSkew = travel === 'none' ? 0 : travel === 'right' ? -2 : 2

  // Shared glass material per Figma node 93:2448 / 93:2454 → both the
  // 3-tab pill and the QR scan button use the same `Material Small`
  // surface: rgba(255,255,255,0.1) bg with Elevation Level 3 shadows.
  // The hairline inset highlight + backdrop blur match the iOS Liquid
  // Glass treatment used elsewhere in the prototype.
  const GLASS: CSSProperties = {
    background: 'rgba(255,255,255,0.10)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    boxShadow:
      '0 2px 8px rgba(5,55,130,0.04), 0 4px 4px rgba(5,55,130,0.04), 0 4px 20px rgba(5,55,130,0.08), inset 0 0 0 0.5px rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.25)',
  }

  return (
    // Per Figma node 93:2445 → Bottom Navigation is a vertical stack:
    // a horizontal row with 20px L/R inset + 8px inter-item gap, then
    // a 20px Home Indicator Space below it.
    <div className="pointer-events-none" style={{ paddingBottom: 20 }}>
      <div
        className="flex items-center justify-center pointer-events-none w-full"
        style={{ gap: 8, paddingLeft: 20, paddingRight: 20 }}
      >
        {/* Three-tab pill — Figma node 93:2447. flex-1, max 298 wide,
            64 tall, 4px padding, rounded-full glass material. */}
        <div
          className="relative flex items-center justify-between pointer-events-auto"
          style={{
            ...GLASS,
            flex: '1 0 0',
            minWidth: 0,
            maxWidth: 298,
            height: 64,
            padding: 4,
            borderRadius: 999,
          }}
        >
          {/* Sliding indicator pill — tracks the active tab's offsetLeft /
              offsetWidth and slides between positions. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 4,
              left: pill.left,
              width: pill.width,
              height: 56,
              borderRadius: 999,
              background: 'rgba(204,204,204,0.28)',
              boxShadow:
                'inset 0 0 0 0.5px rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.18)',
              opacity: pill.mounted ? 1 : 0,
              transform: `scaleX(${pillScaleX}) skewX(${pillSkew}deg)`,
              transformOrigin: 'center center',
              transition: `left 440ms ${PILL_EASE}, width 440ms ${PILL_EASE}, transform 240ms ${PILL_EASE}, opacity 200ms ease`,
              willChange: 'left, width, transform',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          {NAV_TABS.map((t, idx) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[idx] = el
                }}
                type="button"
                onClick={() => onSelect(t.key)}
                className="relative flex flex-col items-center justify-center text-white transition-transform active:scale-[0.92]"
                // Per Figma node 93:2449 (Tab.Item) — flex-1, max 80
                // wide, h-full, 4px padding, 2px gap (icon → label).
                style={{
                  flex: '1 0 0',
                  minWidth: 0,
                  maxWidth: 80,
                  height: '100%',
                  padding: 4,
                  gap: 2,
                  borderRadius: 999,
                  background: 'transparent',
                  transitionTimingFunction: PILL_EASE,
                  transitionDuration: '220ms',
                  zIndex: 1,
                }}
                aria-pressed={isActive}
                aria-label={t.label}
              >
                {/* 24×24 slot with per-icon insets (from Figma node
                    93:2449's inset percentages). The icon nudges up
                    slightly when active for tactile press feedback. */}
                <div
                  aria-hidden
                  style={{
                    position: 'relative',
                    width: 24,
                    height: 24,
                    overflow: 'hidden',
                    transform: isActive ? 'translateY(-0.5px) scale(1.04)' : 'translateY(0) scale(1)',
                    transition: `transform 320ms ${PILL_EASE}`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: t.inset.top,
                      right: t.inset.right,
                      bottom: t.inset.bottom,
                      left: t.inset.left,
                    }}
                  >
                    <img
                      src={t.icon}
                      alt=""
                      className="block max-w-none"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
                <span
                  className="font-text"
                  style={{
                    fontSize: 10,
                    lineHeight: '12px',
                    color: '#fff',
                    opacity: isActive ? 1 : 0.72,
                    transition: `opacity 320ms ${PILL_EASE}`,
                  }}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
        {/* QR scan button — Figma node 93:2453. 64×64 round glass
            material, 24×24 qr-code glyph centered. */}
        <button
          type="button"
          onClick={onScanQr}
          className="relative flex items-center justify-center pointer-events-auto transition-transform active:scale-[0.92]"
          style={{
            ...GLASS,
            flexShrink: 0,
            width: 64,
            height: 64,
            padding: 4,
            borderRadius: 999,
            transitionTimingFunction: PILL_EASE,
            transitionDuration: '220ms',
          }}
          aria-label="Scan QR code"
        >
          <div
            aria-hidden
            style={{ position: 'relative', width: 24, height: 24, overflow: 'hidden' }}
          >
            <div
              // qr-code inset per Figma node I93:2456;129:1950 → 8.44% / 8.33% / 8.23% / 8.33%
              style={{
                position: 'absolute',
                top: '8.44%',
                right: '8.33%',
                bottom: '8.23%',
                left: '8.33%',
              }}
            >
              <img
                src={`${ICON_BASE}/icon-qr.svg`}
                alt=""
                className="block max-w-none"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
