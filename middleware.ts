// Vercel Edge Middleware — gates the entire prototype behind a custom,
// on-brand password screen (single password field, no username). Unlike
// HTTP Basic Auth, this lets us style the gate to match the prototype.
//
// Flow:
//   • No auth cookie  → serve the styled password page (200).
//   • POST password   → if correct, set an HttpOnly auth cookie + redirect
//                        into the app; if wrong, re-serve the page w/ error.
//   • Valid cookie    → fall through so the real app is served.
//
// Password: set a `SITE_PASSWORD` env var in Vercel to override the
// fallback below. The username is irrelevant — there's only a password.
export const config = {
  // Gate the app entry (HTML routes) but NOT static assets. Excluding
  // the Vite/`public` static dirs — assets (JS/CSS), images, fonts — and
  // Vercel internals + favicon means those load unconditionally. The gate
  // still protects the app: an unauthenticated visitor gets the login
  // page at "/" and never receives index.html to bootstrap the bundle.
  // (Previously /images was gated, so product images intermittently
  // returned the login HTML instead of the PNG — broken images.)
  matcher: '/((?!_vercel|assets|images|fonts|favicon\\.ico).*)',
}

const PASSWORD = process.env.SITE_PASSWORD || 'Pass'
const COOKIE = 'hfpp_gate'
// Opaque token stored in the cookie once the password is verified — never
// the password itself.
const TOKEN = 'granted-9f2c7a4e1b6d8051'

const page = (error: boolean) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<title>PayPal — Enter password</title>
<style>
  @font-face { font-family:'PayPal Pro'; src:url('/fonts/PayPalPro-Black.otf') format('opentype'); font-weight:900; font-display:swap; }
  @font-face { font-family:'Plain'; src:url('/fonts/Plain-Regular.otf') format('opentype'); font-weight:400; font-display:swap; }
  @font-face { font-family:'Plain'; src:url('/fonts/Plain-Medium.otf') format('opentype'); font-weight:500 700; font-display:swap; }
  * { box-sizing:border-box; }
  html, body { height:100%; margin:0; }
  body {
    background:#0b0f1a; color:#fff;
    font-family:'Plain',-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;
    display:flex; align-items:center; justify-content:center;
    min-height:100svh; position:relative; overflow:hidden;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  }
  /* Ambient L0 blue glow — mirrors the prototype's top-of-viewport glow. */
  body::before {
    content:''; position:absolute; left:50%; top:-12%; transform:translateX(-50%);
    width:130%; height:62%; pointer-events:none;
    background:radial-gradient(ellipse 72% 55% at 50% 0%, rgba(26,96,255,0.5), rgba(12,74,210,0.24) 42%, rgba(7,14,30,0) 70%);
    filter:blur(22px);
  }
  .card { position:relative; width:340px; max-width:88vw; text-align:center; }
  .logo { width:46px; height:auto; display:block; margin:0 auto 22px; }
  h1 { font-family:'PayPal Pro','Plain',system-ui,sans-serif; font-weight:900; font-size:26px; letter-spacing:-0.02em; margin:0 0 8px; }
  p.sub { margin:0 0 28px; font-size:15px; line-height:22px; color:rgba(255,255,255,0.6); }
  form { display:flex; flex-direction:column; gap:12px; }
  input { width:100%; height:52px; border-radius:26px; background:rgba(255,255,255,0.08);
    border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:16px; font-family:inherit;
    padding:0 20px; outline:none; transition:border-color .15s ease, background .15s ease; }
  input::placeholder { color:rgba(255,255,255,0.45); }
  input:focus { border-color:rgba(0,112,224,0.85); background:rgba(255,255,255,0.12); }
  button { width:100%; height:52px; border-radius:26px; border:none; cursor:pointer;
    background:#0070E0; color:#fff; font-size:16px; font-weight:500; font-family:inherit;
    transition:background .15s ease, transform .08s ease; }
  button:hover { background:#0064c8; }
  button:active { transform:scale(0.99); }
  .error { min-height:18px; margin:6px 0 0; font-size:13px; line-height:18px; color:#ef9b9e; }
</style>
</head>
<body>
  <div class="card">
    <svg class="logo" viewBox="0 0 13.695 16.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11.6813 3.795C11.6813 5.83875 9.795 8.25 6.94125 8.25H4.1925L4.0575 9.10125L3.41625 13.2H0L2.055 0H7.59C9.45375 0 10.92 1.03875 11.46 2.4825C11.6138 2.89125 11.6888 3.33375 11.6813 3.795Z" fill="#002991"/>
      <path d="M13.6486 7.58992C13.2698 9.87742 11.3011 11.5499 8.97234 11.5499H7.06359L6.26859 16.4999H2.87109L3.41484 13.1999L4.05609 9.10117L4.19109 8.24992H6.93984C9.78984 8.24992 11.6798 5.83867 11.6798 3.79492C13.0823 4.51867 13.8998 5.98117 13.6486 7.58992Z" fill="#60CDFF"/>
      <path d="M11.6802 3.79505C11.0914 3.48755 10.3789 3.30005 9.60266 3.30005H4.96766L4.19141 8.25005H6.94016C9.79016 8.25005 11.6802 5.8388 11.6802 3.79505Z" fill="#008CFF"/>
    </svg>
    <h1>PayPal</h1>
    <p class="sub">This prototype is private.<br/>Enter the password to continue.</p>
    <form method="POST" action="/">
      <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password" aria-label="Password" />
      <button type="submit">Continue</button>
      <p class="error">${error ? 'Incorrect password. Please try again.' : ''}</p>
    </form>
  </div>
</body>
</html>`

const loginResponse = (error: boolean) =>
  new Response(page(error), {
    status: error ? 401 : 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })

export default async function middleware(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const authed = cookie
    .split(';')
    .some((c) => c.trim() === `${COOKIE}=${TOKEN}`)
  if (authed) return // already unlocked → serve the app

  // Password submission from the gate page.
  if (request.method === 'POST') {
    const form = await request.formData()
    const submitted = form.get('password')
    if (typeof submitted === 'string' && submitted === PASSWORD) {
      return new Response(null, {
        status: 303,
        headers: {
          // SESSION cookie (no Max-Age / Expires): the browser caches it
          // only for the current session, so the password is required
          // again on a fresh open / new session, but never re-prompts
          // while the user is actively browsing (it's cached on their end).
          'set-cookie': `${COOKIE}=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax`,
          location: '/',
          'cache-control': 'no-store',
        },
      })
    }
    return loginResponse(true) // wrong password → re-show with error
  }

  // Any other unauthenticated request → the gate page.
  return loginResponse(false)
}
