// ---------------------------------------------------------------------------
// NBA List — standalone export
//
// Extracted from oslo-home-prototype/src/App.tsx (ExtraPoints — Figma node
// Card.NBA.List, 15:371, "Extra points. Limited time."). This file has no
// dependency on the rest of that app — drop it into another React +
// Tailwind project as-is.
//
// REQUIRED SETUP IN THE TARGET PROJECT:
//
// 1. Fonts — the header uses `font-display` (PayPal Pro Black, weight 900).
//    Row text uses the plain default body font (no `font-text` class here,
//    unlike the other exported components) — if the target project's
//    default font differs from "Plain", row text sizing may look slightly
//    off since it was tuned against Plain's metrics.
//
// 2. Images — copy these 4 files from oslo-home-prototype/public/images/
//    into the target project's public dir (paths below assume they land at
//    the same /images/... path; update IMAGE_BASE if you place them
//    elsewhere):
//      brand-uniqlo.png   brand-ultabeauty.png
//      brand-hm.png       brand-apple.png
//
// 3. No drag/carousel behavior — this is a static 4-row list, not a
//    swipeable component. Each row's "Shop" button is decorative in the
//    source app; this export adds an optional `onShop(index)` prop so you
//    can wire it up if the target prototype needs it.
// ---------------------------------------------------------------------------

const IMAGE_BASE = '/images'

type NbaListRow = {
  back: string
  src: string
  bg?: string
  inset?: string
}

// Outer 370×397 with solid dark-navy fill. Inner Card.List (338×291) holds
// 4 row blocks, each 338×72 with a translucent grey fill — 1px gap between
// rows lets the navy outer background show through as the divider. First
// row gets rounded top corners, last row gets rounded bottom corners.
const ROWS: NbaListRow[] = [
  { back: '5% back', src: `${IMAGE_BASE}/brand-uniqlo.png`, bg: '#ec1d24', inset: '12.5%' },
  { back: '3% back', src: `${IMAGE_BASE}/brand-ultabeauty.png` },
  { back: '2% back', src: `${IMAGE_BASE}/brand-hm.png` },
  { back: '5% back', src: `${IMAGE_BASE}/brand-apple.png` },
]

export const NbaList = ({ onShop }: { onShop?: (index: number) => void }) => {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 370,
        height: 397,
        margin: '0 auto',
        borderRadius: 24,
        background: 'rgb(16, 26, 51)',
      }}
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
        {ROWS.map((r, i) => {
          const isFirst = i === 0
          const isLast = i === ROWS.length - 1
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
                  onClick={() => onShop?.(i)}
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
  )
}
