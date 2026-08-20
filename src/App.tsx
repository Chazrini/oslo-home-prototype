import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// ---------- Scroll reveal ----------
// IntersectionObserver-based reveal. Each <Reveal> child starts lifted + tilted
// slightly back; when it crosses into the phone viewport the section settles
// into place with a soft 3D perspective shift. Once revealed, stays put — no
// reverse animation on scroll-up.
const ScrollRootContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null)

// ---------- App-level view + navigation ----------
// Wallet, Transfer, PayPal+ and the QR scanner have been removed from the
// build — Home is the only real view. The bottom nav still renders all of
// its tabs for visual parity, but none of them navigate anywhere anymore.
type AppView = 'feed'

// In-app browser launches as a slide-up sheet over whichever view is
// active. The brand drives the URL, logo and pay-later copy.
type BrowserBrand = 'nike' | 'apple' | 'sony'

type NavApi = {
  view: AppView
  openFeed: () => void
  // In-app browser sheet — null = closed.
  browserBrand: BrowserBrand | null
  openBrowser: (brand: BrowserBrand) => void
  closeBrowser: () => void
  // Crypto Product Detail Page — slides up over the active view when a
  // coin row is tapped. `cryptoPdpCoin` is the active coin (null when
  // closed); `cryptoPdpSource` records HOW it was opened so the
  // top-left control adapts:
  //   'overview' → opened from the Crypto Overview sheet → back arrow
  //                (returns to that list, which is still open beneath)
  //   'direct'   → opened straight from the Accounts-tab Crypto card →
  //                X close (dismisses entirely back to the wallet)
  cryptoPdpCoin: CoinId | null
  cryptoPdpSource: 'overview' | 'direct'
  openCryptoPdp: (coin: CoinId, source?: 'overview' | 'direct') => void
  closeCryptoPdp: () => void
  // Backward-compatible Bitcoin wrapper (Accounts-tab Crypto card +
  // Crypto Overview Bitcoin rows still call this).
  openBitcoinPdp: (source?: 'overview' | 'direct') => void
  // Crypto Overview sheet — slides up over the active view when the
  // Crypto card itself (header / value area) is tapped.
  cryptoOverviewOpen: boolean
  openCryptoOverview: () => void
  closeCryptoOverview: () => void
}

const NavContext = createContext<NavApi | null>(null)

const useNav = (): NavApi => {
  const ctx = useContext(NavContext)
  if (!ctx) {
    return {
      view: 'feed',
      openFeed: () => {},
      browserBrand: null,
      openBrowser: () => {},
      closeBrowser: () => {},
      cryptoPdpCoin: null,
      cryptoPdpSource: 'direct',
      openCryptoPdp: () => {},
      closeCryptoPdp: () => {},
      openBitcoinPdp: () => {},
      cryptoOverviewOpen: false,
      openCryptoOverview: () => {},
      closeCryptoOverview: () => {},
    }
  }
  return ctx
}

const useScrollReveal = () => {
  const rootRef = useContext(ScrollRootContext)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = rootRef?.current ?? null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { root, threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { ref, visible }
}

const Reveal = ({
  children,
  delay = 0,
  tilt = 5,
}: {
  children: React.ReactNode
  delay?: number
  tilt?: number
}) => {
  const { ref, visible } = useScrollReveal()
  return (
    <div
      ref={ref}
      style={{
        // Subtle vertical perspective tilt — cards lean slightly forward at
        // their bottom edge while entering, then settle flat. No opacity fade
        // and no translate. Perspective is self-applied via the transform
        // function so it doesn't interfere with the scroll container.
        transform: visible
          ? 'perspective(1400px) rotateX(0deg)'
          : `perspective(1400px) rotateX(${tilt}deg)`,
        transformOrigin: 'center bottom',
        // ease-out-expo — long, smooth tail
        transition: `transform 900ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
}

// ---------- Horizontal scroll helper ----------
// Adds click-and-drag to a scrollable row, plus shift+wheel-to-horizontal.
// Skips touch (native works) and respects a small drag threshold so taps still register as clicks.

const useHScroll = () => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (horizontalIntent) return // already horizontal, let native handle
      // A plain vertical wheel scroll should keep scrolling the page even
      // when the cursor happens to be sitting over a carousel — it used to
      // get hijacked into panning the carousel instead, which felt broken
      // mid-scroll. Only an explicit shift+wheel (the standard "make this
      // horizontal" modifier) pans it now.
      if (!e.shiftKey) return
      const max = el.scrollWidth - el.clientWidth
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft >= max && e.deltaY > 0
      if (atStart || atEnd) return // let vertical scroll bubble
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
        // suppress the click that would otherwise fire on whichever child we landed on
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

// Adds click-and-drag vertical scrolling with touch-like momentum to the
// phone's main feed viewport. A plain mouse drag on a scrollable div has no
// momentum and stops dead the instant you release, which is what makes
// steering the phone preview with a desktop mouse feel unlike a real swipe.
// Skips touch entirely (real touch already gets native momentum scrolling
// from the browser) and axis-locks to vertical intent so it doesn't hijack
// horizontal carousels (DeckCarousel, HScroll, etc.) living inside the feed.
const useVScrollDrag = (ref: React.RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let dragging = false
    let axis: 'none' | 'vertical' | 'horizontal' = 'none'
    let startX = 0
    let startY = 0
    let startTop = 0
    let lastY = 0
    let lastTime = 0
    let velocity = 0
    let momentumFrame = 0

    const stopMomentum = () => {
      if (momentumFrame) {
        cancelAnimationFrame(momentumFrame)
        momentumFrame = 0
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      stopMomentum()
      dragging = true
      axis = 'none'
      startX = e.clientX
      startY = e.clientY
      startTop = el.scrollTop
      lastY = e.clientY
      lastTime = performance.now()
      velocity = 0
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (axis === 'none') {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
        axis = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal'
        if (axis === 'vertical') {
          try {
            el.setPointerCapture(e.pointerId)
          } catch {}
          el.style.cursor = 'grabbing'
          el.style.userSelect = 'none'
        }
      }
      if (axis !== 'vertical') return
      e.preventDefault()
      el.scrollTop = startTop - dy
      const now = performance.now()
      const dt = Math.max(1, now - lastTime)
      velocity = (e.clientY - lastY) / dt
      lastY = e.clientY
      lastTime = now
    }
    const finish = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      } catch {}
      el.style.cursor = ''
      el.style.userSelect = ''
      if (axis === 'vertical') {
        // Suppress the click that would otherwise fire on whichever child
        // we landed on, same as the horizontal-carousel drag pattern.
        const stop = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        el.addEventListener('click', stop, { capture: true, once: true })

        // Momentum: keep scrolling in the drag direction and decay it like
        // a touch-scroll fling, instead of stopping dead like a plain
        // mouse drag would.
        let v = -velocity * 16
        const FRICTION = 0.94
        const step = () => {
          if (Math.abs(v) < 0.5) {
            momentumFrame = 0
            return
          }
          el.scrollTop += v
          v *= FRICTION
          const atTop = el.scrollTop <= 0
          const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight
          if (atTop || atBottom) {
            momentumFrame = 0
            return
          }
          momentumFrame = requestAnimationFrame(step)
        }
        momentumFrame = requestAnimationFrame(step)
      }
      axis = 'none'
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)

    return () => {
      stopMomentum()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
    }
  }, [ref])
}

const HScroll = ({
  children,
  className = '',
  gapPx,
}: {
  children: React.ReactNode
  className?: string
  // Optional inline gap override (px). Defaults to the gap-3 (12px)
  // Tailwind class; pass a number to match a specific Figma stride.
  gapPx?: number
}) => {
  const ref = useHScroll()
  return (
    <div
      ref={ref}
      // overflow-y-hidden is required, not decorative: per the CSS spec, an
      // element with overflow-x set to anything but 'visible' while
      // overflow-y is left at its 'visible' default has overflow-y computed
      // as 'auto' instead — silently turning every one of these rows into a
      // real (if 1-2px) vertical scroll container. no-scrollbar only hides
      // the bar; it doesn't stop the scroll, so wheel/drag could catch on
      // that sliver before bubbling to the feed. Pinning overflow-y closes it.
      className={`flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar cursor-grab touch-pan-x ${className}`}
      style={gapPx != null ? { gap: gapPx } : undefined}
    >
      {children}
    </div>
  )
}

type Frame = {
  id: number
  label: string
  anchor: string
  /** Extra pixels of headroom above the target. Default -12 (target sits at
   *  viewport top + 12). Larger values keep the previous section partially
   *  visible above the target. */
  offset?: number
}

const FRAMES: Frame[] = [
  // Home flow starting frame. The sidebar's HOME header is the flow
  // name; this individual sub-frame keeps its content-screen label
  // ("Account Snapshot") since it's the first screen of the flow.
  { id: 1, label: 'Account Snapshot', anchor: 'top' },
  // Top stores is the Hero collection (Figma Collection.Hero) — a row of
  // brand chips above the Deck Collection. It sits right at the top of the
  // feed (just below Account Snapshot), so jumping to it scrolls back to
  // the very top rather than a mid-scroll offset.
  { id: 2, label: 'Hero Collection', anchor: 'top' },
  // Hero scrolls less so the "Pay later at top stores" row above stays
  // partially visible at the top of the viewport, matching the Figma comp.
  { id: 3, label: 'Deck Collection', anchor: 'hero', offset: 212 },
  // NYC scrolls past most of the card so "shopper favorites" peeks at the
  // top (behind the status bar) and Extra Points becomes the focal point.
  { id: 4, label: 'Square Collection 1', anchor: 'nyc', offset: -50 },
  // "Extra points" is a Card.NBA.List instance (Figma 15:371).
  { id: 5, label: 'NBA List', anchor: 'extra-points' },
  // Spring heros sits lower in the viewport so Extra Points' last rows peek
  // at the top and Streaming card peeks at the bottom, matching the Figma comp.
  // "This weeks spring heros" — a generic Card.Collection.Spotlight instance.
  { id: 6, label: 'Spotlight Collection 1', anchor: 'spring-heros', offset: 180 },
  // Streaming sits below Spring heros bottom peek and above Spring essentials peek.
  { id: 7, label: 'Fanned Collection', anchor: 'stream', offset: 190 },
  // "Spring essentials." is a Card.Collection.Square tile group, same
  // pattern as Square Collection 1 (frame 4).
  { id: 8, label: 'Square Collection 2', anchor: 'spring-essentials' },
  // Boutiques scrolls past the tile bodies so the captions peek at the top
  // and the Crypto promo becomes the focal point.
  // "Boutiques & breakouts" is a Card.Collection.Square tile group.
  { id: 9, label: 'Square Collection 3', anchor: 'boutiques', offset: -115 },
  // Crypto scrolls so the buttons + coins peek take the top band with more
  // breathing room under the search bar, then Top tec gifts becomes the
  // focal point and Big styles peeks at the bottom.
  // "Crypto made simple, start with just $1." is a Card.NBA.Spotlight
  // instance (the NBA-branded Spotlight variant, distinct from the generic
  // Card.Collection.Spotlight used at frames 6/11/15).
  { id: 10, label: 'NBA Spotlight - Crypto', anchor: 'crypto', offset: -280 },
  // Tec gifts scrolls past Top tec gifts + Big styles tiles so the PayPal
  // Mastercard promo is the focal point. Big styles tile labels (Pay later
  // + cashback %) peek at the top; See better. Look even better. with its
  // ZENNI / WARBY tiles peeks at the bottom.
  // "Top tec gifts" is another generic Card.Collection.Spotlight instance.
  { id: 11, label: 'Spotlight Collection 2', anchor: 'tec-gifts', offset: -555 },
  // "Big styles." is a Card.Collection.Square tile group. Positive offset
  // scrolls less than the default so the heading clears the status bar.
  { id: 12, label: 'Square Collection 4', anchor: 'big-styles', offset: 60 },
  // PayPal Card scrolls past the Mastercard promo + See better tiles so
  // Refresh your space (IKEA chair) becomes the focal point, with See
  // better tile labels peeking at top and Find your sound (Reverb / Guitar
  // Center / Sam Ash) tiles peeking at the bottom.
  // PayPal Cashback Mastercard promo is a Card.NBA.Carousel instance.
  { id: 13, label: 'NBA Carousel', anchor: 'paypal-mastercard', offset: -695 },
  // "See better. Look even better." is a Card.Collection.Square tile group.
  // Larger positive offset — this one overshot the most under the default.
  { id: 14, label: 'Square Collection 5', anchor: 'see-better', offset: 90 },
  // Refresh scrolls past the Refresh your space + Find your sound sections
  // so Track orders to your doorstep becomes the focal point. Find your
  // sound (Reverb / Guitar Center / Sam Ash tiles + labels) fully fills
  // the top band, with Track orders fully visible below.
  // "Refresh your space" is a generic Card.Collection.Spotlight instance.
  { id: 15, label: 'Spotlight Collection 3', anchor: 'refresh-space', offset: -400 },
  // "Find your sound" is a Card.Collection.Square tile group. Positive
  // offset scrolls less than the default so the heading clears the status bar.
  { id: 16, label: 'Square Collection 6', anchor: 'find-your-sound', offset: 60 },
  // "Track orders to your doorstep" is a Card.NBA.Spotlight instance
  // (Figma 24:2460), the same NBA-branded family as Crypto (frame 10).
  { id: 17, label: 'NBA Spotlight - Tracking', anchor: 'track-orders' },
]

// ---------- Tiny SVG icons ----------

// Search-bar sparkle — single 4-pointed star with concave edges,
// matching the Figma asset (replaces the prior dual-sparkle SVG).
// Points sit on the cardinal axes of a 24×24 viewBox; each edge is a
// cubic curve pulling toward (12,12), giving the classic AI-sparkle
// silhouette.
const SparkleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#60cdff"
      d="M12 2 C 13 8 16 11 22 12 C 16 13 13 16 12 22 C 11 16 8 13 2 12 C 8 11 11 8 12 2 Z"
    />
  </svg>
)

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zm5 11a2 2 0 0 0 2 0"
    />
  </svg>
)

// ---------- Brand glyphs (text-as-logo) ----------

type BrandStyle = {
  bg: string
  fg: string
  label: string
  italic?: boolean
  weight?: string
  size?: string
  tracking?: string
  family?: string
}

const BRANDS: Record<string, BrandStyle> = {
  target: { bg: '#fff', fg: '#cc0000', label: '◎', size: 'text-3xl' },
  walmart: { bg: '#0071ce', fg: '#ffc220', label: '✻', size: 'text-3xl' },
  ikea: { bg: '#0058a3', fg: '#ffdb00', label: 'IKEA', size: 'text-[14px]', weight: 'font-extrabold' },
  uniqlo: { bg: '#e60012', fg: '#fff', label: 'UNI\nQLO', size: 'text-[13px]', weight: 'font-black', tracking: 'tracking-tight' },
  kith: { bg: '#fff', fg: '#000', label: 'KITH', size: 'text-[16px]', weight: 'font-extrabold' },
  farfetch: { bg: '#fff', fg: '#000', label: 'FF', size: 'text-2xl', weight: 'font-black' },
  ulta: { bg: '#ef7e2e', fg: '#fff', label: 'ULTA', size: 'text-[12px]', weight: 'font-black' },
  hm: { bg: '#fff', fg: '#e50010', label: 'H&M', italic: true, weight: 'font-bold', size: 'text-base' },
  apple: { bg: '#fff', fg: '#000', label: '', size: 'text-2xl' },
  nike: { bg: '#000', fg: '#fff', label: '✓', size: 'text-xl', weight: 'font-black' },
  netflix: { bg: '#000', fg: '#e50914', label: 'N', size: 'text-5xl', weight: 'font-black', family: 'font-serif' },
  disney: { bg: '#000', fg: '#fff', label: 'Disney', italic: true, weight: 'font-bold', size: 'text-xl', family: 'font-serif' },
  hulu: { bg: '#000', fg: '#1ce783', label: 'hulu', size: 'text-2xl', weight: 'font-black' },
  zara: { bg: '#fff', fg: '#000', label: 'Z', size: 'text-4xl', family: 'font-serif', weight: 'font-bold' },
  crocs: { bg: '#88c540', fg: '#fff', label: 'crocs', size: 'text-base', weight: 'font-extrabold' },
  rei: { bg: '#fff', fg: '#16432d', label: 'REI', size: 'text-base', weight: 'font-black' },
  etsy: { bg: '#f1641e', fg: '#fff', label: 'E', size: 'text-4xl', family: 'font-serif', italic: true, weight: 'font-bold' },
  rimowa: { bg: '#fff', fg: '#000', label: 'RIMOWA', size: 'text-[10px]', weight: 'font-black', tracking: 'tracking-widest' },
  sony: { bg: '#fff', fg: '#000', label: 'SONY', size: 'text-[11px]', weight: 'font-extrabold', tracking: 'tracking-tight' },
  samsung: { bg: '#000', fg: '#fff', label: 'SAMSUNG', size: 'text-[9px]', weight: 'font-extrabold' },
  shein: { bg: '#fff', fg: '#000', label: 'SHEIN', size: 'text-[12px]', weight: 'font-black', tracking: 'tracking-wider' },
  llbean: { bg: '#1d5132', fg: '#fff', label: 'L.L.Bean', size: 'text-base', family: 'font-serif', weight: 'font-semibold' },
}

const BrandBadge = ({
  brand,
  size = 56,
  rounded = 'rounded-full',
}: {
  brand: keyof typeof BRANDS
  size?: number
  rounded?: string
}) => {
  const b = BRANDS[brand]
  if (!b) return null
  const cls = [
    'flex items-center justify-center shrink-0 leading-none text-center whitespace-pre',
    rounded,
    b.size ?? 'text-base',
    b.weight ?? '',
    b.italic ? 'italic' : '',
    b.tracking ?? '',
    b.family ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      style={{ width: size, height: size, background: b.bg, color: b.fg }}
    >
      {b.label}
    </div>
  )
}

// ---------- Reusable section header ----------

type SectionTitleProps = {
  white?: string
  blue?: string
  blueTop?: string
  whiteBottom?: string
  trailing?: React.ReactNode
  size?: string
  // When true, white + blue render on the same line (with a space between).
  // Default is two-line stacked layout.
  inline?: boolean
}

const SectionTitle = ({
  white,
  blue,
  blueTop,
  whiteBottom,
  trailing,
  size = 'text-[24px]',
  inline = false,
}: SectionTitleProps) => (
  <div className="flex items-start justify-between gap-3 mb-3">
    <h2
      className={`${size} font-black font-display`}
      style={{ lineHeight: '28px', letterSpacing: '-1px', margin: 0 }}
    >
      {blueTop ? (
        <>
          <span className="text-link">{blueTop}</span>
          {whiteBottom && (
            <>
              <br />
              <span className="text-white">{whiteBottom}</span>
            </>
          )}
        </>
      ) : (
        <>
          <span className="text-white">{white}</span>
          {blue && (
            <>
              {inline ? ' ' : <br />}
              <span className="text-link">{blue}</span>
            </>
          )}
        </>
      )}
    </h2>
    {trailing}
  </div>
)

const AiOrb = () => (
  <div className="h-[33px] w-[33px] rounded-full flex items-center justify-center">
    <img src="/images/ai-mark.svg" alt="" className="h-4 w-4" />
  </div>
)

// ---------- Phone header ----------

// iOS status bar — pinned to the top of the scroll container, sized to sit
// around the dynamic island per Apple's HIG. Fully transparent — content
// scrolls behind the time / signal / wi-fi / battery icons unobstructed.
const StatusBar = ({ fixed = false }: { fixed?: boolean }) => (
  <div
    // When rendered outside a scroll container (PhoneShell-level, fixed
    // above the view-switch animation) we anchor with absolute positioning
    // instead of sticky.
    className={
      fixed
        ? 'absolute top-0 left-0 right-0 z-30 flex items-center justify-between pointer-events-none'
        : 'sticky top-0 z-30 flex items-center justify-between pointer-events-none'
    }
    style={{
      height: 60, // iOS status bar with Dynamic Island
      paddingLeft: 28,
      paddingRight: 28,
      color: '#fff',
      // SF-style numerals
      fontSize: 17,
      fontWeight: 600,
      letterSpacing: '-0.4px',
      lineHeight: 1,
      background: 'transparent',
    }}
  >
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</span>
    <div className="flex items-center" style={{ gap: 5 }}>
      {/* Signal bars */}
      <svg viewBox="0 0 17 11" width="17" height="11" aria-hidden="true">
        <rect x="0" y="7" width="3" height="4" rx="1" fill="white" />
        <rect x="4.5" y="5" width="3" height="6" rx="1" fill="white" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="white" />
        <rect x="13.5" y="0" width="3" height="11" rx="1" fill="white" />
      </svg>
      {/* Wi-Fi */}
      <svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true">
        <path
          d="M8 10.4a1.05 1.05 0 1 0 0-2.1 1.05 1.05 0 0 0 0 2.1z"
          fill="white"
        />
        <path
          d="M2.4 6.2a8 8 0 0 1 11.2 0M4.6 8.4a5 5 0 0 1 6.8 0M.4 4.1a11 11 0 0 1 15.2 0"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {/* Battery — Apple style: rounded outer + 1px gap + filled level + nub */}
      <div className="relative" style={{ width: 27, height: 12 }}>
        <div
          className="absolute"
          style={{
            inset: 0,
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 4,
          }}
        />
        <div
          className="absolute"
          style={{
            top: 2,
            bottom: 2,
            left: 2,
            right: 4,
            background: '#fff',
            borderRadius: 2,
          }}
        />
        <div
          className="absolute"
          style={{
            top: 4,
            right: -2,
            width: 1.5,
            height: 4,
            background: 'rgba(255,255,255,0.4)',
            borderRadius: '0 1px 1px 0',
          }}
        />
      </div>
    </div>
  </div>
)

// Search bar + notification avatar — pinned just below the iOS status bar with
// the iOS "Liquid Glass" treatment: heavy backdrop blur + saturation boost,
// translucent white fill, hairline border highlight, soft inset glow.
const SearchBell = ({ fixed = false }: { fixed?: boolean }) => {
  // Glass stroke now matches the BottomNav exactly — hairline 0.5px at
  // 18% white delivered via a box-shadow inset (no explicit `border`),
  // so the top and bottom chrome read as the same surface family.
  const GLASS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 0.5px rgba(255,255,255,0.18), 0 1px 3px rgba(0,0,0,0.18)',
  }
  return (
    <div
      // Same sticky-vs-absolute split as StatusBar — absolute when
      // hoisted into PhoneShell, sticky when embedded in a scroll view.
      className={fixed ? 'absolute left-0 right-0 z-30' : 'sticky z-20'}
      style={{
        top: 54, // sits flush under the status bar (54 = iOS status-bar bottom)
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 6,
        paddingBottom: 10,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex-1 flex items-center gap-2 rounded-full px-4"
          style={{ ...GLASS, height: 40 }}
        >
          <SparkleIcon />
          <span className="text-white/85 text-[15px] font-text">Search or ask questions</span>
        </div>
        <button
          className="rounded-full flex items-center justify-center"
          aria-label="Notifications"
          style={{ ...GLASS, height: 40, width: 40 }}
        >
          <BellIcon />
        </button>
      </div>
    </div>
  )
}

// ---------- Sections ----------

// Account Snapshot (Figma 1:21) — 225×127 tiles, rgba(129,129,129,0.2) bg, rounded 12px
// Each tile: label 12px Plain Medium, amount 20px PayPal Pro Black tracking -1px, sub 12px Plain Regular
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
  // Clickable variant — used by the PayPal balance tile to open the wallet
  // page. type="button" prevents implicit form submission inside any wrapper.
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
const AcctHeader = ({
  label,
  trailing,
}: {
  label: string
  trailing?: React.ReactNode
}) => (
  // Inner padding per Figma node 1:25 → Card.Header sits at x:12, y:12
  // inside the 225×127 Account Snapshot tile (was 11.5 before audit).
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
const AcctFooter = ({ amount, sub, subColor }: { amount: string; sub: string; subColor?: string }) => (
  // Inner padding per Figma 1:21 Account Snapshot tile — footer block
  // mirrors the 12px left/right inset of Card.Header. Top:67 + h:48
  // leaves a 12px bottom inset (225×127 tile − 12 padding bottom).
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

const AccountSnapshot = () => {
  const { openCryptoOverview } = useNav()
  return (
  <div id="account" className="px-4 mt-4">
    <HScroll className="-mx-4 px-4 pb-1">
      {/* PayPal balance — Wallet has been removed from the build, so this
          tile is now static (matches the "Pay Later" tile below). */}
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
              <img
                src="/images/card-debit.png"
                alt=""
                className="w-full h-full object-cover"
              />
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
              style={{
                width: 33,
                height: 33,
                borderRadius: 8,
                background: 'rgba(129,129,129,0.2)',
              }}
            >
              <img src="/images/icon-calendar.svg" alt="" style={{ width: 16, height: 16 }} />
            </div>
          }
        />
        <AcctFooter amount="$1,500.00" sub="Spending Power" subColor="#73e6ab" />
      </AcctTile>

      {/* PayPal+ — PayPal+ has been removed from the build, so this tile
          is now static. */}
      <AcctTile>
        <AcctHeader
          label="PayPal+"
          trailing={
            <div
              className="flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: 8, background: '#fff' }}
            >
              <img
                src="/images/paypal-monogram.svg"
                alt=""
                style={{ width: 22, height: 22 }}
              />
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
              style={{
                width: 48,
                height: 32,
                borderRadius: 4,
                border: '0.4px solid rgba(204,204,204,0.28)',
              }}
            >
              <img
                src="/images/card-credit.png"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          }
        />
        <AcctFooter amount="$245.72" sub="Payment due Mar, 30" />
      </AcctTile>

      {/* Crypto — opens the Crypto overview ("Buy and sell crypto") page. */}
      <AcctTile onClick={() => openCryptoOverview()}>
        <AcctHeader
          label="Crypto"
          trailing={
            <div
              className="flex items-center justify-center"
              style={{
                width: 33,
                height: 33,
                borderRadius: 8,
                background: 'rgba(129,129,129,0.2)',
              }}
            >
              <img src="/images/icon-crypto-snap.svg" alt="" style={{ width: 16, height: 16 }} />
            </div>
          }
        />
        {/* Custom (inline) Crypto footer with sparkline — uses the same
            12px insets as AcctFooter per Figma 1:21. */}
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
            style={{
              left: 0,
              top: 32,
              fontSize: 12,
              lineHeight: '16px',
              color: 'rgba(255,255,255,0.72)',
              margin: 0,
            }}
          >
            Available balance
          </p>
          <div
            className="absolute flex items-center justify-center"
            style={{
              right: 0,
              top: 24,
              width: 63,
              height: 24,
              borderRadius: 999,
              background: 'rgba(0,82,67,0.25)',
            }}
          >
            <span
              style={{ fontSize: 12, color: '#73e6ab', fontWeight: 500, lineHeight: '16px' }}
            >
              ↑ 3.56%
            </span>
          </div>
        </div>
      </AcctTile>

      {/* Banks and cards (dashed border) */}
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
              style={{
                left: 0,
                top: 0,
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'rgba(204,204,204,0.28)',
              }}
            >
              <img src="/images/icon-bank.svg" alt="" style={{ width: 16, height: 16 }} />
            </div>
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: 24,
                top: 0,
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'rgba(204,204,204,0.28)',
              }}
            >
              <img src="/images/icon-card.svg" alt="" style={{ width: 16, height: 16 }} />
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
            <img src="/images/icon-plus.svg" alt="Add" style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>
    </HScroll>
  </div>
  )
}

// Top stores — Collection.Hero (Figma 1:336)
// 8 brand chips with 64px round avatars, horizontal scroll
type StoreChip = { name: string; back: string; src: string; bg?: string; inset?: string }
const TOP_STORES: StoreChip[] = [
  { name: 'Target', back: '5% back', src: '/images/brand-target.png' },
  { name: 'Walmart', back: '5% back', src: '/images/brand-walmart.png' },
  { name: 'Ikea', back: '3% back', src: '/images/brand-ikea.png' },
  { name: 'Uniqlo', back: '5% back', src: '/images/brand-uniqlo.png', bg: '#ec1d24', inset: '9.37%' },
  { name: 'Nike', back: '5% back', src: '/images/brand-nike.png' },
  { name: 'Fanatics', back: '2% back', src: '/images/brand-fanatics.png', bg: '#0a1e3f', inset: '7.81%' },
  { name: 'New Balance', back: '5% back', src: '/images/brand-newbalance.png' },
  { name: 'L.L. Bean', back: '3% back', src: '/images/brand-llbean.png' },
]

const TopStoresRow = () => (
  <section id="top-stores" className="mt-4">
    <div className="px-6">
      <SectionTitle blueTop="Pay later" whiteBottom="at top stores" />
    </div>
    <HScroll className="px-3 pt-2">
      {TOP_STORES.map((s) => (
        <div key={s.name} className="shrink-0 w-[96px] flex flex-col items-center pt-0">
          <div
            className="relative rounded-full overflow-hidden"
            style={{
              width: 64,
              height: 64,
              background: s.bg ?? 'transparent',
              border: '1px solid rgba(255,255,255,0.24)',
            }}
          >
            {s.inset ? (
              <img
                src={s.src}
                alt={s.name}
                className="absolute max-w-none object-cover pointer-events-none"
                style={{
                  left: s.inset,
                  top: s.inset,
                  width: `calc(100% - 2 * ${s.inset})`,
                  height: `calc(100% - 2 * ${s.inset})`,
                }}
              />
            ) : (
              <img
                src={s.src}
                alt={s.name}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            )}
          </div>
          <p className="font-text text-white text-center mt-3" style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500 }}>
            {s.name}
          </p>
          <p className="font-text text-center" style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
            Pay Later
          </p>
          <p className="font-text text-center" style={{ fontSize: 12, lineHeight: '16px', color: '#60cdff', marginTop: 2 }}>
            {s.back}
          </p>
        </div>
      ))}
    </HScroll>
  </section>
)

// HeroCarousel — Collection.Deck.3:4 (Figma node 1:550)
// Front card (1:655): 320×427, bg #9c1414, with Nike shoes image fill
// Back left card (1:604): 280×374, rotated -8°, bg rgb(35,72,68)
// ---------- Deck Collection (Figma node 60:2801) ----------
// 3-card stack with the front card centred, two back cards fanned out
// behind at ±8°. Horizontal drag (or tap a back card) swaps the deck —
// each tile keeps its identity and animates between slot positions
// using the same FLIP pattern as the Streaming Fanned Collection.

type DeckCard = {
  id: string
  // Card body styling
  baseColor: string
  gradient: string
  // Product image inside the card with absolute positioning percentages.
  // Each card has a FRONT style (centred, larger, designed for the full
  // 320×427 card) and a BACK style (offset / cropped to look good in
  // the smaller 280×374 fan position). The carousel picks the right
  // one based on which slot the card currently occupies.
  productImage: string
  productStyleFront: React.CSSProperties
  productStyleBack: React.CSSProperties
  // Header text and badge
  titleLine1: string
  titleLine2?: string
  badgeLabel: string
  // Footer brand row
  brandName: string
  brandLogo: string
  brandLogoBg?: string
}

const DECK_CARDS: DeckCard[] = [
  {
    id: 'nike',
    baseColor: 'rgb(15, 19, 33)',
    // Figma Card 1 / Position 1 radial:
    //   center = (12%, -20%)
    //   gradientTransform half-axes = 84 × 76.86 → 262.5% × 180% of card
    //   stops: opaque red at 28% → faded red at 86%
    // The huge ellipse means the gradient covers nearly the whole card
    // with red, lightest at the top-left and darkest at the bottom-right.
    gradient:
      'radial-gradient(ellipse 262.5% 180% at 12% -20%, rgba(146,52,28,1) 28%, rgba(112,13,13,0.29) 86%)',
    productImage: '/images/deck-img-nike.png',
    productStyleFront: { height: '34.67%', left: '8.75%', top: '39.84%', width: '82.39%' },
    productStyleBack: { height: '34.67%', left: '8.75%', top: '42%', width: '82.39%' },
    titleLine1: 'New season,',
    titleLine2: 'new energy',
    badgeLabel: '5% off',
    brandName: 'Nike',
    brandLogo: '/images/deck-brand-nike.png',
    brandLogoBg: '#000',
  },
  {
    id: 'apple',
    // Deeper navy base so the card reads "dark + cool" before the
    // gradient even kicks in. Matches the Card.Deck.3:4 reference.
    baseColor: 'rgb(1, 10, 19)',
    // Figma Card 2 / Position 2 radial:
    //   center = (12%, -20%), same ellipse footprint as Card 1/3
    //     (gradientTransform 73.5 × 67.32 → 262.5% × 180% of card)
    //   layer opacity = 0.4 — stop alphas pre-multiplied below
    //   stops: gray at 32% fading to deeper gray at 100%
    // Produces a subtle "light from the top-left" wash without
    // brightening the rest of the card.
    gradient:
      'radial-gradient(ellipse 262.5% 180% at 12% -20%, rgba(157,157,157,0.4) 32%, rgba(128,128,128,0.329) 49%, rgba(99,99,99,0.258) 66%, rgba(70,70,70,0.187) 83%, rgba(41,41,41,0.116) 100%)',
    productImage: '/images/deck-img-apple.png',
    // FRONT: AirPods + case fill the lower-middle of the card,
    // matching the Card.Deck.3:4 reference. The product image is
    // square-ish so width and height percentages map roughly 1:1.
    productStyleFront: { height: '62%', left: '5%', top: '30%', width: '90%' },
    // BACK: cropped to the left edge (matches Figma's back-left fan).
    productStyleBack: { height: '62.76%', left: '-8%', top: '37.02%', width: '59.27%' },
    titleLine1: 'Find your',
    titleLine2: 'sound',
    badgeLabel: '5% off',
    brandName: 'Apple',
    brandLogo: '/images/deck-brand-apple.png',
    // Apple logo is a dark glyph on a clean white pill (per the
    // Card.Deck.3:4 reference). Black background would invert the
    // glyph and hide it.
    brandLogoBg: '#fff',
  },
  {
    id: 'sony',
    baseColor: 'rgb(31, 31, 55)',
    // Figma Card 3 / Position 3 radial:
    //   center = (12%, -20%), ellipse 262.5% × 180% of card
    //   layer opacity = 1
    //   stops: bright red at 0% fading through dark red to transparent
    //     at 61%, then the base navy shows through.
    gradient:
      'radial-gradient(ellipse 262.5% 180% at 12% -20%, rgba(200,70,49,1) 0%, rgba(150,53,37,0.75) 15%, rgba(100,35,25,0.5) 30%, rgba(50,18,12,0.25) 46%, rgba(0,0,0,0) 61%)',
    productImage: '/images/deck-img-sony.png',
    // FRONT: Sony headphones centred and large.
    productStyleFront: { height: '52%', left: '14%', top: '36%', width: '72%' },
    // BACK: Figma's offset crop for the back-right fan position.
    productStyleBack: { height: '61.98%', left: '24.76%', top: '24.12%', width: '50.96%' },
    titleLine1: 'Hear the sound',
    titleLine2: 'of silence',
    badgeLabel: '5% off',
    brandName: 'Sony',
    brandLogo: '/images/deck-brand-sony.png',
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
  // Back-left and back-right peek symmetrically out from behind the
  // front card. Cards are 280×374 rotated ±8°. The x offsets push each
  // card sideways far enough that its outer corner clears the front
  // card's edge; the y offset drops them low enough that the rounded
  // bottom corners visibly extend ~35px below the front card.
  // (Figma's exact asymmetric values pushed back-right past the 402-px
  // viewport so the card got clipped — we use symmetric offsets that
  // produce a similar deck silhouette without clipping.)
  [-1]: { x: -28, y: 56, w: 280, h: 374, rotate: -8, z: 1, isFront: false, scaleFooter: 280 / 320 },
  // Front: full-size, no rotation, top of the stack.
  [0]: { x: 0, y: 0, w: 320, h: 427, rotate: 0, z: 3, isFront: true, scaleFooter: 1 },
  [1]: { x: 28, y: 56, w: 280, h: 374, rotate: 8, z: 1, isFront: false, scaleFooter: 280 / 320 },
}

// One card rendered into a slot. Pure presentation; the parent
// component owns the slot/offset state and drag handling.
const DeckCardView = ({
  card,
  slot,
  scaleFontHeader,
  scaleHeader,
}: {
  card: DeckCard
  slot: DeckSlotGeom
  scaleFontHeader: number
  scaleHeader: number
}) => {
  const fs = scaleHeader
  // Each deck card id (nike / apple / sony) maps 1:1 to a browser brand,
  // so the Shop button can launch the in-app browser for that brand.
  const { openBrowser } = useNav()
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
            if (slot.isFront) openBrowser(card.id as BrowserBrand)
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
      {/* scaleFontHeader is only here to silence the unused-arg warning
          if we don't end up using it separately from scaleHeader. */}
      {scaleFontHeader === 0 && null}
    </div>
  )
}

const DeckCarousel = () => {
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
  // The previous implementation was binary: pull > 56px → snap to next
  // card; pull less → nothing visible happened. Felt rigid. This pass
  // makes the deck behave like a physical card stack:
  //
  // 1. DRAG — the front card follows the finger 1:1. Back cards move
  //    at ~32% of the drag (parallax). Beyond a commit threshold the
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
  const PARALLAX_BACK = 0.14     // back cards' share of the drag — dialled
                                 // back from 0.32 so the back cards sit
                                 // anchored while the front card carries
                                 // most of the drag motion.
  const TILT_PER_100PX = 4       // degrees of tilt per 100 px drag (+2 vs prior pass)

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
      // of a swipe doesn't prematurely kill the deck drag — the lock is a
      // one-way decision per gesture, so being trigger-happy about
      // 'vertical' here made the deck feel like it "broke" on whichever
      // drag direction happened to have a slightly steeper early angle.
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

  // Top margin per Figma Feed 1:20 → Collection.Hero sits at y:143
  // with Account Sanpshot above ending at y:127, so the gap is 16px
  // (mt-4). Previously mt-9.
  return (
    <section id="hero" className="mt-4">
      <div className="mx-auto relative" style={{ width: 370, height: 497 }}>
        {/* Drag surface covers the whole card stack. Cards themselves
            are pointer-events:none so taps fall through to this surface
            (except the Shop button which stops propagation). */}
        <div
          className="absolute"
          style={{ left: 0, top: 0, width: 370, height: 445, touchAction: 'pan-y', cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}
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
              // PARALLAX_BACK (~32%) so depth reads naturally.
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
                    scaleFontHeader={slot.scaleFooter}
                    scaleHeader={slot.scaleFooter}
                  />
                </div>
              )
            })}
          </div>
        </div>
        {/* Pagination — 3 dots at y=461, centred horizontally. Active
            dot is white, others are #808080. */}
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
    </section>
  )
}
const HeroCarousel = DeckCarousel

// Card.Collection.Square (Figma 1:1072 pattern)
// 370 wide card, 24px radius, rgba(129,129,129,0.2) background
// Each tile: 136×136, 24px radius, 64px brand logo centered, 64px caption below
type TileItem = {
  brand?: keyof typeof BRANDS
  name: string
  back?: string
  src?: string
  tileBg?: string
}

const TileGroup = ({
  id,
  title,
  subtitle,
  inlineTitle = false,
  trailing,
  items,
  showSeeMore = true,
}: {
  id?: string
  title: string
  subtitle?: string
  // When true, title + subtitle render on the same line (e.g. "Find your sound"),
  // and the card height collapses to the single-line 291px size.
  inlineTitle?: boolean
  trailing?: React.ReactNode
  items: TileItem[]
  showSeeMore?: boolean
}) => (
  <section id={id} className="mt-4 px-4">
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        margin: '0 auto',
        borderRadius: 24,
        background: 'rgba(129,129,129,0.2)',
        // 2-line title → 314h, 1-line title (no subtitle OR inlineTitle) → 291h
        height: subtitle && !inlineTitle ? 314 : 291,
      }}
    >
      <div className="px-4 pt-4">
        <SectionTitle
          white={title}
          blue={subtitle}
          inline={inlineTitle}
          trailing={trailing}
          size="text-[24px]"
        />
      </div>
      <HScroll className="px-4">
        {items.map((it) => (
          <div key={it.name} className="shrink-0" style={{ width: 136 }}>
            <div
              className="relative overflow-hidden"
              style={{
                width: 136,
                height: 136,
                borderRadius: 24,
                background: it.tileBg ?? '#fff',
              }}
            >
              {it.src ? (
                <img
                  src={it.src}
                  alt={it.name}
                  className="absolute pointer-events-none object-cover"
                  style={{
                    width: 64,
                    height: 64,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ) : it.brand ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrandBadge brand={it.brand} size={120} rounded="rounded-none" />
                </div>
              ) : null}
            </div>
            <div className="pt-2">
              <p
                className="font-text text-white"
                style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, padding: '8px 4px 0' }}
              >
                {it.name}
              </p>
              <p
                className="font-text"
                style={{
                  fontSize: 12,
                  lineHeight: '16px',
                  color: 'rgba(255,255,255,0.72)',
                  padding: '0 4px',
                }}
              >
                Pay later
              </p>
              {it.back && (
                <p
                  className="font-text"
                  style={{ fontSize: 12, lineHeight: '16px', color: '#60cdff', padding: '0 4px' }}
                >
                  {it.back}
                </p>
              )}
            </div>
          </div>
        ))}
        {showSeeMore && (
          <div className="shrink-0 flex items-center" style={{ width: 136, height: 136 }}>
            <button
              type="button"
              className="font-text text-white"
              style={{
                width: 96,
                height: 40,
                margin: '0 auto',
                background: 'rgba(204,204,204,0.28)',
                border: '1px solid rgba(129,129,129,0.2)',
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              See More
            </button>
          </div>
        )}
      </HScroll>
    </div>
  </section>
)

// Card.NBA.List (Figma 15:371) — Extra points list
// Outer 370×397 with solid `rgb(16,26,51)` dark-navy fill
// Inner Card.List 338×291 at left:16 top:90 — holds 4 row blocks
// Each row 338×72 with `rgba(129,129,129,0.2)` fill
//   - first row: rounded top corners (24px)
//   - last row:  rounded bottom corners (24px)
//   - 1px gap between rows (navy outer shows through as the divider)
const ExtraPoints = () => {
  const rows = [
    { back: '5% back', src: '/images/brand-uniqlo.png', bg: '#ec1d24', inset: '12.5%' },
    { back: '3% back', src: '/images/brand-ultabeauty.png' },
    { back: '2% back', src: '/images/brand-hm.png' },
    { back: '5% back', src: '/images/brand-apple.png' },
  ]
  return (
    <section id="extra-points" className="mt-4 px-4">
      <div
        className="relative overflow-hidden"
        style={{ width: 370, height: 397, margin: '0 auto', borderRadius: 24, background: 'rgb(16, 26, 51)' }}
      >
        {/* Card.Header — 58 tall, at top:16 left:16 */}
        <div className="absolute" style={{ left: 16, top: 16, width: 338, height: 58 }}>
          <div className="absolute" style={{ left: 2, top: 2, width: 298, height: 56 }}>
            <h2
              className="font-display font-black text-white"
              style={{ fontSize: 24, lineHeight: '28px', letterSpacing: '-1px', margin: 0 }}
            >
              Extra points.
              <br />
              <span style={{ color: '#60cdff' }}>Limited time.</span>
            </h2>
          </div>
        </div>

        {/* Card.List wrapper at left:16 top:90, 338×291 */}
        <div className="absolute" style={{ left: 16, top: 90, width: 338, height: 291 }}>
          {rows.map((r, i) => {
            const isFirst = i === 0
            const isLast = i === rows.length - 1
            return (
              <div
                key={i}
                className="absolute overflow-hidden"
                style={{
                  left: 0,
                  top: i * 73, // 72h + 1px gap
                  width: 338,
                  height: 72,
                  background: 'rgba(129,129,129,0.2)',
                  borderTopLeftRadius: isFirst ? 24 : 0,
                  borderTopRightRadius: isFirst ? 24 : 0,
                  borderBottomLeftRadius: isLast ? 24 : 0,
                  borderBottomRightRadius: isLast ? 24 : 0,
                }}
              >
                {/* Row content — Card.Footer at left:0 top:16, 338×40 */}
                <div className="absolute" style={{ left: 0, top: 16, width: 338, height: 40 }}>
                  {/* Avatar 40×40 at left:16 */}
                  <div
                    className="absolute overflow-hidden"
                    style={{
                      left: 16,
                      top: 0,
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: r.bg ?? 'transparent',
                      border: '1px solid rgba(204,204,204,0.28)',
                    }}
                  >
                    {r.inset ? (
                      <img
                        src={r.src}
                        alt=""
                        className="absolute pointer-events-none"
                        style={{
                          left: r.inset,
                          top: r.inset,
                          width: `calc(100% - 2 * ${r.inset})`,
                          height: `calc(100% - 2 * ${r.inset})`,
                          maxWidth: 'none',
                        }}
                      />
                    ) : (
                      <img
                        src={r.src}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />
                    )}
                  </div>

                  {/* Leading content at left:68, width 188 */}
                  <div className="absolute" style={{ left: 68, top: 0, width: 188, height: 40 }}>
                    <p
                      className="absolute text-white"
                      style={{ left: 0, top: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500, margin: 0 }}
                    >
                      {r.back}
                    </p>
                    <p
                      className="absolute"
                      style={{
                        left: 0,
                        top: 24,
                        fontSize: 12,
                        lineHeight: '16px',
                        color: 'rgba(255,255,255,0.72)',
                        margin: 0,
                      }}
                    >
                      Today Only
                    </p>
                  </div>

                  {/* Shop button — 54×32 at left:268 top:4 */}
                  <button
                    type="button"
                    className="absolute flex items-center justify-center text-white"
                    style={{
                      left: 268,
                      top: 4,
                      width: 54,
                      height: 32,
                      background: 'rgba(204,204,204,0.28)',
                      border: '1px solid rgba(129,129,129,0.2)',
                      borderRadius: 24,
                      fontSize: 12,
                      lineHeight: '16px',
                      fontWeight: 500,
                    }}
                  >
                    Shop
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// Card.Colection.Spotlight (Figma 15:1577 — "This weeks spring heros")
// Container: 370×420, rgba(129,129,129,0.2) bg, 24px radius
// Each spotlight card: 250×314 with 40px avatar, 5% back badge, 174×174 product image, footer
type SpotlightCard = {
  name: string
  back: string
  avatar: string
  avatarBg?: string
  avatarInset?: string
  product: string
  // Image positioning per Figma (each product image has unique offset/scale)
  imgStyle?: React.CSSProperties
}
const SPRING_HEROS: SpotlightCard[] = [
  {
    name: 'Nike',
    back: '5% back',
    avatar: '/images/brand-nike.png',
    avatarBg: '#000',
    product: '/images/hero-nike.png',
    imgStyle: { height: '201.87%', width: '131.18%', left: '-15.59%', top: '-50.93%' },
  },
  {
    name: 'Uniqlo',
    back: '5% back',
    avatar: '/images/brand-uniqlo.png',
    avatarBg: '#ec1d24',
    avatarInset: '10%',
    product: '/images/spring-uniqlo.png',
    imgStyle: { height: '203.52%', width: '132.26%', left: '-16.13%', top: '-51.76%' },
  },
  {
    name: 'New Balance',
    back: '3% back',
    avatar: '/images/brand-newbalance.png',
    product: '/images/spring-newbalance.png',
    imgStyle: { height: '198.85%', width: '149.29%', left: '-24.64%', top: '-49.43%' },
  },
  {
    name: 'Nike',
    back: '5% back',
    avatar: '/images/brand-nike.png',
    avatarBg: '#000',
    product: '/images/spring-nike2.png',
    imgStyle: { height: '214.94%', width: '161.37%', left: '-30.68%', top: '-53.74%' },
  },
  {
    name: 'KITH',
    back: '3% back',
    avatar: '/images/brand-kith.png',
    product: '/images/spring-kith.png',
    imgStyle: { height: '181.61%', width: '136.34%', left: '-18.17%', top: '-40.8%' },
  },
]

// Generic spotlight collection — matches Figma `Card.Colection.Spotlight`
// Used for Spring heros (with subtitle + AI orb) and Top tec gifts (single-line title)
const SpotlightSection = ({
  id,
  title,
  subtitle,
  inlineTitle = false,
  withOrb,
  cards,
  cardHeight = 420,
}: {
  id: string
  title: string
  subtitle?: string
  inlineTitle?: boolean
  withOrb?: boolean
  cards: SpotlightCard[]
  cardHeight?: number
}) => (
  <section id={id} className="mt-4 px-4">
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        margin: '0 auto',
        height: cardHeight,
        borderRadius: 24,
        // Figma uses rgba(129,129,129,0.2) for both this container and the
        // inner cards. Outer composites over black → #1a1a1a.
        background: 'rgba(129,129,129,0.2)',
      }}
    >
      <div className="px-4 pt-4">
        <SectionTitle
          white={title}
          blue={subtitle}
          inline={inlineTitle}
          trailing={withOrb ? <AiOrb /> : undefined}
          size="text-[24px]"
        />
      </div>
      <HScroll className="px-4 pt-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className="shrink-0 relative overflow-hidden"
            style={{
              width: 250,
              height: 314,
              borderRadius: 12,
              // Inner card sits on top of #1a1a1a — second layer of the same
              // translucent fill composites to ~#2f2f2f. Use the solid value
              // so we don't depend on CSS stacking.
              background: 'rgba(129,129,129,0.2)',
            }}
          >
            {/* Header — avatar + badge */}
            <div className="absolute" style={{ left: 16, top: 16, right: 16, height: 40 }}>
              <div
                className="absolute overflow-hidden"
                style={{
                  left: 0,
                  top: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: card.avatarBg ?? 'transparent',
                  border: '1px solid rgba(204,204,204,0.28)',
                }}
              >
                {card.avatarInset ? (
                  <img
                    src={card.avatar}
                    alt=""
                    className="absolute object-cover pointer-events-none"
                    style={{
                      left: card.avatarInset,
                      top: card.avatarInset,
                      width: `calc(100% - 2 * ${card.avatarInset})`,
                      height: `calc(100% - 2 * ${card.avatarInset})`,
                    }}
                  />
                ) : (
                  <img
                    src={card.avatar}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}
              </div>
              <div
                className="absolute flex items-center justify-center"
                style={{
                  right: 0,
                  top: 0,
                  width: 65,
                  height: 24,
                  background: '#002991',
                  borderRadius: 4,
                }}
              >
                <span className="font-text" style={{ fontSize: 12, color: '#60cdff', fontWeight: 500 }}>
                  {card.back}
                </span>
              </div>
            </div>
            {/* Product image — 174×174 framed area at left:38 top:72 with the image overflowing per Figma */}
            <div className="absolute overflow-hidden" style={{ left: 38, top: 72, width: 174, height: 174 }}>
              <img
                src={card.product}
                alt={card.name}
                className="absolute max-w-none pointer-events-none"
                style={card.imgStyle}
              />
            </div>
            {/* Footer — name + Pay later */}
            <div className="absolute" style={{ left: 16, right: 16, top: 262 }}>
              <p
                className="font-text text-white"
                style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, margin: 0 }}
              >
                {card.name}
              </p>
              <p
                className="font-text"
                style={{
                  fontSize: 12,
                  lineHeight: '16px',
                  color: 'rgba(255,255,255,0.72)',
                  margin: 0,
                }}
              >
                Pay later
              </p>
            </div>
          </div>
        ))}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 125, height: 314 }}
        >
          <button
            type="button"
            className="font-text text-white"
            style={{
              width: 96,
              height: 40,
              background: 'rgba(204,204,204,0.28)',
              border: '1px solid rgba(129,129,129,0.2)',
              borderRadius: 24,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            See More
          </button>
        </div>
      </HScroll>
    </div>
  </section>
)

// Spring heros (Figma 15:1577) — uses the generic SpotlightSection
const SpringHeros = () => (
  <SpotlightSection
    id="spring-heros"
    title="This weeks spring"
    subtitle="heros"
    cards={SPRING_HEROS}
    cardHeight={420}
  />
)

// Top tec gifts (Figma 15:5177) — same Spotlight pattern, shorter card height (no subtitle)
const TOP_TEC_GIFTS: SpotlightCard[] = [
  {
    name: 'Sony',
    back: '3% back',
    avatar: '/images/brand-sony.png',
    product: '/images/product-sony.png',
    imgStyle: { height: '200.57%', width: '150.57%', left: '-25.29%', top: '-50.28%' },
  },
  {
    name: 'Samsung',
    back: '5% back',
    avatar: '/images/brand-samsung.png',
    product: '/images/product-samsung.png',
    imgStyle: { height: '205.16%', width: '154.02%', left: '-27.01%', top: '-52.58%' },
  },
  {
    name: 'Microsoft',
    back: '5% back',
    avatar: '/images/brand-microsoft.png',
    avatarBg: '#fff',
    avatarInset: '12.5%',
    product: '/images/product-microsoft.png',
    imgStyle: { height: '169.94%', width: '127.59%', left: '-13.79%', top: '-34.97%' },
  },
  {
    name: 'Best Buy',
    back: '5% back',
    avatar: '/images/brand-bestbuy.png',
    avatarBg: '#fff',
    avatarInset: '10%',
    product: '/images/product-bestbuy.png',
    imgStyle: { height: '174.54%', width: '131.03%', left: '-15.52%', top: '-37.27%' },
  },
  {
    name: 'HP',
    back: '3% back',
    avatar: '/images/brand-hp.png',
    product: '/images/product-hp.png',
    imgStyle: { height: '95.27%', width: '71.26%', left: '14.37%', top: '2.37%' },
  },
]

const TopTecGifts = () => (
  <SpotlightSection
    id="tec-gifts"
    title="Top tec gifts"
    cards={TOP_TEC_GIFTS}
    cardHeight={397}
  />
)

// Card.Collection.Fanned (Figma 15:1666 — "Stream more. Pay less.")
// Five black 2:3 tiles arranged in a fan, each with a circular streaming-service logo
// Front Netflix: 175×271, rotation 0
// 2nd ring (±8°): 167.7×256 with -8°/+8°
// 3rd ring (±16°): 157.9×241 with -16°/+16°
// StreamCards — Card.Collection.Fanned (Figma 15:1666)
// Properly animated fan carousel: each tile keeps its identity and animates
// between fan slots as `active` changes. Drag the deck horizontally — the
// front card slides into the back-left/right position while the next card
// rotates forward to become the new front. Wrap-around tile fades through
// its transition to avoid a visible cross-screen jump.
type StreamTileData = { src: string; name: string; back: string }
const STREAM_TILES: StreamTileData[] = [
  // The numbered stream files don't map to obvious brands by name.
  // Mapping was verified visually: stream-1 = Sling, stream-2 = Spotify,
  // stream-3 = Disney+, stream-4 = Hulu, stream-netflix = Netflix.
  { src: '/images/stream-1.png', name: 'Sling', back: '5% back' },
  { src: '/images/stream-3.png', name: 'Disney+', back: '2% back' },
  { src: '/images/stream-netflix.png', name: 'Netflix', back: '3% back' },
  { src: '/images/stream-2.png', name: 'Spotify', back: '4% back' },
  { src: '/images/stream-4.png', name: 'Hulu', back: '3% back' },
]

// Slot geometry keyed by offset-from-front (range -2..+2). Each slot's
// translate (x,y) puts the card center at the appropriate fan position.
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
  // -3 and +3 are off-screen positions used during wrap transitions so the
  // back-row card can slide off one side while a duplicate slides in from
  // the opposite side. They are intentionally further out + more rotated
  // than the -2 / +2 slots so they stay clipped by the section's
  // overflow:hidden.
  [-3]: { x: -260, y: 24, w: 148, h: 226, rotate: -24, z: 0, isFront: false },
  [-2]: { x: -161.17, y: 9.55, w: 157.868, h: 241.083, rotate: -16, z: 1, isFront: false },
  [-1]: { x: -79.38, y: -8.83, w: 167.742, h: 256.029, rotate: -8, z: 2, isFront: false, shadow: 'mid' },
  [0]:  { x: 0.5, y: -9.2, w: 175, h: 271, rotate: 0, z: 4, isFront: true, shadow: 'strong' },
  [1]:  { x: 79.17, y: -8.83, w: 167.742, h: 256.029, rotate: 8, z: 2, isFront: false, shadow: 'mid' },
  [2]:  { x: 161.16, y: 9.42, w: 157.973, h: 241.106, rotate: 16, z: 1, isFront: false },
  [3]:  { x: 260, y: 24, w: 148, h: 226, rotate: 24, z: 0, isFront: false },
}

// Wrap state per tile: which way it wraps (its OLD slot was on the left or
// right side) and whether we're still in the pre-paint snap frame or have
// kicked off the off-screen slide-in / slide-out transitions.
type WrapEntry = { dir: 'left' | 'right'; phase: 'snap' | 'fly' }

const StreamCards = () => {
  const [active, setActive] = useState(2) // tile in the front position
  const prevActiveRef = useRef(active)
  // Tiles mid-wrap: rendered as a "ghost" sliding off-screen the old side
  // and a "main" sliding in from the opposite off-screen side, so neither
  // back slot is ever empty during the transition.
  const [wrapMap, setWrapMap] = useState<Map<number, WrapEntry>>(new Map())
  const N = STREAM_TILES.length

  // Find a tile's signed offset from the active position, taking the shortest
  // path around the ring so transitions don't cross the whole carousel.
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
  // Previously this used a "drag past 56px → snap" pattern which felt
  // jerky on the bare-mode mobile share URL (scaled viewport changes
  // the relationship between finger travel and card travel, and a
  // binary snap can't compensate). New pattern matches the Deck:
  // front card tracks the finger live, back cards parallax subtly,
  // release commits on EITHER distance or velocity threshold.
  const COMMIT_PX = 56
  const FLICK_VELOCITY = 0.5     // px/ms — fast flick still commits
  const MAX_RUBBER_BAND = 120    // px — visible drag past commit
  const PRESS_SCALE = 1.02       // front-tile lift on press
  const PARALLAX_BACK = 0.22     // back tiles' share of the drag
  const TILT_PER_100PX = 2       // degrees of additional front tilt
  // Unified release spring for every tile. Five tiles re-balancing
  // simultaneously must arrive together, so they share one curve and
  // one duration. Includes width/height/box-shadow so a back tile that
  // becomes the front (or vice versa) grows/shrinks SMOOTHLY in sync
  // with its translate — previously width/height popped instantly,
  // which read as the "jerky snap" the user was seeing. The curve is
  // damped (no overshoot) so the five tiles don't visually compete.
  // `filter` runs on its own snappier 220ms because the press-lift
  // drop shadow is a property of the foreground tile only and should
  // feel responsive, not springy.
  const RELEASE_SPRING =
    'transform 460ms cubic-bezier(0.22, 0.85, 0.25, 1), width 460ms cubic-bezier(0.22, 0.85, 0.25, 1), height 460ms cubic-bezier(0.22, 0.85, 0.25, 1), box-shadow 460ms cubic-bezier(0.22, 0.85, 0.25, 1), opacity 320ms ease, filter 220ms ease'

  const [dragX, setDragX] = useState(0)
  const [pressed, setPressed] = useState(false)
  // While the user is actively dragging we turn transitions OFF so
  // the front tile tracks the finger pixel-for-pixel. On release we
  // turn them back ON so the spring-back / commit animates smoothly.
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
      // of a swipe doesn't prematurely kill the drag (see DeckCarousel).
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
    <section id="stream" className="mt-4 px-4">
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
          <SectionTitle white="Stream more." blue="Pay less." size="text-[24px]" />
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
            {/* The fan container — cards are positioned relative to its center */}
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
                  return node ? [node] : ([] as React.ReactElement[])
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
                // while fading out. The user sees a card slide off one
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
                return [mainNode, ghostNode].filter(
                  (n): n is React.ReactElement => n != null,
                )
              })}
            </div>
          </div>
        </div>
        {/* Pagination — OUTSIDE the drag surface so clicks aren't swallowed
            by pointer capture. Positioned at the same y as before. */}
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
    </section>
  )
}


// Card.NBA.Spotlight (Figma 15:4039 — "Crypto made simple, start with just $1.")
// 370×493, rgb(16,26,51) bg, 24px radius
// Header 338×136 at left:16 top:16 — 48px avatar centered + headline
// Image 338×253 at top:168 (coins illustration)
// Footer 338×40 at top:437 — two side-by-side buttons
const CryptoPromo = () => (
  <section id="crypto" className="mt-4 px-4">
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        margin: '0 auto',
        height: 493.006,
        borderRadius: 24,
        background: 'rgb(16, 26, 51)',
      }}
    >
      {/* Header */}
      <div className="absolute" style={{ left: 16, top: 16, width: 338, height: 136 }}>
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: 145,
            top: 8,
            width: 48,
            height: 48,
            borderRadius: 999,
            background: 'rgba(204,204,204,0.28)',
          }}
        >
          <img src="/images/crypto-icon.svg" alt="" style={{ width: 20, height: 20 }} />
        </div>
        <h2
          className="absolute font-display text-center text-white"
          style={{
            left: '50%',
            top: 68,
            transform: 'translateX(-50%)',
            width: 306,
            fontSize: 32,
            lineHeight: '32px',
            letterSpacing: '-1px',
            fontWeight: 900,
            margin: 0,
          }}
        >
          <span>Crypto made simple, </span>
          <span style={{ color: '#60cdff' }}>start with just $1.</span>
        </h2>
      </div>
      {/* Coins illustration */}
      <div className="absolute" style={{ left: 16, top: 168, width: 338, height: 253.006 }}>
        <img
          src="/images/crypto-coins.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      {/* Footer — two buttons */}
      <div className="absolute" style={{ left: 16, top: 437.006, width: 338, height: 40 }}>
        <button
          type="button"
          className="absolute font-text text-white"
          style={{
            left: 0,
            top: 0,
            width: 163,
            height: 40,
            background: 'rgba(204,204,204,0.28)',
            border: '1px solid rgba(129,129,129,0.2)',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Learn More
        </button>
        <button
          type="button"
          className="absolute font-text text-white"
          style={{
            left: 175,
            top: 0,
            width: 163,
            height: 40,
            background: 'rgba(204,204,204,0.28)',
            border: '1px solid rgba(129,129,129,0.2)',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Buy Crypto
        </button>
      </div>
    </div>
  </section>
)

// Track orders — Card.NBA.Spotlight (Figma 24:2460). Full-bleed package
// illustration with a single full-width action button.
const TrackOrders = () => (
  <section id="track-orders" className="mt-4 px-4">
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        margin: '0 auto',
        height: 433.006,
        borderRadius: 24,
        background: 'rgb(16, 26, 51)',
      }}
    >
      {/* Header */}
      <div className="absolute" style={{ left: 16, top: 16, width: 338, height: 76 }}>
        <div className="absolute" style={{ left: 16, top: 8, width: 306, height: 64 }}>
          <h2
            className="absolute font-display text-center text-white"
            style={{
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: 306,
              fontSize: 32,
              lineHeight: '32px',
              letterSpacing: '-1px',
              fontWeight: 900,
              margin: 0,
            }}
          >
            <span>Track orders to</span>
            <br />
            <span style={{ color: '#60cdff' }}>your doorstep</span>
          </h2>
        </div>
      </div>
      {/* Illustration */}
      <div className="absolute" style={{ left: 16, top: 108, width: 338, height: 253.006 }}>
        <img
          src="/images/track-orders.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-bottom pointer-events-none"
        />
      </div>
      {/* Footer — full-width Link Email button */}
      <div className="absolute" style={{ left: 16, top: 377.01, width: 338, height: 40 }}>
        <button
          type="button"
          className="text-white"
          style={{
            width: 338,
            height: 40,
            background: 'rgba(204,204,204,0.28)',
            border: '1px solid rgba(129,129,129,0.2)',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Link Email
        </button>
      </div>
    </div>
  </section>
)

// PayPal Cashback Mastercard — Card.NBA.Carousel (Figma 24:1855). Big
// dark-navy promo card with a 3-card swipable carousel, caption, pagination
// dots, and footer with $0-interest copy + Apply button.
//
// Each card has its own design. The active card occupies the FRONT slot
// (largest, on top); the next/previous cards sit in the MID and BACK slots.
// Drag horizontally to rotate the deck, vertical drags pass through to the
// page so the feed keeps scrolling.

// Three card variants per Figma 24:1855.
// "front" → dark-navy w/ chip+contactless+large PayPal P monogram (a unique
//   illustrated treatment built from cropped regions of paypal-mastercard.png)
// "cyan"  → cyan bg with full "PayPal" wordmark in black + small "Credit"
//   label + Mastercard digital logo at right
// "navy"  → dark-blue bg with full "PayPal" wordmark in cyan + small "Debit"
//   label + Mastercard logo at right
type MCVariant = 'front' | 'cyan' | 'navy'
type MCDesign = { variant: MCVariant; bg: string; lighting: string }
const MC_DESIGNS: MCDesign[] = [
  { variant: 'front', bg: '#152045', lighting: '/images/lighting-front.svg' },
  { variant: 'cyan', bg: '#60cdff', lighting: '/images/lighting-middle.svg' },
  { variant: 'navy', bg: '#002991', lighting: '/images/lighting-back.svg' },
]

// Slot 0 = front, 1 = middle, 2 = back. Each slot has fixed visual props.
const MC_SLOTS = [
  { y: 6, w: 244.444, h: 154, radius: 9.208, z: 3, shadow: true },
  { y: -16, w: 225.397, h: 142, radius: 8.521, z: 2, shadow: true },
  { y: -38, w: 206.349, h: 130, radius: 7.844, z: 1, shadow: false },
]

// Front card content — chip+waves + large PayPal P monogram cropped from
// paypal-mastercard.png (Figma values from `PayPal-Cashback-Mastercard.png 1/2`)
const FrontCardContent = ({ scale }: { scale: number }) => (
  <>
    {/* Logo group is positioned via Figma's Card 1 → Logo: centered in card */}
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
        <rect
          x="0.4"
          y="2.4"
          width="13.0"
          height="15.1"
          rx="2.2"
          ry="2.2"
          fill="#DCDFE2"
        />
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
      src="/images/mastercard-logo.svg"
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
  const logo = variant === 'cyan' ? '/images/paypal-logo-2.svg' : '/images/paypal-logo-line.svg'
  const logoW = variant === 'cyan' ? 209.708 : 193.066
  const logoH = variant === 'cyan' ? 69.906 : 64.359
  const textLabel = variant === 'cyan' ? '/images/text-credit.svg' : '/images/text-debit.svg'
  const mcDigital =
    variant === 'cyan' ? '/images/mastercard-digital-2.svg' : '/images/mastercard-digital.svg'
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

const PayPalMastercardPromo = () => {
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
    <section id="paypal-mastercard" className="mt-4 px-4">
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
    </section>
  )
}

// Refresh your space — Card.Colection.Spotlight (Figma 24:2833) — uses
// the SpotlightSection pattern with 5 furniture product cards
const REFRESH_SPACE: SpotlightCard[] = [
  {
    name: 'Ikea',
    back: '5% back',
    avatar: '/images/brand-ikea.png',
    product: '/images/product-ikea-chair.png',
    imgStyle: { height: '165.22%', width: '124.04%', left: '-17.52%', top: '-32.34%' },
  },
  {
    name: 'Crate & Barrel',
    back: '5% back',
    avatar: '/images/brand-cratebarrel.png',
    avatarBg: '#ad2b1e',
    product: '/images/product-cratebarrel.png',
    imgStyle: { height: '194.26%', width: '145.84%', left: '-22.92%', top: '-47.13%' },
  },
  {
    name: 'Target',
    back: '3% back',
    avatar: '/images/brand-target.png',
    product: '/images/product-target.png',
    imgStyle: { width: '100%', height: '100%', left: 0, top: 0, objectFit: 'cover' },
  },
  {
    name: "Macy's",
    back: '2% back',
    avatar: '/images/brand-macys.png',
    avatarBg: '#fff',
    avatarInset: '9.99%',
    product: '/images/product-macys.png',
    imgStyle: { height: '190.81%', width: '143.25%', left: '-21.63%', top: '-45.41%' },
  },
  {
    name: 'Shein',
    back: '5% back',
    avatar: '/images/brand-shein.png',
    product: '/images/product-shein.png',
    imgStyle: { height: '165.52%', width: '124.27%', left: '-12.13%', top: '-32.76%' },
  },
]

const RefreshSpace = () => (
  <SpotlightSection
    id="refresh-space"
    title="Refresh"
    subtitle="your space"
    inlineTitle
    cards={REFRESH_SPACE}
    cardHeight={397}
  />
)

// ---------- Feed ----------

const Feed = () => (
  <div className="text-white">
    <div id="top" />
    {/* StatusBar + SearchBell are rendered ONCE by PhoneShell (above the
        scroll containers) so they stay fixed across the wallet ↔ feed
        transition. We reserve their vertical space here with a spacer so
        the first card lines up where it always did. */}
    <div aria-hidden style={{ height: 116 }} />
    {/* Above-the-fold cards mount with a quick reveal (small lift, fast) so
        the screen doesn't feel empty on first paint, but they're already on
        screen so the motion is subtle. */}
    <Reveal tilt={4}>
      <AccountSnapshot />
    </Reveal>
    <Reveal tilt={4} delay={60}>
      <TopStoresRow />
    </Reveal>
    {/* 20px extra padding above the Deck Collection (HeroCarousel). */}
    <div aria-hidden style={{ height: 20 }} />
    <Reveal tilt={5} delay={120}>
      <HeroCarousel />
    </Reveal>

    {/* Extra 20px between the hero pagination dots and the NYC tile group */}
    <div aria-hidden style={{ height: 20 }} />

    {/* Below-the-fold cards get the full perspective tilt as you scroll in. */}
    <Reveal>
      <TileGroup
        id="nyc"
        title="New York City"
        subtitle="shopper favorites"
        items={[
          { name: 'Uniqlo', back: '5% back', src: '/images/brand-uniqlo.png', tileBg: '#ec1d24' },
          { name: 'KITH', back: '3% back', src: '/images/brand-kith.png', tileBg: '#fff' },
          { name: 'Farfetch', back: '5% back', src: '/images/brand-farfetch.png', tileBg: '#fff' },
          { name: 'Nike', back: '5% back', src: '/images/brand-nike.png', tileBg: '#000' },
          { name: 'Apple', back: '2% back', src: '/images/brand-apple.png', tileBg: '#fff' },
        ]}
      />
    </Reveal>

    <Reveal>
      <ExtraPoints />
    </Reveal>
    <Reveal>
      <SpringHeros />
    </Reveal>
    <Reveal>
      <StreamCards />
    </Reveal>

    <Reveal>
      <TileGroup
        id="spring-essentials"
        title="Spring essentials."
        subtitle="Pay later."
        items={[
          { name: 'Zara', back: '5% back', src: '/images/brand-zara.png', tileBg: '#fff' },
          { name: 'Crocs', back: '3% back', src: '/images/brand-crocs.png', tileBg: '#83bb00' },
          { name: 'REI', back: '5% back', src: '/images/brand-rei.png', tileBg: '#fff' },
          { name: 'H&M', back: '5% back', src: '/images/brand-hm.png', tileBg: '#fff' },
          { name: 'Lululemon', back: '3% back', src: '/images/brand-lululemon.png', tileBg: '#d2202f' },
        ]}
      />
    </Reveal>

    <Reveal>
      <TileGroup
        id="boutiques"
        title="Boutiques & breakouts"
        items={[
          { name: 'Etsy', back: '3% back', src: '/images/brand-etsy.png', tileBg: '#f66303' },
          { name: 'KITH', back: '2% back', src: '/images/brand-kith.png', tileBg: '#fff' },
          { name: 'Rimowa', back: '3% back', src: '/images/brand-rimowa.png', tileBg: '#fff' },
          { name: 'Michael Kors', back: '5% back', src: '/images/brand-michaelkors.png', tileBg: '#fff' },
          { name: 'Ulta Beauty', back: '3% back', src: '/images/brand-ultabeauty.png', tileBg: '#f67c39' },
        ]}
      />
    </Reveal>

    <Reveal>
      <CryptoPromo />
    </Reveal>
    <Reveal>
      <TopTecGifts />
    </Reveal>

    <Reveal>
      <TileGroup
        id="big-styles"
        title="Big styles."
        subtitle="Small payments."
        items={[
          { name: 'Shein', back: '5% back', src: '/images/brand-shein.png', tileBg: '#fff' },
          { name: 'Label', back: '3% back', src: '/images/brand-llbean.png', tileBg: '#2e6047' },
          { name: 'Target', back: '5% back', src: '/images/brand-target.png', tileBg: '#fff' },
          { name: 'The North Face', back: '5% back', src: '/images/brand-northface.png', tileBg: '#e72b25' },
          { name: 'Zara', back: '3% back', src: '/images/brand-zara.png', tileBg: '#fff' },
        ]}
      />
    </Reveal>

    {/* --- 5 NEW CARDS (Figma 24:1855, 24:2464, 24:2833, 24:2462, 24:2460) --- */}

    <Reveal>
      <PayPalMastercardPromo />
    </Reveal>

    <Reveal>
      <TileGroup
        id="see-better"
        title="See better."
        subtitle="Look even better."
        items={[
          { name: 'Zenni', back: '5% back', src: '/images/brand-zenni.png', tileBg: '#0a3f47' },
          { name: 'Warby Parker', back: '5% back', src: '/images/brand-warbyparker.png', tileBg: '#00a3e2' },
          { name: 'Frames Direct', back: '3% back', src: '/images/brand-framesdirect.png', tileBg: '#fff' },
          { name: 'Lnes Crafteres', back: '3% back', src: '/images/brand-linescrafters.png', tileBg: '#192b4f' },
          { name: 'Shady Rays', back: '5% back', src: '/images/brand-shadyrays.png', tileBg: '#fff' },
        ]}
      />
    </Reveal>

    <Reveal>
      <RefreshSpace />
    </Reveal>

    <Reveal>
      <TileGroup
        id="find-your-sound"
        title="Find"
        subtitle="your sound"
        inlineTitle
        items={[
          { name: 'Reverb', back: '5% Back', src: '/images/brand-reverb.png', tileBg: '#f6870f' },
          { name: 'Guitar Center', back: '3% back', src: '/images/brand-guitarcenter.png', tileBg: '#eb1c24' },
          { name: 'Sam Ash', back: '5% back', src: '/images/brand-samash.png', tileBg: '#e91f31' },
          { name: "Musician's Friend", back: '3% back', src: '/images/brand-musiciansfriend.png', tileBg: '#fff' },
          { name: 'Strymon', back: '5% back', src: '/images/brand-strymon.png', tileBg: '#000' },
        ]}
      />
    </Reveal>

    <Reveal>
      <TrackOrders />
    </Reveal>

    {/* Bottom padding so the last card isn't covered by the floating BottomNav */}
    <div style={{ height: 120 }} />
  </div>
)

// ---------- Bottom global navigation ----------
// Figma node 22:8049 — floating pill with 3 tabs (Home, Transfer, Me) pinned
// to the bottom of the viewport. 64px nav + 24px home-indicator space below.
// Active tab uses the same rgba(204,204,204,0.28) glass fill as the rest of
// the iOS-style controls in this prototype.

type TabKey = 'home' | 'transfer' | 'paypalplus' | 'me'
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
    icon: '/images/icon-home.svg',
    inset: { top: '7.51%', right: '8.33%', bottom: '8.32%', left: '8.34%' },
  },
  {
    // Display label "Transfer" (route key stays 'transfer', preserving
    // all navigation/routing behavior 1:1).
    key: 'transfer',
    label: 'Transfer',
    icon: '/images/icon-transfer.svg',
    inset: { top: '8.35%', right: '10.28%', bottom: '8.32%', left: '10.4%' },
  },
  {
    // PayPal+ — new fourth tab per Figma 102:21237 (trophy icon).
    // Insets come from the same node.
    key: 'paypalplus',
    label: 'PayPal+',
    icon: '/images/icon-trophy.svg',
    inset: { top: '8.4%', right: '6.17%', bottom: '9.3%', left: '6.44%' },
  },
  {
    key: 'me',
    label: 'Me',
    icon: '/images/icon-person.svg',
    inset: { top: '8.35%', right: '18.75%', bottom: '8.32%', left: '18.75%' },
  },
]

const BottomNav = ({
  active,
  onSelect,
}: {
  active: TabKey
  onSelect: (k: TabKey) => void
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
  const pillScaleX =
    travel === 'none' ? 1 : 1.06 // stretch slightly along travel axis
  const pillSkew = travel === 'none' ? 0 : travel === 'right' ? -2 : 2

  // Shared glass material per Figma node 93:2448 / 93:2454 → both the
  // 3-tab pill and the QR scan button use the same `Material Small`
  // surface: rgba(255,255,255,0.1) bg with Elevation Level 3 shadows.
  // The hairline inset highlight + backdrop blur match the iOS Liquid
  // Glass treatment used elsewhere in the prototype.
  const GLASS: React.CSSProperties = {
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
          {/* Sliding indicator pill — preserves the existing liquid
              animation behavior. Tracks the active tab's offsetLeft /
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
                {/* 24×24 slot with per-icon insets (preserved from the
                    prior nav and re-confirmed by Figma node 93:2449's
                    inset percentages). The icon nudges up slightly
                    when active for tactile press feedback. */}
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
            material, 24×24 qr-code glyph centered. No existing
            destination defined; the button is wired up but its
            onClick is a no-op so no nav behavior changes. */}
        <button
          type="button"
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
                src="/images/icon-qr.svg"
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

// ---------- Phone shell ----------

type TransitionPhase = 'idle' | 'exit' | 'enter'

// L0 background glow — Figma's blurred blue/cyan radials at the top of
// the phone viewport. Rendered ONCE inside PhoneShell so it's anchored
// to the top of the screen rather than scrolling with the feed/wallet
// content. The wrapper plays an infinite hue-cycle animation so the blue
// hues smoothly oscillate across the loop.
const L0Glow = () => (
  <div
    className="absolute pointer-events-none"
    style={{
      left: 0,
      top: 0,
      width: 402,
      height: 402,
      // z-stacks at the very back of the phone viewport so the glow
      // reads as the *base ambient layer* and UI elements (cards,
      // sheets, chrome) float over it with their own transparency.
      // Sheets that fully cover this PhoneShell-level glow render
      // their OWN <L0Glow /> as their first child so the glow is
      // present at every level of the experience — feed, wallet,
      // PayPal+, Bitcoin PDP, Crypto Overview, etc.
      zIndex: 1,
      overflow: 'hidden',
    }}
    aria-hidden
  >
    {/* Soft "dome" of deep navy at the very top of the viewport. Just
        dense enough to give the animated glow a consistent base so the
        perceived blue doesn't shift when the surface behind it changes
        (feed → wallet → sheet). Kept low-opacity and tight-radius on
        purpose — it should kiss the status-bar zone and be fully gone
        before it reaches any UI card or content. */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 75% 45% at 50% -10%, rgba(7,14,30,0.45) 0%, rgba(7,14,30,0.22) 35%, rgba(7,14,30,0) 65%)',
      }}
    />
    <div
      className="absolute inset-0"
      style={{
        // Layered radial gradients that match Figma's heavily-blurred L0
        // effect. The wrapping animation handles the hue shift + opacity.
        background:
          'radial-gradient(circle at 28% 18%, rgba(0,102,245,0.13) 0%, rgba(0,102,245,0) 55%), radial-gradient(circle at 70% 12%, rgba(96,205,255,0.11) 0%, rgba(96,205,255,0) 50%), radial-gradient(circle at 85% 28%, rgba(0,102,245,0.10) 0%, rgba(0,102,245,0) 45%)',
        animation: 'l0-hue-cycle 14s ease-in-out infinite',
        willChange: 'filter, opacity',
      }}
    />
    {/* L0 source SVG layered on top for the Figma-exact ellipse positioning */}
    <div
      className="absolute"
      style={{ top: '-84.13%', right: '-44.32%', bottom: 0, left: '-53.45%' }}
    >
      <img src="/images/l0-glow.svg" alt="" className="block max-w-none w-full h-full" />
    </div>
  </div>
)

// Per-view animation style for the two-phase wallet ↔ feed transition.
// `thisView` is which container we're styling. `displayView` is the view
// the orchestrator currently has on-stage. `phase` is the current step in
// the sequence.
//   exit  — only the displayed view is visible, playing the exit keyframe.
//   enter — only the displayed view is visible, playing the enter keyframe.
//   idle  — only the displayed view is visible, no animation.
// In every case the non-displayed view is fully hidden (opacity 0,
// pointer-events none) and waits off-stage at its enter-start position
// so the browser doesn't have to allocate a fresh layer when it's next
// brought back in.
const computeViewStyle = (
  thisView: AppView,
  displayView: AppView,
  phase: TransitionPhase,
): React.CSSProperties => {
  const isOnStage = thisView === displayView
  if (!isOnStage) {
    // Off-stage: hidden, pre-positioned for next entrance.
    return {
      opacity: 0,
      transform: 'translateY(24px) scale(1)',
      transition: 'none',
      animation: 'none',
      pointerEvents: 'none',
      willChange: 'opacity, transform',
    }
  }
  // On-stage. Behavior depends on phase.
  if (phase === 'exit') {
    return {
      // Phase 1 — exit keyframe owns opacity + transform.
      animation: 'view-exit 360ms cubic-bezier(0.32, 0, 0.4, 1) forwards',
      pointerEvents: 'none',
      willChange: 'opacity, transform',
    }
  }
  if (phase === 'enter') {
    return {
      // Phase 2 — enter keyframe. Slightly longer + softer easing than
      // exit so the incoming page settles in organically.
      animation: 'view-enter 520ms cubic-bezier(0.22, 0.61, 0.32, 1) forwards',
      pointerEvents: 'none',
      willChange: 'opacity, transform',
    }
  }
  // Idle — fully visible, no animation, interactive.
  return {
    opacity: 1,
    transform: 'translateY(0px) scale(1)',
    transition: 'none',
    animation: 'none',
    pointerEvents: 'auto',
  }
}

const PhoneShell = ({
  children,
  scrollRef,
  displayView,
  phase,
  bare = false,
  loading = false,
  error = false,
  onErrorRetry,
}: {
  children: React.ReactNode
  scrollRef: React.RefObject<HTMLDivElement | null>
  displayView: AppView
  phase: TransitionPhase
  // `bare` = mobile/share mode — strip the outer bezel chrome and the
  // dynamic island, since the device's own screen takes their role.
  bare?: boolean
  // Fake "Loading" state demo (Prototype menu → States accordion). Shows a
  // skeleton-shimmer overlay in place of the real feed content; purely
  // visual, driven by a timer in App(), not real loading state.
  loading?: boolean
  // Fake "Error" state demo (Prototype menu → States accordion). Shows the
  // Figma "Error.Load" connection-error screen in place of the real feed
  // content; purely visual, no real network state.
  error?: boolean
  onErrorRetry?: () => void
}) => {
  // Wallet, Transfer and PayPal+ have been removed from the build, so Home
  // is the only real destination — the bottom nav still renders all of its
  // tabs (see BottomNav/NAV_TABS) but none of them navigate anywhere.
  const activeTab: TabKey = 'home'
  const setActiveTab = (_k: TabKey) => {}
  // Desktop mouse drag on the feed viewport otherwise scrolls 1:1 and stops
  // dead on release; this makes it feel like a real touch swipe instead.
  useVScrollDrag(scrollRef)
  return (
  <div className="relative">
    {/* Outer bezel — 414×886 in dev mode; in bare/mobile mode the bezel
        is collapsed to the 402×874 inner viewport (no padding, no black
        bezel chrome, no shadow) so the phone screen IS the device. */}
    <div
      className={
        bare
          ? 'w-[402px] h-[874px] relative'
          : 'w-[414px] h-[886px] rounded-[54px] bg-black shadow-phone border border-[#CCCCCC]/35 p-[6px] relative'
      }
    >
      {/* iOS Dynamic Island — 122×37, vertically centered with status bar
          content. Hidden in bare mode (the device has its own). */}
      {!bare && (
        <div
          className="absolute z-40 rounded-full bg-black pointer-events-none"
          style={{
            width: 122,
            height: 37,
            top: 17, // 11 in viewport + 6 phone-bezel padding
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      )}
      {/* The phone viewport is a positioning context that stacks the feed
          and wallet scroll containers on top of each other. The inactive
          view is faded out + shifted slightly so the active view appears
          to rise into place. */}
      <div className="relative w-[402px] h-[874px] rounded-[48px] bg-black overflow-hidden">
      <div
        ref={scrollRef}
        // overflow-x-hidden + overflow-y-auto prevents the horizontal
        // overscroll from carousels (HScroll) bubbling up and shifting the
        // whole feed sideways once a carousel reaches its end.
        // overscrollBehavior:'contain' further isolates the scroll chain.
        className="absolute inset-0 overflow-x-hidden overflow-y-auto rounded-[48px] no-scrollbar"
        style={{
          overscrollBehavior: 'contain',
          // Transparent so the PhoneShell-level L0 glow shows through and
          // stays anchored at the top of the viewport instead of scrolling.
          background: 'transparent',
          ...computeViewStyle('feed', displayView, phase),
        }}
      >
        <div className="relative">{children}</div>
      </div>
      {/* L0 background glow — fixed to the top of the phone viewport so it
          stays anchored regardless of scroll position or view transitions.
          Sits below the scroll containers' content but above the phone
          viewport's black background. */}
      <L0Glow />
      {/* Status bar + search bell — rendered ONCE at the PhoneShell level
          (above both scroll containers in the z-stack) so they stay
          completely fixed during the wallet ↔ feed transition. They're
          not affected by the view's exit/enter animations. */}
      <StatusBar fixed />
      <SearchBell fixed />
      {/* In-app browser sheet — slides up from the bottom of the phone
          viewport. Sits inside the viewport's overflow-hidden so its
          edges align with the phone's rounded corners. z-stacks above
          status bar / search bell so it covers them fully. */}
      <BrowserSheet />
      {/* Crypto PDP sheet — opens when a coin row (Bitcoin / Ethereum /
          Solana) is tapped. Same slide-up pattern as BrowserSheet,
          coin-parameterized via CRYPTO_PDP_CONFIG. */}
      <CryptoPdpSheet />
      {/* Crypto Overview sheet — opens when the Crypto card's header
          area is tapped. Lists holdings + explorable coins. */}
      <CryptoOverviewSheet />
      {/* Fake "Loading" state overlay (Prototype menu → States accordion).
          Shapes mirror the real above-the-fold feed (AccountSnapshot tiles,
          TopStoresRow avatars, HeroCarousel, first TileGroup) so the skeleton
          reads as "this screen," not generic bars. App() reverts `loading`
          to false via a timer — purely a UI demo, no real loading state. */}
      {loading && (
        <div
          className="absolute inset-0 overflow-hidden flex flex-col gap-4"
          style={{ zIndex: 60, background: '#0b0f1a', paddingTop: 96, paddingBottom: 96 }}
        >
          {/* AccountSnapshot row */}
          <div className="flex gap-3 px-4">
            <div className="skeleton-shimmer shrink-0" style={{ width: 225, height: 127, borderRadius: 12 }} />
            <div className="skeleton-shimmer shrink-0" style={{ width: 225, height: 127, borderRadius: 12 }} />
          </div>
          {/* TopStoresRow avatars */}
          <div className="flex gap-3 px-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0" style={{ width: 96 }}>
                <div className="skeleton-shimmer rounded-full" style={{ width: 64, height: 64 }} />
                <div className="skeleton-shimmer" style={{ width: 48, height: 10, borderRadius: 4 }} />
              </div>
            ))}
          </div>
          {/* HeroCarousel */}
          <div className="px-4 flex justify-center">
            <div className="skeleton-shimmer" style={{ width: 320, height: 340, borderRadius: 32 }} />
          </div>
          {/* First TileGroup ("New York City") */}
          <div className="px-4">
            <div
              className="relative overflow-hidden"
              style={{ height: 200, borderRadius: 24, background: 'rgba(129,129,129,0.2)' }}
            >
              <div className="flex flex-col gap-2 px-4 pt-4">
                <div className="skeleton-shimmer" style={{ width: 160, height: 20, borderRadius: 6 }} />
                <div className="skeleton-shimmer" style={{ width: 110, height: 20, borderRadius: 6 }} />
              </div>
              <div className="flex gap-3 px-4 mt-4">
                <div className="skeleton-shimmer" style={{ width: 136, height: 136, borderRadius: 24 }} />
                <div className="skeleton-shimmer" style={{ width: 136, height: 136, borderRadius: 24 }} />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Fake "Error" state overlay (Prototype menu → States accordion).
          Figma: "Error.Load" (node 11795:41951) — centered warning icon,
          headline, subtext, and a "Try again" pill that resets the demo
          back to Default. Purely a UI demo, no real network state. */}
      {error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center"
          style={{ zIndex: 60, background: '#0b0f1a' }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, background: '#7a1414' }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3 L22 20.5 H2 Z"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="17.3" r="1.1" fill="#fff" />
            </svg>
          </div>
          <h2 className="font-display text-white text-[20px] leading-[26px]">
            We&rsquo;re having trouble connecting
          </h2>
          <p className="font-text text-white/70 text-[15px] leading-[20px] -mt-2">
            Please check your connection and try again.
          </p>
          <button
            onClick={onErrorRetry}
            className="px-5 py-2.5 rounded-full bg-white/12 hover:bg-white/[0.18] text-white text-[15px] font-semibold transition"
          >
            Try again
          </button>
        </div>
      )}
      {/* Sheet-aware status bar duplicate — when a sheet (BrowserSheet,
          BitcoinPdpSheet, CryptoOverviewSheet) is open, the original
          StatusBar above gets covered by the sheet's solid black
          background. This second copy renders after the sheets at a
          higher z-index so the time + signal / wifi / battery chrome
          stays visible above the sheet (iOS-native "sheet slides
          under the status bar" effect). When no sheet is open the
          two overlap perfectly and the user only ever sees one. */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ zIndex: 70 }}
      >
        <StatusBar fixed />
      </div>
      </div>
      {/* Global bottom navigation — pinned inside the phone bezel, above the
          scroll container so it stays put while the feed scrolls beneath. The
          phone bezel has 6px padding, so the nav sits at left:6 right:6
          bottom:6 (matching the rounded 48px inner viewport). */}
      <div
        className="absolute pointer-events-none"
        style={{ left: 6, right: 6, bottom: 6, zIndex: 50 }}
      >
        <BottomNav active={activeTab} onSelect={setActiveTab} />
      </div>
    </div>
  </div>
  )
}


// ---------- In-App Browser (Figma node 77:2812) ----------
// Slide-up sheet that overlays the current view when the Shop button on
// a deck card is tapped. The sheet mimics an iOS Safari View Controller:
// status bar + URL header + content + close button. Three phases:
//   1. Splash ("Taking you to brand.com")    — IAB 1
//   2. Brand site mockup with floating BNPL  — IAB 2 (Nike for now)
//   3. Pay Later detail sheet                — IAB 3 (todo)
//
// closeBrowser() can be called at any phase to dismiss back to the
// underlying view.

type BrowserStep = 'splash' | 'site'

type BrowserBrandSpec = {
  url: string
  name: string
  // 48 round brand avatar shown on the splash. Black bg by default;
  // some brands (Apple) need white.
  logoSrc: string
  logoBg: string
  // Tint colour used on "Pay Later at <Brand>" — Nike uses PayPal blue.
  brandColor: string
}

const BROWSER_BRANDS: Record<BrowserBrand, BrowserBrandSpec> = {
  nike: {
    url: 'nike.com',
    name: 'Nike',
    logoSrc: '/images/deck-brand-nike.png',
    logoBg: '#000',
    brandColor: '#0066f5',
  },
  apple: {
    url: 'apple.com',
    name: 'Apple',
    logoSrc: '/images/deck-brand-apple.png',
    logoBg: '#fff',
    brandColor: '#0066f5',
  },
  sony: {
    url: 'sony.com',
    name: 'Sony',
    logoSrc: '/images/deck-brand-sony.png',
    logoBg: '#000',
    brandColor: '#0066f5',
  },
}

// Pre-baked iPhone-X-viewport fullPage screenshots used by IAB 2 for
// brands that can't be embedded (Apple/Sony block iframes via
// X-Frame-Options). Nike has a bespoke Figma-built mockup so it isn't
// listed here. To refresh either, see the comment in BrowserSite.
const IAB_SCREENSHOTS: Partial<Record<BrowserBrand, string>> = {
  apple: '/images/iab-apple.jpg',
  sony: '/images/iab-sony.jpg',
}

// Status bar with BLACK text/icons (this is a white in-app browser, so
// the iOS status bar inverts).
const BrowserStatusBar = () => (
  <div
    className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between pointer-events-none"
    style={{
      height: 50,
      paddingLeft: 28,
      paddingRight: 28,
      paddingTop: 21,
      fontSize: 17,
      fontWeight: 600,
      letterSpacing: '-0.4px',
      color: '#000',
      lineHeight: 1,
    }}
  >
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</span>
    <div className="flex items-center" style={{ gap: 5 }}>
      <svg viewBox="0 0 17 11" width="17" height="11" aria-hidden>
        <rect x="0" y="7" width="3" height="4" rx="1" fill="black" />
        <rect x="4.5" y="5" width="3" height="6" rx="1" fill="black" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="black" />
        <rect x="13.5" y="0" width="3" height="11" rx="1" fill="black" />
      </svg>
      <svg viewBox="0 0 16 11" width="16" height="11" aria-hidden>
        <path d="M8 10.4a1.05 1.05 0 1 0 0-2.1 1.05 1.05 0 0 0 0 2.1z" fill="black" />
        <path
          d="M2.4 6.2a8 8 0 0 1 11.2 0M4.6 8.4a5 5 0 0 1 6.8 0M.4 4.1a11 11 0 0 1 15.2 0"
          stroke="black"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="relative" style={{ width: 27, height: 12 }}>
        <div
          className="absolute"
          style={{ inset: 0, border: '1px solid rgba(0,0,0,0.4)', borderRadius: 4 }}
        />
        <div
          className="absolute"
          style={{ top: 2, bottom: 2, left: 2, right: 4, background: '#000', borderRadius: 2 }}
        />
        <div
          className="absolute"
          style={{
            top: 4,
            right: -2,
            width: 1.5,
            height: 4,
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '0 1px 1px 0',
          }}
        />
      </div>
    </div>
  </div>
)

// Web view header — close X on the left + URL/status text centered.
const BrowserHeader = ({
  centerText,
  onClose,
}: {
  centerText: string
  onClose: () => void
}) => (
  <div
    className="absolute left-0 right-0 z-20 bg-white"
    style={{ top: 50, height: 48 }}
  >
    <button
      type="button"
      onClick={onClose}
      className="absolute flex items-center justify-center"
      style={{
        left: 16,
        top: 4,
        width: 41,
        height: 41,
        borderRadius: 999,
      }}
      aria-label="Close in-app browser"
    >
      <img src="/images/browser-icon-close.svg" alt="" style={{ width: 20, height: 20 }} />
    </button>
    <div
      className="absolute flex items-center justify-center"
      style={{ left: 108.5, top: 4, width: 185, height: 40 }}
    >
      <p
        className="font-text"
        style={{
          fontSize: 12,
          lineHeight: '16px',
          fontWeight: 500,
          color: '#000',
          margin: 0,
        }}
      >
        {centerText}
      </p>
    </div>
  </div>
)

// IAB 1 — splash: "Taking you to <brand>.com" + brand logo + "Pay Later
// at <Brand>" headline + Continue button.
const BrowserSplash = ({
  spec,
  onClose,
  onContinue,
}: {
  spec: BrowserBrandSpec
  onClose: () => void
  onContinue: () => void
}) => (
  <div className="absolute inset-0 bg-white">
    <BrowserStatusBar />
    <BrowserHeader centerText={`Taking you to ${spec.url}`} onClose={onClose} />
    {/* Centred brand block — avatar + headline + paragraph. */}
    <div
      className="absolute left-0 right-0 px-4"
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      <div style={{ width: 370, marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Brand avatar */}
        <div
          className="overflow-hidden"
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            background: spec.logoBg,
            border: '0.5px solid rgba(5,55,130,0.08)',
          }}
        >
          <img
            src={spec.logoSrc}
            alt=""
            className="w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        </div>
        {/* Headline */}
        <p
          className="font-display"
          style={{
            fontSize: 32,
            lineHeight: '32px',
            fontWeight: 900,
            letterSpacing: '-1px',
            color: '#000',
            margin: 0,
            marginTop: 16,
          }}
        >
          Pay Later at{' '}
          <span style={{ color: spec.brandColor }}>{spec.name}</span>
        </p>
        {/* Sub */}
        <p
          className="font-text"
          style={{
            fontSize: 16,
            lineHeight: '24px',
            color: '#000',
            margin: 0,
            marginTop: 8,
          }}
        >
          Check out with PayPal and enjoy the flexibility of Pay in 4.
        </p>
      </div>
    </div>
    {/* Bottom Continue CTA */}
    <div className="absolute left-0 right-0" style={{ bottom: 0, height: 84 }}>
      <button
        type="button"
        onClick={onContinue}
        className="absolute font-text transition-transform active:scale-[0.98]"
        style={{
          left: 16,
          top: 0,
          width: 370,
          height: 48,
          borderRadius: 24,
          background: '#000',
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Continue
      </button>
    </div>
  </div>
)

// IAB 3 — Pay Later expanded sheet (Figma node 73:2780).
// Slides up from the bottom over IAB 2 with the dimmed Nike page
// visible behind. Contains: tab nav (Pay Later / Price tracking /
// Price history / Price comparison), Due Today header with the total
// owed, Pay in 4 schedule (4 tiles with dates), and Pay Monthly
// options (3 tiles with APR + interest).

const PAY_LATER_TABS = ['Pay Later', 'Price tracking', 'Price history', 'Price comparison'] as const
type PayLaterTab = (typeof PAY_LATER_TABS)[number]

const PAY_IN_4_INSTALLMENTS = [
  { n: '1', date: '15 Sep', amount: '$800.00' },
  { n: '2', date: '29 Sep', amount: '$800.00' },
  { n: '3', date: '13 Oct', amount: '$800.00' },
  { n: '4', date: '27 Oct', amount: '$800.00' },
] as const

const PAY_MONTHLY_OPTIONS = [
  { rate: '$561.40/mo', term: 'for 6 months', meta: '17.99%APR  ·  $168.42 interest' },
  { rate: '$294.74/mo', term: 'for 12 months', meta: '24.99%APR  ·  $1336.84 interest' },
  { rate: '$153.92/mo', term: 'for 24 months', meta: '28.99%APR  ·  $494.19 interest' },
] as const

// Sliding glass pill tab nav for the Pay Later sheet. Mirrors the
// BottomNav / WalletTabsRow pattern exactly: a single absolutely-
// positioned pill morphs between tab positions with the iOS spring
// curve, the row shifts left as a whole when the active tab would
// otherwise overflow the right edge, and active-tap scales the
// button slightly for tactile feedback. The pill is WHITE here
// (matches the Figma's sheet design).
const PayLaterTabsRow = ({
  active,
  onChange,
}: {
  active: PayLaterTab
  onChange: (tab: PayLaterTab) => void
}) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0, mounted: false })
  // Horizontal offset applied to the entire row so the active tab
  // never gets clipped by the sheet's right edge — same trick as the
  // Wallet sub-nav. The pill is positioned inside the row so it
  // travels with it.
  const [rowShift, setRowShift] = useState(0)
  const [travel, setTravel] = useState<'left' | 'right' | 'none'>('none')
  const prevIdxRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const idx = PAY_LATER_TABS.indexOf(active)
    const el = tabRefs.current[idx]
    const row = rowRef.current
    if (!el || !row) return
    const prev = prevIdxRef.current
    if (prev != null && prev !== idx) {
      setTravel(idx > prev ? 'right' : 'left')
      window.setTimeout(() => setTravel('none'), 220)
    }
    prevIdxRef.current = idx
    setPill({ left: el.offsetLeft, width: el.offsetWidth, mounted: true })

    // Compute row shift so the active tab's right edge aligns with
    // the wrapper's content-area right edge (which already sits 16px
    // in from the sheet edge thanks to the 16px paddingLeft/Right).
    const wrapper = row.parentElement
    if (!wrapper) return
    const styles = window.getComputedStyle(wrapper)
    const padL = parseFloat(styles.paddingLeft) || 0
    const padR = parseFloat(styles.paddingRight) || 0
    const contentWidth = wrapper.clientWidth - padL - padR
    const activeRight = el.offsetLeft + el.offsetWidth
    const overflow = activeRight - contentWidth
    setRowShift(overflow > 0 ? -overflow : 0)
  }, [active])

  const PILL_EASE = 'cubic-bezier(0.34, 1.36, 0.64, 1)'
  const pillScaleX = travel === 'none' ? 1 : 1.06
  const pillSkew = travel === 'none' ? 0 : travel === 'right' ? -2 : 2

  return (
    <div style={{ paddingLeft: 16, paddingRight: 16, overflow: 'hidden' }}>
      <div
        ref={rowRef}
        className="relative flex"
        style={{
          gap: 2,
          paddingBottom: 8,
          width: 'max-content',
          transform: `translateX(${rowShift}px)`,
          transition: `transform 440ms ${'cubic-bezier(0.34, 1.36, 0.64, 1)'}`,
          willChange: 'transform',
        }}
      >
        {/* Sliding white pill behind the active tab. Absolutely
            positioned inside the relative tab row so it sits under
            the tab labels. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: pill.left,
            width: pill.width,
            height: 40,
            borderRadius: 999,
            background: '#fff',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.25), inset 0 0 0 0.5px rgba(255,255,255,0.4)',
            opacity: pill.mounted ? 1 : 0,
            transform: `scaleX(${pillScaleX}) skewX(${pillSkew}deg)`,
            transformOrigin: 'center center',
            transition: `left 440ms ${PILL_EASE}, width 440ms ${PILL_EASE}, transform 240ms ${PILL_EASE}, opacity 200ms ease`,
            willChange: 'left, width, transform',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {PAY_LATER_TABS.map((t, idx) => {
          const isActive = t === active
          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[idx] = el
              }}
              type="button"
              onClick={() => onChange(t)}
              className="font-text whitespace-nowrap relative transition-transform active:scale-[0.96]"
              style={{
                height: 40,
                paddingLeft: 16,
                paddingRight: 16,
                borderRadius: 999,
                background: 'transparent',
                // Text color crossfades between black (when active,
                // sits on top of the white pill) and translucent white
                // (when inactive on the dark sheet bg).
                color: isActive ? '#000' : 'rgba(255,255,255,0.72)',
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                transitionTimingFunction: PILL_EASE,
                transitionDuration: '220ms',
                zIndex: 1,
              }}
              aria-pressed={isActive}
            >
              {t}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Price History tab content (Figma node 73:3388). Header showing the
// year + month, description, filter chip row, and a line chart of
// historical prices with axis labels and a marker for the current
// price (1M ago).
const PriceHistoryTab = () => {
  // Chart points — month abscissa (0..1) and price normalized for the
  // visible Y range. Per Figma 73:3406: line starts on a $210 plateau,
  // drops steeply just past mid, dips slightly below $180, then runs
  // flat at $180 out to "Today".
  const W = 338
  const H = 320
  const PAD_L = 36 // room for Y-axis labels
  const PAD_R = 4
  const PAD_T = 8
  const PAD_B = 32 // room for X-axis labels
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  // Y range $220 (top) → $170 (bottom)
  const yMin = 170
  const yMax = 220
  const yToPx = (y: number) =>
    PAD_T + ((yMax - y) / (yMax - yMin)) * innerH
  const xToPx = (t: number) => PAD_L + t * innerW
  const points: [number, number][] = [
    [0, 210],
    [0.4, 210],
    [0.6, 178],
    [0.7, 180],
    [1, 180],
  ]
  const pathD = points
    .map(([t, y], i) => `${i === 0 ? 'M' : 'L'} ${xToPx(t)} ${yToPx(y)}`)
    .join(' ')
  const areaD = `${pathD} L ${xToPx(1)} ${yToPx(yMin)} L ${xToPx(0)} ${yToPx(yMin)} Z`
  // 1M marker — the second-to-last point in the polyline (plateau at $180)
  const markerX = xToPx(0.7)
  const markerY = yToPx(180)
  return (
    // paddingTop per Figma node 73:3388 → Container / Price History
    // sits at top:12 within Modal/Sheet.
    <div style={{ paddingTop: 12 }}>
      {/* Header — 2026 / April / description. "2026" matches the
          small label styling of "Good" on Price tracking and "Due
          Today" on Pay Later (PayPal Pro Black 20px, -1px tracking),
          and "April" matches "$180.00" / "$800.00" (PayPal Pro Black
          40px, -1px tracking). */}
      <p
        className="font-display"
        style={{
          fontSize: 20,
          lineHeight: '32px',
          fontWeight: 900,
          letterSpacing: '-1px',
          color: '#fff',
          margin: 0,
        }}
      >
        2026
      </p>
      <p
        className="font-display"
        style={{
          fontSize: 40,
          lineHeight: '40px',
          fontWeight: 900,
          letterSpacing: '-1px',
          color: '#fff',
          margin: 0,
          marginTop: 4,
        }}
      >
        April
      </p>
      <p
        className="font-text"
        style={{
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.72)',
          margin: 0,
          marginTop: 4,
        }}
      >
        Lorem ipsum dolor sit amet consectetur.
      </p>

      {/* Filter row — 36×36 round sliders button + "Lowest price"
          white pill, matching the Figma reference. */}
      <div className="flex items-center" style={{ marginTop: 40, gap: 8 }}>
        <button
          type="button"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(204,204,204,0.18)',
            border: '0.5px solid rgba(204,204,204,0.22)',
          }}
          aria-label="Filter"
        >
          <img
            src="/images/activity-icon-sliders.svg"
            alt=""
            style={{ width: 16, height: 16 }}
          />
        </button>
        <button
          type="button"
          className="font-text"
          style={{
            height: 36,
            paddingLeft: 14,
            paddingRight: 14,
            borderRadius: 999,
            background: '#fff',
            color: '#000',
            fontSize: 14,
            fontWeight: 500,
            lineHeight: '20px',
          }}
        >
          Lowest price
        </button>
      </div>

      {/* Line chart. */}
      <div style={{ marginTop: 24 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <defs>
            <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5bcbff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5bcbff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Horizontal gridlines + Y-axis labels at $170…$220 */}
          {[170, 180, 190, 200, 210, 220].map((v) => {
            const y = yToPx(v)
            return (
              <g key={v}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="1"
                />
                <text
                  x={2}
                  y={y - 4}
                  fill="rgba(255,255,255,0.72)"
                  fontSize="12"
                  fontFamily="Plain, sans-serif"
                >
                  ${v}
                </text>
              </g>
            )
          })}
          {/* Area fill under the line */}
          <path d={areaD} fill="url(#price-area)" />
          {/* Chart line */}
          <path
            d={pathD}
            fill="none"
            stroke="#5bcbff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 1M marker — vertical connector line + dot + label, matching
              the Figma comp where the $180.00 label hovers above the
              dot connected by a hairline. */}
          <line
            x1={markerX}
            x2={markerX}
            y1={markerY - 22}
            y2={markerY - 7}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill="#fff"
            stroke="#5bcbff"
            strokeWidth="1.5"
          />
          <text
            x={markerX}
            y={markerY - 28}
            fill="#fff"
            fontSize="14"
            fontFamily="Plain, sans-serif"
            fontWeight="500"
            textAnchor="middle"
          >
            $180.00
          </text>
          {/* X-axis labels — single string per tick (no stacked chars) */}
          {[
            { t: 0, label: '1Y' },
            { t: 0.25, label: '6M' },
            { t: 0.5, label: '3M' },
            { t: 0.7, label: '1M' },
            { t: 1, label: 'Today' },
          ].map(({ t, label }) => {
            const x = xToPx(t)
            const anchor: 'start' | 'middle' | 'end' =
              t === 0 ? 'start' : t === 1 ? 'end' : 'middle'
            return (
              <text
                key={t}
                x={x}
                y={H - 10}
                fill="rgba(255,255,255,0.72)"
                fontSize="13"
                fontFamily="Plain, sans-serif"
                textAnchor={anchor}
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// Price Comparison tab content (Figma node 73:3692). Shows the brand
// + product header, a "Lowest price" filter chip, and a list of
// retailer rows. Each row = round logo + brand/stock + price pill
// with an external-link icon (tap would open the retailer in a new
// tab if this were live).
const PRICE_COMPARISON_OFFERS = [
  { retailer: 'Walmart', stock: 'In stock', price: '$180.00' },
  { retailer: 'Walmart', stock: 'In stock', price: '$180.00' },
  { retailer: 'Walmart', stock: 'In stock', price: '$180.00' },
  { retailer: 'Walmart', stock: 'In stock', price: '$180.00' },
  { retailer: 'Walmart', stock: 'In stock', price: '$180.00' },
  { retailer: 'Walmart', stock: 'In stock', price: '$180.00' },
] as const

const IconExternalLink = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
    <path
      d="M4.5 3 H11 V9.5 M11 3 L3.5 10.5"
      stroke="#fff"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PriceComparisonTab = () => (
  // paddingTop per Figma node 73:3692 → Container / Price Comparison
  // sits at top:12 within Modal/Sheet (matches Pay Later + Price
  // Tracking + Price History).
  <div style={{ paddingTop: 12 }}>
    {/* Header — brand / price / product name */}
    <p
      className="font-text"
      style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: '#fff', margin: 0 }}
    >
      Nike
    </p>
    <div className="flex items-start" style={{ marginTop: 4 }}>
      <span
        className="font-display"
        style={{
          fontSize: 24,
          lineHeight: '40px',
          letterSpacing: '-0.48px',
          fontWeight: 900,
          color: '#fff',
          marginRight: 2,
        }}
      >
        $
      </span>
      <span
        className="font-display"
        style={{
          fontSize: 40,
          lineHeight: '40px',
          letterSpacing: '-1px',
          fontWeight: 900,
          color: '#fff',
        }}
      >
        180.00
      </span>
    </div>
    <p
      className="font-text"
      style={{
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.72)',
        margin: 0,
        marginTop: 4,
      }}
    >
      Nike Vomero Plus
    </p>

    {/* Filter row — sliders icon + "Lowest price" sort pill.
        marginTop per Figma node 73:3692 → body block sits at top:130
        in Container/Price Comparison, header above ends at 102, gap
        = 28. Button sizes (40×32 icon, 97×32 pill) come from the
        same node. */}
    <div className="flex items-center" style={{ marginTop: 28, gap: 8 }}>
      <button
        type="button"
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 32,
          borderRadius: 24,
          background: 'rgba(204,204,204,0.18)',
          border: '0.5px solid rgba(204,204,204,0.22)',
        }}
        aria-label="Filter"
      >
        <img
          src="/images/activity-icon-sliders.svg"
          alt=""
          style={{ width: 16, height: 16 }}
        />
      </button>
      <button
        type="button"
        className="font-text"
        style={{
          height: 32,
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: 24,
          background: '#fff',
          color: '#000',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: '16px',
        }}
      >
        Lowest price
      </button>
    </div>

    {/* Retailer list — each row: 40 round logo + name/stock + price.
        marginTop per Figma node 73:3692 → list sits at top:64 within
        the body block, filter row above ends at 32, gap = 32. Each
        List Item is 72 tall with a 4px gap (stride 76 in Figma). */}
    <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {PRICE_COMPARISON_OFFERS.map((offer, i) => (
        <div key={i} className="flex items-center" style={{ gap: 12, height: 72 }}>
          {/* Walmart blue avatar with logo. Subs already downloaded
              this asset (subs-logo-walmart.png). */}
          <div
            className="overflow-hidden flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: '#0071ce',
              border: '0.5px solid rgba(204,204,204,0.28)',
            }}
          >
            <img
              src="/images/subs-logo-walmart.png"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-text text-white"
              style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, margin: 0 }}
            >
              {offer.retailer}
            </p>
            <p
              className="font-text"
              style={{
                fontSize: 14,
                lineHeight: '20px',
                color: 'rgba(255,255,255,0.72)',
                margin: 0,
              }}
            >
              {offer.stock}
            </p>
          </div>
          {/* Price pill with external-link icon */}
          <div
            className="flex items-center"
            style={{
              height: 32,
              paddingLeft: 14,
              paddingRight: 12,
              borderRadius: 999,
              background: 'rgba(0,0,0,0.45)',
              border: '0.5px solid rgba(204,204,204,0.12)',
              gap: 8,
              color: '#fff',
            }}
          >
            <span
              className="font-text"
              style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500 }}
            >
              {offer.price}
            </span>
            <IconExternalLink size={14} />
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Price Tracking tab content (Figma node 73:3084). Shows the page's
// current price relative to historical highs/lows, a horizontal price
// spectrum with a marker for "$180 — Good", and a price-alert
// dropdown + Set price alert CTA at the bottom.
const PriceTrackingTab = () => (
  // paddingTop per Figma node 73:3084 → Container / Price Tracking
  // sits at top:12 within Modal/Sheet (consistent with Pay Later).
  // Flex column with min-height matches the inner sheet body so the
  // "Set price alert" CTA can stick to the bottom via marginTop:auto,
  // mirroring the Figma where the button is anchored at the sheet
  // floor (not floating mid-content).
  <div
    style={{
      paddingTop: 12,
      display: 'flex',
      flexDirection: 'column',
      // Sheet inner = 606 (660 - 60 tab row); minus paddingBottom 32 on
      // the parent and our paddingTop 12 = 562 available column height.
      minHeight: 562,
    }}
  >
    {/* Header — status word + current price + supporting copy */}
    <div>
      <p
        className="font-display"
        style={{
          fontSize: 20,
          lineHeight: '32px',
          fontWeight: 900,
          letterSpacing: '-1px',
          color: '#fff',
          margin: 0,
        }}
      >
        Good
      </p>
      <div className="flex items-start" style={{ marginTop: 4 }}>
        <span
          className="font-display"
          style={{
            fontSize: 24,
            lineHeight: '40px',
            letterSpacing: '-0.48px',
            fontWeight: 900,
            color: '#fff',
            marginRight: 2,
          }}
        >
          $
        </span>
        <span
          className="font-display"
          style={{
            fontSize: 40,
            lineHeight: '40px',
            letterSpacing: '-1px',
            fontWeight: 900,
            color: '#fff',
          }}
        >
          180.00
        </span>
      </div>
      <p
        className="font-text"
        style={{
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.72)',
          margin: 0,
          marginTop: 4,
        }}
      >
        This is a typical price and lower than usual.
      </p>
    </div>

    {/* Price spectrum chart — 3-segment bar with $180 marker.
        Per Figma node 73:3084 → Contanier / Data Vis sits at top:130
        within Container/Price Tracking; gap from header = 28px. The
        Balance sub-frame (this chart) is 103 tall. */}
    <div className="relative" style={{ marginTop: 28, height: 103 }}>
      {/* $180 marker label — positioned over the gap between segment 1
          (low/dark) and segment 2 (mid/medium) at ~25%, matching Figma
          where the tick line drops right onto the segment boundary. */}
      <p
        className="font-display absolute"
        style={{
          left: '25%',
          top: 0,
          transform: 'translateX(-50%)',
          fontSize: 24,
          lineHeight: '32px',
          fontWeight: 900,
          letterSpacing: '-1px',
          color: '#fff',
          margin: 0,
          whiteSpace: 'nowrap',
        }}
      >
        $180
      </p>
      {/* Vertical pointer line from label to the bar */}
      <div
        className="absolute"
        style={{
          left: '25%',
          top: 32,
          transform: 'translateX(-50%)',
          width: 2,
          height: 12,
          background: '#fff',
        }}
      />
      {/* Segmented price spectrum — 3 distinct blue chunks (Low / Mid /
          High) with 4px gaps between. Proportions tuned to match
          Figma 1:1: 24% / 50% / ~22% (with the right segment taking
          the remaining flex). The middle segment is the widest band. */}
      <div
        className="absolute flex"
        style={{ left: 0, right: 0, top: 44, height: 12, gap: 4 }}
      >
        <div
          style={{
            flex: '0 0 24%',
            height: 12,
            borderRadius: 999,
            background: '#0d567b',
          }}
        />
        <div
          style={{
            flex: '0 0 50%',
            height: 12,
            borderRadius: 999,
            background: '#2287b2',
          }}
        />
        <div
          style={{
            flex: '1 1 auto',
            height: 12,
            borderRadius: 999,
            background: '#5bcbff',
          }}
        />
      </div>
      {/* Range labels — $170.00 / $190.00 sit at top:83 just below the
          bar (per Figma node 73:3084, Balance frame). */}
      <p
        className="font-text absolute"
        style={{
          left: 0,
          top: 83,
          fontSize: 14,
          lineHeight: '20px',
          color: '#fff',
          margin: 0,
        }}
      >
        $170.00
      </p>
      <p
        className="font-text absolute"
        style={{
          right: 0,
          top: 83,
          fontSize: 14,
          lineHeight: '20px',
          color: '#fff',
          margin: 0,
        }}
      >
        $190.00
      </p>
    </div>

    {/* Stay-in-the-know label + price-alert dropdown.
        Per Figma node 73:3084 → Set Alert sits at top:127 within
        Contanier/Data Vis, and Balance above ends at 103 — so the
        gap between the two sub-frames is 24px. */}
    <div style={{ marginTop: 24 }}>
      <p
        className="font-text"
        style={{
          fontSize: 14,
          lineHeight: 1,
          letterSpacing: '-0.14px',
          color: '#fff',
          margin: 0,
        }}
      >
        Stay in the know when the price drops:
      </p>
      <div
        className="relative"
        style={{
          marginTop: 12,
          height: 56,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.24)',
        }}
      >
        <p
          className="font-text"
          style={{
            position: 'absolute',
            left: 16,
            top: 10,
            fontSize: 13,
            lineHeight: 1.25,
            letterSpacing: '-0.13px',
            color: '#999',
            margin: 0,
          }}
        >
          Price alert
        </p>
        <p
          className="font-text"
          style={{
            position: 'absolute',
            left: 16,
            top: 28,
            fontSize: 14,
            lineHeight: '16px',
            color: '#fff',
            margin: 0,
          }}
        >
          <strong style={{ fontWeight: 500 }}>Over 5% off</strong>{' '}
          <span style={{ color: '#999' }}>($171.00 and lower)</span>
        </p>
        <svg
          className="absolute"
          style={{ right: 12, top: 18, width: 20, height: 20 }}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M5 7.5 L10 12.5 L15 7.5"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>

    {/* Set price alert CTA — white pill, anchored at the bottom of the
        sheet (marginTop:auto pushes it to the floor; paddingTop floor
        keeps a comfortable gap from the dropdown when content is tall). */}
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>
      <button
        type="button"
        className="font-text flex items-center justify-center transition-transform active:scale-[0.98]"
        style={{
          width: '100%',
          height: 48,
          borderRadius: 24,
          background: '#fff',
          color: '#000',
          fontSize: 14,
          fontWeight: 500,
          lineHeight: '20px',
          gap: 8,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 2 C7.5 2 5.5 4 5.5 6.5 V9.5 C5.5 11 4.5 12 3.5 13 H16.5 C15.5 12 14.5 11 14.5 9.5 V6.5 C14.5 4 12.5 2 10 2 Z"
            stroke="#000"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M8 15.5 C8 16.5 9 17.5 10 17.5 C11 17.5 12 16.5 12 15.5"
            stroke="#000"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        Set price alert
      </button>
    </div>
  </div>
)

// iOS-style morphing pill → sheet. A single element transitions its
// position, size, and border-radius between the "Buy Now Pay Later"
// pill (at the floating toolbar position) and the expanded sheet.
// Inside, the pill text and the sheet content cross-fade so the
// expansion reads as a single Liquid Glass morph.
const BrowserPayLater = ({
  open,
  onOpen,
  onClose,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
}) => {
  const [tab, setTab] = useState<PayLaterTab>('Pay Later')
  // Two-phase tab content swap (same model as the Wallet view).
  // `displayTab` is what's currently in the body — it flips to the
  // target tab at the boundary between Phase 1 (exit) and Phase 2
  // (enter), so the exit animation plays on the OLD content.
  const [displayTab, setDisplayTab] = useState<PayLaterTab>('Pay Later')
  const [tabPhase, setTabPhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  // +1 = sliding to a tab on the right (e.g. Pay Later → Price tracking)
  // −1 = sliding to a tab on the left
  const [tabDirection, setTabDirection] = useState<1 | -1>(1)
  const tabTimersRef = useRef<number[]>([])
  const TAB_EXIT_MS = 220
  const TAB_ENTER_MS = 320
  const handleTabChange = (next: PayLaterTab) => {
    if (next === tab) return
    tabTimersRef.current.forEach((id) => window.clearTimeout(id))
    tabTimersRef.current = []
    const currentIdx = PAY_LATER_TABS.indexOf(tab)
    const nextIdx = PAY_LATER_TABS.indexOf(next)
    setTabDirection(nextIdx > currentIdx ? 1 : -1)
    setTab(next)
    setTabPhase('exit')
    const t1 = window.setTimeout(() => {
      setDisplayTab(next)
      setTabPhase('enter')
      const t2 = window.setTimeout(() => setTabPhase('idle'), TAB_ENTER_MS)
      tabTimersRef.current.push(t2)
    }, TAB_EXIT_MS)
    tabTimersRef.current.push(t1)
  }
  useEffect(
    () => () => {
      tabTimersRef.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )
  // Pane style for the current phase + direction. Mirrors the
  // WalletView's horizontal slide transition exactly.
  const tabPaneStyle: React.CSSProperties = (() => {
    const SLIDE = 28
    const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
    if (tabPhase === 'exit') {
      return {
        opacity: 0,
        transform: `translateX(${tabDirection === 1 ? -SLIDE : SLIDE}px)`,
        transition: `transform ${TAB_EXIT_MS}ms ${EASE}, opacity ${TAB_EXIT_MS}ms ${EASE}`,
      }
    }
    if (tabPhase === 'enter') {
      return {
        opacity: 1,
        transform: 'translateX(0)',
        transition: `transform ${TAB_ENTER_MS}ms ${EASE}, opacity ${TAB_ENTER_MS}ms ${EASE}`,
      }
    }
    return { opacity: 1, transform: 'translateX(0)', transition: 'none' }
  })()
  // iOS-spring curve — slow start, soft overshoot-free settle. Length
  // is long enough for the morph to feel deliberate but not slow.
  const MORPH_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
  const MORPH_MS = 560
  // ---------- Drag-to-close ----------
  // iOS sheets dismiss when the user pulls down on the drag handle /
  // top of the sheet. `dragY` is the live offset while dragging; on
  // release we close if the user crossed the distance threshold or
  // flicked down with enough velocity, otherwise we snap back to 0.
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  // We track the live drag distance in a ref alongside React state,
  // because pointerup fires from the same task queue that React
  // schedules its renders from — there's no guarantee the `dragY`
  // captured in the handler closure is the value after the most
  // recent pointermove. Reading from the ref guarantees we use the
  // latest distance when deciding whether to close.
  const dragYRef = useRef(0)
  const dragRef = useRef<{ startY: number; startTime: number } | null>(null)
  // Any intentional pull-down collapses the sheet back into the
  // "Buy Now Pay Later" CTA pill — we keep a small distance floor
  // (~24px) so an accidental tap on the handle bar doesn't close,
  // but anything beyond that triggers the morph-back gesture.
  const DRAG_CLOSE_DISTANCE = 24
  const DRAG_CLOSE_VELOCITY = 0.15 // px/ms — soft flick also triggers
  const onDragPointerDown = (e: React.PointerEvent) => {
    if (!open) return
    // Block secondary mouse button only — keep primary (0) and
    // middle (1) working. Touch / pen inputs report button 0 or -1
    // and should pass through unchanged.
    if (e.button === 2) return
    // Stop the browser's native left-click behaviour: HTML5 drag
    // initiation, text selection, and ghost-image preview. Without
    // this, left-click+drag on a <div> pre-empts the pointer event
    // sequence (which is why middle-click worked before — middle-
    // click doesn't trigger native drag-and-drop).
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startTime: performance.now() }
    dragYRef.current = 0
    setIsDragging(true)
    setDragY(0)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }
  const onDragPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    // Allow a small elastic pull upward (negative delta) for natural
    // feel but cap it tightly. Downward motion follows the finger
    // 1:1 with no damping.
    const delta = Math.max(-16, e.clientY - drag.startY)
    dragYRef.current = delta
    setDragY(delta)
  }
  const onDragPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setIsDragging(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
    // Read from the ref (not the React state) — the ref is updated
    // synchronously in pointermove, so it always reflects the final
    // drag distance even if React hasn't rerendered yet.
    const finalDy = dragYRef.current
    const elapsed = Math.max(performance.now() - drag.startTime, 1)
    const velocity = finalDy / elapsed
    const shouldClose = finalDy > DRAG_CLOSE_DISTANCE || velocity > DRAG_CLOSE_VELOCITY
    if (shouldClose) onClose()
    // Spring back / let the morph play from this position by
    // resetting the live drag offset to 0.
    dragYRef.current = 0
    setDragY(0)
  }
  // While dragging, fade the dim backdrop in proportion to how far
  // the sheet has been pulled down so dismissal reads visually. The
  // sheet closes once `open` flips to false (driven by parent state)
  // — at that point the morph + translateY reset transition together
  // and the backdrop fades to 0 along with them.
  const dragBackdropOpacity = open
    ? Math.max(0.2, 1 - Math.max(0, dragY) / 400)
    : 0
  return (
    <>
      {/* Dim the underlying Nike page when sheet is open. Tap to dismiss.
          Opacity also fades as the sheet is dragged down so the user
          gets visual confirmation the dismiss gesture is registering. */}
      <div
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? dragBackdropOpacity : 0,
          transition: isDragging
            ? 'none'
            : `opacity ${MORPH_MS}ms ${MORPH_EASE}`,
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 20,
        }}
        aria-hidden={!open}
      />
      {/* The morphing pill/sheet — single element transitions all its
          dimensions from the pill (157×48 at left:229, bottom:16, fully
          rounded) to the sheet (402×666 at left:0, bottom:0, top-only
          rounded). The closed state is interactive (tap to open) and
          shows the pill text; the open state shows the sheet body. */}
      <div
        onClick={open ? undefined : onOpen}
        className="absolute overflow-hidden"
        role={open ? undefined : 'button'}
        aria-label={open ? undefined : 'Open Pay Later'}
        tabIndex={open ? -1 : 0}
        style={{
          // Pill: floats at left:229 / bottom:16 (toolbar position).
          // Sheet: tighter card-floating style — ~8px horizontal
          // margin and 12px bottom margin so the sheet feels close
          // to the phone edges while still showing the dim backdrop
          // around it. Corner radius follows iOS concentric-rounding
          // guidelines: sheet radius = viewport inner radius (48px)
          // minus sheet inset (8px) = 40px, so the sheet visually
          // nests inside the phone's rounded viewport.
          left: open ? 8 : 229,
          width: open ? 386 : 157,
          bottom: open ? 12 : 16,
          height: open ? 660 : 48,
          borderRadius: open ? 40 : 1080,
          // iOS Liquid Glass — translucent dark fill + heavy backdrop
          // blur + saturation boost so the dimmed Nike page bleeds
          // through. Inset white highlight gives the realistic glass
          // edge. The pill state uses a slightly more opaque fill
          // because it's smaller and needs more contrast for the
          // "Buy Now Pay Later" text to read on the busy page bg.
          background: open ? 'rgba(20,20,22,0.62)' : 'rgba(0,0,0,0.63)',
          border: '0.5px solid rgba(204,204,204,0.18)',
          boxShadow: open
            ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 -2px 24px rgba(0,0,0,0.35)'
            : 'inset 0 1px 0 rgba(255,255,255,0.12)',
          WebkitBackdropFilter: `blur(${open ? 36 : 20}px) saturate(180%)`,
          backdropFilter: `blur(${open ? 36 : 20}px) saturate(180%)`,
          // Drag offset applied as translateY ON TOP OF the morph
          // dimensions. We always apply translateY(dragY) — even
          // when transitioning to closed — so a release past the
          // threshold lets the morph (left/width/etc) and the
          // translateY reset interpolate together in lock-step.
          // Otherwise the sheet snaps back UP at 320ms while still
          // morphing for another 240ms, which reads as the buggy
          // "two motions fighting" feel.
          transform: `translateY(${dragY}px)`,
          transition: [
            `left ${MORPH_MS}ms ${MORPH_EASE}`,
            `width ${MORPH_MS}ms ${MORPH_EASE}`,
            `bottom ${MORPH_MS}ms ${MORPH_EASE}`,
            `height ${MORPH_MS}ms ${MORPH_EASE}`,
            `border-radius ${MORPH_MS}ms ${MORPH_EASE}`,
            `background ${MORPH_MS}ms ${MORPH_EASE}`,
            `backdrop-filter ${MORPH_MS}ms ${MORPH_EASE}`,
            `-webkit-backdrop-filter ${MORPH_MS}ms ${MORPH_EASE}`,
            // Transform follows the same curve + duration as the
            // morph so close + slide read as a single motion.
            isDragging ? 'transform 0ms' : `transform ${MORPH_MS}ms ${MORPH_EASE}`,
          ].join(', '),
          willChange: 'left, width, bottom, height, border-radius, transform',
          zIndex: 21,
          color: '#fff',
          cursor: open ? 'default' : 'pointer',
        }}
        aria-hidden={undefined}
      >
        {/* Pill content layer — visible only when closed. Cross-fades
            out fast as the morph begins, with a short delay-in when
            collapsing back so the sheet content is gone first. */}
        <div
          className="absolute inset-0 flex items-center justify-center font-text"
          style={{
            gap: 4,
            fontSize: 12,
            lineHeight: '16px',
            opacity: open ? 0 : 1,
            transition: open
              ? `opacity 160ms ${MORPH_EASE}`
              : `opacity 240ms ${MORPH_EASE} ${Math.round(MORPH_MS * 0.55)}ms`,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontWeight: 500 }}>Buy Now</span>
          <span className="font-display" style={{ fontWeight: 900 }}>
            Pay Later
          </span>
        </div>
        {/* Sheet content layer — visible only when open. Delayed in
            until the morph is mostly done; fades out fast on close. */}
        <div
          className="absolute inset-0"
          style={{
            opacity: open ? 1 : 0,
            transition: open
              ? `opacity 280ms ${MORPH_EASE} ${Math.round(MORPH_MS * 0.5)}ms`
              : `opacity 160ms ${MORPH_EASE}`,
            pointerEvents: open ? 'auto' : 'none',
            textAlign: 'left',
          }}
        >
        {/* Drag handle — iOS-style pull-down zone. We give the
            handle a generous touch target (full-width, ~24px tall
            band) so it's easy to grab without being precise. Pointer
            handlers drive the dragY state above to follow the
            finger; release decides whether to close or spring back.
            `userSelect: none` + `draggable={false}` prevent the
            browser from kicking in native text-selection / drag-
            image behaviour on left-click. */}
        <div
          className="flex justify-center"
          draggable={false}
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            // @ts-expect-error: WebkitUserDrag is non-standard but
            // suppresses the ghost drag image in WebKit/Chromium.
            WebkitUserDrag: 'none',
          }}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <div
            style={{
              width: 36,
              height: 5,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.36)',
              pointerEvents: 'none',
            }}
          />
        </div>
        {/* Tabs — iOS Liquid Glass sliding pill morphs between tab
            positions with spring easing + a subtle liquid stretch in
            the travel direction. Same motion as the bottom nav and
            wallet sub-nav, except the active pill is white (matches
            the Figma's sheet design). */}
        <PayLaterTabsRow active={tab} onChange={handleTabChange} />
        {/* Scrollable body — content swaps per active tab with a
            two-phase direction-aware slide that mirrors the wallet
            tabs exactly. `displayTab` is what's actually rendered;
            it flips at the boundary between exit and enter so the
            outgoing content slides off before the new one slides in.
            overflow-x: hidden so the off-screen panes don't show. */}
        <div
          className="overflow-y-auto overflow-x-hidden no-scrollbar relative"
          // Padding per Figma node 73:2780 → Container / Pay Later:
          // the 386px sheet has 16px content inset on each side
          // (giving the 354px-wide inner content rail).
          style={{ height: 666 - 60, paddingLeft: 16, paddingRight: 16, paddingBottom: 32 }}
        >
          <div style={tabPaneStyle} key={displayTab}>
          {displayTab === 'Price tracking' ? (
            <PriceTrackingTab />
          ) : displayTab === 'Price history' ? (
            <PriceHistoryTab />
          ) : displayTab === 'Price comparison' ? (
            <PriceComparisonTab />
          ) : (
            <>
          {/* Due Today header.
              paddingTop per Figma node 73:2780 → Container / Pay Later
              sits at top:12 within its parent (above it is the tabs
              row, which is a sibling). */}
          <div style={{ paddingTop: 12 }}>
            <p
              className="font-display"
              style={{
                fontSize: 20,
                lineHeight: '32px',
                fontWeight: 900,
                letterSpacing: '-1px',
                margin: 0,
              }}
            >
              Due Today
            </p>
            <div className="flex items-start" style={{ marginTop: 4 }}>
              <span
                className="font-display"
                style={{
                  fontSize: 24,
                  lineHeight: '40px',
                  letterSpacing: '-0.48px',
                  fontWeight: 900,
                  marginRight: 2,
                }}
              >
                $
              </span>
              <span
                className="font-display"
                style={{
                  fontSize: 40,
                  lineHeight: '40px',
                  letterSpacing: '-1px',
                  fontWeight: 900,
                }}
              >
                800.00
              </span>
            </div>
            <p
              className="font-text"
              style={{
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.72)',
                margin: 0,
                marginTop: 4,
              }}
            >
              No late fees.
            </p>
          </div>
          {/* Pay in 4 section.
              marginTop per Figma node 73:2780 → Container / 1 sits at
              top:130 within Container/Pay Later. Container/Header
              above it ends at 102, so the inter-section gap is 28px. */}
          <div style={{ marginTop: 28 }}>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="font-text"
                  style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500, margin: 0 }}
                >
                  Pay in 4. Interest free.
                </p>
                <p
                  className="font-text"
                  style={{ fontSize: 12, lineHeight: '16px', color: '#999', margin: 0 }}
                >
                  Your payment schedule with <strong>0% APR</strong> at a glance.
                </p>
              </div>
              <img src="/images/browser-icon-info.svg" alt="" style={{ width: 17, height: 17 }} />
            </div>
            {/* 4 installment tiles.
                marginTop per Figma node 73:2780 → within Container/1,
                "Top Desc" (heading row) is 40 tall at top:0 and the
                tiles "Content" starts at top:52, so the gap is 12px. */}
            <div className="flex" style={{ gap: 8, marginTop: 12 }}>
              {PAY_IN_4_INSTALLMENTS.map((inst, i) => {
                const isPaid = i === 0
                return (
                  <div
                    key={inst.n}
                    className="overflow-hidden"
                    style={{
                      flex: 1,
                      height: 94,
                      borderRadius: 13.831,
                      background: isPaid ? '#efefef' : 'rgba(129,129,129,0.2)',
                      border: isPaid
                        ? '0.864px solid #efefef'
                        : '0.5px solid rgba(204,204,204,0.12)',
                      padding: 9.5,
                    }}
                  >
                    <p
                      className="font-display"
                      style={{
                        fontSize: 20.746,
                        lineHeight: '27.661px',
                        fontWeight: 900,
                        letterSpacing: '-0.8644px',
                        color: isPaid ? '#000' : '#fff',
                        margin: 0,
                      }}
                    >
                      {inst.n}
                    </p>
                    <p
                      className="font-text"
                      style={{
                        fontSize: 12,
                        lineHeight: '16px',
                        color: '#999',
                        margin: 0,
                        marginTop: 12,
                      }}
                    >
                      {inst.date}
                    </p>
                    <p
                      className="font-text"
                      style={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 500,
                        color: isPaid ? '#000' : '#fff',
                        margin: 0,
                      }}
                    >
                      {inst.amount}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Pay Monthly section.
              marginTop per Figma node 73:2780 → Container/2 sits at
              top:304 within Container/Pay Later. Container/1 above
              it ends at 276, so the inter-section gap is 28px. */}
          <div style={{ marginTop: 28 }}>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="font-text"
                  style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500, margin: 0 }}
                >
                  Pay Monthly
                </p>
                <p
                  className="font-text"
                  style={{ fontSize: 12, lineHeight: '16px', color: '#999', margin: 0 }}
                >
                  Your payment options at a glance.
                </p>
              </div>
              <img src="/images/browser-icon-info.svg" alt="" style={{ width: 17, height: 17 }} />
            </div>
            {/* Pay Monthly options list.
                marginTop per Figma node 73:2780 → within Container/2,
                "Top Desc" is 40 tall at top:0 and "Container/List"
                starts at top:52, so the gap is 12px. Row gap of 8px
                matches the 84−76 stride between adjacent tiles. */}
            <div className="flex flex-col" style={{ gap: 8, marginTop: 12 }}>
              {PAY_MONTHLY_OPTIONS.map((opt) => (
                <div
                  key={opt.term}
                  className="overflow-hidden"
                  style={{
                    height: 76,
                    borderRadius: 13.831,
                    background: 'rgba(129,129,129,0.2)',
                    border: '0.5px solid rgba(204,204,204,0.12)',
                    padding: '15px 11.5px',
                  }}
                >
                  <p
                    className="font-text"
                    style={{ fontSize: 14, lineHeight: '20px', color: '#fff', margin: 0 }}
                  >
                    <strong>{opt.rate}</strong> {opt.term}
                  </p>
                  <p
                    className="font-text"
                    style={{
                      fontSize: 14,
                      lineHeight: '20px',
                      color: '#999',
                      margin: 0,
                      marginTop: 4,
                    }}
                  >
                    {opt.meta}
                  </p>
                </div>
              ))}
            </div>
          </div>
            </>
          )}
          </div>
          {/* /sliding tab pane */}
        </div>
        {/* /sheet content layer */}
        </div>
      </div>
    </>
  )
}

// IAB 2 — brand site mockup. For Nike we have the real Figma background
// + player image; other brands fall back to a placeholder. Layout taken
// 1:1 from Figma node 73:2543:
//   - Status bar (50)
//   - URL header (48 below status)
//   - ViewPort scroll container (top:98, height:776) with page content
//     402 × 2657 (page bg) and player photo at top:258 sized 402 × 602
//   - Floating toolbar (bottom:0, h:80, w:402) with absolute-positioned
//     chevrons + Buy Now Pay Later pill at exact Figma offsets
const BrowserSite = ({
  brand,
  spec,
  onClose,
}: {
  brand: BrowserBrand
  spec: BrowserBrandSpec
  onClose: () => void
}) => (
  <div className="absolute inset-0 bg-white overflow-hidden">
    <BrowserStatusBar />
    <BrowserHeader centerText={spec.url} onClose={onClose} />
    {/* Page content viewport — sits below the 98px status+URL header.
        Scrollable for the tall page background; horizontal overflow
        hidden so the slight 100.01% image overshoot doesn't leak.
        `no-scrollbar` hides the WebKit/Firefox scrollbar to match an
        iOS in-app browser. */}
    <div
      className="absolute left-0 right-0 overflow-y-auto overflow-x-hidden no-scrollbar"
      style={{ top: 98, bottom: 0, background: '#fff' }}
    >
      {brand === 'nike' ? (
        // Inner page container — 402 wide × 2657 tall matches Figma.
        <div className="relative" style={{ width: 402, height: 2657 }}>
          {/* Page background — fills the 402×2657 container slightly
              oversized (h: 105.95% / left: -0.01%) per Figma. */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              src="/images/browser-nike-page-bg.png"
              alt=""
              className="absolute pointer-events-none max-w-none"
              style={{
                left: '-0.01%',
                top: 0,
                width: '100.01%',
                height: '105.95%',
              }}
            />
          </div>
          {/* Nike Football player photo — 402 × 602 at top:258 */}
          <div
            className="absolute overflow-hidden"
            style={{ left: 0, top: 258, width: 402, height: 602 }}
          >
            <img
              src="/images/browser-nike-player.png"
              alt=""
              className="absolute inset-0 pointer-events-none w-full h-full"
              style={{ objectFit: 'cover' }}
            />
          </div>
        </div>
      ) : (
        // Pre-baked mobile screenshot of the live retail page (Apple,
        // Sony) stored under /public/images/. We previously hit
        // microlink.io at render time, but its free tier rate-limits
        // browser requests, so the IAB intermittently failed to load.
        // Baking the screenshots into the bundle removes the runtime
        // dependency entirely — Apple + Sony now always load instantly.
        // To refresh either screenshot, re-fetch from microlink with
        //   device=iphone-x&fullPage=true and overwrite the file.
        <img
          src={IAB_SCREENSHOTS[brand] ?? ''}
          alt={`${spec.name} retail site`}
          className="block"
          style={{
            width: 402,
            // Auto height preserves the image's aspect ratio. Tall
            // screenshots will scroll inside the parent container.
            height: 'auto',
            background: '#fff',
          }}
        />
      )}
    </div>
    {/* Floating bottom tool bar — anchored at bottom:0, height:80, w:402.
        Backdrop-blur applies to the entire bar so the page behind
        softens through it. Children are positioned with 16px L/R
        margins to match the rest of the prototype's content rail:
          chevron-left:  x=16, y=16, 49×49 (was x=40.5)
          chevron-right: x=72, y=16, 49×49 (was x=96.5 — 7px gap)
          Buy Now Pay Later pill: x=229, y=16, 157×48 (right edge 386
            → 16px from the 402-wide viewport edge). */}
    <div
      className="absolute left-0 right-0 z-10"
      style={{
        bottom: 0,
        height: 80,
        WebkitBackdropFilter: 'blur(4px)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <button
        type="button"
        className="absolute flex items-center justify-center"
        style={{
          left: 16,
          top: 16,
          width: 49,
          height: 49,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.63)',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
        }}
        aria-label="Back"
      >
        <img
          src="/images/browser-icon-chevron-left.svg"
          alt=""
          style={{ width: 24, height: 24 }}
        />
      </button>
      <button
        type="button"
        className="absolute flex items-center justify-center"
        style={{
          left: 72,
          top: 16,
          width: 49,
          height: 49,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.63)',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
        }}
        aria-label="Forward"
      >
        <img
          src="/images/browser-icon-chevron-right.svg"
          alt=""
          style={{ width: 24, height: 24 }}
        />
      </button>
      {/* The "Buy Now Pay Later" pill itself is rendered by
          BrowserPayLater so it can morph into the sheet. We just
          render the chevrons here; the pill sits in the same toolbar
          row visually but lives outside this container. */}
    </div>
  </div>
)

// Bitcoin Product Detail Page sheet — slides up over the Crypto card
// when a user taps the Bitcoin row. Built 1:1 from Figma 129:88848:
// a header with back arrow + "Buy and sell crypto" title, a hero card
// (badge + price + chart + time tabs + Sell/Buy CTAs), a Recent
// Activity list with a See-all CTA, and an informational nested card.
// ── Shared crypto market store (per coin) ───────────────────────────
// Module-level so every surface (each coin's PDP, Crypto Overview,
// wallet Crypto card) reads the SAME live quote from ONE 60s poll per
// coin, instead of each component fetching separately. CoinGecko free
// endpoints, no API key, browser CORS — works on the static deploy
// with no backend.
type CoinId =
  | 'bitcoin'
  | 'ethereum'
  | 'solana'
  | 'chainlink'
  | 'litecoin'
  | 'bitcoin-cash'
  | 'paypal-usd'
type CoinQuote = { price: number; change24h: number }
type CoinStore = {
  quote: CoinQuote | null
  subs: Set<(q: CoinQuote) => void>
  timer: number | null
  retry: number | null
  seriesCache: Record<string, number[]>
  yearRaw: Array<[number, number]> | null
  yearRawPromise: Promise<void> | null
}
// Registry of per-coin stores, stashed on globalThis so Vite HMR
// re-evaluations reuse the SAME instances — otherwise each hot reload
// would orphan the previous module's 60s poll as a zombie, multiplying
// CoinGecko calls into the rate limit. One store per coin = one
// interval, one cache, live values that survive code edits in dev.
const coinStores: Record<string, CoinStore> = ((
  globalThis as unknown as Record<string, unknown>
).__hfppCoinStores as Record<string, CoinStore>) ??
  (((globalThis as unknown as Record<string, unknown>).__hfppCoinStores =
    {}) as Record<string, CoinStore>)
const getCoinStore = (id: CoinId): CoinStore => {
  if (!coinStores[id]) {
    coinStores[id] = {
      quote: null,
      subs: new Set(),
      timer: null,
      retry: null,
      seriesCache: {},
      yearRaw: null,
      yearRawPromise: null,
    }
  }
  return coinStores[id]
}
// If a fetch fails BEFORE we ever got a quote, retry on a short fuse
// (10s) so a transient rate-limit window self-heals; once a quote
// exists the 60s poll cadence is enough.
const scheduleCoinQuoteRetry = (id: CoinId) => {
  const s = getCoinStore(id)
  if (s.quote || s.retry != null || s.subs.size === 0) return
  s.retry = window.setTimeout(() => {
    s.retry = null
    fetchCoinQuote(id)
  }, 10_000)
}
// Every coin the app can show. One bulk quote call warms them ALL, so
// opening any detail page (Chainlink / Litecoin / Bitcoin Cash included)
// finds its price already live instead of waiting on a cold per-coin
// fetch that often loses the CoinGecko free-tier rate-limit race.
const ALL_COIN_IDS: CoinId[] = [
  'bitcoin',
  'ethereum',
  'solana',
  'chainlink',
  'litecoin',
  'bitcoin-cash',
  'paypal-usd',
]
// Collapse concurrent callers into a single in-flight request so the
// always-on BTC poll + the open PDP's poll don't double-spend the rate
// limit. One network call updates every coin's store + subscribers.
let allQuotesInFlight: Promise<void> | null = null
const fetchAllCoinQuotes = (): Promise<void> => {
  if (allQuotesInFlight) return allQuotesInFlight
  allQuotesInFlight = (async () => {
    try {
      const ids = ALL_COIN_IDS.join(',')
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      )
      if (!r.ok) return
      const j = await r.json()
      for (const id of ALL_COIN_IDS) {
        const price = j?.[id]?.usd
        const change = j?.[id]?.usd_24h_change
        if (typeof price === 'number') {
          const s = getCoinStore(id)
          s.quote = {
            price,
            change24h: typeof change === 'number' ? change : 0,
          }
          s.subs.forEach((fn) => fn(s.quote!))
        }
      }
    } catch {
      /* offline / rate-limited — subscribers keep their fallbacks */
    } finally {
      allQuotesInFlight = null
    }
  })()
  return allQuotesInFlight
}
const fetchCoinQuote = async (id: CoinId) => {
  // Any single coin's poll fetches the whole set in one request; if this
  // coin still has no quote afterwards (rate-limited), retry on the fuse.
  await fetchAllCoinQuotes()
  if (!getCoinStore(id).quote) scheduleCoinQuoteRetry(id)
}
// Subscribe to a coin's shared quote while `active`. The poll starts
// with the first active subscriber and stops when the last one leaves.
const useCoinQuote = (id: CoinId, active: boolean): CoinQuote | null => {
  const [quote, setQuote] = useState<CoinQuote | null>(getCoinStore(id).quote)
  useEffect(() => {
    if (!active) return
    const s = getCoinStore(id)
    const sub = (q: CoinQuote) => setQuote(q)
    s.subs.add(sub)
    if (s.quote) setQuote(s.quote)
    if (s.timer == null) {
      fetchCoinQuote(id)
      s.timer = window.setInterval(() => fetchCoinQuote(id), 60_000)
    }
    return () => {
      s.subs.delete(sub)
      if (s.subs.size === 0 && s.timer != null) {
        window.clearInterval(s.timer)
        s.timer = null
      }
    }
  }, [id, active])
  return quote
}
// Backward-compatible Bitcoin wrapper for the surfaces that only show
// BTC (wallet Crypto card + Crypto Overview hero).
const useBtcQuote = (active: boolean): CoinQuote | null =>
  useCoinQuote('bitcoin', active)
const ensureCoinYearRaw = (id: CoinId): Promise<void> => {
  const s = getCoinStore(id)
  if (s.yearRaw) return Promise.resolve()
  if (s.yearRawPromise) return s.yearRawPromise
  s.yearRawPromise = (async () => {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365`,
      )
      if (!r.ok) return
      const j = await r.json()
      if (Array.isArray(j?.prices) && j.prices.length > 1) {
        s.yearRaw = j.prices
        // Seed the 1Y chart cache from the same payload so tapping the
        // 1Y tab later costs nothing extra.
        const prices = (j.prices as Array<[number, number]>).map((p) => p[1])
        const N = 120
        s.seriesCache['365'] =
          prices.length > N
            ? Array.from(
                { length: N },
                (_, i) => prices[Math.round((i * (prices.length - 1)) / (N - 1))],
              )
            : prices
      }
    } catch {
      /* lots keep their fallback changes */
    } finally {
      if (!s.yearRaw) s.yearRawPromise = null
    }
  })()
  return s.yearRawPromise
}
// Closest historical price to `daysAgo` from a coin's raw 1Y series.
const lookupCoinPriceDaysAgo = (id: CoinId, daysAgo: number): number | null => {
  const s = getCoinStore(id)
  if (!s.yearRaw) return null
  const target = Date.now() - daysAgo * 86_400_000
  let best: [number, number] | null = null
  for (const pt of s.yearRaw) {
    if (!best || Math.abs(pt[0] - target) < Math.abs(best[0] - target)) {
      best = pt
    }
  }
  return best ? best[1] : null
}

// ── Per-coin 40px avatars (reused by the PDP header + activity rows) ─
const CoinAvatarBitcoin = () => (
  <div
    className="relative overflow-hidden"
    style={{
      width: 40,
      height: 40,
      borderRadius: 999,
      background: '#ff8d00',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div style={{ position: 'absolute', inset: 'calc(12.5% - 0.75px)' }}>
      <img
        src="/images/ppp-bitcoin.svg"
        alt=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  </div>
)
const CoinAvatarEthereum = () => (
  <div
    className="relative overflow-hidden"
    style={{
      width: 40,
      height: 40,
      borderRadius: 999,
      background: '#151c2f',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 'calc(12.5% - 0.75px)',
        right: 'calc(10.8% - 0.78px)',
        bottom: 'calc(12.5% - 0.75px)',
        left: 'calc(14.2% - 0.72px)',
      }}
    >
      <img
        src="/images/ppp-eth.svg"
        alt=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  </div>
)
const CoinAvatarSolana = () => (
  <div
    className="relative overflow-hidden"
    style={{
      width: 40,
      height: 40,
      borderRadius: 32,
      background: '#000',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: '27.57%',
        left: '24.97%',
        right: '24.97%',
        bottom: '27.57%',
        WebkitMaskImage: 'url(/images/ppp-sol-mask.svg)',
        maskImage: 'url(/images/ppp-sol-mask.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        backgroundImage: 'url(/images/ppp-sol-fill.svg)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  </div>
)
const CoinAvatarChainlink = () => (
  <div
    className="relative"
    style={{
      width: 40,
      height: 40,
      borderRadius: 50,
      background: '#0847f7',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 'calc(16.04% - 0.68px)',
        right: 'calc(20.46% - 0.59px)',
        bottom: 'calc(16.04% - 0.68px)',
        left: 'calc(20.46% - 0.59px)',
      }}
    >
      <img
        src="/images/crypto-pdp-chainlink.svg"
        alt=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  </div>
)
const CoinAvatarLitecoin = () => (
  <div
    className="relative overflow-hidden"
    style={{
      width: 40,
      height: 40,
      borderRadius: 999,
      background: '#587be1',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div style={{ position: 'absolute', inset: 'calc(12.5% - 0.75px)' }}>
      <img
        src="/images/crypto-pdp-litecoin.svg"
        alt=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  </div>
)
const CoinAvatarBitcoinCash = () => (
  <div
    className="relative overflow-hidden"
    style={{
      width: 40,
      height: 40,
      borderRadius: 999,
      background: '#4bcf51',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div style={{ position: 'absolute', inset: 'calc(12.5% - 0.75px)' }}>
      <img
        src="/images/crypto-pdp-bitcoin-cash.svg"
        alt=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  </div>
)
const CoinAvatarPyusd = () => (
  <div
    className="relative overflow-hidden"
    style={{
      width: 40,
      height: 40,
      borderRadius: 999,
      background: '#000',
      border: '1px solid rgba(204,204,204,0.28)',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 'calc(19.61% - 0.61px)',
        right: 'calc(19.81% - 0.6px)',
        bottom: 'calc(18.87% - 0.62px)',
        left: 'calc(21.65% - 0.57px)',
      }}
    >
      <img
        src="/images/crypto-pdp-pyusd.svg"
        alt=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  </div>
)

// ── Per-coin PDP config ─────────────────────────────────────────────
// Everything the (shared) crypto detail sheet needs to render a coin:
// labels, the user's holdings + its display precision, the chart line
// accent (each coin's brand color), and the offline fallback numbers.
type CryptoPdpConfig = {
  id: CoinId
  name: string
  symbol: string
  holdings: number
  balanceDecimals: number
  lineColor: string
  // Optional brand gradient for the chart line (≥2 colour stops, drawn
  // left→right across the chart). When set it replaces the solid
  // lineColor on the graph — e.g. Solana's purple→green brand gradient.
  lineGradient?: string[]
  fallbackBase: number
  fallbackPrice: number
  fallbackChange: number
  Avatar: React.FC
  // Stablecoins: the USD value they're pegged to (e.g. PYUSD → 1). When
  // set, the chart fixes its vertical domain symmetrically around this
  // peg instead of auto-scaling to min/max — so sub-cent fluctuations
  // render as a flat line hugging the peg (the dotted baseline) rather
  // than being amplified into fake volatility. The fallback series and
  // activity changes are likewise generated as near-peg/near-0%.
  pegUsd?: number
  // Descriptor paragraphs shown in the "About" card at the bottom of the
  // detail page — one entry per paragraph, coin-specific.
  about: string[]
}
const CRYPTO_PDP_CONFIG: Record<CoinId, CryptoPdpConfig> = {
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    holdings: 0.01936605,
    balanceDecimals: 8,
    lineColor: '#F7931B',
    // Fallbacks track the live market level so the header + chart stay
    // accurate when CoinGecko is rate-limited. base === price so the
    // synthetic line is anchored at the same value the header shows.
    fallbackBase: 64000,
    fallbackPrice: 64000,
    fallbackChange: -0.4,
    Avatar: CoinAvatarBitcoin,
    about: [
      'Launched in 2009, Bitcoin is the original cryptocurrency. It was developed by an anonymous developer who uses the pseudonym Satoshi Nakamoto.',
      'Bitcoin relies on a decentralized peer-to-peer network called a blockchain. This decentralized network enables direct transactions without the need of a third party.',
    ],
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    holdings: 0.5123,
    balanceDecimals: 6,
    lineColor: '#627EEA',
    fallbackBase: 1670,
    fallbackPrice: 1670,
    fallbackChange: -0.4,
    Avatar: CoinAvatarEthereum,
    about: [
      'Launched in 2015, Ethereum is a decentralized blockchain best known for introducing smart contracts — programs that run exactly as written, without intermediaries.',
      'ETH is the network’s native token, used to pay for transactions and computation. Ethereum powers much of decentralized finance (DeFi), NFTs, and a wide range of decentralized apps.',
    ],
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    holdings: 8.42,
    balanceDecimals: 4,
    lineColor: '#14F195',
    // Solana brand gradient — purple → green across the chart line.
    lineGradient: ['#9945FF', '#14F195'],
    fallbackBase: 68,
    fallbackPrice: 68,
    fallbackChange: -0.7,
    Avatar: CoinAvatarSolana,
    about: [
      'SOL is the native cryptocurrency token of the Solana blockchain. Solana, launched in 2020, is a blockchain known for its high transaction speeds, minimal fees and advanced technologies, supporting fast, scalable, and low-cost decentralized applications.',
      'This mix of features makes it an attractive platform for developers and users in the blockchain space.',
    ],
  },
  chainlink: {
    id: 'chainlink',
    name: 'Chainlink',
    symbol: 'LINK',
    holdings: 42.5,
    balanceDecimals: 4,
    lineColor: '#2A5ADA',
    fallbackBase: 7.85,
    fallbackPrice: 7.85,
    fallbackChange: -1.6,
    Avatar: CoinAvatarChainlink,
    about: [
      'Chainlink is a decentralized oracle network that connects blockchains to real-world data, events, and payment systems outside their native networks.',
      'LINK is the network’s token, used to pay node operators who retrieve and verify off-chain data so smart contracts can act on it reliably.',
    ],
  },
  litecoin: {
    id: 'litecoin',
    name: 'Litecoin',
    symbol: 'LTC',
    holdings: 3.21,
    balanceDecimals: 4,
    lineColor: '#A6A9AA',
    fallbackBase: 44,
    fallbackPrice: 44,
    fallbackChange: 1.1,
    Avatar: CoinAvatarLitecoin,
    about: [
      'Created in 2011 by Charlie Lee, Litecoin is one of the earliest cryptocurrencies, designed as a faster, lower-cost complement to Bitcoin.',
      'It uses the same peer-to-peer model as Bitcoin but with quicker block times, making it well suited to everyday payments.',
    ],
  },
  'bitcoin-cash': {
    id: 'bitcoin-cash',
    name: 'Bitcoin Cash',
    symbol: 'BCH',
    holdings: 1.12,
    balanceDecimals: 5,
    lineColor: '#0AC18E',
    fallbackBase: 200,
    fallbackPrice: 200,
    fallbackChange: -3.4,
    Avatar: CoinAvatarBitcoinCash,
    about: [
      'Bitcoin Cash launched in 2017 as a fork of Bitcoin, increasing the block size to fit more transactions into each block.',
      'BCH is designed to be used as peer-to-peer electronic cash, prioritizing faster, lower-fee everyday transactions.',
    ],
  },
  // PYUSD — PayPal's $1-pegged stablecoin (CoinGecko id `paypal-usd`).
  // Holdings are whole tokens, so the USD balance ≈ holdings; the live
  // line stays near $1 and auto-scales to the micro-fluctuation. Brand
  // accent is PayPal blue.
  'paypal-usd': {
    id: 'paypal-usd',
    name: 'PYUSD',
    symbol: 'PYUSD',
    holdings: 120.87,
    balanceDecimals: 2,
    lineColor: '#0070E0',
    fallbackBase: 1,
    fallbackPrice: 1,
    fallbackChange: 0.0,
    Avatar: CoinAvatarPyusd,
    pegUsd: 1,
    about: [
      'PayPal USD (PYUSD) is a stablecoin issued by Paxos and fully backed by US dollar deposits, US Treasuries, and similar cash equivalents.',
      'Each PYUSD is designed to be redeemable 1:1 for US dollars, so its value stays pegged to $1.00.',
    ],
  },
}

const CryptoPdpSheet = () => {
  const {
    cryptoPdpCoin,
    cryptoPdpSource,
    closeCryptoPdp,
  } = useNav()
  // Sell/Buy previously launched the Transfer flow for this coin — Transfer
  // has been removed from the build, so the buttons render but no longer do
  // anything.
  const launchTransfer = () => {}
  // Default time range = 1W on every detail-page load (reset on open via
  // the effect below, since this sheet is a single persistent instance
  // and would otherwise keep the last-selected tab between pages).
  const [timeTab, setTimeTab] = useState<'24H' | '1W' | '1M' | '6M' | '1Y' | '2Y'>('1W')
  const visible = cryptoPdpCoin != null
  // The active coin's config drives every coin-specific value below
  // (labels, holdings, line color, fallbacks, avatar). Falls back to
  // bitcoin while closed so hooks below always have a stable config.
  const cfg = CRYPTO_PDP_CONFIG[cryptoPdpCoin ?? 'bitcoin']
  const coinId = cfg.id
  const closeBitcoinPdp = closeCryptoPdp
  // Context-dependent dismiss control. Opened from the Crypto Overview
  // sheet → back arrow (returns to that list beneath). Opened directly
  // from the Accounts-tab Crypto card → X close (full dismiss, since
  // there's no parent list to step back to).
  const fromOverview = cryptoPdpSource === 'overview'
  // Two-frame entrance gate so the slide ALWAYS travels along the axis
  // of the CURRENT source. A CSS transform-transition animates from the
  // element's previous committed position — so if the sheet last rested
  // off-screen at the BOTTOM (a prior 'direct' modal) and we now open as
  // 'overview', a naive transform swap would animate bottom→centre
  // (vertical) instead of right→centre (horizontal). To fix it we:
  //   frame A (visible, !entered): snap to this source's off-screen
  //            position with transition OFF (no diagonal animation)
  //   frame B (visible, entered):  animate to centre with transition ON
  // On close (!visible) the transition is ON so it slides back out along
  // the same axis it came in.
  const [pdpEntered, setPdpEntered] = useState(false)
  useEffect(() => {
    if (!visible) {
      setPdpEntered(false)
      return
    }
    const raf = requestAnimationFrame(() => setPdpEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [visible])
  // Graph draw-on — the live line "draws itself" via a CSS keyframe
  // (btc-draw-on) sweeping the stroke dash from hidden → drawn. It's
  // replayed by remounting the <path>; the key combines `chartAnimKey`
  // (below) + the active tab, so the line re-draws on a tab switch AND
  // every time the sheet enters / the coin changes — i.e. navigating
  // detail-page → detail-page always animates the graph. (Keying on the
  // path string instead would restart it mid-view when a slow fetch
  // lands; chartAnimKey/timeTab stay stable through a fetch.)
  const [chartAnimKey, setChartAnimKey] = useState(0)
  useEffect(() => {
    // Bump on entrance and on coin change so the draw-on replays for
    // each detail page navigated to (close→reopen or a direct swap).
    // Also snap the range back to the 1W default so every detail-page
    // load opens on the one-week view regardless of the last tab used.
    if (visible) {
      setChartAnimKey((k) => k + 1)
      setTimeTab('1W')
    }
  }, [visible, coinId])
  // About card sits at a fixed top; its height varies per coin (copy
  // length). Measure it so the scroll content ends just below it — a
  // tight, consistent bottom margin on every coin's page (no global nav
  // here, so no extra reserved space). ABOUT_CARD_TOP keeps the card and
  // the bottom spacer in sync.
  const ABOUT_CARD_TOP = 1160
  const aboutCardRef = useRef<HTMLDivElement>(null)
  const [aboutCardH, setAboutCardH] = useState(0)
  useLayoutEffect(() => {
    const el = aboutCardRef.current
    if (!el) return
    const measure = () => setAboutCardH(el.offsetHeight)
    measure()
    // Re-measure if the copy reflows (e.g. fonts finish loading).
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [coinId, visible])
  // Count-up progress 0 → 1 that drives the USD and BTC balance reads.
  // Resets to 0 whenever the sheet closes so the animation replays on
  // the next open. Uses requestAnimationFrame + ease-out-cubic so the
  // numbers decelerate naturally into their final values.
  const [countProgress, setCountProgress] = useState(0)
  useEffect(() => {
    if (!visible) {
      setCountProgress(0)
      return
    }
    let raf = 0
    const DURATION = 1100
    // Match the graph reveal's 220ms delay so the chart and the two
    // headline numbers all "wake up" together right as the sheet
    // settles.
    const startDelay = window.setTimeout(() => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION)
        const eased = 1 - Math.pow(1 - t, 3)
        setCountProgress(eased)
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, 220)
    return () => {
      window.clearTimeout(startDelay)
      cancelAnimationFrame(raf)
    }
  }, [visible])
  // ── Live market data (shared per-coin store) ─────────────────────
  // One module-level 60s poll per coin feeds every surface; the
  // fallback numbers keep the prototype alive offline / rate-limited.
  const COIN_HOLDINGS = cfg.holdings
  const liveQuote = useCoinQuote(coinId, visible)
  const [liveSeries, setLiveSeries] = useState<number[] | null>(null)
  // Reset the per-tab live series when the coin changes so we don't
  // briefly show the previous coin's line before the new fetch lands.
  useEffect(() => {
    setLiveSeries(getCoinStore(coinId).seriesCache['1'] ?? null)
  }, [coinId])
  // Raw 1Y series for valuing the Recent Activity purchase lots —
  // fetched once per coin per session; `yearRawTick` re-renders when
  // it lands.
  const [yearRawTick, setYearRawTick] = useState(0)
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let retryId: number | null = null
    const attempt = () => {
      ensureCoinYearRaw(coinId).then(() => {
        if (cancelled) return
        if (getCoinStore(coinId).yearRaw) {
          setYearRawTick((t) => t + 1)
        } else {
          // Failed (rate-limited / offline) — retry while the sheet is
          // open so the activity lots upgrade to real gains once the
          // window passes.
          retryId = window.setTimeout(attempt, 12_000)
        }
      })
    }
    attempt()
    return () => {
      cancelled = true
      if (retryId != null) window.clearTimeout(retryId)
    }
  }, [visible, coinId])
  // Historical series for the active time-range tab — cached per range
  // (module level) so revisiting a tab is instant and free.
  useEffect(() => {
    if (!visible) return
    const TAB_DAYS: Record<typeof timeTab, string> = {
      '24H': '1',
      '1W': '7',
      '1M': '30',
      '6M': '180',
      '1Y': '365',
      '2Y': '730',
    }
    const days = TAB_DAYS[timeTab]
    const cache = getCoinStore(coinId).seriesCache
    const cached = cache[days]
    if (cached) {
      setLiveSeries(cached)
      return
    }
    let cancelled = false
    let retryId: number | null = null
    const run = async () => {
      try {
        const r = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
        )
        if (!r.ok) throw new Error(String(r.status))
        const j = await r.json()
        const prices: number[] | null = Array.isArray(j?.prices)
          ? j.prices.map((p: [number, number]) => p[1])
          : null
        if (!prices || prices.length < 2) return
        // Downsample to ~120 points so the rendered line keeps the
        // same visual density as the Figma chart.
        const N = 120
        const ds =
          prices.length > N
            ? Array.from(
                { length: N },
                (_, i) => prices[Math.round((i * (prices.length - 1)) / (N - 1))],
              )
            : prices
        cache[days] = ds
        if (!cancelled) setLiveSeries(ds)
      } catch {
        // Rate-limited / offline — retry on a short fuse so the chart
        // upgrades from the static fallback once the window passes.
        if (!cancelled) retryId = window.setTimeout(run, 10_000)
      }
    }
    run()
    return () => {
      cancelled = true
      if (retryId != null) window.clearTimeout(retryId)
    }
  }, [visible, timeTab, coinId])
  // Header + balance read from live data when present, per-coin
  // fallback otherwise. USD value = user's holdings × live spot price,
  // so the count-up animates to the real number.
  const quotePrice = liveQuote?.price ?? cfg.fallbackPrice
  const quoteChange = liveQuote?.change24h ?? cfg.fallbackChange
  const quoteUp = quoteChange >= 0
  const quotePriceDisplay =
    '$' +
    quotePrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  const quoteChangeDisplay = Math.abs(quoteChange).toFixed(1) + '%'
  const usdTarget = COIN_HOLDINGS * quotePrice
  const usdDisplay =
    '$' +
    (usdTarget * countProgress).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  const balanceDisplay = (COIN_HOLDINGS * countProgress).toFixed(
    cfg.balanceDecimals,
  )

  // Per-range fallback series — a deterministic, BTC-shaped fluctuation
  // unique to each time tab. Used when live data for a tab hasn't
  // landed (offline / API rate-limited) so EVERY tab still shows — and
  // animates — its own distinct market line, then seamlessly upgrades
  // to real data when it arrives. Each range gets a different trend,
  // volatility, frequency, and seed so the six tabs read as genuinely
  // different windows of the market.
  const fallbackSeries = useMemo(() => {
    // Stablecoin: hug the USD peg on every range. No trend and only
    // sub-percent ripples, so the offline line reads as "pegged to $1"
    // exactly like the real market data would. Longer ranges get a touch
    // more movement, but never enough to look like a trending asset.
    if (cfg.pegUsd != null) {
      const peg = cfg.pegUsd
      const tabCfg = {
        '24H': { n: 96, vol: 0.0025, freq: 6.0, seed: 11 },
        '1W': { n: 84, vol: 0.0035, freq: 7.5, seed: 23 },
        '1M': { n: 90, vol: 0.0045, freq: 5.0, seed: 37 },
        '6M': { n: 96, vol: 0.0055, freq: 4.0, seed: 53 },
        '1Y': { n: 104, vol: 0.0065, freq: 3.0, seed: 71 },
        '2Y': { n: 120, vol: 0.008, freq: 2.2, seed: 97 },
      }[timeTab]
      const out: number[] = []
      let r = tabCfg.seed * 9301
      const rnd = () => {
        r = (r * 9301 + 49297) % 233280
        return r / 233280
      }
      for (let i = 0; i < tabCfg.n; i++) {
        const t = i / (tabCfg.n - 1)
        const wave = Math.sin(t * Math.PI * tabCfg.freq) * peg * tabCfg.vol
        const noise = (rnd() - 0.5) * peg * tabCfg.vol * 0.7
        out.push(peg + wave + noise)
      }
      return out
    }
    const tabCfg = {
      '24H': { n: 96, trend: 0.03, vol: 0.8, freq: 5.0, seed: 11 },
      '1W': { n: 84, trend: 0.07, vol: 1.1, freq: 6.5, seed: 23 },
      '1M': { n: 90, trend: -0.09, vol: 1.4, freq: 4.0, seed: 37 },
      '6M': { n: 96, trend: 0.24, vol: 1.8, freq: 3.0, seed: 53 },
      '1Y': { n: 104, trend: 0.55, vol: 2.2, freq: 2.3, seed: 71 },
      '2Y': { n: 120, trend: 2.1, vol: 3.0, freq: 1.4, seed: 97 },
    }[timeTab]
    const base = cfg.fallbackBase
    const out: number[] = []
    // Tiny LCG so the noise is deterministic per tab (stable across
    // re-renders) yet distinct between ranges.
    let r = tabCfg.seed * 9301
    const rnd = () => {
      r = (r * 9301 + 49297) % 233280
      return r / 233280
    }
    for (let i = 0; i < tabCfg.n; i++) {
      const t = i / (tabCfg.n - 1)
      const trend = base * tabCfg.trend * t
      const wave = Math.sin(t * Math.PI * tabCfg.freq) * base * 0.045 * tabCfg.vol
      const wiggle =
        Math.sin(t * Math.PI * tabCfg.freq * 2.7) * base * 0.018 * tabCfg.vol
      const noise = (rnd() - 0.5) * base * 0.03 * tabCfg.vol
      out.push(base + trend + wave + wiggle + noise)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTab, coinId])
  // The series actually drawn: real data when present, otherwise the
  // per-range fallback so the chart is never empty and every tab
  // animates.
  const chartSeries = liveSeries ?? fallbackSeries
  // Chart path — real or fallback data drawn as a stroked #F7931B line
  // inside the identical 370×160 frame.
  const livePathD = useMemo(() => {
    if (!chartSeries || chartSeries.length < 2) return null
    const W = 370
    const H = 160
    const PAD = 6
    let min = Infinity
    let max = -Infinity
    if (cfg.pegUsd != null) {
      // Pegged stablecoin: anchor the vertical domain symmetrically
      // around the $1 peg (±3%) so the price line stays flat against the
      // dotted baseline (which represents the peg) rather than being
      // auto-scaled to amplify sub-cent moves. If a real depeg pushes
      // data outside the window, widen to fit so it's never clipped.
      const peg = cfg.pegUsd
      const half = peg * 0.03
      min = peg - half
      max = peg + half
      for (const v of chartSeries) {
        if (v < min) min = v
        if (v > max) max = v
      }
    } else {
      for (const v of chartSeries) {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    const range = max - min || 1
    return chartSeries
      .map((v, i) => {
        const x = (i / (chartSeries.length - 1)) * W
        const y = PAD + (1 - (v - min) / range) * (H - PAD * 2)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [chartSeries, cfg.pegUsd])
  // Recent Activity rows (Figma 129:91581 .. 129:91737) — five fixed
  // purchase lots (Figma's USD amounts) at staggered past dates. Each
  // row's date is the lot's REAL calendar date, and its change is the
  // REAL gain/loss of that lot: (live spot − price on the purchase
  // date) / purchase-date price, valued from the raw 1Y series. The
  // Figma change values remain as fallbacks until live data lands.
  // Per-lot fallbacks: BTC-style gains for volatile coins, but near-0%
  // for a pegged stablecoin (a $1 buy is worth ~$1 today). `up` carries
  // the arrow/colour so a stablecoin lot can also read as a hair down.
  const ACTIVITY_LOTS = cfg.pegUsd != null
    ? [
        { usd: 30, daysAgo: 14, fallbackChange: '↑ 0.02%', up: true },
        { usd: 20, daysAgo: 45, fallbackChange: '↓ 0.01%', up: false },
        { usd: 80, daysAgo: 90, fallbackChange: '↑ 0.03%', up: true },
        { usd: 120, daysAgo: 180, fallbackChange: '↓ 0.02%', up: false },
        { usd: 100, daysAgo: 320, fallbackChange: '↑ 0.01%', up: true },
      ]
    : [
        { usd: 30, daysAgo: 14, fallbackChange: '↑ 32.76%', up: true },
        { usd: 20, daysAgo: 45, fallbackChange: '↑ 48.64%', up: true },
        { usd: 80, daysAgo: 90, fallbackChange: '↑ 10.56%', up: true },
        { usd: 120, daysAgo: 180, fallbackChange: '↑ 16.73%', up: true },
        { usd: 100, daysAgo: 320, fallbackChange: '↑ 88.86%', up: true },
      ]
  const ACTIVITY = useMemo(
    () =>
      ACTIVITY_LOTS.map((lot) => {
        const date = new Date(Date.now() - lot.daysAgo * 86_400_000)
        const sub =
          'Bought ' +
          cfg.symbol +
          ' ' +
          date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        const purchasePrice = lookupCoinPriceDaysAgo(coinId, lot.daysAgo)
        if (purchasePrice && liveQuote) {
          const pct =
            ((liveQuote.price - purchasePrice) / purchasePrice) * 100
          return {
            amount: '$' + lot.usd.toFixed(2),
            sub,
            change:
              (pct >= 0 ? '↑ ' : '↓ ') + Math.abs(pct).toFixed(2) + '%',
            up: pct >= 0,
          }
        }
        return {
          amount: '$' + lot.usd.toFixed(2),
          sub,
          change: lot.fallbackChange,
          up: lot.up,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveQuote, yearRawTick, coinId],
  )
  return (
    <>
      {/* Dim backdrop — only for the MODAL (direct) presentation, where
          a darkened wallet recedes behind the rising sheet. Suppressed
          for the PUSH presentation (opened from the Crypto Overview):
          a horizontal push is a peer-level drill-down, so the PDP body
          (z63) simply slides over the overview (z61) at full opacity
          with nothing to dim. Dimming there would read as wrong
          layering — a modal-over-content instead of a clean push. */}
      <div
        className="absolute inset-0 rounded-[48px] pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: visible && !fromOverview ? 1 : 0,
          transition: 'opacity 320ms cubic-bezier(0.22, 0.85, 0.25, 1)',
          zIndex: 62,
        }}
      />
      {/* Sheet body — slides up from the bottom and covers the full
          phone viewport. The parent's iOS status bar lives in a higher
          stacking context outside this sheet, so it stays visible on
          top — giving the iOS-native "sheet slides under the status
          bar" effect without leaving a transparent strip that exposes
          the underlying page. zIndex 63 sits above the Crypto Overview
          sheet (61) so the Bitcoin PDP can layer on top when launched
          from inside the overview. */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[48px]"
        style={{
          background: '#000',
          // Context-dependent entrance (axis chosen by the originating
          // location, via the two-frame `pdpEntered` gate above):
          //   • from the Crypto Overview → horizontal PUSH (slides in
          //     right→left), so the back arrow reads as a "pop" that
          //     reverses the push — a within-section drill-down.
          //   • opened directly from the Accounts card → vertical
          //     MODAL slide-up from the bottom, paired with the X close.
          // While entering, the off-screen frame snaps with transition
          // OFF so the slide only ever travels along the current axis.
          transform: pdpEntered
            ? 'translate(0%, 0%)'
            : fromOverview
            ? 'translate(100%, 0%)'
            : 'translate(0%, 100%)',
          transition:
            visible && !pdpEntered
              ? 'none'
              : 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
          zIndex: 63,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        aria-hidden={!visible}
      >
        {/* Sheet-local L0 glow — re-renders the ambient blue/cyan as
            the back-most layer of this sheet's surface (the
            PhoneShell-level glow lives at z 1 behind the sheet body
            and gets covered when the sheet slides up). The sheet's
            own L0 takes over so the glow stays the consistent base
            layer that all UI floats over with their transparency. */}
        <L0Glow />
        {/* Scrollable container so the page can scroll inside the sheet. */}
        <div className="absolute inset-0 overflow-y-auto no-scrollbar">
          {/* Header — back button on left, centered title. Top 60px of
              the sheet is left as solid black so the parent's status
              bar reads on a clean dark background. */}
          <div
            className="absolute"
            style={{ left: 0, top: 64, width: 402, height: 40 }}
          >
            <p
              className="absolute font-text text-white"
              style={{
                left: 0,
                right: 0,
                top: 8,
                margin: 0,
                fontSize: 12,
                lineHeight: '24px',
                fontWeight: 500,
                textAlign: 'center',
                // Title stays inside the scroll content and recedes
                // naturally; the back button is lifted out below so it
                // pins to the sheet body.
                pointerEvents: 'none',
              }}
            >
              Buy and sell crypto
            </p>
          </div>

          {/* Hero card — Figma 129:88956 → 370 wide, py-16, flex-col
              with gap-24 between the (title + chart + values) group
              and the Sell/Buy buttons. Within the group, gap-12 sits
              between (title + chart) and the values row. */}
          <div
            className="absolute"
            style={{ left: 16, top: 128, width: 370 }}
          >
            <div
              className="relative overflow-hidden flex flex-col"
              style={{
                width: 370,
                background: 'rgba(129,129,129,0.2)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                paddingTop: 16,
                paddingBottom: 16,
                gap: 24,
              }}
            >
              {/* Section 1 — title + chart + values, stacked with
                  gap-12 between (title + chart) and (values). */}
              <div className="flex flex-col" style={{ gap: 12 }}>
                <div className="flex flex-col">
              {/* Title row — badge + name + tag + bell */}
              <div
                className="relative flex items-center justify-between"
                style={{ paddingLeft: 15, paddingRight: 15 }}
              >
                <div className="flex items-center" style={{ gap: 8 }}>
                  {/* Coin badge — the active coin's 40px avatar. */}
                  <cfg.Avatar />
                  <div className="flex flex-col">
                    <p
                      className="font-text text-white"
                      style={{ margin: 0, fontSize: 14, lineHeight: '1.35' }}
                    >
                      {cfg.name}
                    </p>
                    <p
                      className="font-text"
                      style={{ margin: 0, fontSize: 8, lineHeight: 1, color: '#999' }}
                    >
                      {cfg.symbol}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  {/* Change tag — live 24h change + spot price (CoinGecko),
                      falling back to the Figma values. Positive keeps the
                      exact green arrow asset; negative renders a ↓ glyph in
                      the same coral used by the holdings list rows. */}
                  <div
                    className="flex items-center"
                    style={{ gap: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 11, paddingBottom: 11, borderRadius: 100 }}
                  >
                    <div className="flex items-center">
                      {quoteUp ? (
                        <img
                          src="/images/crypto-pdp-arrow-up.svg"
                          alt=""
                          style={{
                            width: 10,
                            height: 10,
                            display: 'block',
                            // flexShrink:0 stops the tight change-tag
                            // flex row from squishing the arrow's width
                            // on load; maxWidth:none defeats Tailwind's
                            // img{max-width:100%} preflight. Both keep
                            // the 10×10 square from distorting.
                            flexShrink: 0,
                            maxWidth: 'none',
                          }}
                        />
                      ) : (
                        <span
                          className="font-text"
                          style={{
                            fontSize: 12,
                            lineHeight: 1,
                            color: '#ef9b9e',
                            marginRight: 1,
                          }}
                        >
                          ↓
                        </span>
                      )}
                      <span
                        className="font-text"
                        style={{
                          fontSize: 14,
                          lineHeight: 1,
                          color: quoteUp ? '#0ac886' : '#ef9b9e',
                          letterSpacing: '-0.14px',
                        }}
                      >
                        {quoteChangeDisplay}
                      </span>
                    </div>
                    <span
                      className="font-text text-white"
                      style={{
                        fontSize: 14,
                        lineHeight: 1,
                        letterSpacing: '-0.14px',
                      }}
                    >
                      {quotePriceDisplay}
                    </span>
                  </div>
                  {/* Notification bell — 32px hit area, 20px glyph.
                      The inner 20×20 box needs flexShrink:0 because
                      the flex parent's 11px padding shrinks the
                      content axis to 10px wide — without it the box
                      collapses from 20→10 and squashes the bell. */}
                  <div
                    className="flex items-center justify-center overflow-hidden"
                    style={{ width: 32, height: 32, padding: 11, borderRadius: 100 }}
                  >
                    <div
                      className="relative overflow-hidden"
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                    >
                      {/* Bell — render at the full 20×20 inner box so
                          the silhouette is crisp at small sizes. The
                          SVG now ships preserveAspectRatio="xMidYMid
                          meet" so its 14.997×16.249 viewBox scales up
                          to fit (≈18.46×20) without distortion, and
                          stays centered inside the 20×20 frame. */}
                      <img
                        src="/images/crypto-pdp-bell.svg"
                        alt=""
                        className="absolute"
                        style={{
                          left: 0,
                          top: 0,
                          width: 20,
                          height: 20,
                          display: 'block',
                          maxWidth: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart container — 320 tall, holds the line chart and the
                  bottom time-range tab strip. */}
              <div className="relative" style={{ width: 370, height: 320 }}>
                {/* Chart graph + baseline, vertically centered. */}
                <div
                  className="absolute"
                  style={{
                    left: 0,
                    top: 'calc(50% - 14px)',
                    transform: 'translateY(-50%)',
                    width: 370,
                    height: 164,
                  }}
                >
                  {/* Graph line — the live line "draws itself" via an
                      SVG stroke-dash sweep that replays whenever the
                      path data changes (open + every time-range tab
                      switch). The fallback static SVG keeps the simpler
                      clip-path wipe since a raster img can't stroke-draw. */}
                  {livePathD ? (
                    /* Live chart — real market data drawn as a stroked
                       path with the Figma asset's exact #F7931B color
                       and weight, same 370×160 frame. pathLength={1}
                       normalizes the line length to one unit so a
                       dasharray/offset of 1 hides it and 0 reveals it,
                       independent of the actual geometry. */
                    <svg
                      width={370}
                      height={160}
                      viewBox="0 0 370 160"
                      fill="none"
                      className="absolute"
                      style={{
                        left: 0,
                        top: 0,
                        display: 'block',
                        overflow: 'visible',
                      }}
                    >
                      {/* Brand gradient stroke (e.g. Solana purple→green),
                          spanning the chart width left→right. Only defined
                          for coins that opt in via cfg.lineGradient. */}
                      {cfg.lineGradient && (
                        <defs>
                          <linearGradient
                            id="cryptoLineGradient"
                            gradientUnits="userSpaceOnUse"
                            x1="0"
                            y1="0"
                            x2="370"
                            y2="0"
                          >
                            {cfg.lineGradient.map((c, i) => (
                              <stop
                                key={c + i}
                                offset={`${
                                  (i / (cfg.lineGradient!.length - 1)) * 100
                                }%`}
                                stopColor={c}
                              />
                            ))}
                          </linearGradient>
                        </defs>
                      )}
                      <path
                        // key = entrance/coin counter + active tab, so the
                        // element remounts (and the draw-on keyframe
                        // replays) on each TAB switch AND every time the
                        // sheet enters or the coin changes (detail-page →
                        // detail-page navigation) — but NOT when that
                        // tab's live data lands. Keying on the path string
                        // instead would remount mid-view when the slow
                        // 6M/1Y fetch resolves, restarting the draw-on and
                        // leaving the line briefly hidden. With this key
                        // the line just updates its `d` in place.
                        key={`${chartAnimKey}-${timeTab}`}
                        d={livePathD}
                        stroke={
                          cfg.lineGradient
                            ? 'url(#cryptoLineGradient)'
                            : cfg.lineColor
                        }
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={1}
                        strokeDasharray={1}
                        style={{
                          // Base state fully drawn (offset 0) so the line
                          // is never stuck hidden if the keyframe can't
                          // run; `forwards` holds the drawn end-state
                          // after the sweep, so a later in-place `d`
                          // update keeps the line visible.
                          strokeDashoffset: 0,
                          animation:
                            'btc-draw-on 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
                          willChange: 'stroke-dashoffset',
                        }}
                      />
                    </svg>
                  ) : (
                    <img
                      src="/images/crypto-pdp-graph.svg"
                      alt=""
                      className="absolute"
                      style={{
                        left: 0,
                        top: 0,
                        width: 370,
                        height: 160,
                        display: 'block',
                      }}
                    />
                  )}
                  {/* Baseline — CSS-rendered dotted line so it can hug
                      the full container width without the SVG's
                      end-of-path bleed creating a gap. Rendered with a
                      tiny radial-gradient dot tiled every 7.1px to
                      match Figma's stroke-dasharray "0.1 7" + 1.5px
                      stroke-width. */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: 0,
                      right: 0,
                      top: 'calc(50% - 0.75px)',
                      height: 1.5,
                      backgroundImage:
                        'radial-gradient(circle, rgba(255,255,255,0.3) 0.75px, transparent 0.85px)',
                      backgroundSize: '7.1px 1.5px',
                      backgroundRepeat: 'repeat-x',
                      backgroundPosition: '0 center',
                    }}
                  />
                </div>
                {/* Time-range tab strip pinned to the bottom of the chart
                    container. */}
                <div
                  className="absolute"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: 8,
                    width: 338,
                    height: 42,
                    background: '#1a1a1a',
                    borderRadius: 500,
                    paddingTop: 4,
                    paddingBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {(['24H', '1W', '1M', '6M', '1Y', '2Y'] as const).map((t) => {
                    const active = timeTab === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTimeTab(t)}
                        className="flex items-center justify-center overflow-hidden"
                        style={{
                          flex: 1,
                          height: 34,
                          paddingLeft: 12,
                          paddingRight: 12,
                          borderRadius: 500,
                          background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                          border: active ? '0.5px solid rgba(204,204,204,0.2)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          className="font-text"
                          style={{
                            fontSize: 12,
                            lineHeight: 1,
                            color: active ? '#fff' : '#808080',
                          }}
                        >
                          {t}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
                </div>{/* end title + chart sub-group */}

              {/* Values row — USD value (holdings × live spot) on the
                  left, coin Balance on the right. Both numerics count up
                  from 0 on sheet open (see countProgress / usdDisplay /
                  balanceDisplay above). */}
              <div
                className="relative flex items-center"
                style={{ paddingLeft: 20, paddingRight: 16, height: 40 }}
              >
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div style={{ width: 120 }}>
                    <p
                      className="font-display text-white"
                      style={{
                        margin: 0,
                        fontSize: 20,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: '-0.4px',
                        // Tabular numerals so the digit columns don't
                        // jitter while the value ticks up.
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {usdDisplay}
                    </p>
                    <p
                      className="font-text"
                      style={{ margin: 0, fontSize: 12, color: '#999' }}
                    >
                      USD
                    </p>
                  </div>
                  <div style={{ width: 162 }}>
                    <p
                      className="font-display text-white"
                      style={{
                        margin: 0,
                        fontSize: 20,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: '-0.4px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {balanceDisplay}
                    </p>
                    <p
                      className="font-text"
                      style={{ margin: 0, fontSize: 12, color: '#999' }}
                    >
                      Balance
                    </p>
                  </div>
                </div>
              </div>
              </div>{/* end section 1 (title + chart + values, gap-12) */}

              {/* Sell + Buy CTA row — sits 24px below the values row
                  via the parent's gap-24 (not marginTop). Both launch the
                  Transfer flow. */}
              <div
                className="relative flex items-center justify-between"
                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 4, paddingBottom: 4, height: 48 }}
              >
                {(['Sell', 'Buy'] as const).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={launchTransfer}
                    aria-label={`${label} ${cfg.symbol}`}
                    className="font-text text-white transition-transform active:scale-[0.97]"
                    style={{
                      width: 163,
                      height: 40,
                      borderRadius: 24,
                      background: 'rgba(204,204,204,0.28)',
                      border: '0.5px solid rgba(129,129,129,0.2)',
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity section — header + list + See-all CTA. */}
          <div
            className="absolute"
            style={{ left: 0, top: 668, width: 402, paddingLeft: 16, paddingRight: 16 }}
          >
            <p
              className="font-text text-white"
              style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500 }}
            >
              Recent Activity
            </p>
            <div className="flex flex-col" style={{ gap: 8, marginTop: 16 }}>
              {ACTIVITY.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center"
                  style={{ gap: 12, paddingTop: 12, paddingBottom: 12 }}
                >
                  {/* 40px coin avatar, matching the holdings rows. */}
                  <cfg.Avatar />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-text text-white"
                      style={{ margin: 0, fontSize: 14, lineHeight: '20px' }}
                    >
                      {cfg.name}
                    </p>
                    <p
                      className="font-text"
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: '20px',
                        color: 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {row.sub}
                    </p>
                  </div>
                  <div
                    className="flex flex-col"
                    style={{ alignItems: 'flex-end', whiteSpace: 'nowrap' }}
                  >
                    <p
                      className="font-text text-white"
                      style={{ margin: 0, fontSize: 14, lineHeight: '20px' }}
                    >
                      {row.amount}
                    </p>
                    <p
                      className="font-text"
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: '20px',
                        // Real gain → green, real loss → coral (same
                        // pair used across the crypto lists).
                        color: row.up ? '#73e6ab' : '#ef9b9e',
                      }}
                    >
                      {row.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="font-text text-white"
              style={{
                width: '100%',
                height: 48,
                borderRadius: 24,
                background: 'rgba(204,204,204,0.28)',
                border: 'none',
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                marginTop: 20,
                cursor: 'pointer',
              }}
            >
              See all
            </button>
          </div>

          {/* About card — coin avatar + per-coin descriptor copy (cfg.about)
              + the shared crypto disclaimer. Avatar + body are coin-driven
              so each detail page reads correctly (e.g. Solana's masked
              gradient mark + SOL description). */}
          <div
            ref={aboutCardRef}
            className="absolute"
            style={{
              left: 16,
              top: ABOUT_CARD_TOP,
              width: 370,
              background: 'rgba(129,129,129,0.2)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              paddingTop: 16,
              paddingBottom: 16,
            }}
          >
            <div style={{ paddingLeft: 16, paddingRight: 16, marginBottom: 16 }}>
              <cfg.Avatar />
            </div>
            <div style={{ paddingLeft: 16, paddingRight: 16 }}>
              {cfg.about.map((para, i) => (
                <p
                  key={i}
                  className="font-text text-white"
                  style={{
                    margin: i === 0 ? 0 : '16px 0 0',
                    fontSize: 14,
                    lineHeight: '20px',
                  }}
                >
                  {para}
                </p>
              ))}
              <p
                className="font-text"
                style={{
                  margin: '24px 0 0',
                  fontSize: 12,
                  lineHeight: '18px',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                Values shown are based on current exchange rates. Prices will differ when you buy or sell due to market changes and our fees.
              </p>
              <p
                className="font-text"
                style={{
                  margin: '16px 0 0',
                  fontSize: 12,
                  lineHeight: '18px',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                Buying, selling, and holding cryptocurrencies is not regulated in many US states and territories.
              </p>
            </div>
          </div>
          {/* Bottom spacer so the last card has breathing room above the bezel. */}
          <div
            style={{
              position: 'absolute',
              // Sits just below the (measured) About card so the scroll
              // content ends with a tight 24px bottom margin on every
              // coin — no global nav here, so no extra reserved space.
              top: ABOUT_CARD_TOP + aboutCardH,
              left: 0,
              width: 1,
              height: 24,
            }}
          />
        </div>
        {/* Dismiss control — lifted OUT of the scroll container so it
            pins to the sheet body. Context-dependent per entry point:
              • from Crypto Overview → back arrow, anchored LEFT, returns
                to the overview list still open beneath
              • opened directly from the Accounts Crypto card → X close,
                anchored RIGHT, fully dismisses the sheet
            The title "Buy and sell crypto" stays in the scroll content
            and recedes naturally; this control stays put. */}
        <button
          type="button"
          onClick={closeBitcoinPdp}
          aria-label={fromOverview ? 'Back' : 'Close'}
          className="absolute flex items-center justify-center"
          style={{
            // Back arrow sits on the left (step back); X sits on the
            // right (modal-style dismiss) — matching platform
            // conventions for each affordance.
            left: fromOverview ? 16 : undefined,
            right: fromOverview ? undefined : 16,
            top: 64,
            width: 40,
            height: 40,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: 'none',
            padding: 8,
            cursor: 'pointer',
            zIndex: 5,
          }}
        >
          <img
            src={
              fromOverview
                ? '/images/crypto-pdp-arrow-left.svg'
                : '/images/crypto-pdp-x-mark.svg'
            }
            alt=""
            style={{
              // Both glyphs ship preserveAspectRatio="none", so a square
              // box stretches them. Render each at its true viewBox
              // aspect, centered inside Figma's 20×20 icon container:
              //   • arrow-left → 16.666×10.001 (Figma 129:91835)
              //   • x-mark     → 16.591×16.279 (Figma 129:92045)
              // maxWidth:none defeats Tailwind's img{max-width:100%}.
              width: fromOverview ? 16.666 : 16.591,
              height: fromOverview ? 10.001 : 16.279,
              display: 'block',
              maxWidth: 'none',
              flexShrink: 0,
            }}
          />
        </button>
      </div>
    </>
  )
}

// Crypto Overview sheet — Figma 129:91847. Slides up over the active
// view when the Crypto card's header is tapped. Mirrors the iOS modal
// pattern: top header with title + X close, a compact Bitcoin hero
// (no chart, just price + holdings + Sell/Buy), a "Your crypto" list
// of holdings, and an "Explore crypto" list of available coins.
type CryptoRowDef = {
  name: string
  symbol: string
  price: string
  change: string
  changeColor: '#73e6ab' | '#ef9b9e'
  avatar: React.ReactNode
}
const CryptoOverviewSheet = () => {
  const {
    cryptoOverviewOpen,
    closeCryptoOverview,
    openBitcoinPdp,
    openCryptoPdp,
  } = useNav()
  const visible = cryptoOverviewOpen
  // Sell/Buy previously launched the Transfer flow — Transfer has been
  // removed from the build, so the buttons render but no longer do anything.
  const launchTransfer = () => {}
  // The "Explore crypto" section is the last content; its height varies
  // with the row count + disclaimer. Measure it so the scroll content
  // ends with the same tight 24px bottom margin used on the detail pages
  // (no global nav here, so no extra reserved space).
  const EXPLORE_SECTION_TOP = 560
  const exploreRef = useRef<HTMLDivElement>(null)
  const [exploreH, setExploreH] = useState(0)
  useLayoutEffect(() => {
    const el = exploreRef.current
    if (!el) return
    const measure = () => setExploreH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible])
  // Live BTC quote from the shared module store (same 60s poll the
  // Bitcoin PDP uses). Everything BTC-denominated on this sheet reads
  // from it; the Figma values stay as offline fallbacks.
  const liveQuote = useBtcQuote(visible)
  const OV_BTC_HOLDINGS = 0.01936605
  // Offline fallbacks track the live BTC market level (~$64k) so the
  // hero spot, 24h change, and holdings value stay accurate when
  // CoinGecko is rate-limited — matching CRYPTO_PDP_CONFIG.bitcoin.
  const ovUp = (liveQuote?.change24h ?? -0.4) >= 0
  const ovSpotDisplay = liveQuote
    ? '$' +
      liveQuote.price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '$64,000.00'
  const ovChangeDisplay = liveQuote
    ? Math.abs(liveQuote.change24h).toFixed(1) + '%'
    : '0.4%'
  // List-row form of the 24h change ("↑ 0.12%") + matching color.
  const ovRowChange = liveQuote
    ? (ovUp ? '↑ ' : '↓ ') + Math.abs(liveQuote.change24h).toFixed(2) + '%'
    : null
  const ovRowChangeColor = ovUp ? '#73e6ab' : '#ef9b9e'
  // The user's position value — holdings × live spot.
  const ovHoldingsDisplay = liveQuote
    ? '$' +
      (OV_BTC_HOLDINGS * liveQuote.price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '$1,239.43'

  // Avatar factories — each renders a 48px circle with the brand
  // background + an SVG glyph positioned per Figma's inset values.
  const BitcoinAvatarBig = (
    <div
      className="relative overflow-hidden"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: '#ff8d00',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', inset: 'calc(12.5% - 0.75px)' }}>
        <img
          src="/images/ppp-bitcoin.svg"
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
  const SolanaAvatarBig = (
    <div
      className="relative overflow-hidden"
      style={{
        width: 40,
        height: 40,
        borderRadius: 32,
        background: '#000',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '27.57%',
          left: '24.97%',
          right: '24.97%',
          bottom: '27.57%',
          WebkitMaskImage: 'url(/images/ppp-sol-mask.svg)',
          maskImage: 'url(/images/ppp-sol-mask.svg)',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          backgroundImage: 'url(/images/ppp-sol-fill.svg)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  )
  const EthAvatarBig = (
    <div
      className="relative overflow-hidden"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: '#151c2f',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(12.5% - 0.75px)',
          right: 'calc(10.8% - 0.78px)',
          bottom: 'calc(12.5% - 0.75px)',
          left: 'calc(14.2% - 0.72px)',
        }}
      >
        <img
          src="/images/ppp-eth.svg"
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
  const PyusdAvatar = (
    <div
      className="relative overflow-hidden"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: '#000',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(19.61% - 0.61px)',
          right: 'calc(19.81% - 0.6px)',
          bottom: 'calc(18.87% - 0.62px)',
          left: 'calc(21.65% - 0.57px)',
        }}
      >
        <img
          src="/images/crypto-pdp-pyusd.svg"
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
  const ChainlinkAvatar = (
    <div
      className="relative"
      style={{
        width: 40,
        height: 40,
        borderRadius: 50,
        background: '#0847f7',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(16.04% - 0.68px)',
          right: 'calc(20.46% - 0.59px)',
          bottom: 'calc(16.04% - 0.68px)',
          left: 'calc(20.46% - 0.59px)',
        }}
      >
        <img
          src="/images/crypto-pdp-chainlink.svg"
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
  const LitecoinAvatar = (
    <div
      className="relative overflow-hidden"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: '#587be1',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', inset: 'calc(12.5% - 0.75px)' }}>
        <img
          src="/images/crypto-pdp-litecoin.svg"
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
  const BitcoinCashAvatar = (
    <div
      className="relative overflow-hidden"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: '#4bcf51',
        border: '1px solid rgba(204,204,204,0.28)',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', inset: 'calc(12.5% - 0.75px)' }}>
        <img
          src="/images/crypto-pdp-bitcoin-cash.svg"
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )

  const YOUR_CRYPTO: CryptoRowDef[] = [
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      // Your position's live value (holdings × spot) + live 24h move.
      price: ovHoldingsDisplay,
      change: ovRowChange ?? '↓ 0.40%',
      changeColor: ovRowChange ? ovRowChangeColor : '#ef9b9e',
      avatar: BitcoinAvatarBig,
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      // Position value = 8.42 SOL × ~$67.82 spot; 24h move matches SOL.
      price: '$571.05',
      change: '↓ 0.67%',
      changeColor: '#ef9b9e',
      avatar: SolanaAvatarBig,
    },
  ]
  const EXPLORE_CRYPTO: CryptoRowDef[] = [
    {
      name: 'PYUSD',
      symbol: 'PYUSD',
      // $1-pegged stablecoin — spot stays at the peg with a flat move.
      price: '$1.00',
      change: '↑ 0.01%',
      changeColor: '#73e6ab',
      avatar: PyusdAvatar,
    },
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      // Live spot price + 24h move for the explore listing.
      price: ovSpotDisplay,
      change: ovRowChange ?? '↓ 0.40%',
      changeColor: ovRowChange ? ovRowChangeColor : '#ef9b9e',
      avatar: BitcoinAvatarBig,
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      price: '$67.82',
      change: '↓ 0.67%',
      changeColor: '#ef9b9e',
      avatar: SolanaAvatarBig,
    },
    {
      name: 'Ethereum',
      symbol: 'ETH',
      price: '$1,669.51',
      change: '↓ 0.37%',
      changeColor: '#ef9b9e',
      avatar: EthAvatarBig,
    },
    {
      name: 'Chainlink',
      symbol: 'LINK',
      price: '$7.85',
      change: '↓ 1.61%',
      changeColor: '#ef9b9e',
      avatar: ChainlinkAvatar,
    },
    {
      name: 'Litecoin',
      symbol: 'LTC',
      price: '$44.38',
      change: '↑ 1.06%',
      changeColor: '#73e6ab',
      avatar: LitecoinAvatar,
    },
    {
      name: 'Bitcoin Cash',
      symbol: 'BCH',
      price: '$200.62',
      change: '↓ 3.44%',
      changeColor: '#ef9b9e',
      avatar: BitcoinCashAvatar,
    },
  ]

  const renderRow = (row: CryptoRowDef, i: number) => {
    // Every coin row with its own Product Detail Page launches it.
    const NAME_TO_COIN: Record<string, CoinId> = {
      Bitcoin: 'bitcoin',
      Ethereum: 'ethereum',
      Etherium: 'ethereum', // legacy misspelling, kept defensively
      Solana: 'solana',
      Chainlink: 'chainlink',
      Litecoin: 'litecoin',
      'Bitcoin Cash': 'bitcoin-cash',
      PYUSD: 'paypal-usd',
    }
    const pdpCoin: CoinId | null = NAME_TO_COIN[row.name] ?? null
    const interactive = pdpCoin != null
    const open = () => pdpCoin && openCryptoPdp(pdpCoin, 'overview')
    return (
    <div
      key={`${row.name}-${row.symbol}-${i}`}
      className={
        interactive
          ? 'flex items-center cursor-pointer transition-transform active:scale-[0.985]'
          : 'flex items-center'
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Open ${row.name} details` : undefined}
      onClick={interactive ? open : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                open()
              }
            }
          : undefined
      }
      style={{ gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}
    >
      {row.avatar}
      <div className="flex-1 min-w-0">
        <p
          className="font-text text-white"
          style={{ margin: 0, fontSize: 14, lineHeight: '20px' }}
        >
          {row.name}
        </p>
        <p
          className="font-text"
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: '20px',
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          {row.symbol}
        </p>
      </div>
      <div
        className="flex flex-col"
        style={{ alignItems: 'flex-end', whiteSpace: 'nowrap' }}
      >
        <p
          className="font-text text-white"
          style={{ margin: 0, fontSize: 14, lineHeight: '20px' }}
        >
          {row.price}
        </p>
        <p
          className="font-text"
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: '20px',
            color: row.changeColor,
          }}
        >
          {row.change}
        </p>
      </div>
    </div>
    )
  }

  return (
    <>
      <div
        className="absolute inset-0 rounded-[48px] pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 320ms cubic-bezier(0.22, 0.85, 0.25, 1)',
          zIndex: 60,
        }}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-[48px]"
        style={{
          background: '#000',
          transform: visible ? 'translateY(0%)' : 'translateY(100%)',
          transition: 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
          zIndex: 61,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        aria-hidden={!visible}
      >
        {/* Sheet-local L0 glow — the PhoneShell glow at z 1 gets
            covered when this sheet slides up, so the sheet renders
            its own glow as the back-most layer so the ambient base
            stays consistent. */}
        <L0Glow />
        <div className="absolute inset-0 overflow-y-auto no-scrollbar">
          {/* Header — centered title + close button (40px hit area on
              the right). The top 60px of the sheet is left as solid
              black so the parent's iOS status bar reads on a clean
              dark background (its higher stacking context keeps it
              visible above the sheet). */}
          <div
            className="absolute"
            style={{ left: 0, top: 64, width: 402, height: 40 }}
          >
            <p
              className="absolute font-text text-white"
              style={{
                left: 0,
                right: 0,
                top: 8,
                margin: 0,
                fontSize: 12,
                lineHeight: '24px',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              Buy and sell crypto
            </p>
          </div>

          {/* Hero card — Bitcoin price + holdings + Sell/Buy. */}
          <div className="absolute" style={{ left: 16, top: 128, width: 370 }}>
            <div
              className="relative overflow-hidden"
              style={{
                width: 370,
                background: 'rgba(129,129,129,0.2)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                paddingTop: 16,
                paddingBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Title row — badge + Bitcoin/BTC + 3.5% / price + bell.
                  The badge+label group on the left is tappable and
                  opens the Bitcoin PDP; the bell / tag area stays
                  passive so only the asset identity is the launch
                  target. */}
              <div
                className="relative flex items-center justify-between"
                style={{ paddingLeft: 15, paddingRight: 15 }}
              >
                <div
                  className="flex items-center cursor-pointer transition-transform active:scale-[0.985]"
                  role="button"
                  tabIndex={0}
                  aria-label="Open Bitcoin details"
                  onClick={() => openBitcoinPdp('overview')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openBitcoinPdp('overview')
                    }
                  }}
                  style={{ gap: 8 }}
                >
                  {/* Hero Bitcoin avatar — reuses the same 40×40 factory as
                      the holdings rows + the PDP header so every Bitcoin
                      mark on the sheet is pixel-identical (40px circle,
                      hairline border, ppp-bitcoin glyph). */}
                  {BitcoinAvatarBig}
                  <div className="flex flex-col">
                    <p
                      className="font-text text-white"
                      style={{ margin: 0, fontSize: 14, lineHeight: '1.35' }}
                    >
                      Bitcoin
                    </p>
                    <p
                      className="font-text"
                      style={{ margin: 0, fontSize: 8, lineHeight: 1, color: '#999' }}
                    >
                      BTC
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div
                    className="flex items-center"
                    style={{ gap: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 11, paddingBottom: 11, borderRadius: 100 }}
                  >
                    <div className="flex items-center">
                      {ovUp ? (
                        <img
                          src="/images/crypto-pdp-arrow-up.svg"
                          alt=""
                          style={{
                            width: 10,
                            height: 10,
                            display: 'block',
                            // flexShrink:0 stops the tight change-tag
                            // flex row from squishing the arrow's width
                            // on load; maxWidth:none defeats Tailwind's
                            // img{max-width:100%} preflight. Both keep
                            // the 10×10 square from distorting.
                            flexShrink: 0,
                            maxWidth: 'none',
                          }}
                        />
                      ) : (
                        <span
                          className="font-text"
                          style={{
                            fontSize: 12,
                            lineHeight: 1,
                            color: '#ef9b9e',
                            marginRight: 1,
                          }}
                        >
                          ↓
                        </span>
                      )}
                      <span
                        className="font-text"
                        style={{
                          fontSize: 14,
                          lineHeight: 1,
                          color: ovUp ? '#0ac886' : '#ef9b9e',
                          letterSpacing: '-0.14px',
                        }}
                      >
                        {ovChangeDisplay}
                      </span>
                    </div>
                    <span
                      className="font-text text-white"
                      style={{
                        fontSize: 14,
                        lineHeight: 1,
                        letterSpacing: '-0.14px',
                      }}
                    >
                      {ovSpotDisplay}
                    </span>
                  </div>
                  {/* Notification bell — same fix as the Bitcoin PDP
                      copy: the flex parent's 11px padding shrinks the
                      content axis to 10px, so the inner 20×20 box
                      needs flexShrink:0 to hold its width. */}
                  <div
                    className="flex items-center justify-center overflow-hidden"
                    style={{ width: 32, height: 32, padding: 11, borderRadius: 100 }}
                  >
                    <div
                      className="relative overflow-hidden"
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                    >
                      <img
                        src="/images/crypto-pdp-bell.svg"
                        alt=""
                        className="absolute"
                        style={{
                          left: 0,
                          top: 0,
                          width: 20,
                          height: 20,
                          display: 'block',
                          maxWidth: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Values row */}
              <div
                className="relative flex items-center"
                style={{ paddingLeft: 20, paddingRight: 16, height: 40 }}
              >
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div style={{ width: 120 }}>
                    <p
                      className="font-display text-white"
                      style={{
                        margin: 0,
                        fontSize: 20,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: '-0.4px',
                      }}
                    >
                      {ovHoldingsDisplay}
                    </p>
                    <p
                      className="font-text"
                      style={{ margin: 0, fontSize: 12, color: '#999' }}
                    >
                      USD
                    </p>
                  </div>
                  <div style={{ width: 162 }}>
                    <p
                      className="font-display text-white"
                      style={{
                        margin: 0,
                        fontSize: 20,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: '-0.4px',
                      }}
                    >
                      0.01936605
                    </p>
                    <p
                      className="font-text"
                      style={{ margin: 0, fontSize: 12, color: '#999' }}
                    >
                      Balance
                    </p>
                  </div>
                </div>
              </div>

              {/* Sell + Buy CTA row — both launch the Transfer flow. */}
              <div
                className="relative flex items-center justify-between"
                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 4, paddingBottom: 4, height: 48 }}
              >
                {(['Sell', 'Buy'] as const).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={launchTransfer}
                    aria-label={`${label} crypto`}
                    className="font-text text-white transition-transform active:scale-[0.97]"
                    style={{
                      width: 163,
                      height: 40,
                      borderRadius: 24,
                      background: 'rgba(204,204,204,0.28)',
                      border: '0.5px solid rgba(129,129,129,0.2)',
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Your crypto section */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: 0, top: 360, width: 402, gap: 16 }}
          >
            <div
              className="flex items-center"
              style={{ paddingLeft: 16, paddingRight: 16, width: '100%', height: 24 }}
            >
              <p
                className="font-text text-white"
                style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500 }}
              >
                Your crypto
              </p>
            </div>
            <div
              className="overflow-hidden"
              style={{
                width: 370,
                background: 'rgba(129,129,129,0.2)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                paddingTop: 4,
                paddingBottom: 4,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {YOUR_CRYPTO.map((row, i) => renderRow(row, i))}
            </div>
          </div>

          {/* Explore crypto section — top derived from the section rhythm:
              "Your crypto" card bottom (360 + 24 header + 16 gap + 136 card
              = 536) plus the 24px inter-section gap used above "Your crypto"
              (hero card bottom 336 → "Your crypto" top 360). */}
          <div
            ref={exploreRef}
            className="absolute flex flex-col items-center"
            style={{ left: 0, top: EXPLORE_SECTION_TOP, width: 402, gap: 16 }}
          >
            <div
              className="flex items-center"
              style={{ paddingLeft: 16, paddingRight: 16, width: '100%', height: 24 }}
            >
              <p
                className="font-text text-white"
                style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500 }}
              >
                Explore crypto
              </p>
            </div>
            <div
              className="overflow-hidden"
              style={{
                width: 370,
                background: 'rgba(129,129,129,0.2)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                paddingTop: 4,
                paddingBottom: 4,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {EXPLORE_CRYPTO.map((row, i) => renderRow(row, i))}
            </div>
            {/* Disclaimer copy */}
            <div style={{ width: 370, paddingLeft: 8, paddingRight: 8 }}>
              <p
                className="font-text"
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: '20px',
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                Values show are based on current exchange rates. Prices will differ when you buy or sell due to market changes and fees.
              </p>
            </div>
          </div>
          {/* Bottom spacer — sits just below the (measured) Explore
              section so the scroll content ends with a tight 24px bottom
              margin, matching the detail pages. */}
          <div
            style={{
              position: 'absolute',
              top: EXPLORE_SECTION_TOP + exploreH,
              left: 0,
              width: 1,
              height: 24,
            }}
          />
        </div>
        {/* Close button — lifted OUT of the scroll container so it
            pins to the sheet body. The title "Buy and sell crypto"
            still lives inside the scroll content and recedes
            naturally, but the X stays anchored at top:64 right:16
            for the entire sheet's lifetime — easier reach for the
            user when navigating between page levels. */}
        <button
          type="button"
          onClick={closeCryptoOverview}
          aria-label="Close"
          className="absolute flex items-center justify-center"
          style={{
            right: 16,
            top: 64,
            width: 40,
            height: 40,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: 'none',
            padding: 8,
            cursor: 'pointer',
            zIndex: 5,
          }}
        >
          <img
            src="/images/crypto-pdp-x-mark.svg"
            alt=""
            style={{
              // x-mark SVG is 16.591×16.279 with preserveAspectRatio
              // "none" — a 20×20 square stretches it. Per Figma 129:92010
              // the glyph sits in a 20×20 container at its natural aspect;
              // render those true dimensions, centered by the flex button.
              // maxWidth:none defeats Tailwind's img{max-width:100%}.
              width: 16.591,
              height: 16.279,
              display: 'block',
              maxWidth: 'none',
              flexShrink: 0,
            }}
          />
        </button>
      </div>
    </>
  )
}

const BrowserSheet = () => {
  const { browserBrand, closeBrowser } = useNav()
  const [step, setStep] = useState<BrowserStep>('splash')
  // Pay Later expanded sheet (IAB 3) — overlays the site page (IAB 2).
  const [payLaterOpen, setPayLaterOpen] = useState(false)
  // Reset to splash whenever the browser opens with a new brand.
  useEffect(() => {
    if (browserBrand) {
      setStep('splash')
      setPayLaterOpen(false)
    }
  }, [browserBrand])

  const visible = browserBrand != null
  const spec = browserBrand ? BROWSER_BRANDS[browserBrand] : null

  return (
    <>
      {/* Dim backdrop — fades in/out */}
      <div
        className="absolute inset-0 rounded-[48px] pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 320ms cubic-bezier(0.22, 0.85, 0.25, 1)',
          zIndex: 60,
        }}
      />
      {/* The sheet itself — slides up from the bottom of the phone
          viewport. When closed, it sits one full viewport below. */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[48px]"
        style={{
          background: '#fff',
          transform: visible ? 'translateY(0%)' : 'translateY(100%)',
          transition: 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
          zIndex: 61,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        aria-hidden={!visible}
      >
        {spec && (
          <>
            {/* Splash layer — visible when step='splash'. Fades and
                scales down slightly as the site rises into view. */}
            <div
              className="absolute inset-0"
              style={{
                opacity: step === 'splash' ? 1 : 0,
                transform:
                  step === 'splash'
                    ? 'translateY(0) scale(1)'
                    : 'translateY(-12px) scale(0.97)',
                transition:
                  'opacity 380ms cubic-bezier(0.32, 0.72, 0, 1), transform 420ms cubic-bezier(0.32, 0.72, 0, 1)',
                pointerEvents: step === 'splash' ? 'auto' : 'none',
                willChange: 'opacity, transform',
                zIndex: step === 'splash' ? 2 : 1,
              }}
            >
              <BrowserSplash
                spec={spec}
                onClose={closeBrowser}
                onContinue={() => setStep('site')}
              />
            </div>
            {/* Site layer + Pay Later morph — visible when step='site'.
                Rises in from 16px below as the splash fades away,
                creating a "page loading into place" feel. The Pay
                Later morph sits in the same layer so its absolute
                positioning resolves against the same containing
                block as the site. */}
            <div
              className="absolute inset-0"
              style={{
                opacity: step === 'site' ? 1 : 0,
                transform:
                  step === 'site' ? 'translateY(0)' : 'translateY(16px)',
                transition:
                  'opacity 420ms cubic-bezier(0.32, 0.72, 0, 1) 60ms, transform 460ms cubic-bezier(0.32, 0.72, 0, 1) 60ms',
                pointerEvents: step === 'site' ? 'auto' : 'none',
                willChange: 'opacity, transform',
                zIndex: step === 'site' ? 2 : 1,
              }}
            >
              <BrowserSite
                brand={browserBrand!}
                spec={spec}
                onClose={closeBrowser}
              />
              {/* IAB 3 Pay Later morph — pill ↔ sheet morph lives
                  here. It renders the pill at the toolbar position
                  when closed; when opened it expands into a half-sheet
                  over the Nike page. */}
              <BrowserPayLater
                open={payLaterOpen}
                onOpen={() => setPayLaterOpen(true)}
                onClose={() => setPayLaterOpen(false)}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ---------- Component catalog (docs mode) ----------
// A second top-level mode for browsing cataloged components in isolation,
// each with a short description, a note on how it's used in the live
// prototype, and a standalone code snippet a developer can copy into
// their own front end. Distinct from the phone-feed Prototype mode —
// toggled from the sidebar (see catalogMode in App()).

// Full NavApi shape with every handler a no-op and every field at a
// neutral default — mirrors useNav()'s own no-provider fallback above.
// `overrides` lets a catalog entry force a sheet open (e.g.
// cryptoOverviewOpen: true) without touching the live prototype's nav
// state, and without its own close button being able to make it
// disappear (the close handler stays a no-op unless overridden).
const buildCatalogNavApi = (overrides?: Partial<NavApi>): NavApi => ({
  view: 'feed',
  openFeed: () => {},
  browserBrand: null,
  openBrowser: () => {},
  closeBrowser: () => {},
  cryptoPdpCoin: null,
  cryptoPdpSource: 'direct',
  openCryptoPdp: () => {},
  closeCryptoPdp: () => {},
  openBitcoinPdp: () => {},
  cryptoOverviewOpen: false,
  openCryptoOverview: () => {},
  closeCryptoOverview: () => {},
  ...overrides,
})

type CatalogEntry = {
  id: string
  name: string
  group: string
  description: string
  usage: string
  code: string
  // Sourced from PRD-Home.pdf (Feed/NBA/Ads PRD). contentType/uiPattern/
  // purpose are the PRD's own taxonomy; personalization/rankingObjective
  // are illustrative applications of the Curator Model and Uber Ranker
  // sections to this specific card — this prototype has no live ranking
  // engine, so those two fields are representative, not computed.
  whySeeing: {
    contentType: string
    uiPattern: string
    purpose: string
    personalization: string
    rankingObjective: string
    // Sourced from componentlogicsheets.pdf (per-UI-pattern technical/logic
    // specs) — slotBehavior/interaction are given for every pattern; fallback
    // is only documented for Collection patterns (Hero/Deck/Square/Splash/
    // Fanned); contentGuidelines (character counts + legal text + content
    // style) is only documented for the three NBA patterns (Spotlight/List/
    // Carousel).
    slotBehavior: string
    interaction: string
    fallback?: string
    contentGuidelines?: string
    phase: 'P0' | 'P1' | 'P2'
  }
  navOverrides?: Partial<NavApi>
  render: () => React.ReactNode
}

// Team modal — Figma: "Product + Design Team" (node 4245:22560). Headshots
// live in public/images/team (provided by the user), sized to match the
// Figma circular avatar treatment.
type TeamMember = {
  name: string
  role: string
  photo: string
  slackUrl?: string
}
const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Yashika Shah', role: 'Director, PM', photo: '/images/team/yashika-shah.png', slackUrl: 'https://paypal.enterprise.slack.com/team/U09BYRSEWQ4' },
  { name: 'Chaz Rini', role: 'Principal Designer', photo: '/images/team/chaz-rini.png', slackUrl: 'https://paypal.enterprise.slack.com/team/U08S19VEF1T' },
  { name: 'Ryllis Lyle', role: 'Sr Content Designer', photo: '/images/team/ryllis-lyle.png', slackUrl: 'https://paypal.enterprise.slack.com/team/W017B53DP4M' },
  { name: 'Jamison Vrabel', role: 'Director Program Management', photo: '/images/team/jamison-vrabel.png' },
  { name: 'Ben Downard', role: 'Designer', photo: '/images/team/ben-downard.png' },
  { name: 'Angie Yuanmalai', role: 'Designer', photo: '/images/team/angie-yuanmalai.png' },
]

const CATALOG_ENTRIES: CatalogEntry[] = [
  {
    id: 'account-snapshot',
    name: 'Account Snapshot',
    group: 'Feed sections',
    description:
      'The top-of-feed balance card: PayPal balance, Pay Later, PayPal+ and Crypto account tiles.',
    usage:
      "The first section of the Home feed (frame 1, \"Account Snapshot\"). The Crypto tile's onClick opens the Crypto Overview sheet via openCryptoOverview() from NavContext.",
    code: `// Container: horizontal scroll, 16px side padding, tiles are 225×127
// with a 12px gap (HScroll's default "gap-3"). Every tile shell below
// is a design-system <Card> instance — see the note at the bottom.
<div id="account" className="px-4 mt-4">
  <HScroll className="-mx-4 px-4 pb-1">
    {/* Card: 225×127, 12px radius, translucent grey fill.
        AcctHeader sits at inset 12/12, AcctFooter at inset 12/67. */}
    <AcctTile>
      {/* label: 12px/16px, weight 500, white, at 0,8 inside the header */}
      <AcctHeader
        label="PayPal balance"
        trailing={
          // 48×32, 4px radius, 0.5px border rgba(204,204,204,0.28)
          <div style={{ width: 48, height: 32, borderRadius: 4,
            border: '0.5px solid rgba(204,204,204,0.28)',
            background: 'rgba(129,129,129,0.2)' }}>
            <img src="/images/card-debit.png" className="w-full h-full object-cover" />
          </div>
        }
      />
      {/* amount: 20px/32px, weight 900, letterSpacing -1px, white
          sub: 12px/16px, rgba(255,255,255,0.72) (or subColor override) */}
      <AcctFooter amount="$125.56" sub="Available balance" />
    </AcctTile>

    <AcctTile>
      <AcctHeader
        label="Pay Later"
        trailing={
          // 33×33, 8px radius icon chip
          <div style={{ width: 33, height: 33, borderRadius: 8,
            background: 'rgba(129,129,129,0.2)' }}>
            <img src="/images/icon-calendar.svg" style={{ width: 16, height: 16 }} />
          </div>
        }
      />
      <AcctFooter amount="$1,500.00" sub="Spending Power" subColor="#73e6ab" />
    </AcctTile>

    <AcctTile>
      <AcctHeader
        label="PayPal+"
        trailing={
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff' }}>
            <img src="/images/paypal-monogram.svg" style={{ width: 22, height: 22 }} />
          </div>
        }
      />
      <AcctFooter amount="10,380 points" sub="Available to use" />
    </AcctTile>

    <AcctTile>
      <AcctHeader
        label="PayPal credit card"
        trailing={
          <div style={{ width: 48, height: 32, borderRadius: 4,
            border: '0.4px solid rgba(204,204,204,0.28)' }}>
            <img src="/images/card-credit.png" className="w-full h-full object-cover" />
          </div>
        }
      />
      <AcctFooter amount="$245.72" sub="Payment due Mar, 30" />
    </AcctTile>

    {/* Opens the Crypto Overview sheet on click (openCryptoOverview() from
        NavContext). Footer is custom — same 12px insets as AcctFooter, plus
        a ↑3.56% pill (24px height, pill radius, translucent green fill). */}
    <AcctTile onClick={() => openCryptoOverview()}>
      <AcctHeader
        label="Crypto"
        trailing={
          <div style={{ width: 33, height: 33, borderRadius: 8,
            background: 'rgba(129,129,129,0.2)' }}>
            <img src="/images/icon-crypto-snap.svg" style={{ width: 16, height: 16 }} />
          </div>
        }
      />
      <div className="absolute" style={{ left: 12, top: 67, right: 12, height: 48 }}>
        <p style={{ fontSize: 20, lineHeight: '32px', letterSpacing: '-1px', fontWeight: 900 }}>
          $388.32
        </p>
        <p style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)' }}>
          Available balance
        </p>
        <div style={{ position: 'absolute', right: 0, top: 24, width: 63, height: 24,
          borderRadius: 999, background: 'rgba(0,82,67,0.25)' }}>
          <span style={{ fontSize: 12, color: '#73e6ab', fontWeight: 500, lineHeight: '16px' }}>
            ↑ 3.56%
          </span>
        </div>
      </div>
    </AcctTile>

    // "Banks and cards" — same 225×127 Card footprint but a dashed
    // border instead of a solid fill, since it's an empty-state CTA.
    <Card width={225} height={127} radius={12} fill="rgba(129,129,129,0.2)"
      border="1px dashed rgba(204,204,204,0.28)">
      {/* ...two 32px icon chips + a 33px circular "+" Add button, see
          App.tsx for exact positions */}
    </Card>
  </HScroll>
</div>

// AcctTile is a thin wrapper around the shared design-system <Card>
// primitive — every tile above is really:
//   <Card width={225} height={127} radius={12} fill="rgba(129,129,129,0.2)">
// AcctHeader (inset 12/12) and AcctFooter (inset 12/67) are the only
// bits that differ tile-to-tile; the Card shell stays pixel-identical.`,
    whySeeing: {
      contentType: 'Account Snapshot (fka Wallet Snapshot)',
      uiPattern: 'n/a — fixed chip row, always above slot 1',
      purpose:
        'Exists solely for at-a-glance balance visibility, not financial management (that\'s "ME"). PRD describes it as "the shadow of Accounts in ME" — chip set, order, and critical-alert logic all mirror ME.',
      personalization:
        'Not personalized — identical chip set and order for every customer (PayPal balance first, Spending Power/Pay Later second). Only the balance values differ per account.',
      rankingObjective: 'N/A — renders before the ranked feed begins; not part of the 75/15/10 Collections/NBA/Ads mix.',
      slotBehavior: 'N/A — fixed chip row, always above slot 1; not part of the ranked/slotted feed.',
      interaction: 'Tap a chip to open its detail sheet (balance, Pay Later, etc.).',
      phase: 'P0',
    },
    render: () => <AccountSnapshot />,
  },
  {
    id: 'top-stores-row',
    name: 'Hero Collection',
    group: 'Feed sections',
    description:
      'The "Card.Collection.Hero" pattern: a horizontally-scrollable row of circular brand chips, each with a logo, name and cashback rate.',
    usage: 'Sits at the very top of the Home feed, just below Account Snapshot (frame 2, "Hero Collection").',
    code: `// Card.Collection.Hero (Figma 1:336).
<section className="mt-4">
  <div className="px-6">
    <SectionTitle blueTop="Pay later" whiteBottom="at top stores" />
  </div>
  <HScroll className="px-3 pt-2">
    {[
      { name: 'Target', back: '5% back', src: '/images/brand-target.png' },
      { name: 'Walmart', back: '5% back', src: '/images/brand-walmart.png' },
      { name: 'Ikea', back: '3% back', src: '/images/brand-ikea.png' },
      { name: 'Uniqlo', back: '5% back', src: '/images/brand-uniqlo.png', bg: '#ec1d24' },
      { name: 'Nike', back: '5% back', src: '/images/brand-nike.png' },
    ].map((s) => (
      <div key={s.name} className="shrink-0 w-[96px] flex flex-col items-center">
        {/* Avatar: 64×64 circle, 1px border rgba(255,255,255,0.24),
            per-brand fill (transparent by default), logo cropped to fit. */}
        <div className="relative rounded-full overflow-hidden" style={{
          width: 64, height: 64, background: s.bg ?? 'transparent',
          border: '1px solid rgba(255,255,255,0.24)' }}>
          <img src={s.src} className="absolute inset-0 w-full h-full object-cover" />
        </div>
        {/* Name 12px/16px weight 500 white, "Pay Later" 12px/16px
            rgba(255,255,255,0.72), back-rate 12px/16px #60cdff. */}
        <p style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500 }}>{s.name}</p>
        <p style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)' }}>Pay Later</p>
        <p style={{ fontSize: 12, lineHeight: '16px', color: '#60cdff' }}>{s.back}</p>
      </div>
    ))}
  </HScroll>
</section>`,
    whySeeing: {
      contentType: 'Hero',
      uiPattern: 'Hero carousel',
      purpose:
        'The Hero collection\'s "one job" per the PRD: educate that PayPal offers Pay Later at the biggest brands. It\'s the cold-start default — always slot 1 of the feed.',
      personalization:
        'Not personalized — same top-BNPL merchants shown to every customer regardless of persona or transaction history.',
      rankingObjective: 'Collections (75% of feed) optimize for merchant-site taps/clicks, which drives GMV.',
      slotBehavior: 'Always slot #1, in 100% of sessions.',
      interaction: 'Horizontal carousel of brand logo tiles; tap opens the merchant in an in-app browser (IAB).',
      fallback: 'If payload/config fails, shows the last-good cached Hero.',
      phase: 'P0',
    },
    render: () => <TopStoresRow />,
  },
  {
    id: 'deck-carousel',
    name: 'Deck Collection',
    group: 'Feed sections',
    description: 'The swipeable "Deck Collection" card carousel (brand spotlight cards).',
    usage:
      'Sits in the Home feed below Account Snapshot and Hero Collection (frame 3, "Deck Collection"). Tapping a card opens the in-app Browser sheet via openBrowser(brand) from NavContext.',
    code: `// Outer stack: 370×497. Slot geometry for the 3-card fan
// (DECK_SLOT_GEOM) — front is centred/full-size, back cards peek out
// ±28px, rotated ±8°, scaled to 280×374 (87.5% of front):
const DECK_SLOT_GEOM = {
  [-1]: { x: -28, y: 56, w: 280, h: 374, rotate: -8, z: 1 },
  [0]:  { x: 0,   y: 0,  w: 320, h: 427, rotate: 0,  z: 3 }, // front
  [1]:  { x: 28,  y: 56, w: 280, h: 374, rotate: 8,  z: 1 },
}

<section className="mt-4">
  <div className="mx-auto relative" style={{ width: 370, height: 497 }}>
    {/* Drag surface: horizontal drag/flick re-orders the deck (commit
        past 56px or a 0.5px/ms flick). Interaction logic omitted here —
        see DeckCarousel in App.tsx — dimensions/colors below are exact. */}
    <div style={{ width: 370, height: 445 }}>
      {DECK_CARDS.map((card, i) => {
        const slot = DECK_SLOT_GEOM[offsetFor(i, active)]
        return (
          <div
            key={card.id}
            style={{
              width: slot.w,
              height: slot.h,
              transform: \`translate(calc(-50% + \${slot.x}px), \${slot.y}px) rotate(\${slot.rotate}deg)\`,
              zIndex: slot.z,
            }}
          >
            {/* Card shell: front radius 24 / back radius 21, 0.5px border
                rgba(204,204,204,0.28), per-brand base color + radial
                gradient overlay, drop shadow (front: 0 32px 32px -4px,
                back: 0 28px 28px -3.5px, both rgba(0,0,0,0.25)). Same
                design-system <Card> primitive used everywhere else — the
                gradient overlay + shop button are the only additions. */}
            <Card
              width={slot.w}
              height={slot.h}
              radius={slot.z === 3 ? 24 : 21}
              fill={card.baseColor} // e.g. Nike: rgb(15, 19, 33)
              border="0.5px solid rgba(204,204,204,0.28)"
              shadow={slot.z === 3 ? '0 32px 32px -4px rgba(0,0,0,0.25)' : '0 28px 28px -3.5px rgba(0,0,0,0.25)'}
            >
              <div className="absolute inset-0" style={{ background: card.gradient }} />
              <img src={card.productImage} style={{ objectFit: 'contain', ...card.productStyleFront }} />

              {/* Header: 288×108 block at 15.5/15.5. Title 32px/32px weight
                  900 letterSpacing -1px, centered. Badge pill: 24px tall,
                  bg #002991, 4px radius, text 12px/16px #60cdff weight 500. */}
              <div style={{ left: 15.5, top: 15.5, width: 288, height: 108 }}>
                <h3 style={{ fontSize: 32, lineHeight: '32px', fontWeight: 900, letterSpacing: '-1px' }}>
                  {card.titleLine1}
                  {card.titleLine2 && <><br />{card.titleLine2}</>}
                </h3>
                <div style={{ height: 24, background: '#002991', borderRadius: 4 }}>
                  <span style={{ fontSize: 12, color: '#60cdff', fontWeight: 500 }}>{card.badgeLabel}</span>
                </div>
              </div>

              {/* Footer: 288×44 block at 15.5/366.5 (front). 40×40 circular
                  brand avatar, name 16px/24px weight 500, "Pay Later"
                  14px/20px rgba(255,255,255,0.72), Shop button 67×40,
                  translucent grey fill, 24px radius. */}
              <div style={{ left: 15.5, top: 366.5, width: 288, height: 44 }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: card.brandLogoBg ?? '#000',
                  border: '1px solid rgba(204,204,204,0.28)' }}>
                  <img src={card.brandLogo} className="w-full h-full object-cover" />
                </div>
                <p style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500 }}>{card.brandName}</p>
                <p style={{ fontSize: 14, lineHeight: '20px', color: 'rgba(255,255,255,0.72)' }}>Pay Later</p>
                <button
                  style={{ width: 67, height: 40, background: 'rgba(204,204,204,0.28)',
                    border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24 }}
                  onClick={() => openBrowser(card.id)}
                >
                  Shop
                </button>
              </div>
            </Card>
          </div>
        )
      })}
    </div>

    {/* Pagination — 8×8 dots, 8px gap, centered at y:461. Active = #fff,
        inactive = #808080. */}
    <div style={{ left: '50%', top: 461, gap: 8 }}>
      {DECK_CARDS.map((_, i) => (
        <button key={i} style={{ width: 8, height: 8, borderRadius: 999,
          background: i === active ? '#fff' : '#808080' }} />
      ))}
    </div>
  </div>
</section>`,
    whySeeing: {
      contentType: 'Top Category',
      uiPattern: 'Deck Card',
      purpose:
        'Standardized commerce categories, market leaders — the PRD calls this type "the backbone of the feed": always-relevant categories that don\'t depend on cold-start personalization to be useful.',
      personalization:
        'Curator selects which standardized category to surface and which merchant chips populate it, using ConsumerDNA persona/category-affinity signals.',
      rankingObjective: 'Collections (75% of feed) optimize for merchant-site taps/clicks, which drives GMV.',
      slotBehavior:
        'The component logic sheet\'s own Deck example is a "Deck (Seasonal)" card, slotted #2 by default for cold-start/fallback users (directly behind Hero) — this UI pattern isn\'t fixed to Top Category specifically.',
      interaction: 'Novel card-based carousel with a flicker/reveal interaction of photography imagery; tap to shop opens IAB.',
      fallback: 'If the lifestyle image is unavailable, falls back to a standard tile carousel.',
      phase: 'P0',
    },
    render: () => <DeckCarousel />,
  },
  {
    id: 'tile-group',
    name: 'Square Collection',
    group: 'Feed sections',
    description:
      'The "Card.Collection.Square" pattern: a horizontally-scrollable row of square 136×136 brand tiles, each with a logo, name and cashback rate.',
    usage:
      'Used repeatedly through the Home feed for brand collections — e.g. "New York City / shopper favorites" (frame 4, "Square Collection 1"). Takes a title/subtitle and a list of items.',
    code: `// Card.Collection.Square (Figma 1:1072). Every rounded rect here —
// outer container and inner tiles — is an instance of the shared
// design-system <Card> primitive; only width/height/radius/fill change.
<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgba(129,129,129,0.2)" height={314}>
    <div className="px-4 pt-4">
      <SectionTitle white="New York City" blue="shopper favorites" size="text-[24px]" />
    </div>
    <HScroll className="px-4">
      {[
        { name: 'Uniqlo', back: '5% back', src: '/images/brand-uniqlo.png', tileBg: '#ec1d24' },
        { name: 'KITH', back: '3% back', src: '/images/brand-kith.png', tileBg: '#fff' },
        { name: 'Farfetch', back: '5% back', src: '/images/brand-farfetch.png', tileBg: '#fff' },
        { name: 'Nike', back: '5% back', src: '/images/brand-nike.png', tileBg: '#000' },
        { name: 'Apple', back: '2% back', src: '/images/brand-apple.png', tileBg: '#fff' },
      ].map((it) => (
        <div key={it.name} style={{ width: 136 }}>
          {/* Card: 136×136, 24px radius, per-brand fill, 64×64 logo centered */}
          <Card width={136} height={136} radius={24} fill={it.tileBg}>
            <img src={it.src} style={{ width: 64, height: 64, left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)' }} />
          </Card>
          {/* Caption: name 14px/20px weight 500 white, "Pay later" 12px/16px
              rgba(255,255,255,0.72), optional back-rate line in #60cdff */}
          <p style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, padding: '8px 4px 0' }}>
            {it.name}
          </p>
          <p style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)', padding: '0 4px' }}>
            Pay later
          </p>
        </div>
      ))}
      {/* "See More" pill: 96×40, translucent grey fill, 24px radius */}
      <div style={{ width: 136, height: 136 }}>
        <button style={{ width: 96, height: 40, background: 'rgba(204,204,204,0.28)',
          border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24, fontSize: 14, fontWeight: 500 }}>
          See More
        </button>
      </div>
    </HScroll>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'Near You',
      uiPattern: 'Square',
      purpose: 'Location-based collection surfacing trending merchants near the customer.',
      personalization:
        'Curator selects the chips inside the collection using location plus local merchant-popularity signals — the location itself isn\'t curated, only which merchants represent it.',
      rankingObjective: 'Collections (75% of feed) optimize for merchant-site taps/clicks, which drives GMV.',
      slotBehavior: 'No fixed slot specified.',
      interaction: 'Square tiles (logo + brand color); tap to shop opens IAB.',
      fallback: 'On signal loss, defaults to a generic, popular collection.',
      phase: 'P0',
    },
    render: () => (
      <TileGroup
        title="New York City"
        subtitle="shopper favorites"
        items={[
          { name: 'Uniqlo', back: '5% back', src: '/images/brand-uniqlo.png', tileBg: '#ec1d24' },
          { name: 'KITH', back: '3% back', src: '/images/brand-kith.png', tileBg: '#fff' },
          { name: 'Farfetch', back: '5% back', src: '/images/brand-farfetch.png', tileBg: '#fff' },
          { name: 'Nike', back: '5% back', src: '/images/brand-nike.png', tileBg: '#000' },
          { name: 'Apple', back: '2% back', src: '/images/brand-apple.png', tileBg: '#fff' },
        ]}
      />
    ),
  },
  {
    id: 'extra-points',
    name: 'NBA List',
    group: 'Feed sections',
    description:
      'The "Card.NBA.List" pattern: a dark-navy card with a stacked, dividerless list of merchant rows (avatar, name, cashback rate).',
    usage: 'Part of the Home feed, in the "NBA List" section (frame 5).',
    code: `// Card.NBA.List (Figma 15:371). Outer container: 370×397, solid
// rgb(16, 26, 51) fill, 24px radius. Inner list: 338×291 at left:16
// top:90 — 4 rows of 338×72, translucent grey fill, 1px gap between
// rows (the navy outer shows through as the divider); first/last row
// get 24px corner radius on their outer edge only.
<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgb(16, 26, 51)" height={397}>
    <div style={{ left: 16, top: 16, width: 338, height: 58 }}>
      <h2 style={{ fontSize: 24, lineHeight: '28px', letterSpacing: '-1px', fontWeight: 900 }}>
        Extra points.
        <br />
        <span style={{ color: '#60cdff' }}>Limited time.</span>
      </h2>
    </div>
    <div style={{ left: 16, top: 90, width: 338, height: 291 }}>
      {[
        { back: '5% back', src: '/images/brand-uniqlo.png', bg: '#ec1d24' },
        { back: '3% back', src: '/images/brand-ultabeauty.png' },
        { back: '2% back', src: '/images/brand-hm.png' },
        { back: '5% back', src: '/images/brand-apple.png' },
      ].map((r, i, rows) => (
        <div key={i} style={{
          top: i * 73, width: 338, height: 72, background: 'rgba(129,129,129,0.2)',
          borderTopLeftRadius: i === 0 ? 24 : 0, borderTopRightRadius: i === 0 ? 24 : 0,
          borderBottomLeftRadius: i === rows.length - 1 ? 24 : 0,
          borderBottomRightRadius: i === rows.length - 1 ? 24 : 0,
        }}>
          {/* Row content: 40×40 circular avatar at left:16, back-rate
              16px/24px weight 500 white + "Cash back" 12px/16px
              rgba(255,255,255,0.72) at left:68. */}
          <div style={{ left: 16, width: 40, height: 40, borderRadius: 999,
            background: r.bg ?? 'transparent', border: '1px solid rgba(204,204,204,0.28)' }}>
            <img src={r.src} className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <p style={{ left: 68, fontSize: 16, lineHeight: '24px', fontWeight: 500 }}>{r.back}</p>
          <p style={{ left: 68, fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)' }}>
            Cash back
          </p>
        </div>
      ))}
    </div>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'Next Best Action — Builds Daily Engagement Habits',
      uiPattern: 'NBA List',
      purpose:
        'NBA (fka Recommendations) are "internal ads" for PayPal\'s own products. This one promotes a PP+ points offer to drive daily engagement, distinct from Collections in both content and objective.',
      personalization:
        'NBA content selection is its own Curator Model touchpoint, separate from Collections — this slot is chosen from the points-balance / promo-eligibility signal set, not transaction-history affinity.',
      rankingObjective: 'NBA (15% of feed, fixed slots #4/#12/#20 at P0) optimizes for Customer LTV, not click-through.',
      slotBehavior: 'Reference PRD — fixed NBA slots #4/#12/#20 at P0.',
      interaction: 'Vertical list, max 4 rows; each row pairs an image with a label, optional description, and CTA.',
      contentGuidelines:
        'Title: ~2 lines, ~45–55 characters. Label: ~1 line max, ~28 characters. Description: ~1 line max, ~28 characters. CTA button label: ~1 line, ~10–12 characters (e.g. "Apply now," "Learn more"). Optional disclosure line beneath the card; tappable "Terms and Conditions" opens full terms where applicable.',
      phase: 'P0',
    },
    render: () => <ExtraPoints />,
  },
  {
    id: 'spotlight-section',
    name: 'Spotlight Collection',
    group: 'Feed sections',
    description:
      'The "Card.Colection.Spotlight" pattern: a horizontally-scrollable row of larger 250×314 hero cards, each with an avatar, a cashback badge, a product image and a footer.',
    usage:
      'Used for merchandising moments in the Home feed — e.g. "This weeks spring heros" (frame 6, "Spotlight Collection 1"), "Top tec gifts" and "Refresh your space". Takes a title/subtitle and a list of cards.',
    code: `// Card.Colection.Spotlight (Figma 15:1577). Outer and inner cards
// are both instances of the shared design-system <Card> primitive
// (height matches cardHeight — 420 for Spring heros, 380 for shorter
// variants like Top tec gifts).
<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgba(129,129,129,0.2)" height={420}>
    <div className="px-4 pt-4">
      <SectionTitle white="This weeks spring" blue="heros" size="text-[24px]" />
    </div>
    <HScroll className="px-4 pt-2">
      {SPRING_HEROS.map((card, i) => (
        // Card: 250×314, 12px radius, same translucent grey fill
        // (composites lighter than the outer Card since it's a 2nd layer)
        <Card key={i} width={250} height={314} radius={12} fill="rgba(129,129,129,0.2)">
          {/* Header: 40×40 circular avatar at 16/16, cashback badge pill
              65×24 top-right, bg #002991, text 12px #60cdff weight 500 */}
          <div style={{ left: 16, top: 16, right: 16, height: 40 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999,
              border: '1px solid rgba(204,204,204,0.28)', background: card.avatarBg }}>
              <img src={card.avatar} className="w-full h-full object-cover" />
            </div>
            <div style={{ width: 65, height: 24, background: '#002991', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: '#60cdff', fontWeight: 500 }}>{card.back}</span>
            </div>
          </div>
          {/* Product image: 174×174 framed area at left:38 top:72 */}
          <div style={{ left: 38, top: 72, width: 174, height: 174, overflow: 'hidden' }}>
            <img src={card.product} style={card.imgStyle} />
          </div>
          {/* Footer: name 14px/20px weight 500, "Pay later" 12px/16px
              rgba(255,255,255,0.72), at left:16 right:16 top:262 */}
          <div style={{ left: 16, right: 16, top: 262 }}>
            <p style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>{card.name}</p>
            <p style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.72)' }}>Pay later</p>
          </div>
        </Card>
      ))}
      {/* "See More" pill: 96×40 centered in a 125×314 slot */}
      <div style={{ width: 125, height: 314 }}>
        <button style={{ width: 96, height: 40, background: 'rgba(204,204,204,0.28)',
          border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24, fontSize: 14, fontWeight: 500 }}>
          See More
        </button>
      </div>
    </HScroll>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'Seasonal',
      uiPattern:
        'Splash Card — PRD 2.4 names this UI pattern "Splash Card" (category-based collection with lifestyle imagery, falling back to a standard tile carousel if the image is unavailable); this codebase\'s Figma-layer comments call the same component "Spotlight." Worth reconciling naming with design before shipping.',
      purpose:
        'Calendar and retail-event driven (e.g. "Halloween Edit," spring). Cold-start default — always slot 2 of the feed, right after Hero.',
      personalization:
        'Not personalized during cold start — same event merchants shown to every customer for the promotional window. Which event runs is curated centrally, not per-user.',
      rankingObjective: 'Collections (75% of feed) optimize for merchant-site taps/clicks, which drives GMV.',
      slotBehavior: 'No fixed slot specified.',
      interaction: 'Large image-led card carousel; tap to shop opens IAB.',
      fallback: 'If photography imagery is unavailable, falls back to a standard square carousel.',
      phase: 'P0',
    },
    render: () => <SpringHeros />,
  },
  {
    id: 'stream-cards',
    name: 'Fanned Collection',
    group: 'Feed sections',
    description: 'The horizontally-scrollable subscriptions/streaming promo row.',
    usage: 'Part of the Home feed, in the "Fanned Collection" section (frame 7).',
    code: `// Outer + tile shells are both design-system <Card> instances.
// Fan slot geometry (SLOT_GEOM) — front tile is centred/largest;
// back tiles fan out at ±8/16° with decreasing width/height:
const SLOT_GEOM = {
  [-1]: { x: -79.38, y: -8.83, w: 167.742, h: 256.029, rotate: -8 },
  [0]:  { x: 0.5,    y: -9.2,  w: 175,     h: 271,     rotate: 0  }, // front
  [1]:  { x: 79.17,  y: -8.83, w: 167.742, h: 256.029, rotate: 8  },
}

<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgba(129,129,129,0.2)" height={442.626}>
    <div className="px-4 pt-4">
      <SectionTitle white="Stream more." blue="Pay less." size="text-[24px]" />
    </div>
    {/* Drag surface: horizontal drag/flick re-orders the ring (commit past
        56px or a 0.5px/ms flick). Interaction logic omitted — see
        StreamCards in App.tsx — dimensions/colors below are exact. */}
    <div style={{ left: 16, top: 88, width: 338, height: 338.626 }}>
      {STREAM_TILES.map((tile, i) => {
        const slot = SLOT_GEOM[offsetFor(i, active)]
        const isFront = slot.rotate === 0
        return (
          <Card
            key={tile.name}
            width={slot.w}
            height={slot.h}
            radius={isFront ? 24 : 22}
            fill="#101010"
            border="0.5px solid rgba(204,204,204,0.28)"
            shadow={isFront ? '0 0 48px 16px rgba(0,0,0,0.25)' : '0 0 45.257px 15.086px rgba(0,0,0,0.25)'}
            style={{ transform: \`translate(calc(-50% + \${slot.x}px), calc(-50% + \${slot.y}px)) rotate(\${slot.rotate}deg)\` }}
          >
            {/* Album art: circular, inset 8.86%/7.2%, 81.7% width, 1:1 */}
            <div style={{ left: '8.86%', top: '7.2%', width: '81.7%', aspectRatio: '1 / 1', borderRadius: 999 }}>
              <img src={tile.src} className="w-full h-full object-cover" />
            </div>
            {/* Caption (front tile only): name 16px/24px weight 500,
                sub 14px/20px rgba(255,255,255,0.7), at left:15.5 bottom:16 */}
            {isFront && (
              <div style={{ left: 15.5, bottom: 16, width: 143 }}>
                <p style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500 }}>{tile.name}</p>
                <p style={{ fontSize: 14, lineHeight: '20px', color: 'rgba(255,255,255,0.7)' }}>{tile.back}</p>
              </div>
            )}
          </Card>
        )
      })}
    </div>
    {/* Pagination — 8×8 dots, 8px gap. Active #fff, inactive rgba(255,255,255,0.63) */}
    <div style={{ left: 149, top: 406.63, gap: 8 }}>
      {STREAM_TILES.map((t, i) => (
        <button key={i} style={{ width: 8, height: 8, borderRadius: 999,
          background: i === active ? '#fff' : 'rgba(255,255,255,0.63)' }} />
      ))}
    </div>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'For You',
      uiPattern: 'Fanned carousel',
      purpose: 'Personalized from transaction history and ConsumerDNA behavior/persona signals — introduces adjacent categories to balance familiarity with discovery.',
      personalization:
        'Curator selects both the collection type and its chips from the customer\'s transaction-history affinity — here, a high recent affinity for entertainment/streaming.',
      rankingObjective: 'Collections (75% of feed) optimize for merchant-site taps/clicks, which drives GMV.',
      slotBehavior: 'No fixed slot specified.',
      interaction: 'Stacked, swipeable cards users fan through; tap to shop opens IAB.',
      fallback: 'Falls back to the Square card format if the fanned layout can\'t render.',
      phase: 'P0',
    },
    render: () => <StreamCards />,
  },
  {
    id: 'crypto-promo',
    name: 'NBA Crypto',
    group: 'Feed sections',
    description: 'The Crypto promo card shown inline in the feed (buy/sell teaser + coin ticker).',
    usage: 'Part of the Home feed, in the "NBA Spotlight - Crypto" section (frame 10).',
    code: `// Card.NBA.Spotlight (Figma 15:4039). The outer container is a
// design-system <Card> instance: 370 wide, height 493.006, 24px radius,
// solid rgb(16, 26, 51) fill.
<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgb(16, 26, 51)" height={493.006}>
    {/* Header: 48×48 circular icon chip (translucent grey), centered;
        headline 32px/32px weight 900 letterSpacing -1px, "start with
        just $1." in #60cdff, rest white. */}
    <div style={{ left: 16, top: 16, width: 338, height: 136 }}>
      <div style={{ left: 145, top: 8, width: 48, height: 48, borderRadius: 999,
        background: 'rgba(204,204,204,0.28)' }}>
        <img src="/images/crypto-icon.svg" style={{ width: 20, height: 20 }} />
      </div>
      <h2 style={{ fontSize: 32, lineHeight: '32px', letterSpacing: '-1px', fontWeight: 900 }}>
        <span>Crypto made simple, </span>
        <span style={{ color: '#60cdff' }}>start with just $1.</span>
      </h2>
    </div>
    {/* Illustration: 338×253.006, object-cover */}
    <div style={{ left: 16, top: 168, width: 338, height: 253.006 }}>
      <img src="/images/crypto-coins.png" className="w-full h-full object-cover" />
    </div>
    {/* Footer: two 163×40 pill buttons, 8px gap, translucent grey fill,
        24px radius, text 14px weight 500. */}
    <div style={{ left: 16, top: 437.006, width: 338, height: 40 }}>
      <button style={{ width: 163, height: 40, background: 'rgba(204,204,204,0.28)',
        border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24, fontSize: 14, fontWeight: 500 }}>
        Learn More
      </button>
      <button style={{ left: 175, width: 163, height: 40, background: 'rgba(204,204,204,0.28)',
        border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24, fontSize: 14, fontWeight: 500 }}>
        Buy Crypto
      </button>
    </div>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'Next Best Action — Expands Wallet Share',
      uiPattern: 'NBA Spotlight',
      purpose: 'NBA promoting PayPal\'s own Crypto product to grow wallet share — an "internal ad," not a merchant Collection.',
      personalization:
        'Selected from the Expands Wallet Share NBA category for customers with no existing crypto product and a high exploration/discovery tendency.',
      rankingObjective: 'NBA (15% of feed, fixed slots #4/#12/#20 at P0) optimizes for Customer LTV, not click-through.',
      slotBehavior: 'Reference PRD — fixed NBA slots #4/#12/#20 at P0.',
      interaction: 'Single card with headline, optional description, image, and CTA; tapping the card or CTA funnels the user toward learning more and into the utility flows.',
      contentGuidelines:
        '3D render illustration recommended. Title: ~2 lines, ~40–50 characters. Description: ~2 line max, ~85–90 characters. CTA button label: ~1 line, ~10–12 characters (e.g. "Apply now," "Learn more"). Optional disclosure line beneath the card; tappable "Terms and Conditions" opens full terms where applicable.',
      phase: 'P0',
    },
    render: () => <CryptoPromo />,
  },
  {
    id: 'track-orders',
    name: 'NBA Spotlight',
    group: 'Feed sections',
    description: 'The "Track orders to your doorstep" shipment promo card.',
    usage: 'Part of the Home feed, in the "NBA Spotlight - Tracking" section (frame 17).',
    code: `// Card.NBA.Spotlight (Figma 24:2460). The outer container is a
// design-system <Card> instance: 370 wide, height 433.006, 24px radius,
// solid rgb(16, 26, 51) fill.
<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgb(16, 26, 51)" height={433.006}>
    {/* Header: 32px/32px weight 900 letterSpacing -1px, 2-line, centered,
        second line "your doorstep" in #60cdff. */}
    <div style={{ left: 32, top: 24, width: 306, height: 64 }}>
      <h2 style={{ fontSize: 32, lineHeight: '32px', letterSpacing: '-1px', fontWeight: 900 }}>
        <span>Track orders to</span>
        <br />
        <span style={{ color: '#60cdff' }}>your doorstep</span>
      </h2>
    </div>
    {/* Illustration: 338×253.006, object-cover, object-position bottom */}
    <div style={{ left: 16, top: 108, width: 338, height: 253.006 }}>
      <img src="/images/track-orders.png" className="w-full h-full object-cover object-bottom" />
    </div>
    {/* Footer: single full-width 338×40 pill button, translucent grey
        fill, 24px radius, text 14px weight 500. */}
    <div style={{ left: 16, top: 377.01, width: 338, height: 40 }}>
      <button style={{ width: 338, height: 40, background: 'rgba(204,204,204,0.28)',
        border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24, fontSize: 14, fontWeight: 500 }}>
        Link Email
      </button>
    </div>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'Next Best Action — Builds Daily Engagement Habits',
      uiPattern: 'NBA Spotlight',
      purpose: 'NBA promoting package tracking to build a daily-open habit — an "internal ad" for a PayPal feature, not a merchant Collection.',
      personalization:
        'Selected from the Builds Daily Engagement Habits NBA category for active shoppers with regular purchase activity, to increase app engagement.',
      rankingObjective: 'NBA (15% of feed, fixed slots #4/#12/#20 at P0) optimizes for Customer LTV, not click-through.',
      slotBehavior: 'Reference PRD — fixed NBA slots #4/#12/#20 at P0.',
      interaction: 'Single card with headline, optional description, image, and CTA; tapping the card or CTA funnels the user toward learning more and into the utility flows.',
      contentGuidelines:
        '3D render illustration recommended. Title: ~2 lines, ~40–50 characters. Description: ~2 line max, ~85–90 characters. CTA button label: ~1 line, ~10–12 characters (e.g. "Apply now," "Learn more"). Optional disclosure line beneath the card; tappable "Terms and Conditions" opens full terms where applicable.',
      phase: 'P0',
    },
    render: () => <TrackOrders />,
  },
  {
    id: 'paypal-mastercard-promo',
    name: 'NBA Carousel',
    group: 'Feed sections',
    description: 'The PayPal Mastercard promo card, including the animated card-flip preview.',
    usage: 'Part of the Home feed, in the "NBA Carousel" section (frame 13).',
    code: `// Card.NBA.Carousel (Figma 24:1855). Outer + per-slot shells are
// both design-system <Card> instances. Outer: 370×514, 24px radius,
// solid rgb(16, 26, 51) fill. 3-card fan slot geometry (front
// is largest/topmost, back two recede in y/scale):
const MC_SLOTS = [
  { y: 6,   w: 244.444, h: 154, radius: 9.208, z: 3 }, // front
  { y: -16, w: 225.397, h: 142, radius: 8.521, z: 2 },
  { y: -38, w: 206.349, h: 130, radius: 7.844, z: 1 },
]
// Per-slot design: front = dark-navy w/ chip + PayPal "P" monogram
// (see FrontCardContent in App.tsx for the inlined chip/monogram SVG);
// cyan/navy = full PayPal wordmark + Mastercard digital logo
// (see SecondaryCardContent in App.tsx).
const MC_DESIGNS = [
  { variant: 'front', bg: '#152045' },
  { variant: 'cyan',  bg: '#60cdff' },
  { variant: 'navy',  bg: '#002991' },
]

<section className="mt-4 px-4">
  <Card width={370} radius={24} fill="rgb(16, 26, 51)" height={514}>
    {/* Header: 32px/32px weight 900 letterSpacing -1px, 2-line centered,
        second line "of PayPal" in #60cdff. */}
    <div style={{ left: 16, top: 24, width: 302 }}>
      <h2 style={{ fontSize: 32, lineHeight: '32px', letterSpacing: '-1px', fontWeight: 900 }}>
        <span>Get the most out</span>
        <br />
        <span style={{ color: '#60cdff' }}>of PayPal</span>
      </h2>
    </div>
    {/* Swipeable deck: 338×338 at left:16 top:104. Drag/flick logic
        omitted — see PayPalMastercardPromo in App.tsx. Each card's shell
        is a <Card> using its slot's w/h/radius + design's bg. */}
    <div style={{ left: 16, top: 104, width: 338, height: 338 }}>
      {MC_SLOTS.map((slot, i) => (
        <div key={i} style={{ zIndex: slot.z, transform: \`translateY(\${slot.y}px)\` }}>
          <Card width={slot.w} height={slot.h} radius={slot.radius} fill={MC_DESIGNS[i].bg}>
            {i === 0 ? <FrontCardContent scale={1} /> : <SecondaryCardContent variant={MC_DESIGNS[i].variant} scale={1} />}
          </Card>
        </div>
      ))}
    </div>
    {/* Pagination: 8×8 dots, active #fff / inactive #808080, at y:294 */}
    <div style={{ left: 0, top: 294, width: 338, height: 44, gap: 8 }}>
      {MC_SLOTS.map((_, i) => (
        <button key={i} style={{ width: 8, height: 8, borderRadius: 999,
          background: i === 0 ? '#fff' : '#808080' }} />
      ))}
    </div>
    {/* Footer: fine-print 14px/20px rgba(255,255,255,0.72) at left, Apply
        pill 72×40 translucent grey fill 24px radius at right. */}
    <div style={{ left: 16, top: 458, width: 338, height: 40 }}>
      <div style={{ width: 254, fontSize: 14, lineHeight: '20px', color: 'rgba(255,255,255,0.72)' }}>
        <p>$0 interest if paid in full in 6 months</p>
        <p>on all purchases of $149+</p>
      </div>
      <button style={{ left: 266, width: 72, height: 40, background: 'rgba(204,204,204,0.28)',
        border: '1px solid rgba(129,129,129,0.2)', borderRadius: 24, fontSize: 14, fontWeight: 500 }}>
        Apply
      </button>
    </div>
  </Card>
</section>`,
    whySeeing: {
      contentType: 'Next Best Action — Expands Wallet Share',
      uiPattern: 'NBA Carousel',
      purpose: 'NBA promoting the PayPal Mastercard to grow wallet share — an "internal ad" for PayPal\'s own credit product, not a merchant Collection.',
      personalization:
        'Selected from the Expands Wallet Share NBA category for customers who don\'t hold a PayPal Mastercard whose tenure and spend frequency indicate strong approval likelihood.',
      rankingObjective: 'NBA (15% of feed, fixed slots #4/#12/#20 at P0) optimizes for Customer LTV, not click-through.',
      slotBehavior: 'Reference PRD — fixed NBA slots #4/#12/#20 at P0.',
      interaction: 'Tapping the image shuffles through content — the front item moves to the back, the next slides forward, and the item label/label/pagination/description update accordingly; loops infinitely. Tapping the CTA brings the user to a detail page or contextual flow.',
      contentGuidelines:
        'Title: ~2 lines, ~40–50 characters. Item label: ~1 line max, ~30 characters. Label: ~1 line max, ~30 characters. Description: ~1 line max, ~30 characters. CTA button label: ~1 line, ~10–12 characters (e.g. "Apply now," "Learn more"). Optional disclosure line beneath the card; tappable "Terms and Conditions" opens full terms where applicable.',
      phase: 'P0',
    },
    render: () => <PayPalMastercardPromo />,
  },
]

const AccordionChevron = ({ open, active = open }: { open: boolean; active?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className={`shrink-0 transition-all duration-200 ${open ? 'rotate-180' : ''} ${
      active ? 'text-white' : 'text-white/45'
    }`}
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CatalogSidebarList = ({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) => {
  const groups = Array.from(new Set(CATALOG_ENTRIES.map((e) => e.group)))
  return (
    <>
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            {CATALOG_ENTRIES.filter((e) => e.group === group).map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(e.id)}
                className={`text-left p-3 rounded-2xl border transition ${
                  e.id === selected
                    ? 'border-white/80 bg-transparent'
                    : 'border-transparent bg-white/5 hover:bg-white/[0.08]'
                }`}
              >
                <p className="text-[14px] font-semibold leading-[20px] text-white">{e.name}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

const CatalogView = ({ entry }: { entry: CatalogEntry }) => {
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  // Reset the code toggle and any "Copied" toast when switching entries,
  // so state from the previous component doesn't linger.
  useEffect(() => {
    setShowCode(false)
    setCopied(false)
  }, [entry.id])
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(entry.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }
  return (
    <div className="flex-1 min-h-0 flex">
      {/* Center column: preview and the code panel. Scrolls independently
          so revealing the code snippet never affects the tray's height or
          position. The "Show code" toggle is pinned at bottom-10, level
          with the sidebar's collapse toggle at the same offset. */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center pt-8 pb-24">
          {/* my-auto (rather than justify-center on the scroll container)
              centers this group vertically when it fits, but — unlike
              justify-center — degrades gracefully to top-aligned/scrollable
              when the content (e.g. a long code panel) is taller than the
              viewport, instead of clipping the unreachable overflow. */}
          <div className="my-auto flex flex-col items-center gap-6">
            <div className="w-[402px] flex flex-col gap-5">
              <div className="relative min-h-[300px] max-h-[720px] overflow-y-auto shrink-0 flex justify-center">
                {/* max-w-full + min-w-0 cap this at the 402px viewport so
                    components with their own internal horizontal scroller
                    (e.g. AccountSnapshot's HScroll) still get clipped to a
                    fixed-width viewport instead of growing to fit all their
                    content — flex items otherwise size to content by
                    default and can overflow their container. Components
                    narrower than 402px keep their natural width, so
                    justify-center still centers them. */}
                <div className="relative max-w-full min-w-0">
                  <NavContext.Provider value={buildCatalogNavApi(entry.navOverrides)}>
                    {entry.render()}
                  </NavContext.Provider>
                </div>
              </div>
            </div>

            {/* Full-width code panel — spans the whole center column rather
                than being capped to the 402px preview width. ml-7 (28px)
                gives the left gap from the nav; the right gap comes from the
                tray's own m-7 left margin, so mr-0 here avoids doubling it. */}
            {showCode && (
              <div className="relative self-stretch ml-7 mr-0">
                <pre className="font-mono text-[12px] leading-relaxed text-white/85 bg-white/5 border border-[#CCCCCC]/35 rounded-xl p-4 overflow-x-auto overflow-y-auto whitespace-pre-wrap max-h-[1024px]">
                  {entry.code}
                </pre>
                <button
                  onClick={copyCode}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[14px] font-medium leading-[20px] bg-white/10 hover:bg-white/15 text-white/80 transition"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toggling this ADDS the code panel above rather than replacing
            anything, so the example stays visible for reference while
            reading/copying the snippet. */}
        <button
          onClick={() => setShowCode((v) => !v)}
          className={`absolute bottom-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-[14px] font-medium leading-[20px] transition ${
            showCode ? 'bg-white/15 text-white' : 'bg-white/5 text-white/45 hover:text-white/70'
          }`}
        >
          {showCode ? 'Hide code' : 'Show code'}
        </button>
      </div>

      {/* Always-present tray — sourced from PRD-Home.pdf's feed-composition,
          collection-type, Curator Model, and Uber Ranker sections. Full-height,
          with a constant 28px margin on every side. */}
      <div className="hidden lg:flex flex-col gap-5 w-[320px] shrink-0 self-stretch m-7 rounded-2xl bg-white/5 border border-[#CCCCCC]/35 p-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-medium leading-[32px] text-white">Overview</p>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/60 font-medium">
            {entry.whySeeing.phase}
          </span>
        </div>

        {/* Placeholder CTA — no per-entry Figma node link is stored yet, so
            this doesn't navigate anywhere. Wire up entry.figmaUrl once the
            catalog tracks real node IDs per component. */}
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/15 text-[13px] font-medium leading-[18px] text-white transition"
        >
          <svg width="12" height="17" viewBox="0 0 38 57" fill="none" aria-hidden>
            <path d="M19 28.5a9.5 9.5 0 1 1 9.5-9.5 9.5 9.5 0 0 1-9.5 9.5Z" fill="#1ABCFE" />
            <path d="M9.5 38A9.5 9.5 0 0 1 9.5 19H19v9.5A9.5 9.5 0 0 1 9.5 38Z" fill="#0ACF83" />
            <path d="M9.5 19A9.5 9.5 0 0 1 9.5 0H19v19H9.5Z" fill="#FF7262" />
            <path d="M19 0h9.5a9.5 9.5 0 0 1 0 19H19V0Z" fill="#F24E1E" />
            <path d="M19 28.5h-9.5a9.5 9.5 0 1 0 9.5 9.5v-9.5Z" fill="#A259FF" />
          </svg>
          View in Figma
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
          </svg>
        </button>

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            Content Type
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.contentType}</p>
        </div>

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            UI Pattern
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.uiPattern}</p>
        </div>

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            Purpose
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.purpose}</p>
        </div>

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            Slot behavior
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.slotBehavior}</p>
        </div>

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            Interaction
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.interaction}</p>
        </div>

        {entry.whySeeing.fallback && (
          <div>
            <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
              Fallback
            </p>
            <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.fallback}</p>
          </div>
        )}

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            Personalization
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.personalization}</p>
        </div>

        <div>
          <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
            Ranking objective
          </p>
          <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.rankingObjective}</p>
        </div>

        {entry.whySeeing.contentGuidelines && (
          <div>
            <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1">
              Content guidelines
            </p>
            <p className="text-[16px] leading-[22px] text-white/70">{entry.whySeeing.contentGuidelines}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- App ----------

export default function App() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const homeFeedListRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(1)
  const [view, setView] = useState<AppView>('feed')
  // Prototype sidebar collapse state — lets the presenter hide the dev
  // nav when demoing. Persisted to localStorage so a presenter's choice
  // survives a refresh. Default is open so first-time visitors still
  // see the flow map.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = window.localStorage.getItem('hfpp:sidebarOpen')
      return v == null ? true : v === '1'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('hfpp:sidebarOpen', sidebarOpen ? '1' : '0')
    } catch {
      /* private mode / disabled storage — silently ignore */
    }
  }, [sidebarOpen])
  // Catalog mode — a second top-level mode (alongside the phone-feed
  // Prototype mode) for browsing each cataloged component in isolation
  // with documentation + a copyable code snippet. Persisted like
  // sidebarOpen so a presenter's choice survives a refresh.
  const [catalogMode, setCatalogMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('hfpp:catalogMode') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('hfpp:catalogMode', catalogMode ? '1' : '0')
    } catch {
      /* private mode / disabled storage — silently ignore */
    }
  }, [catalogMode])
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(
    CATALOG_ENTRIES[0].id,
  )
  // Prototype preview scale — the phone bezel in the main panel is a fixed
  // 414×886, which gets cut off on smaller laptop screens. A button pinned
  // to the browser window's bottom-right corner opens a slider popover to
  // shrink/grow the preview. Persisted like sidebarOpen/catalogMode.
  const [previewScale, setPreviewScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    try {
      const v = window.localStorage.getItem('hfpp:previewScale')
      const n = v == null ? 1 : parseFloat(v)
      return Number.isFinite(n) ? Math.min(1, Math.max(0.25, n)) : 1
    } catch {
      return 1
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('hfpp:previewScale', String(previewScale))
    } catch {
      /* private mode / disabled storage — silently ignore */
    }
  }, [previewScale])
  const PREVIEW_SCALE_MIN = 0.25
  const PREVIEW_SCALE_MAX = 1
  const [scalePopoverOpen, setScalePopoverOpen] = useState(false)
  const scalePopoverRef = useRef<HTMLDivElement | null>(null)
  const scaleTrackRef = useRef<HTMLDivElement | null>(null)
  const scaleSliderDraggingRef = useRef(false)
  useEffect(() => {
    if (!scalePopoverOpen) return
    const onOutside = (e: PointerEvent) => {
      if (!scalePopoverRef.current?.contains(e.target as Node)) {
        setScalePopoverOpen(false)
      }
    }
    window.addEventListener('pointerdown', onOutside)
    return () => window.removeEventListener('pointerdown', onOutside)
  }, [scalePopoverOpen])
  const updateScaleFromClientX = (clientX: number) => {
    const track = scaleTrackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    setPreviewScale(PREVIEW_SCALE_MIN + ratio * (PREVIEW_SCALE_MAX - PREVIEW_SCALE_MIN))
  }
  const onScaleSliderPointerDown = (e: React.PointerEvent) => {
    scaleSliderDraggingRef.current = true
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
    updateScaleFromClientX(e.clientX)
  }
  const onScaleSliderPointerMove = (e: React.PointerEvent) => {
    if (!scaleSliderDraggingRef.current) return
    updateScaleFromClientX(e.clientX)
  }
  const onScaleSliderPointerUp = () => {
    scaleSliderDraggingRef.current = false
  }
  // Prototype sidebar accordion — Home Feed is real (drives the frame
  // list below); States/Cohort are placeholder sections for exploring the
  // menu's UI/UX before any real state/cohort switching exists. "Add" is
  // appended to the end of each list (not its own section) so trying the
  // add-a-custom-component UI doesn't need a dedicated accordion row.
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(
    () => new Set(['home-feed']),
  )
  const toggleAccordion = (id: string) => {
    setOpenAccordions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const [fakeAccordionSections] = useState<
    { id: string; name: string; options: string[] }[]
  >([
    { id: 'states', name: 'States', options: ['Default', 'Loading', 'Error', 'Empty'] },
    { id: 'cohort', name: 'Cohort', options: ['New user', 'Existing user', 'High value'] },
  ])
  // "Add" is a UI concept only — it shows what adding a custom component to
  // the Home Feed could look like (paste code, pick a slot), but submitting
  // it doesn't actually touch the feed.
  const [addComponentModalOpen, setAddComponentModalOpen] = useState(false)
  const [addComponentCode, setAddComponentCode] = useState('')
  const [addComponentSlot, setAddComponentSlot] = useState<number>(FRAMES[0]?.id ?? 1)
  // Top app bar "Team" CTA — opens a modal listing the Product + Design
  // team (Figma node 4245:22560).
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  // States accordion demo. "Loading" shows a skeleton-shimmer overlay for a
  // couple seconds then reverts to Default on its own; "Error" shows the
  // Figma "Error.Load" connection-error screen and stays until the user
  // taps "Try again" or picks Default. "Empty" isn't wired up yet — a
  // UI-only demo, no real states/cohort switching exists.
  const [statesDemo, setStatesDemo] = useState<'default' | 'loading' | 'error'>('default')
  const triggerStatesLoadingDemo = () => {
    setStatesDemo('loading')
    window.setTimeout(() => {
      setStatesDemo((cur) => (cur === 'loading' ? 'default' : cur))
    }, 2200)
  }
  // Mobile / "bare" presentation mode. Set ?mobile=1 (or ?bare=1) in
  // the URL to strip the prototype chrome — sidebar, toggle, prototype
  // nav, phone bezel, dynamic island, gradient bg — so the 402×874
  // viewport fills the device screen. Designed for sharing the live
  // prototype with stakeholders who view it on a phone.
  const bareMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    const p = new URLSearchParams(window.location.search)
    return p.get('mobile') === '1' || p.get('bare') === '1'
  }, [])
  // When bareMode is on, scale the 402×874 viewport to fit the device's
  // viewport while preserving aspect ratio. We use JS rather than pure
  // CSS because `transform: scale()` takes a unit-less number and CSS
  // can't natively convert (100vw / 402) into one. The scale factor is
  // exposed as the `--phone-scale` custom property and applied below.
  useLayoutEffect(() => {
    if (!bareMode) {
      document.documentElement.style.removeProperty('--phone-scale')
      return
    }
    const update = () => {
      const sx = window.innerWidth / 402
      const sy = window.innerHeight / 874
      const s = Math.min(sx, sy, 1)
      document.documentElement.style.setProperty('--phone-scale', String(s))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [bareMode])
  // Transition phase orchestrates the two-step view swap:
  //   'idle'   — no animation, the active view is fully visible
  //   'exit'   — Phase 1: the outgoing view plays the exit animation
  //              (fade + scale down). The incoming view is hidden.
  //   'enter'  — Phase 2: the incoming view plays the enter animation
  //              (fade + slide up from below). Old view is hidden.
  type TransitionPhase = 'idle' | 'exit' | 'enter'
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  // While the exit phase is running we still want to show the OLD view,
  // so `displayView` holds the view being animated. It only flips to the
  // target view at the boundary between Phase 1 and Phase 2.
  const [displayView, setDisplayView] = useState<AppView>('feed')
  const phaseTimersRef = useRef<number[]>([])

  const EXIT_MS = 360
  const ENTER_MS = 520

  const runTransition = (target: AppView) => {
    // Any top-level navigation dismisses transient full-screen overlays
    // (QR scanner, in-app browser, crypto overview/detail sheets) so the
    // destination view is actually shown rather than hidden behind a
    // leftover sheet. Runs before the same-view early-return so re-tapping
    // the current flow still clears an overlay on top of it.
    setBrowserBrand(null)
    setCryptoOverviewOpen(false)
    setCryptoPdpCoin(null)
    if (target === view) return
    // Clear any timers from a previous in-flight transition so a fast
    // re-tap doesn't stack overlapping phases.
    phaseTimersRef.current.forEach((id) => window.clearTimeout(id))
    phaseTimersRef.current = []
    setView(target)
    setPhase('exit')
    // Phase 1: current (displayView) is exiting. After EXIT_MS swap
    // the displayed view and start Phase 2.
    const t1 = window.setTimeout(() => {
      setDisplayView(target)
      setPhase('enter')
      const t2 = window.setTimeout(() => {
        setPhase('idle')
      }, ENTER_MS)
      phaseTimersRef.current.push(t2)
    }, EXIT_MS)
    phaseTimersRef.current.push(t1)
  }

  useEffect(
    () => () => {
      phaseTimersRef.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const openFeed = () => runTransition('feed')

  // In-app browser sheet state — slides up from the bottom over the
  // current view when openBrowser(brand) is called.
  const [browserBrand, setBrowserBrand] = useState<BrowserBrand | null>(null)
  const openBrowser = (brand: BrowserBrand) => setBrowserBrand(brand)
  const closeBrowser = () => setBrowserBrand(null)

  // Crypto PDP sheet state — slides up over the wallet view when a
  // user taps a coin row. `cryptoPdpCoin` is the active coin (null when
  // closed); `cryptoPdpSource` records the entry point so the sheet's
  // top-left control adapts (back arrow vs X).
  const [cryptoPdpCoin, setCryptoPdpCoin] = useState<CoinId | null>(null)
  const [cryptoPdpSource, setCryptoPdpSource] = useState<'overview' | 'direct'>('direct')
  const openCryptoPdp = (coin: CoinId, source: 'overview' | 'direct' = 'direct') => {
    setCryptoPdpSource(source)
    setCryptoPdpCoin(coin)
  }
  const closeCryptoPdp = () => setCryptoPdpCoin(null)
  // Backward-compatible Bitcoin wrapper.
  const openBitcoinPdp = (source: 'overview' | 'direct' = 'direct') =>
    openCryptoPdp('bitcoin', source)

  // Crypto Overview sheet state — slides up when the Crypto card's
  // header / value area is tapped (a separate route from the Bitcoin
  // row, which opens the BTC product detail page).
  const [cryptoOverviewOpen, setCryptoOverviewOpen] = useState(false)
  const openCryptoOverview = () => setCryptoOverviewOpen(true)
  const closeCryptoOverview = () => setCryptoOverviewOpen(false)

  // Manual rAF smooth-scroll. Native `scrollTo({behavior:'smooth'})` gets
  // interrupted when the IntersectionObserver fires during the scroll and
  // toggles each <Reveal>'s transform, so we animate scrollTop directly.
  const animScrollRef = useRef<number | null>(null)
  const animateScrollTo = (sc: HTMLElement, target: number, duration = 1100) => {
    if (animScrollRef.current != null) cancelAnimationFrame(animScrollRef.current)
    const start = sc.scrollTop
    const delta = target - start
    if (Math.abs(delta) < 1) return
    const t0 = performance.now()
    // easeInOutCubic — slow start, accelerate, slow finish. Combined with the
    // longer 1.1s duration this gives the pagination scroll a deliberate,
    // cinematic feel rather than a snap.
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      sc.scrollTo({ top: start + delta * easeInOutCubic(t), behavior: 'auto' })
      if (t < 1) {
        animScrollRef.current = requestAnimationFrame(step)
      } else {
        animScrollRef.current = null
      }
    }
    animScrollRef.current = requestAnimationFrame(step)
  }

  const scrollToFrame = (id: number) => {
    const frame = FRAMES.find((f) => f.id === id)
    const sc = scrollRef.current
    if (!frame || !sc) return
    // Dismiss any full-screen overlay so a Home-frame tap reveals the feed
    // (on-feed taps don't go through runTransition, which handles this
    // otherwise).
    setBrowserBrand(null)
    setCryptoOverviewOpen(false)
    setCryptoPdpCoin(null)
    setActive(id)

    const performScroll = () => {
      const target = sc.querySelector<HTMLElement>(`#${frame.anchor}`)
      if (target) {
        // Use getBoundingClientRect because each section sits inside a
        // <Reveal> whose `transform` makes it the offsetParent — so
        // offsetTop is 0 for every section. Rect-based math gives the
        // true position regardless of intermediate transforms.
        const containerRect = sc.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        // The phone preview itself sits inside a `transform: scale(previewScale)`
        // wrapper (the bottom-right scale slider), so getBoundingClientRect
        // returns post-transform (visually scaled) pixels while sc.scrollTop
        // is always in the element's own unscaled layout pixels. Dividing the
        // rect-derived deltas by previewScale converts them back to that same
        // unscaled space — otherwise the computed target undershoots more and
        // more the further the jump, which is why it only broke at extremes.
        const scale = previewScale || 1
        const dTop = (targetRect.top - containerRect.top) / scale
        const dCenter = (containerRect.height / 2 - targetRect.height / 2) / scale
        // Account Snapshot (id 1) and Hero Collection (id 2) stay pinned
        // near the top of the feed — that's where they naturally sit and
        // there's nothing above them to center against. Every other frame
        // centers vertically in the viewport instead of just peeking below
        // the top, so tapping a component type brings it into clear focus.
        const top =
          frame.id === 1 || frame.id === 2
            ? sc.scrollTop + dTop - (frame.offset ?? 12)
            : sc.scrollTop + dTop - dCenter
        animateScrollTo(sc, top)
      } else {
        animateScrollTo(sc, 0)
      }
    }

    if (view !== 'feed') {
      // Coming from Wallet or Transfer — run the proper two-phase
      // view transition first, then perform the scroll once the feed
      // is the displayed view (i.e. after Phase 1 completes). Using
      // setView directly would leave the feed hidden because
      // computeViewStyle keys off `displayView`, not `view`.
      runTransition('feed')
      window.setTimeout(performScroll, EXIT_MS + 30)
    } else {
      performScroll()
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Arrow keys navigate frames only while the feed view is active.
      if (view !== 'feed') return
      if (e.key === 'ArrowRight') scrollToFrame(Math.min(FRAMES.length, active + 1))
      if (e.key === 'ArrowLeft') scrollToFrame(Math.max(1, active - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, view])

  // Scroll-spy: as the user scrolls the feed by hand (drag/wheel, not just
  // tapping a sidebar row), keep the Home Feed accordion's highlighted row
  // in sync with whichever section currently sits closest to the viewport's
  // vertical center. Account Snapshot and Hero Collection (frames 1 and 2)
  // both use the 'top' anchor for scrollToFrame's jump-to behavior since
  // they're already flush together, but that anchor is ambiguous for
  // spying — '#account' and '#top-stores' are their own real section ids,
  // so spying resolves them to distinct frames while frames 3+ reuse their
  // existing `anchor` id directly.
  useEffect(() => {
    const sc = scrollRef.current
    if (!sc || view !== 'feed') return
    const spyTargets = FRAMES.map((f) => ({
      id: f.id,
      selector: f.id === 1 ? '#account' : f.id === 2 ? '#top-stores' : `#${f.anchor}`,
    }))
    let raf = 0
    const update = () => {
      raf = 0
      // Account Snapshot is short, so its center sits well above the
      // viewport's vertical center even at scrollTop 0 — closest-center
      // matching would pick Hero Collection (top-stores) immediately on
      // load. Pin to frame 1 until the user has actually scrolled past it.
      if (sc.scrollTop < 24) {
        setActive(FRAMES[0].id)
        return
      }
      const containerRect = sc.getBoundingClientRect()
      const viewportCenter = containerRect.top + containerRect.height / 2
      let closestId: number | null = null
      let closestDist = Infinity
      for (const t of spyTargets) {
        const el = sc.querySelector<HTMLElement>(t.selector)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - viewportCenter)
        if (dist < closestDist) {
          closestDist = dist
          closestId = t.id
        }
      }
      if (closestId != null) setActive(closestId)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(update)
    }
    update()
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      sc.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [view, catalogMode])

  // Keep the active row visible inside the Home Feed accordion's own
  // internal scroll — otherwise, once scroll-spy moves selection past the
  // first few rows, the highlighted item sits below the accordion's fold
  // and the user can't see what just got selected.
  useEffect(() => {
    const container = homeFeedListRef.current
    if (!container) return
    const item = container.querySelector<HTMLElement>(`[data-frame-id="${active}"]`)
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  const navApi: NavApi = {
    view,
    openFeed,
    browserBrand,
    openBrowser,
    closeBrowser,
    cryptoPdpCoin,
    cryptoPdpSource,
    openCryptoPdp,
    closeCryptoPdp,
    openBitcoinPdp,
    cryptoOverviewOpen,
    openCryptoOverview,
    closeCryptoOverview,
  }


  // In bare mode the prototype dev chrome (sidebar, toggle, prototype
  // nav, gradient bg, phone bezel) is stripped so the phone viewport
  // fills the device screen. Used when sharing the live prototype URL
  // (`?mobile=1`) with stakeholders viewing on a phone.
  if (bareMode) {
    return (
      <NavContext.Provider value={navApi}>
        <div
          // Full-viewport black backdrop. `100dvh` is the dynamic
          // viewport height, which (unlike `100vh`) accounts for
          // mobile browser chrome appearing / disappearing on scroll.
          style={{
            width: '100vw',
            height: '100dvh',
            background: '#000',
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            // The 402×874 phone viewport, scaled to fit the device.
            // `--phone-scale` is set by the layout effect above.
            style={{
              width: 402,
              height: 874,
              transform: 'scale(var(--phone-scale, 1))',
              transformOrigin: 'center center',
            }}
          >
            <ScrollRootContext.Provider value={scrollRef}>
              <PhoneShell
                scrollRef={scrollRef}
                displayView={displayView}
                phase={phase}
                bare
              >
                <Feed />
              </PhoneShell>
            </ScrollRootContext.Provider>
          </div>
        </div>
      </NavContext.Provider>
    )
  }
  return (
    <NavContext.Provider value={navApi}>
    <div
      className={`h-screen w-full text-white flex flex-col overflow-hidden ${
        catalogMode
          ? 'bg-black'
          : 'bg-[radial-gradient(circle_at_20%_0%,#141d33_0%,#080c1a_55%,#04050f_100%)]'
      }`}
    >
      {/* Top app bar — icon + product name on the left, export/share
          actions on the right (non-functional for now). */}
      <header className="shrink-0 h-[72px] flex items-center justify-between px-6 border-b border-[#CCCCCC]/35">
        <div className="flex items-center gap-3">
          <div className="h-[47px] w-[47px] rounded-xl bg-[#002991] flex items-center justify-center shrink-0">
            <img src="/images/paypal-monogram.png" alt="" className="h-[22px] w-auto" aria-hidden />
          </div>
          <h1 className="font-display text-[27px] font-black leading-[27px] tracking-[-1px]">Home Feed Simulator</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTeamModalOpen(true)}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/15 text-[14px] font-medium leading-[20px] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Team
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/15 text-[14px] font-medium leading-[20px] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Share
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/15 text-[14px] font-medium leading-[20px] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Save
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex relative">
      {/* Sidebar collapse/expand toggle — anchored to the bottom-left of the
          row below the app bar, always visible (mirrors the panel-toggle
          pattern from Claude Code's UI). Below the lg breakpoint the
          sidebar is hidden, so the toggle is hidden too. */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-pressed={sidebarOpen}
        className="hidden lg:flex absolute bottom-10 left-10 z-50 h-[38px] w-[38px] items-center justify-center rounded-full border border-[#CCCCCC]/35 text-white/70 hover:text-white hover:bg-white/[0.08] transition"
      >
        {/* Panel icon — rounded rect with a vertical divider at ~1/3 */}
        <svg width="19" height="19" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="6.25" y1="3.5" x2="6.25" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <aside
        // Width animates between 340 (open) and 0 (collapsed). overflow
        // hidden clips the inner content as it collapses. The contents
        // also fade so they don't visually punch through during the
        // transition. Floats as its own rounded panel (matching the
        // "Why am I seeing this?" tray) with a 28px margin, rather than
        // a flush edge-to-edge column.
        className="hidden lg:flex shrink-0 flex-col gap-6 rounded-2xl bg-white/5 border border-[#CCCCCC]/35 overflow-hidden"
        style={{
          width: sidebarOpen ? 340 : 0,
          margin: sidebarOpen ? '1.75rem 0 1.75rem 1.75rem' : '1.75rem 0 1.75rem 0',
          // Extra bottom padding (3.5rem ≈ 56px) clears the 32×32 collapse
          // toggle button that sits at bottom:40 / left:40 — without this
          // the sidebar's own content can scroll under the button.
          padding: sidebarOpen ? '1.5rem 1.5rem 3.5rem 1.5rem' : '1.5rem 0 3.5rem 0',
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          transition:
            'width 280ms cubic-bezier(0.32, 0.72, 0, 1), margin 280ms cubic-bezier(0.32, 0.72, 0, 1), padding 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease',
        }}
        aria-hidden={!sidebarOpen}
      >
        <div className="shrink-0">
          {/* Prototype / Catalog mode switch — Catalog mode breaks out of
              the phone feed to browse cataloged components individually
              with docs + a copyable code snippet, for front-end handoff. */}
          <div className="flex items-center gap-0.5 rounded-full border border-[#CCCCCC]/35 p-1">
            <button
              onClick={() => setCatalogMode(false)}
              aria-pressed={!catalogMode}
              className={`flex-1 px-2 py-1.5 text-[14px] font-medium leading-[20px] whitespace-nowrap transition rounded-full ${
                !catalogMode ? 'bg-white text-black' : 'text-white/45 hover:text-white/70'
              }`}
            >
              Prototype
            </button>
            <button
              onClick={() => setCatalogMode(true)}
              aria-pressed={catalogMode}
              className={`flex-1 px-2 py-1.5 text-[14px] font-medium leading-[20px] whitespace-nowrap transition rounded-full ${
                catalogMode ? 'bg-white text-black' : 'text-white/45 hover:text-white/70'
              }`}
            >
              Components
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
          {catalogMode ? (
            <CatalogSidebarList
              selected={selectedCatalogId}
              onSelect={setSelectedCatalogId}
            />
          ) : (
            // Wrapped in a single gap-less flex column so the section
            // dividers below sit flush against their neighbors' own
            // py-2.5 button padding — the parent <nav>'s gap-3 would
            // otherwise stack on top of that padding and push dividers
            // off-center between rows. flex-1 min-h-0 lets the Home Feed
            // section below claim the remaining height instead of the
            // wrapper growing past the nav and pushing Cohort off screen.
            <div className="flex flex-col flex-1 min-h-0">
          {/* HOME flow — starting frame is "Home" (frame 1). Frames 2–10
              are connected scroll positions within the same flow and now
              live inside a collapsible accordion section, alongside a
              placeholder States section. Each list (Home Feed frames,
              States options, Cohort options) ends with an "Add" item —
              a UI concept only, opens addComponentModalOpen — dashed/muted
              so it reads as a distinct affordance rather than a real
              option. When expanded, only this section's frame list
              scrolls/flexes — Cohort stays put below it, always visible. */}
          <div className={`flex flex-col ${openAccordions.has('home-feed') ? 'flex-1 min-h-0' : 'shrink-0'}`}>
            <button
              onClick={() => toggleAccordion('home-feed')}
              className="flex items-center justify-between px-4 py-5 w-full text-left shrink-0"
              aria-expanded={openAccordions.has('home-feed')}
            >
              <span
                className={`text-[16px] font-semibold leading-[24px] transition ${
                  openAccordions.has('home-feed') || view === 'feed' ? 'text-white' : 'text-white/45'
                }`}
              >
                Home Feed
              </span>
              <AccordionChevron open={openAccordions.has('home-feed')} active={openAccordions.has('home-feed') || view === 'feed'} />
            </button>
            {openAccordions.has('home-feed') && (
              <div
                ref={homeFeedListRef}
                className="flex flex-col gap-2 pt-3 pb-4 flex-1 min-h-0 overflow-y-auto"
                // Fade the top/bottom edges instead of a hard clip while
                // this list scrolls internally.
                style={{
                  WebkitMaskImage:
                    'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
                  maskImage:
                    'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
                }}
              >
                {FRAMES.map((f) => (
                  <button
                    key={f.id}
                    data-frame-id={f.id}
                    onClick={() => scrollToFrame(f.id)}
                    className={`text-left p-4 rounded-2xl border flex items-center gap-3 transition shrink-0 ${
                      f.id === active && view === 'feed'
                        ? 'border-white/80 bg-transparent'
                        : 'border-transparent bg-white/5 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${
                        f.id === active && view === 'feed'
                          ? 'bg-link text-ink-900'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {f.id}
                    </span>
                    <p className="text-[14px] font-semibold leading-[20px] text-white">{f.label}</p>
                  </button>
                ))}
                {/* "Add" — same "add a custom component" concept as before,
                    now appended to the end of each list instead of living
                    as its own accordion row. Dashed border + muted text
                    distinguishes it from real, selectable list items. */}
                <button
                  onClick={() => setAddComponentModalOpen(true)}
                  className="text-left p-4 rounded-2xl border border-dashed border-white/20 flex items-center gap-3 text-white/40 hover:text-white/60 hover:border-white/30 transition shrink-0"
                >
                  <span className="h-4 w-4 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 bg-white/10">
                    +
                  </span>
                  <p className="text-[14px] font-semibold leading-[20px]">Add</p>
                </button>
              </div>
            )}
            <div className="border-b border-white/10 shrink-0" />
          </div>

          {fakeAccordionSections.map((section, sectionIdx) => (
            <div key={section.id} className="flex flex-col shrink-0">
              <button
                onClick={() => toggleAccordion(section.id)}
                className="flex items-center justify-between px-4 py-5 w-full text-left"
                aria-expanded={openAccordions.has(section.id)}
              >
                <span
                  className={`text-[16px] font-medium leading-[24px] transition ${
                    openAccordions.has(section.id) ? 'text-white' : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {section.name}
                </span>
                <AccordionChevron open={openAccordions.has(section.id)} />
              </button>
              {openAccordions.has(section.id) && (
                <div className="flex flex-col gap-2 pb-4">
                  {section.options.map((opt) => {
                    const isStates = section.id === 'states'
                    const isActive =
                      isStates &&
                      ((opt === 'Default' && statesDemo === 'default') ||
                        (opt === 'Loading' && statesDemo === 'loading') ||
                        (opt === 'Error' && statesDemo === 'error'))
                    const onOptionClick = !isStates
                      ? undefined
                      : opt === 'Default'
                        ? () => setStatesDemo('default')
                        : opt === 'Loading'
                          ? triggerStatesLoadingDemo
                          : opt === 'Error'
                            ? () => setStatesDemo('error')
                            : undefined
                    return (
                      <button
                        key={opt}
                        onClick={onOptionClick}
                        disabled={isStates && opt === 'Loading' && statesDemo === 'loading'}
                        className={`text-left px-4 py-3 rounded-lg text-[14px] font-medium leading-[20px] transition ${
                          isActive
                            ? 'text-white bg-white/[0.12]'
                            : 'text-white/70 bg-white/5 hover:bg-white/[0.08]'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                  {/* "Add" — appended to the end of this list too, with the
                      same dashed/muted treatment as the Home Feed list's. */}
                  <button
                    onClick={() => setAddComponentModalOpen(true)}
                    className="text-left px-4 py-3 rounded-lg border border-dashed border-white/15 text-[14px] font-medium leading-[20px] text-white/40 hover:text-white/60 hover:border-white/25 transition"
                  >
                    + Add
                  </button>
                </div>
              )}
              {/* No divider after the last section (Cohort) — it would
                  draw a stray line under its final list item since there's
                  no next section to separate it from. */}
              {sectionIdx < fakeAccordionSections.length - 1 && (
                <div className="border-b border-white/10" />
              )}
            </div>
          ))}

            </div>
          )}

        </nav>
      </aside>

      <main
        className={
          catalogMode
            ? 'flex-1 min-h-0 flex'
            : 'flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-6 py-8 px-4'
        }
      >
        {catalogMode ? (
          <CatalogView
            entry={
              CATALOG_ENTRIES.find((e) => e.id === selectedCatalogId) ??
              CATALOG_ENTRIES[0]
            }
          />
        ) : (
          <>
        <ScrollRootContext.Provider value={scrollRef}>
          <div
            className="relative shrink-0"
            style={{ width: 414 * previewScale, height: 886 * previewScale }}
          >
            <div
              style={{
                width: 414,
                height: 886,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            >
              <PhoneShell
                scrollRef={scrollRef}
                displayView={displayView}
                phase={phase}
                loading={statesDemo === 'loading'}
                error={statesDemo === 'error'}
                onErrorRetry={() => setStatesDemo('default')}
              >
                <Feed />
              </PhoneShell>
            </div>
          </div>
        </ScrollRootContext.Provider>
          </>
        )}
      </main>

      {/* Preview scale control — pinned to the browser window's corner
          (not the phone) so it stays reachable regardless of how small the
          preview has been shrunk. Tap to open a slider popover. Only
          relevant in Prototype mode, where the phone preview renders. */}
      {!catalogMode && (
      <div ref={scalePopoverRef} className="fixed bottom-5 right-5 z-40">
        {scalePopoverOpen && (
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 flex items-center gap-4 rounded-full bg-[#0c1226] border border-[#CCCCCC]/20 px-5 py-3 shadow-2xl whitespace-nowrap">
            <div
              ref={scaleTrackRef}
              onPointerDown={onScaleSliderPointerDown}
              onPointerMove={onScaleSliderPointerMove}
              onPointerUp={onScaleSliderPointerUp}
              onPointerCancel={onScaleSliderPointerUp}
              role="slider"
              aria-label="Prototype preview size"
              aria-valuemin={PREVIEW_SCALE_MIN * 100}
              aria-valuemax={PREVIEW_SCALE_MAX * 100}
              aria-valuenow={Math.round(previewScale * 100)}
              className="relative w-40 h-1.5 rounded-full bg-white/15 cursor-pointer touch-none"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/70 pointer-events-none"
                style={{
                  width: `${((previewScale - PREVIEW_SCALE_MIN) / (PREVIEW_SCALE_MAX - PREVIEW_SCALE_MIN)) * 100}%`,
                }}
              />
              <div
                className="absolute top-1/2 h-5 w-5 rounded-full bg-white shadow pointer-events-none"
                style={{
                  left: `${((previewScale - PREVIEW_SCALE_MIN) / (PREVIEW_SCALE_MAX - PREVIEW_SCALE_MIN)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
            <span className="text-[14px] font-medium leading-[20px] text-white tabular-nums w-10 text-right">
              {Math.round(previewScale * 100)}%
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setScalePopoverOpen((v) => !v)}
          aria-label="Adjust prototype preview size"
          className="h-11 w-11 rounded-full bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/20 flex items-center justify-center transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v6h-6" />
            <path d="M3 9V3h6" />
            <path d="M21 3 14 10" />
            <path d="M3 21l7-7" />
          </svg>
        </button>
      </div>
      )}

      {/* Team modal — Figma: "Product + Design Team" (node 4245:22560).
          Read-only; lists the Product + Design team with initials avatars
          (see TEAM_MEMBERS comment re: no real headshots). */}
      {teamModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          style={{ backdropFilter: 'blur(4px)' }}
          onClick={() => setTeamModalOpen(false)}
        >
          <div
            className="w-[720px] max-w-[calc(100vw-2rem)] flex flex-col gap-6 rounded-2xl bg-[radial-gradient(circle_at_20%_0%,#141d33_0%,#080c1a_55%,#04050f_100%)] border border-[#CCCCCC]/15 p-9 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-semibold leading-[24px] text-white">Product + Design Team</p>
              <button
                onClick={() => setTeamModalOpen(false)}
                aria-label="Close"
                className="h-7 w-7 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-x-10 gap-y-12">
              {TEAM_MEMBERS.map((m) => (
                <div key={m.name} className="flex flex-col gap-2.5">
                  <img
                    src={m.photo}
                    alt={m.name}
                    width={116}
                    height={116}
                    className="rounded-full"
                  />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col">
                      <p className="text-[14px] font-medium leading-[20px] text-white">{m.name}</p>
                      <p className="text-[13px] leading-[18px] text-white/45">{m.role}</p>
                    </div>
                    {m.slackUrl ? (
                      <a
                        href={m.slackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-full bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/15 text-[12px] font-medium leading-[16px] text-white transition"
                      >
                        <svg width="13" height="13" viewBox="0 0 122.8 122.8" aria-hidden>
                          <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#e01e5a" />
                          <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
                          <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36c5f0" />
                          <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
                          <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2eb67d" />
                          <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
                          <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ecb22e" />
                          <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
                        </svg>
                        Contact
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-full bg-white/10 border border-[#CCCCCC]/35 hover:bg-white/15 text-[12px] font-medium leading-[16px] text-white transition"
                      >
                        <svg width="13" height="13" viewBox="0 0 122.8 122.8" aria-hidden>
                          <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#e01e5a" />
                          <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
                          <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36c5f0" />
                          <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
                          <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2eb67d" />
                          <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
                          <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ecb22e" />
                          <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
                        </svg>
                        Contact
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add-component modal — UI concept only. Shows what wiring a custom
          component into the Home Feed could look like (paste code, pick a
          slot); "Add to Home Feed" just closes the modal, no feed mutation. */}
      {addComponentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          style={{ backdropFilter: 'blur(4px)' }}
          onClick={() => setAddComponentModalOpen(false)}
        >
          <div
            className="w-[480px] max-w-[calc(100vw-2rem)] flex flex-col gap-5 rounded-2xl bg-[#0c1226] border border-[#CCCCCC]/35 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-semibold leading-[24px] text-white">Add component to Home Feed</p>
              <button
                onClick={() => setAddComponentModalOpen(false)}
                aria-label="Close"
                className="h-7 w-7 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-[14px] leading-[20px] text-white/45">
              Paste a component and choose where it slots into the feed. This is a concept of the flow only — nothing is actually added.
            </p>

            <div>
              <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1.5">
                Insert after
              </p>
              <select
                value={addComponentSlot}
                onChange={(e) => setAddComponentSlot(Number(e.target.value))}
                className="w-full rounded-lg bg-white/5 border border-[#CCCCCC]/35 px-3 py-2 text-[14px] text-white"
              >
                {FRAMES.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#0c1226]">
                    {f.id}. {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[14px] uppercase tracking-[0.08em] leading-[20px] text-white/40 font-medium mb-1.5">
                Component code
              </p>
              <textarea
                value={addComponentCode}
                onChange={(e) => setAddComponentCode(e.target.value)}
                placeholder={'<YourComponent />'}
                rows={8}
                spellCheck={false}
                className="w-full rounded-lg bg-white/5 border border-[#CCCCCC]/35 px-3 py-2 text-[13px] font-mono text-white/80 placeholder:text-white/25 resize-none focus:outline-none focus:border-white/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setAddComponentModalOpen(false)}
                className="px-3.5 py-2 rounded-full text-[14px] font-medium leading-[20px] text-white/70 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAddComponentModalOpen(false)
                  setAddComponentCode('')
                }}
                className="px-3.5 py-2 rounded-full bg-white text-black text-[14px] font-medium leading-[20px] hover:bg-white/90 transition"
              >
                Add to Home Feed
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </NavContext.Provider>
  )
}
