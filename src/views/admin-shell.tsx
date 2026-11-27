/** The admin page frame (side menu) and Libya-time helpers, shared by admin.tsx and admin-r1.tsx. */
import type { Child } from 'hono/jsx'
import { V } from './layout'
import { assetPath } from '../lib/assets'

/** D1 stores UTC ('2026-11-24 13:05:00'); the team reads Libya time. */
const libyaFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
export const libyaTime = (utc: string | number) => {
  const d = new Date(String(utc).replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? String(utc) : libyaFmt.format(d)
}


/** Libya time ('2026-12-24T08:00' from a datetime-local box) → D1 UTC text, and back. Africa/Tripoli is UTC+2 with no summer time, but the offset is read from the time zone database anyway. */
const tzOffsetMin = (ms: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tripoli', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 60000
}
export function libyaToUtc(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(local || '').trim())
  if (!m) return null
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  const ms = asUtc - tzOffsetMin(asUtc) * 60000
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}
export function utcToLibyaInput(utc: string): string {
  if (!utc) return ''
  const ms = Date.parse(utc.replace(' ', 'T') + 'Z')
  if (Number.isNaN(ms)) return ''
  return new Date(ms + tzOffsetMin(ms) * 60000).toISOString().slice(0, 16)
}

export const Shell = ({ title, children, nav }: { title: string; children: Child; nav?: string }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex, nofollow" />
      <title>{title} · Salford Admin</title>
      <link rel="icon" type="image/png" href="/static/brand/favicon-48.png" />
      <link rel="stylesheet" href={assetPath('admin.css', V)} />
    </head>
    <body>
      {nav !== undefined ? (
        <div class="a-wrap">
          <nav class="a-side" aria-label="Admin">
            <img class="a-logo" src="/static/brand/word-white.webp" alt="Salford" width="480" height="127" />
            <a href="/admin" class={nav === 'products' ? 'on' : ''}>Products</a>
            <a href="/admin/orders" class={nav === 'orders' ? 'on' : ''}>Orders</a>
            <a href="/admin/customers" class={nav === 'customers' ? 'on' : ''}>Customers</a>
            <a href="/admin/offers" class={nav === 'offers' ? 'on' : ''}>Offers</a>
            <a href="/admin/codes" class={nav === 'codes' ? 'on' : ''}>Discount codes</a>
            <a href="/admin/delivery" class={nav === 'delivery' ? 'on' : ''}>Delivery</a>
            <a href="/admin/reviews" class={nav === 'reviews' ? 'on' : ''}>Reviews</a>
            <a href="/admin/waitlist" class={nav === 'waitlist' ? 'on' : ''}>Waiting list</a>
            <a href="/admin/trust" class={nav === 'trust' ? 'on' : ''}>Trust page</a>
            <a href="/admin/settings" class={nav === 'settings' ? 'on' : ''}>Settings</a>
            <a href="/ar/" target="_blank" rel="noopener">View site ↗</a>
            <form method="post" action="/admin/logout"><button class="linkbtn" type="submit">Log out</button></form>
          </nav>
          <main class="a-main">{children}</main>
        </div>
      ) : (
        <main class="a-center">{children}</main>
      )}
      <div class="toast" role="status" aria-live="polite" hidden></div>
      <script src={assetPath('admin.js', V)} defer></script>
    </body>
  </html>
)

