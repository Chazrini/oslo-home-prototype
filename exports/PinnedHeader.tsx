// ---------------------------------------------------------------------------
// Pinned Header (Status Bar + Search Bar) — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (StatusBar + SearchBell,
// rendered once at the PhoneShell level). This file has no dependency on
// the rest of that app — drop it into another React + Tailwind project
// as-is.
//
// HOW THE SCROLL BEHAVIOR ACTUALLY WORKS (read this before wiring it up):
//
// The header does NOT hide, shrink, or fade on scroll — it's simply not
// part of the scrolling content. There is no scroll listener anywhere in
// this component. The trick is purely structural:
//
//   <div className="relative">                    <- positioning context
//     <div className="overflow-y-auto ...">        <- the ONLY scroll container
//       <div style={{ height: 116 }} />             <- spacer (see below)
//       ...scrolling feed content...
//     </div>
//     <PinnedHeader />                              <- position: absolute,
//   </div>                                             sits ABOVE the scroll
//                                                       container in the
//                                                       z-stack, so it never
//                                                       moves as the content
//                                                       underneath scrolls.
//
// `PinnedHeader` below renders with `position: absolute; top: 0; left: 0;
// right: 0; z-index: 30`, exactly like the source app's `<StatusBar fixed />`
// + `<SearchBell fixed />`. Because it's absolutely positioned, it's removed
// from normal layout flow — so the scroll container needs an empty spacer
// div (116px — the header's total height) at the very top of its content,
// or the first real card will render underneath the header instead of
// below it. This export's total header height is 60 (status bar) + 56
// (search bar) = 116px, matching the spacer used in the source app.
//
// The bottom nav follows the identical pattern (see BottomNav.tsx from this
// same export batch): render it as a sibling of the scroll container,
// absolutely positioned to the bottom of the shared `relative` wrapper — no
// spacer needed there since content is allowed to scroll underneath it and
// the nav uses a translucent glass background instead of a solid one.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. No fonts, images, or icons needed — every glyph (signal bars, wifi,
//    battery, sparkle, bell) is inline SVG.
//
// 2. `font-text` is used for the search placeholder label. If the target
//    project doesn't define this Tailwind class, delete it and let the
//    text fall back to your project's default font.
//
// 3. This assumes a dark background — the glass material
//    (`backdropFilter: blur(28px) saturate(180%)`) is translucent white and
//    needs real content scrolling behind it to read correctly; it's
//    invisible over a flat/solid background.
// ---------------------------------------------------------------------------

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
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

// iOS status bar — time + signal/wifi/battery glyphs. Purely decorative,
// no live clock.
const StatusBar = () => (
  <div
    className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between pointer-events-none"
    style={{
      height: 60, // iOS status bar with Dynamic Island
      paddingLeft: 28,
      paddingRight: 28,
      color: '#fff',
      fontSize: 17,
      fontWeight: 600,
      letterSpacing: '-0.4px',
      lineHeight: 1,
      background: 'transparent',
    }}
  >
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</span>
    <div className="flex items-center" style={{ gap: 5 }}>
      <svg viewBox="0 0 17 11" width="17" height="11" aria-hidden="true">
        <rect x="0" y="7" width="3" height="4" rx="1" fill="white" />
        <rect x="4.5" y="5" width="3" height="6" rx="1" fill="white" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="white" />
        <rect x="13.5" y="0" width="3" height="11" rx="1" fill="white" />
      </svg>
      <svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true">
        <path d="M8 10.4a1.05 1.05 0 1 0 0-2.1 1.05 1.05 0 0 0 0 2.1z" fill="white" />
        <path
          d="M2.4 6.2a8 8 0 0 1 11.2 0M4.6 8.4a5 5 0 0 1 6.8 0M.4 4.1a11 11 0 0 1 15.2 0"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="relative" style={{ width: 27, height: 12 }}>
        <div
          className="absolute"
          style={{ inset: 0, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4 }}
        />
        <div
          className="absolute"
          style={{ top: 2, bottom: 2, left: 2, right: 4, background: '#fff', borderRadius: 2 }}
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

// Search bar + notification bell — iOS "Liquid Glass" treatment (heavy
// backdrop blur + saturation boost, translucent fill, hairline border
// highlight). Sits flush under the status bar.
const SearchBar = ({ onSearch, onNotifications }: { onSearch?: () => void; onNotifications?: () => void }) => {
  const GLASS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 0.5px rgba(255,255,255,0.18), 0 1px 3px rgba(0,0,0,0.18)',
  }
  return (
    <div
      className="absolute left-0 right-0 z-30"
      style={{
        top: 54, // flush under the status bar (54 = iOS status-bar bottom)
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 6,
        paddingBottom: 10,
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSearch}
          className="flex-1 flex items-center gap-2 rounded-full px-4 text-left"
          style={{ ...GLASS, height: 40 }}
        >
          <SparkleIcon />
          <span className="text-white/85 text-[15px] font-text">Search or ask questions</span>
        </button>
        <button
          type="button"
          onClick={onNotifications}
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

// Total header height (status bar 60 + search bar 56) — use this to size
// the spacer at the top of your scroll container's content, matching the
// source app's convention exactly.
export const PINNED_HEADER_HEIGHT = 116

export const PinnedHeader = ({
  onSearch,
  onNotifications,
}: {
  /** Called when the search field is tapped. No-op if omitted. */
  onSearch?: () => void
  /** Called when the bell icon is tapped. No-op if omitted. */
  onNotifications?: () => void
}) => (
  <>
    <StatusBar />
    <SearchBar onSearch={onSearch} onNotifications={onNotifications} />
  </>
)
