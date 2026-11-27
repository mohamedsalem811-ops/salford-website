/**
 * Release 4 admin: who to message for an offer (early access link for returning customers, "Remind me" list), the report
 * after an offer, the occasions calendar (with a reminder on the admin home) and the Instagram story/post image maker.
 * The offer form itself (levels, flash deals, gift, coming soon, early access) is in admin-r1.tsx.
 */
import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { fmtLyd } from '../lib/db'
import type { Offer } from '../lib/pricing'
import { utcNow, shiftUtc, parseScope, parseTiers, inScope } from '../lib/pricing'
import { FLASH_SQL } from '../lib/catalog'
import { LOOKS, LOOK_IDS, lookOf, offerWords } from '../lib/looks'
import { waCustomer } from '../lib/orders'
import type { Lang } from '../lib/i18n'
import { Shell, libyaTime, libyaToUtc, utcToLibyaInput } from '../views/admin-shell'

type Vars = { admin: { id: number; email: string } }
export const r4Pages = new Hono<{ Bindings: Env; Variables: Vars }>()
export const r4Api = new Hono<{ Bindings: Env; Variables: Vars }>()

const SITE = 'https://salfordlibya.com'
const DAY = 86400000
const msOf = (utc: string) => Date.parse(utc.replace(' ', 'T') + 'Z')
const utcOf = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const libyaDay = (utc = utcNow()) => utcToLibyaInput(utc).slice(0, 10)
/** "24 December, 00:00" / "24 ديسمبر، 00:00" in Libya time. */
export const fmtWhen = (utc: string, lang: Lang, time = true) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LY-u-nu-latn' : 'en-GB', {
    timeZone: 'Africa/Tripoli', day: 'numeric', month: 'long', ...(time ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(new Date(msOf(utc)))
const offerName = (o: Offer, lang: Lang) => offerWords(o, lang).name
const loadOffer = (db: D1Database, id: number) => db.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first<Offer>()

/* =====================================================================
   Messages
   ===================================================================== */

export function earlyMessage(lang: Lang, v: { name: string; offer: string; starts: string; hours: number; link: string }) {
  return lang === 'en'
    ? `Hello ${v.name}, thank you for shopping with Salford. Our ${v.offer} offer opens on ${v.starts} (Libya time), and as one of our customers you can shop it ${v.hours} hours before everyone else with this private link:\n${v.link}\nSalford Libya`
    : `مرحباً ${v.name} 🌸\nشكراً لأنك من عملاء سالفورد. عرض ${v.offer} يبدأ يوم ${v.starts} (بتوقيت ليبيا)، ولك دخول مبكر قبل الجميع بـ ${v.hours} ساعة من هذا الرابط الخاص:\n${v.link}\nسالفورد ليبيا`
}
export function startedMessage(lang: Lang, v: { name: string; offer: string; link: string }) {
  return lang === 'en'
    ? `Hello ${v.name}, you asked us to remind you: our ${v.offer} offer has started ✨\n${v.link}\nSalford Libya`
    : `مرحباً ${v.name}، طلبت منا نذكّرك: عرض ${v.offer} بدأ الآن ✨\n${v.link}\nسالفورد ليبيا`
}

/* =====================================================================
   Reminders and early access for one offer
   ===================================================================== */

type Customer = { phone: string; name: string; lang: string; n: number; last: string; sent_at: string | null }
type Reminder = { id: number; name: string; phone: string; lang: string; created_at: string; notified_at: string | null }

r4Pages.get('/offers/:id{[0-9]+}/people', async (c) => {
  const db = c.env.DB
  const o = await loadOffer(db, Number(c.req.param('id')))
  if (!o) return c.redirect('/admin/offers')
  const now = utcNow()
  const [cust, rem] = await Promise.all([
    db.prepare(`SELECT o.phone,
        (SELECT x.name FROM orders x WHERE x.phone = o.phone ORDER BY x.id DESC LIMIT 1) AS name,
        (SELECT x.lang FROM orders x WHERE x.phone = o.phone ORDER BY x.id DESC LIMIT 1) AS lang,
        count(*) AS n, max(o.created_at) AS last, s.sent_at
      FROM orders o LEFT JOIN offer_early_sent s ON s.offer_id = ? AND s.phone = o.phone
      WHERE o.status = 'delivered' GROUP BY o.phone ORDER BY last DESC LIMIT 500`).bind(o.id).all<Customer>(),
    db.prepare('SELECT id, name, phone, lang, created_at, notified_at FROM offer_reminders WHERE offer_id = ? ORDER BY id').bind(o.id).all<Reminder>(),
  ])
  const early = (o.early_hours ?? 0) > 0 && !!o.starts_at && !!o.early_token
  const earlyOpen = early ? shiftUtc(o.starts_at, -(o.early_hours ?? 0)) : ''
  const started = !o.starts_at || o.starts_at <= now
  const ended = !!o.ends_at && o.ends_at <= now
  const name = o.name_en || lookOf(o.template).occasion.en
  const toSend = cust.results.filter((r) => !r.sent_at).length
  return c.html(
    <Shell title={`Reminders · ${name}`} nav="offers">
      <div class="a-head"><h1>Reminders and early access · <span dir="auto">{name}</span></h1><a class="a-btn" href={`/admin/offers/${o.id}`}>Back to the offer</a></div>
      <p class="a-muted">Sending opens WhatsApp with the message ready in the customer’s language. Press send in WhatsApp, then come back: the person is marked “Sent”.</p>

      <section class="a-card">
        <h2>Early access link {early ? <span class="tag ok">On</span> : <span class="tag">Off</span>}</h2>
        {early ? (
          <>
            <p class="a-muted">Opens the offer <b>{o.early_hours} hours</b> before everyone else: from <b>{libyaTime(earlyOpen)}</b> (start for everyone: {libyaTime(o.starts_at)}). Only people with the link see it early; the strip on the site says “Early access”.
              To stop old links working, tick “Make a new early access link” on the offer and save.</p>
            {(['ar', 'en'] as const).map((l) => {
              const link = `${SITE}/${l}/?early=${o.early_token}`
              return <p><code dir="ltr">{link}</code> <button class="a-btn sm" type="button" data-copy={link}>Copy ({l === 'ar' ? 'Arabic' : 'English'})</button></p>
            })}
          </>
        ) : <p class="a-muted">Set “Early access link: hours before the start” on the offer (for example 24) and a start time, then save.</p>}
      </section>

      {early ? (
        <section class="a-card">
          <h2>Returning customers <span class="a-muted">({cust.results.length} with a delivered order · {toSend} not sent yet)</span></h2>
          {ended ? <p class="a-muted">This offer has ended.</p> : null}
          {cust.results.length ? (
            <div class="a-table-wrap"><table class="a-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Last order</th><th>Message</th></tr></thead>
              <tbody>{cust.results.map((r) => {
                const lang: Lang = r.lang === 'en' ? 'en' : 'ar'
                const msg = earlyMessage(lang, { name: r.name, offer: offerName(o, lang), starts: fmtWhen(o.starts_at, lang), hours: o.early_hours ?? 0, link: `${SITE}/${lang}/?early=${o.early_token}` })
                return (
                  <tr>
                    <td><bdi>{r.name}</bdi><br /><span class="a-muted">{lang === 'en' ? 'English' : 'Arabic'}</span></td>
                    <td dir="ltr">{r.phone}</td>
                    <td class="num">{r.n}</td>
                    <td class="c-date">{libyaTime(r.last)}</td>
                    <td>
                      <a class={`a-btn${r.sent_at ? '' : ' p'}`} href={waCustomer(r.phone, msg)} target="_blank" rel="noopener" data-early-sent={`${o.id}:${r.phone}`}>{r.sent_at ? 'Send again' : 'Send on WhatsApp'}</a>
                      {r.sent_at ? <><br /><span class="tag ok">Sent {libyaTime(r.sent_at)}</span></> : null}
                    </td>
                  </tr>
                )
              })}</tbody>
            </table></div>
          ) : <p class="a-muted">No delivered orders yet, so no returning customers to message.</p>}
        </section>
      ) : null}

      <section class="a-card">
        <h2>“Remind me” list <span class="a-muted">({rem.results.length})</span> {(o.teaser_days ?? 0) > 0 ? <span class="tag ok">Coming soon page on</span> : <span class="tag">Coming soon page off</span>}</h2>
        <p class="a-muted">People who pressed “Remind me” on the coming soon page{(o.teaser_days ?? 0) > 0 && o.starts_at ? <> (shown from {libyaTime(shiftUtc(o.starts_at, -(o.teaser_days ?? 0) * 24))})</> : null}. The Send buttons appear when the offer starts. Entries are deleted after 90 days.</p>
        {rem.results.length ? (
          <div class="a-table-wrap"><table class="a-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Joined</th><th>Message</th><th></th></tr></thead>
            <tbody>{rem.results.map((r) => {
              const lang: Lang = r.lang === 'en' ? 'en' : 'ar'
              const msg = startedMessage(lang, { name: r.name, offer: offerName(o, lang), link: `${SITE}/${lang}/shop` })
              return (
                <tr>
                  <td><bdi>{r.name}</bdi><br /><span class="a-muted">{lang === 'en' ? 'English' : 'Arabic'}</span></td>
                  <td dir="ltr">{r.phone}</td>
                  <td class="c-date">{libyaTime(r.created_at)}</td>
                  <td>
                    {started && !ended
                      ? <a class={`a-btn${r.notified_at ? '' : ' p'}`} href={waCustomer(r.phone, msg)} target="_blank" rel="noopener" data-rm-sent={r.id}>{r.notified_at ? 'Send again' : 'Send on WhatsApp'}</a>
                      : <span class="a-muted">{ended ? 'Offer ended' : `Send when it starts (${libyaTime(o.starts_at)})`}</span>}
                    {r.notified_at ? <><br /><span class="tag ok">Sent {libyaTime(r.notified_at)}</span></> : null}
                  </td>
                  <td><button class="a-btn" type="button" data-rm-del={r.id}>Remove</button></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        ) : <p class="a-muted">Nobody yet.</p>}
      </section>
    </Shell>,
  )
})

r4Api.post('/offers/:id{[0-9]+}/early-sent', async (c) => {
  let b: Record<string, unknown>
  try { b = await c.req.json() } catch { return c.json({ error: 'Bad request' }, 400) }
  const phone = String(b.phone ?? '').trim()
  if (!/^\+?[0-9]{6,15}$/.test(phone)) return c.json({ error: 'Bad phone' }, 400)
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare("INSERT INTO offer_early_sent (offer_id, phone) SELECT id, ? FROM offers WHERE id = ? ON CONFLICT(offer_id, phone) DO UPDATE SET sent_at = datetime('now')").bind(phone, id).run()
  return c.json({ ok: true })
})
r4Api.post('/reminders/:id{[0-9]+}/sent', async (c) => {
  await c.env.DB.prepare("UPDATE offer_reminders SET notified_at = datetime('now') WHERE id = ?").bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})
r4Api.delete('/reminders/:id{[0-9]+}', async (c) => {
  await c.env.DB.prepare('DELETE FROM offer_reminders WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

/* =====================================================================
   Report after an offer
   ===================================================================== */

type Totals = { n: number; cancelled: number; delivered: number; revenue: number; disc: number; with_offer: number; gifts: number; early: number; codes: number; delivery: number }
const totalsSql = `SELECT count(*) AS n,
    coalesce(sum(status = 'cancelled'), 0) AS cancelled,
    coalesce(sum(status = 'delivered'), 0) AS delivered,
    coalesce(sum(CASE WHEN status != 'cancelled' THEN subtotal - discount_total END), 0) AS revenue,
    coalesce(sum(CASE WHEN status != 'cancelled' THEN discount_total END), 0) AS disc,
    coalesce(sum(status != 'cancelled' AND offer_id = ?), 0) AS with_offer,
    coalesce(sum(status != 'cancelled' AND gift != ''), 0) AS gifts,
    coalesce(sum(status != 'cancelled' AND early = 1), 0) AS early,
    coalesce(sum(status != 'cancelled' AND code != ''), 0) AS codes,
    coalesce(sum(CASE WHEN status != 'cancelled' THEN delivery_fee END), 0) AS delivery
  FROM orders WHERE created_at >= ? AND created_at < ?`

r4Pages.get('/offers/:id{[0-9]+}/report', async (c) => {
  const db = c.env.DB
  const o = await loadOffer(db, Number(c.req.param('id')))
  if (!o) return c.redirect('/admin/offers')
  const now = utcNow()
  const start = shiftUtc(o.starts_at || o.created_at, -(o.early_hours ?? 0))
  // still running: up to the end of this second, so an order placed this very second counts
  const end = o.ends_at && o.ends_at < now ? o.ends_at : utcOf(msOf(now) + 1000)
  const name = o.name_en || lookOf(o.template).occasion.en
  const head = (
    <div class="a-head"><h1>Report · <span dir="auto">{name}</span></h1>
      <div class="a-btns"><a class="a-btn" href={`/admin/offers/${o.id}`}>Back to the offer</a><a class="a-btn" href="/admin/offers">All offers</a></div></div>
  )
  if (start > now) {
    return c.html(<Shell title={`Report · ${name}`} nav="offers">{head}<div class="a-card"><p class="a-muted">This offer has not started yet ({libyaTime(start)}). The report fills in while it runs.</p></div></Shell>)
  }
  const len = msOf(end) - msOf(start)
  const prevStart = utcOf(msOf(start) - len)
  const [cur, prev, top, flash, rem, sent] = await Promise.all([
    db.prepare(totalsSql).bind(o.id, start, end).first<Totals>(),
    db.prepare(totalsSql).bind(o.id, prevStart, start).first<Totals>(),
    db.prepare(`SELECT i.product_id, max(i.code) AS code, max(i.brand) AS brand, max(i.name) AS name, sum(i.qty) AS qty, sum(i.price * i.qty) AS value
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.status != 'cancelled' AND i.is_gift = 0
      GROUP BY i.product_id ORDER BY qty DESC, value DESC LIMIT 10`).bind(start, end).all<{ product_id: number; code: string; brand: string; name: string; qty: number; value: number }>(),
    db.prepare(`SELECT x.*, p.code, p.price AS normal FROM (${FLASH_SQL} WHERE f.offer_id = ?) x LEFT JOIN products p ON p.id = x.product_id ORDER BY x.sort, x.id`).bind(o.id)
      .all<{ id: number; product_id: number; price: number; max_qty: number; sold: number; code: string | null; normal: number | null }>(),
    db.prepare('SELECT count(*) AS n, coalesce(sum(notified_at IS NOT NULL), 0) AS sent FROM offer_reminders WHERE offer_id = ?').bind(o.id).first<{ n: number; sent: number }>(),
    db.prepare('SELECT count(*) AS n FROM offer_early_sent WHERE offer_id = ?').bind(o.id).first<{ n: number }>(),
  ])
  const k = cur!, p = prev!
  const live = k.n - k.cancelled, plive = p.n - p.cancelled
  const avg = live ? Math.round(k.revenue / live) : 0, pavg = plive ? Math.round(p.revenue / plive) : 0
  const change = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : a ? 'new' : '—')
  const Row = ({ label, a, b, money }: { label: string; a: number; b: number; money?: boolean }) => (
    <tr><td>{label}</td><td class="num"><b>{money ? `${fmtLyd(a)} LYD` : a}</b></td><td class="num">{money ? `${fmtLyd(b)} LYD` : b}</td><td class="num">{change(a, b)}</td></tr>
  )
  return c.html(
    <Shell title={`Report · ${name}`} nav="offers">
      {head}
      <p class="a-muted">From <b>{libyaTime(start)}</b> to <b>{libyaTime(end)}</b>{end > now ? ' (still running: the numbers grow until it ends)' : ''}{o.early_hours ? `, including the ${o.early_hours} early access hours` : ''}.
        Compared with the same length of time just before ({libyaTime(prevStart)} → {libyaTime(start)}). Sales = products after the discount, without delivery; cancelled orders are not counted.</p>
      <div class="a-stats">
        <div><b>{live}</b>orders</div>
        <div><b>{fmtLyd(k.revenue)} LYD</b>sales</div>
        <div><b>{fmtLyd(k.disc)} LYD</b>discount given</div>
        <div><b>{fmtLyd(avg)} LYD</b>average order</div>
      </div>
      <section class="a-card">
        <h2>Compared with before</h2>
        <div class="a-table-wrap"><table class="a-table">
          <thead><tr><th></th><th>During the offer</th><th>Before</th><th>Change</th></tr></thead>
          <tbody>
            <Row label="Orders (not cancelled)" a={live} b={plive} />
            <Row label="Sales" a={k.revenue} b={p.revenue} money />
            <Row label="Average order" a={avg} b={pavg} money />
            <Row label="Discount given" a={k.disc} b={p.disc} money />
            <Row label="Delivered so far" a={k.delivered} b={p.delivered} />
            <Row label="Cancelled" a={k.cancelled} b={p.cancelled} />
          </tbody>
        </table></div>
      </section>
      <section class="a-card">
        <h2>This offer</h2>
        <ul class="a-list">
          <li>Orders that got this offer’s saving (a %, a flash price or the gift): <b>{k.with_offer}</b></li>
          <li>Orders with a discount code instead (the code was better): <b>{k.codes}</b></li>
          {o.gift_product_id ? <li>Orders with the free gift: <b>{k.gifts}</b></li> : null}
          {o.early_hours ? <li>Orders placed with the early access link: <b>{k.early}</b> · early access messages sent: <b>{sent!.n}</b></li> : null}
          {o.teaser_days || rem!.n ? <li>“Remind me” sign-ups: <b>{rem!.n}</b> · reminded: <b>{rem!.sent}</b></li> : null}
          {o.free_delivery ? <li>Delivery charged on these orders: <b>{fmtLyd(k.delivery)} LYD</b> (free delivery was on)</li> : null}
        </ul>
      </section>
      {flash.results.length ? (
        <section class="a-card">
          <h2>Flash deals</h2>
          <div class="a-table-wrap"><table class="a-table">
            <thead><tr><th>Product</th><th>Normal</th><th>Flash</th><th>Sold</th><th>Left</th></tr></thead>
            <tbody>{flash.results.map((f) => (
              <tr><td><code>{f.code ?? '—'}</code></td><td class="num">{f.normal === null ? '—' : `${fmtLyd(f.normal)} LYD`}</td><td class="num">{fmtLyd(f.price)} LYD</td>
                <td class="num">{f.sold}{f.max_qty ? ` / ${f.max_qty}` : ''}</td><td class="num">{f.max_qty ? Math.max(0, f.max_qty - f.sold) : 'no limit'}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      ) : null}
      <section class="a-card">
        <h2>Top products</h2>
        {top.results.length ? (
          <div class="a-table-wrap"><table class="a-table">
            <thead><tr><th>Product</th><th>Pieces</th><th>Sales</th></tr></thead>
            <tbody>{top.results.map((r) => (
              <tr><td><a href={`/admin/p/${r.product_id}`}>{r.brand} · {r.name}</a> <code>{r.code}</code></td><td class="num">{r.qty}</td><td class="num">{fmtLyd(r.value)} LYD</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p class="a-muted">No orders yet.</p>}
      </section>
    </Shell>,
  )
})

/* =====================================================================
   Occasions calendar
   ===================================================================== */

type Occasion = { id: number; name_ar: string; name_en: string; day: string; template: string; pct: number; moon: number; remind_days: number; note: string }

/** The switched-on offer that covers an occasion day (from 3 days before to the end of the day), if any. */
async function offersNear(db: D1Database, days: string[]) {
  if (!days.length) return new Map<string, Offer>()
  const { results } = await db.prepare("SELECT * FROM offers WHERE enabled = 1 AND ends_at > ? ORDER BY id DESC").bind(utcOf(Date.now() - 30 * DAY)).all<Offer>()
  const out = new Map<string, Offer>()
  for (const d of days) {
    const from = libyaToUtc(`${d}T00:00`)
    if (!from) continue
    const lo = utcOf(msOf(from) - 3 * DAY), hi = utcOf(msOf(from) + DAY)
    const hit = results.find((o) => (!o.starts_at || o.starts_at < hi) && o.ends_at > lo)
    if (hit) out.set(d, hit)
  }
  return out
}
const daysTo = (day: string, today: string) => Math.round((Date.parse(day) - Date.parse(today)) / DAY)
const newOfferHref = (x: Occasion) => `/admin/offers/new?look=${x.template}&pct=${x.pct}&start=${x.day}`

/** Admin home: occasions coming up within their reminder days that have no offer yet. */
export async function OccasionsDue({ db }: { db: D1Database }) {
  let rows: Occasion[] = []
  try {
    rows = (await db.prepare('SELECT * FROM occasions ORDER BY day').all<Occasion>()).results
  } catch {
    return <></> // before migration 0006
  }
  const today = libyaDay()
  const due = rows.filter((x) => { const n = daysTo(x.day, today); return n >= 0 && n <= x.remind_days })
  if (!due.length) return <></>
  const near = await offersNear(db, due.map((x) => x.day))
  const todo = due.filter((x) => !near.has(x.day))
  if (!todo.length) return <></>
  return (
    <div class="a-card a-sub">
      <h2>Coming up</h2>
      {todo.map((x) => {
        const n = daysTo(x.day, today)
        return (
          <p><b>{x.name_en}</b> <span class="a-muted">· {x.name_ar}</span> — {n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`} ({x.day}{x.moon ? ', moon date: check it' : ''}). No offer yet.{' '}
            <a class="a-btn sm p" href={newOfferHref(x)}>Create the offer</a> <a class="a-btn sm" href="/admin/calendar">Calendar</a></p>
        )
      })}
    </div>
  )
}

r4Pages.get('/calendar', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare('SELECT * FROM occasions ORDER BY day, id').all<Occasion>()
  const today = libyaDay()
  const near = await offersNear(db, results.map((x) => x.day))
  const LookSel = ({ v }: { v: string }) => (
    <select name="template">{LOOK_IDS.map((id) => <option value={id} selected={id === v}>{LOOKS[id].occasion.en}</option>)}</select>
  )
  const Fields = ({ x }: { x: Occasion | null }) => (
    <>
      <label class="a-f">Arabic name<input name="name_ar" dir="rtl" maxlength={60} required value={x?.name_ar ?? ''} /></label>
      <label class="a-f">English name<input name="name_en" maxlength={60} value={x?.name_en ?? ''} /></label>
      <label class="a-f">Date (Libya)<input name="day" type="date" required value={x?.day ?? ''} /></label>
      <label class="a-f">Look<LookSel v={x?.template ?? 'flash'} /></label>
      <label class="a-f">Usual % off<input name="pct" type="number" min="0" max="90" step="1" inputmode="numeric" value={String(x?.pct ?? 15)} /></label>
      <label class="a-f">Remind me (days before)<input name="remind_days" type="number" min="1" max="60" step="1" inputmode="numeric" value={String(x?.remind_days ?? 14)} /></label>
      <label class="a-f">Note<input name="note" maxlength={200} value={x?.note ?? ''} /></label>
      <label class="a-inline"><input type="checkbox" name="moon" checked={!!x?.moon} /> Moon date (changes every year)</label>
    </>
  )
  return c.html(
    <Shell title="Calendar" nav="calendar">
      <div class="a-head"><h1>Occasions calendar</h1></div>
      <p class="a-muted">The products page reminds you before each occasion (by the “Remind me” days) until an offer covers it. “Create the offer” opens a new offer with the look, % and dates filled in.
        Moon dates (Ramadan, the Eids) are approximate: correct them when the date is announced. After an occasion passes, change its date to next year.</p>
      {results.map((x) => {
        const n = daysTo(x.day, today)
        const o = near.get(x.day)
        return (
          <form class="a-card" data-occ={x.id}>
            <h2><span dir="auto">{x.name_en || x.name_ar}</span> <span class="a-muted">· {x.name_ar}</span>{' '}
              {n < 0 ? <span class="tag">Passed: set next year’s date</span> : n === 0 ? <span class="tag ok">Today</span> : <span class={`tag${n <= x.remind_days ? ' warn' : ''}`}>in {n} days</span>}
              {o ? <a class="tag ok" href={`/admin/offers/${o.id}`}>Offer ready</a> : null}</h2>
            <div class="a-grid3"><Fields x={x} /></div>
            <div class="a-btns">
              <button class="a-btn" type="submit">Save</button>
              {o ? null : <a class="a-btn p" href={newOfferHref(x)}>Create the offer</a>}
              <button class="a-btn danger" type="button" data-occ-del={x.id}>Delete</button>
            </div>
          </form>
        )
      })}
      <form class="a-card a-sub" data-occ="0">
        <h2>Add an occasion</h2>
        <div class="a-grid3"><Fields x={null} /></div>
        <button class="a-btn p" type="submit">Add</button>
      </form>
    </Shell>,
  )
})

function occasionOf(b: Record<string, unknown>): Omit<Occasion, 'id'> | { error: string } {
  const s = (k: string, max: number) => String(b[k] ?? '').trim().slice(0, max)
  const name_ar = s('name_ar', 60), name_en = s('name_en', 60), day = s('day', 10), template = s('template', 20), note = s('note', 200)
  const pct = Math.floor(Number(b.pct || 0)), remind_days = Math.floor(Number(b.remind_days || 14))
  if (!name_ar) return { error: 'Type the Arabic name.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { error: 'Choose the date.' }
  if (!(LOOK_IDS as string[]).includes(template)) return { error: 'Choose a look.' }
  if (!(pct >= 0 && pct <= 90)) return { error: 'The % must be from 0 to 90.' }
  if (!(remind_days >= 1 && remind_days <= 60)) return { error: 'Remind days must be from 1 to 60.' }
  return { name_ar, name_en, day, template, pct, moon: b.moon ? 1 : 0, remind_days, note }
}
r4Api.post('/occasions', async (c) => {
  const v = occasionOf(await c.req.json<Record<string, unknown>>().catch(() => ({})))
  if ('error' in v) return c.json(v, 400)
  const r = await c.env.DB.prepare('INSERT INTO occasions (name_ar, name_en, day, template, pct, moon, remind_days, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(v.name_ar, v.name_en, v.day, v.template, v.pct, v.moon, v.remind_days, v.note).first<{ id: number }>()
  return c.json({ ok: true, id: r!.id })
})
r4Api.put('/occasions/:id{[0-9]+}', async (c) => {
  const v = occasionOf(await c.req.json<Record<string, unknown>>().catch(() => ({})))
  if ('error' in v) return c.json(v, 400)
  const r = await c.env.DB.prepare('UPDATE occasions SET name_ar = ?, name_en = ?, day = ?, template = ?, pct = ?, moon = ?, remind_days = ?, note = ? WHERE id = ?')
    .bind(v.name_ar, v.name_en, v.day, v.template, v.pct, v.moon, v.remind_days, v.note, Number(c.req.param('id'))).run()
  return r.meta.changes ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404)
})
r4Api.delete('/occasions/:id{[0-9]+}', async (c) => {
  await c.env.DB.prepare('DELETE FROM occasions WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

/* =====================================================================
   Instagram story and post images
   ===================================================================== */

const hexes = (css: string) => css.match(/#[0-9a-f]{6}\b/gi) ?? []

r4Pages.get('/offers/:id{[0-9]+}/image', async (c) => {
  const db = c.env.DB
  const o = await loadOffer(db, Number(c.req.param('id')))
  if (!o) return c.redirect('/admin/offers')
  const look = lookOf(o.template)
  const v = look.v as Record<string, string>
  // photos: the banner photo, the flash deal pieces, the gift, then pieces in the offer (in stock, on the site)
  const { results: prods } = await db.prepare(`SELECT p.id, p.price, p.compare_price, p.brand_id, p.category_id, p.no_discount,
      (SELECT m.r2_key FROM media m WHERE m.product_id = p.id AND m.kind = 'image' AND m.r2_key IS NOT NULL ORDER BY m.sort, m.id LIMIT 1) AS k,
      (SELECT m.sizes FROM media m WHERE m.product_id = p.id AND m.kind = 'image' AND m.r2_key IS NOT NULL ORDER BY m.sort, m.id LIMIT 1) AS sz
    FROM products p WHERE p.deleted_at IS NULL AND p.status = 'live' AND p.in_stock = 1 ORDER BY p.sort, p.id DESC LIMIT 300`)
    .all<{ id: number; price: number; compare_price: number | null; brand_id: string; category_id: string; no_discount: number; k: string | null; sz: string }>()
  const flash = (await db.prepare('SELECT product_id FROM offer_flash WHERE offer_id = ? ORDER BY sort, id').bind(o.id).all<{ product_id: number }>()).results.map((f) => f.product_id)
  const scope = parseScope(o.scope)
  const order = [o.photo_product_id, ...flash, o.gift_product_id].filter((x): x is number => !!x)
  const pick = [...order.map((id) => prods.find((p) => p.id === id)), ...prods.filter((p) => inScope(p, scope))]
  const photos: string[] = []
  for (const p of pick) {
    if (!p?.k || photos.length >= 3) continue
    let sizes: number[] = []
    try { sizes = (JSON.parse(p.sz || '[]') as number[]).filter((n) => typeof n === 'number').sort((a, b) => a - b) } catch { /* none */ }
    const s = sizes.find((n) => n >= 900) ?? sizes[sizes.length - 1]
    const url = `/m/${p.k}${s ? `-${s}` : ''}`
    if (!photos.includes(url)) photos.push(url)
  }
  const tiers = o.kind === 'tiers' ? parseTiers(o.tiers) : []
  const words = (lang: Lang) => {
    const w = offerWords(o, lang)
    const cur = lang === 'ar' ? 'د.ل' : 'LYD'
    const extras = [
      ...(tiers.length ? [tiers.map((t) => (lang === 'ar' ? `${t.pct}% من ${fmtLyd(t.min)} ${cur}` : `${t.pct}% from ${fmtLyd(t.min)} ${cur}`)).join('  ·  ')] : []),
      ...(o.gift_product_id && o.gift_min ? [lang === 'ar' ? `هدية مجانية مع الطلبيات من ${fmtLyd(o.gift_min)} ${cur}` : `Free gift with orders from ${fmtLyd(o.gift_min)} ${cur}`] : []),
      ...(o.free_delivery ? [lang === 'ar' ? 'توصيل مجاني' : 'Free delivery'] : []),
    ]
    const dates = o.starts_at && o.ends_at ? `${fmtWhen(o.starts_at, lang, false)} – ${fmtWhen(o.ends_at, lang, false)}` : o.ends_at ? (lang === 'ar' ? `حتى ${fmtWhen(o.ends_at, lang, false)}` : `Until ${fmtWhen(o.ends_at, lang, false)}`) : ''
    return { kick: w.kick, ttl: w.ttl || w.name, sub: w.sub, badge: w.badge, btn: w.btn, extras, dates }
  }
  const data = {
    name: (o.name_en || look.occasion.en).replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    ar: words('ar'), en: words('en'), photos,
    g: hexes(v.hbg).length ? hexes(v.hbg) : [v.bg, v.bg], radial: /^radial/.test(v.hbg), dark: !!look.dark,
    ink: v.hink, ttl: v.tink || v.hink, acc: v.acc, bbg: v.bbg, bink: v.bink, sbg: v.sbg, sink: v.sink,
  }
  return c.html(
    <Shell title="Instagram images" nav="offers">
      <div class="a-head"><h1>Instagram images · <span dir="auto">{o.name_en || look.occasion.en}</span></h1><a class="a-btn" href={`/admin/offers/${o.id}`}>Back to the offer</a></div>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@500;700&display=swap" />
      <div class="a-card" data-offer-image>
        <p class="a-muted">Made from the offer’s look, words and dates{photos.length ? ', with photos of pieces in the offer' : ''}. Change the words on the offer and save to change the image. On iPad, press “Save or share”, then “Save Image” to put it in Photos.</p>
        <div class="a-btns">
          <label class="a-inline"><input type="radio" name="img_fmt" value="story" checked /> Story (1080 × 1920)</label>
          <label class="a-inline"><input type="radio" name="img_fmt" value="post" /> Post (1080 × 1080)</label>
          <label class="a-inline"><input type="radio" name="img_lang" value="ar" checked /> Arabic</label>
          <label class="a-inline"><input type="radio" name="img_lang" value="en" /> English</label>
          <label class="a-inline"><input type="checkbox" name="img_photos" checked={photos.length > 0} disabled={!photos.length} /> Photos</label>
        </div>
        <canvas class="a-canvas" width="1080" height="1920" />
        <div class="a-btns">
          <button class="a-btn p" type="button" data-img-share>Save or share</button>
          <button class="a-btn" type="button" data-img-dl>Download</button>
        </div>
      </div>
      <script type="application/json" id="img-data" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
    </Shell>,
  )
})
