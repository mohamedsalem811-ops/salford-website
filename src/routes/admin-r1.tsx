/**
 * Release 1 admin: Offers (the 9 occasion looks), Discount codes (with the commission report) and Delivery (prices per area).
 * Pages are mounted on /admin, the JSON endpoints on /admin/api (so every save reloads the shop's catalog).
 * Times are typed and shown in Libya time and stored in UTC. Money is typed in LYD and stored in dirhams.
 */
import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { fmtLyd, toDirham, getBrands, getCategories, getSettings } from '../lib/db'
import type { Offer, Code, City, Area } from '../lib/pricing'
import { isLive, liveOffer, utcNow, parseScope, normalizeCode } from '../lib/pricing'
import { LOOKS, LOOK_IDS, lookOf, fill, type Look } from '../lib/looks'
import { Shell, libyaTime, libyaToUtc, utcToLibyaInput } from '../views/admin-shell'

type Vars = { admin: { id: number; email: string } }
export const r1Pages = new Hono<{ Bindings: Env; Variables: Vars }>()
export const r1Api = new Hono<{ Bindings: Env; Variables: Vars }>()

const SITE = 'https://salfordlibya.com'
const lyd = (d: number | null | undefined) => (d === null || d === undefined ? '' : String(d / 1000))
const when = (utc: string) => (utc ? libyaTime(utc) : '—')

/* =====================================================================
   Offers
   ===================================================================== */

function offerStatus(o: Offer, all: Offer[], now = utcNow()): [string, string] {
  if (!o.enabled) return ['Off', '']
  if (o.ends_at && o.ends_at <= now) return ['Ended', '']
  if (o.starts_at && o.starts_at > now) return ['Scheduled', 'warn']
  const live = liveOffer(all, now)
  return live && live.id === o.id ? ['Running now', 'ok'] : ['Hidden by a newer offer', 'bad']
}

/** A small banner in the look's colours, so the team recognises the design they picked. */
const LookChip = ({ look, pct }: { look: Look; pct: number }) => {
  const v = look.v
  return (
    <span class="lk" style={`background:${v.hbg};color:${v.hink}`}>
      <span class="lk-s" style={`background:${v.sbg};color:${v.sink}`}>{fill(look.copy.ar.strip, pct, 2026)}</span>
      <span class="lk-k" style={`color:${v.acc}`}>{fill(look.copy.ar.kick, pct, 2026)}</span>
      <b style={`color:${v.tink || v.hink}`}>{fill(look.copy.ar.ttl, pct, 2026)}</b>
      <span class="lk-b" style={`background:${v.bbg};color:${v.bink}`}>{look.copy.ar.btn}</span>
    </span>
  )
}

r1Pages.get('/offers', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM offers ORDER BY id DESC').all<Offer>()
  return c.html(
    <Shell title="Offers" nav="offers">
      <div class="a-head"><h1>Offers</h1><a class="a-btn p" href="/admin/offers/new">New offer</a></div>
      <p class="a-muted">One offer runs at a time: the newest switched-on offer whose dates cover now. It starts and ends by itself at the times you set (Libya time).
        Products with their own crossed-out price, and products ticked “Never discount”, are never discounted.</p>
      {results.length ? (
        <div class="a-table-wrap"><table class="a-table">
          <thead><tr><th>Offer</th><th>Look</th><th>Discount</th><th>Starts</th><th>Ends</th><th>Status</th><th></th></tr></thead>
          <tbody>{results.map((o) => {
            const [st, cls] = offerStatus(o, results)
            return (
              <tr>
                <td><a href={`/admin/offers/${o.id}`}><b dir="auto">{o.name_en || o.name_ar || lookOf(o.template).occasion.en}</b></a></td>
                <td>{lookOf(o.template).occasion.en}</td>
                <td class="num">{o.percent}%{o.free_delivery ? <span class="tag">free delivery</span> : null}</td>
                <td class="num">{when(o.starts_at)}</td>
                <td class="num">{when(o.ends_at)}</td>
                <td><span class={`tag ${cls}`}>{st}</span></td>
                <td><a class="a-btn sm" href={`/ar/?offer_preview=${o.id}`} target="_blank" rel="noopener">Preview ↗</a></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      ) : <div class="a-card"><p class="a-muted">No offers yet. Press “New offer”, pick the occasion look, set the % and the dates.</p></div>}
    </Shell>,
  )
})

r1Pages.get('/offers/:id{new|[0-9]+}', async (c) => {
  const isNew = c.req.param('id') === 'new'
  const look0 = (c.req.query('look') && (LOOK_IDS as string[]).includes(c.req.query('look')!) ? c.req.query('look') : 'ind') as string
  const blank = {
    id: 0, template: look0, name_ar: '', name_en: '', starts_at: '', ends_at: '', enabled: 1, percent: LOOKS[look0 as 'ind'].pct, scope: '{"all":true}',
    free_delivery: 0, banner_ar: '', banner_en: '', sub_ar: '', sub_en: '', kicker_ar: '', kicker_en: '', caption_ar: '', caption_en: '', badge_ar: '', badge_en: '',
    show_countdown: 1, show_banner: 1, show_strip: 1, photo_product_id: null,
  } as unknown as Offer
  const o = isNew ? blank : await c.env.DB.prepare('SELECT * FROM offers WHERE id = ?').bind(Number(c.req.param('id'))).first<Offer>()
  if (!o) return c.redirect('/admin/offers')
  const [brands, cats] = await Promise.all([getBrands(c.env.DB, true), getCategories(c.env.DB)])
  const sc = parseScope(o.scope)
  const ids = [...(sc.products ?? []), ...(o.photo_product_id ? [o.photo_product_id] : [])]
  const codeOf = new Map<number, string>()
  if (ids.length) {
    const { results } = await c.env.DB.prepare(`SELECT id, code FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: number; code: string }>()
    for (const r of results) codeOf.set(r.id, r.code)
  }
  const look = lookOf(o.template)
  const defaults = Object.fromEntries(LOOK_IDS.map((id) => [id, { pct: LOOKS[id].pct, photo: LOOKS[id].layout === 'photo', ar: LOOKS[id].copy.ar, en: LOOKS[id].copy.en }]))
  const W = (f: string, label: string, help?: string) => (
    <div class="a-grid2">
      <label class="a-f">{label} · Arabic<input name={`${f}_ar`} dir="rtl" maxlength={200} value={(o as unknown as Record<string, string>)[`${f}_ar`]} data-def={f} data-lang="ar" />{help ? <span class="a-muted">{help}</span> : null}</label>
      <label class="a-f">{label} · English<input name={`${f}_en`} maxlength={200} value={(o as unknown as Record<string, string>)[`${f}_en`]} data-def={f} data-lang="en" /></label>
    </div>
  )
  return c.html(
    <Shell title={isNew ? 'New offer' : 'Edit offer'} nav="offers">
      <div class="a-head">
        <h1>{isNew ? 'New offer' : 'Edit offer'}</h1>
        <div class="a-btns">
          {isNew ? null : <a class="a-btn" href={`/ar/?offer_preview=${o.id}`} target="_blank" rel="noopener">Preview on the site ↗</a>}
          <button class="a-btn p" type="submit" form="oform">Save offer</button>
        </div>
      </div>
      <form id="oform" class="a-card" data-offer-form={o.id}>
        <h2>1 · Occasion look</h2>
        <div class="lk-grid">{LOOK_IDS.map((id) => (
          <label class="lk-opt"><input type="radio" name="template" value={id} checked={o.template === id} />
            <LookChip look={LOOKS[id]} pct={LOOKS[id].pct} />
            <span class="lk-n"><b>{LOOKS[id].occasion.en}</b> <span class="a-muted">· {LOOKS[id].occasion.ar}</span></span>
          </label>
        ))}</div>

        <h2>2 · Discount</h2>
        <div class="a-grid2">
          <label class="a-f">Percent off<input name="percent" type="number" min="1" max="90" step="1" required value={String(o.percent || '')} /><span class="a-muted">New prices are rounded down to a whole 5 LYD (590 − 24% → 445).</span></label>
          <label class="a-f">Internal name (optional)<input name="name_en" maxlength={100} value={o.name_en} placeholder={look.occasion.en} /><span class="a-muted">Shown in the order message as the reason for the discount.</span></label>
        </div>
        <label class="a-inline"><input type="checkbox" name="free_delivery" checked={!!o.free_delivery} /> Free delivery during this offer (when delivery prices are switched on)</label>

        <h2>3 · Which products</h2>
        <label class="a-inline"><input type="radio" name="scope_mode" value="all" checked={!!sc.all} /> The whole shop</label>
        <label class="a-inline"><input type="radio" name="scope_mode" value="some" checked={!sc.all} /> Only the brands, categories or products I choose</label>
        <div class="a-card a-sub" data-scope-some hidden={!!sc.all}>
          <p class="a-muted">Choose brands and/or categories (a product must match both when you choose both), and/or list product codes.</p>
          <div class="a-f">Brands<div class="a-checks">{brands.map((b) => <label><input type="checkbox" name="sc_brand" value={b.id} checked={sc.brands?.includes(b.id)} /> {b.name}</label>)}</div></div>
          <div class="a-f">Categories<div class="a-checks">{cats.map((k) => <label><input type="checkbox" name="sc_cat" value={k.id} checked={sc.cats?.includes(k.id)} /> {k.name_en}</label>)}</div></div>
          <label class="a-f">Product codes (comma separated)<input name="sc_codes" value={(sc.products ?? []).map((id) => codeOf.get(id) ?? '').filter(Boolean).join(', ')} /></label>
        </div>

        <h2>4 · Dates (Libya time)</h2>
        <div class="a-grid2">
          <label class="a-f">Starts<input name="starts_at" type="datetime-local" value={utcToLibyaInput(o.starts_at)} /><span class="a-muted">Empty = straight away.</span></label>
          <label class="a-f">Ends<input name="ends_at" type="datetime-local" required value={utcToLibyaInput(o.ends_at)} /></label>
        </div>

        <h2>5 · Words on the site</h2>
        <p class="a-muted">Leave a box empty to use the look’s own words (shown in grey). <code>{'{pct}'}</code> becomes the percent.</p>
        {W('banner', 'Big title')}
        {W('sub', 'Line under the title')}
        {W('kicker', 'Small line above the title')}
        {W('caption', 'Thin strip on every page')}
        {W('badge', 'Badge on product photos', 'Empty = “−24%”.')}
        <div class="a-grid2"><label class="a-f">Arabic name (order message)<input name="name_ar" dir="rtl" maxlength={100} value={o.name_ar} placeholder={look.occasion.ar} /></label></div>

        <h2>6 · Show</h2>
        <div class="a-checks">
          <label><input type="checkbox" name="show_banner" checked={!!o.show_banner} /> Banner on the home page</label>
          <label><input type="checkbox" name="show_strip" checked={!!o.show_strip} /> Thin strip on every page</label>
          <label><input type="checkbox" name="show_countdown" checked={!!o.show_countdown} /> Countdown</label>
        </div>
        <label class="a-f" data-photo-field>Banner photo: product code (photo looks only; empty = the first product in the offer)<input name="photo_code" value={o.photo_product_id ? codeOf.get(o.photo_product_id) ?? '' : ''} /></label>

        <h2>7 · Switch</h2>
        <label class="a-inline"><input type="checkbox" name="enabled" checked={!!o.enabled} /> Switched on (it still waits for its start time)</label>
        <p class="a-err" data-form-err hidden></p>
        <div class="a-btns">
          <button class="a-btn p" type="submit">Save offer</button>
          {isNew ? null : <button class="a-btn danger" type="button" data-offer-delete={o.id}>Delete offer</button>}
        </div>
      </form>
      <script type="application/json" id="look-defaults" dangerouslySetInnerHTML={{ __html: JSON.stringify(defaults).replace(/</g, '\\u003c') }} />
    </Shell>,
  )
})

const T200 = (b: Record<string, unknown>, k: string, max = 200) => String(b[k] ?? '').trim().slice(0, max)

async function productIdsByCode(db: D1Database, codes: string[]) {
  if (!codes.length) return { ids: [] as number[], unknown: [] as string[] }
  const { results } = await db.prepare(`SELECT id, code FROM products WHERE deleted_at IS NULL AND upper(code) IN (${codes.map(() => '?').join(',')})`)
    .bind(...codes.map((x) => x.toUpperCase())).all<{ id: number; code: string }>()
  const by = new Map(results.map((r) => [r.code.toUpperCase(), r.id]))
  return { ids: codes.map((x) => by.get(x.toUpperCase())).filter((n): n is number => !!n), unknown: codes.filter((x) => !by.has(x.toUpperCase())) }
}

async function saveOffer(c: { env: Env; req: { json: <T>() => Promise<T> } }, id: number) {
  const db = c.env.DB
  const b = await c.req.json<Record<string, unknown>>()
  const template = String(b.template ?? '')
  if (!(LOOK_IDS as string[]).includes(template)) return { error: 'Choose an occasion look.' }
  const percent = Math.floor(Number(b.percent))
  if (!(percent >= 1 && percent <= 90)) return { error: 'Percent off must be a whole number from 1 to 90.' }
  const starts = b.starts_at ? libyaToUtc(String(b.starts_at)) : ''
  const ends = libyaToUtc(String(b.ends_at ?? ''))
  if (starts === null) return { error: 'The start time is not valid.' }
  if (!ends) return { error: 'Set when the offer ends.' }
  if (starts && ends <= starts) return { error: 'The offer must end after it starts.' }
  let scope = '{"all":true}'
  if (b.scope_mode !== 'all') {
    const [brands, cats] = await Promise.all([getBrands(db, true), getCategories(db)])
    const bs = (Array.isArray(b.brands) ? b.brands : []).map(String).filter((x) => brands.some((y) => y.id === x))
    const cs = (Array.isArray(b.cats) ? b.cats : []).map(String).filter((x) => cats.some((y) => y.id === x))
    const codes = String(b.sc_codes ?? '').split(/[,\s]+/).map((x) => x.trim()).filter(Boolean).slice(0, 300)
    const p = await productIdsByCode(db, codes)
    if (p.unknown.length) return { error: `These product codes were not found: ${p.unknown.join(', ')}` }
    if (!bs.length && !cs.length && !p.ids.length) return { error: 'Choose at least one brand, category or product, or choose “The whole shop”.' }
    scope = JSON.stringify({ brands: bs, cats: cs, products: p.ids })
  }
  let photo: number | null = null
  const pc = T200(b, 'photo_code', 60)
  if (pc) {
    const p = await productIdsByCode(db, [pc])
    if (!p.ids.length) return { error: `Banner photo: product code ${pc} was not found.` }
    photo = p.ids[0]
  }
  const flag = (k: string) => (b[k] ? 1 : 0)
  const vals = [template, T200(b, 'name_ar', 100), T200(b, 'name_en', 100), starts, ends, flag('enabled'), percent, scope, flag('free_delivery'),
    T200(b, 'banner_ar'), T200(b, 'banner_en'), T200(b, 'sub_ar'), T200(b, 'sub_en'), T200(b, 'kicker_ar'), T200(b, 'kicker_en'),
    T200(b, 'caption_ar'), T200(b, 'caption_en'), T200(b, 'badge_ar', 30), T200(b, 'badge_en', 30), flag('show_countdown'), flag('show_banner'), flag('show_strip'), photo]
  const cols = 'template, name_ar, name_en, starts_at, ends_at, enabled, percent, scope, free_delivery, banner_ar, banner_en, sub_ar, sub_en, kicker_ar, kicker_en, caption_ar, caption_en, badge_ar, badge_en, show_countdown, show_banner, show_strip, photo_product_id'
  let newId = id
  if (id) {
    const r = await db.prepare(`UPDATE offers SET ${cols.split(', ').map((k) => `${k}=?`).join(', ')}, kind='percent' WHERE id=?`).bind(...vals, id).run()
    if (!r.meta.changes) return { error: 'Offer not found.', status: 404 }
  } else {
    const r = await db.prepare(`INSERT INTO offers (${cols}, kind) VALUES (${vals.map(() => '?').join(', ')}, 'percent') RETURNING id`).bind(...vals).first<{ id: number }>()
    newId = r!.id
  }
  // more than one switched-on offer on the same dates: only the newest shows, so say so
  let warning = ''
  if (flag('enabled')) {
    const clash = await db.prepare(`SELECT id, name_en, template FROM offers WHERE enabled = 1 AND id != ? AND (starts_at = '' OR starts_at < ?) AND (ends_at = '' OR ends_at > ?) ORDER BY id DESC LIMIT 1`)
      .bind(newId, ends, starts || utcNow()).first<{ id: number; name_en: string; template: string }>()
    if (clash) warning = `Its dates overlap “${clash.name_en || lookOf(clash.template).occasion.en}”. While both run, only the ${clash.id > newId ? 'other (newer) one' : 'this (newer) one'} shows.`
  }
  return { ok: true, id: newId, warning }
}

r1Api.post('/offers', async (c) => {
  const r = await saveOffer(c, 0)
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json(r)
})
r1Api.put('/offers/:id{[0-9]+}', async (c) => {
  const r = await saveOffer(c, Number(c.req.param('id')))
  return 'error' in r ? c.json({ error: r.error }, (r.status ?? 400) as 400) : c.json(r)
})
r1Api.delete('/offers/:id{[0-9]+}', async (c) => {
  // past orders keep the offer's name in their own row (offer_name), so the offer can go
  await c.env.DB.prepare('DELETE FROM offers WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

/* =====================================================================
   Discount codes
   ===================================================================== */

type CodeRow = Code & { note: string; created_at: string; uses: number; delivered: number; sales: number }

const codeValue = (k: Pick<Code, 'kind' | 'value'>) => (k.kind === 'amount' ? `${fmtLyd(k.value)} LYD off` : `${k.value}% off`)
function codeStatus(k: Code, now = utcNow()): [string, string] {
  if (!k.enabled) return ['Off', '']
  if (k.ends_at && k.ends_at <= now) return ['Ended', '']
  if (k.starts_at && k.starts_at > now) return ['Scheduled', 'warn']
  return isLive({ enabled: 1, starts_at: k.starts_at, ends_at: k.ends_at }, now) ? ['Active', 'ok'] : ['Off', '']
}

r1Pages.get('/codes', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT k.*,
      (SELECT count(*) FROM orders o WHERE o.code = k.code AND o.status != 'cancelled') AS uses,
      (SELECT count(*) FROM orders o WHERE o.code = k.code AND o.status = 'delivered') AS delivered,
      (SELECT coalesce(sum(o.subtotal - o.discount_total), 0) FROM orders o WHERE o.code = k.code AND o.status = 'delivered') AS sales
    FROM codes k ORDER BY k.id DESC`).all<CodeRow>()
  const owed = results.reduce((s, k) => s + Math.round((k.sales * k.commission_pct) / 100), 0)
  return c.html(
    <Shell title="Discount codes" nav="codes">
      <div class="a-head"><h1>Discount codes</h1><a class="a-btn p" href="/admin/codes/new">New code</a></div>
      <p class="a-muted">A customer types the code at checkout, or opens a link like <code>{SITE}/ar/?code=SARA10</code> (the code is then filled in for them).
        An order gets one saving only: the offer or the code, whichever is better for the customer. A use counts when an order is placed and stops counting if you cancel the order.</p>
      {results.length ? (
        <>
          <div class="a-table-wrap"><table class="a-table">
            <thead><tr><th>Code</th><th>Owner</th><th>Discount</th><th>Valid</th><th>Uses</th><th>Delivered orders</th><th>Delivered sales</th><th>Commission</th><th>Status</th></tr></thead>
            <tbody>{results.map((k) => {
              const [st, cls] = codeStatus(k)
              return (
                <tr>
                  <td><a href={`/admin/codes/${k.id}`}><b><code>{k.code}</code></b></a></td>
                  <td dir="auto">{k.owner || '—'}</td>
                  <td class="num">{codeValue(k)}{k.min_total ? <><br /><span class="a-muted">from {fmtLyd(k.min_total)} LYD</span></> : null}</td>
                  <td class="num">{k.starts_at || k.ends_at ? <>{when(k.starts_at)}<br />→ {when(k.ends_at)}</> : 'Always'}</td>
                  <td class="num">{k.uses}{k.max_uses ? ` / ${k.max_uses}` : ''}</td>
                  <td class="num">{k.delivered}</td>
                  <td class="num">{fmtLyd(k.sales)} LYD</td>
                  <td class="num">{k.commission_pct ? <>{fmtLyd(Math.round((k.sales * k.commission_pct) / 100))} LYD<br /><span class="a-muted">{k.commission_pct}%</span></> : '—'}</td>
                  <td><span class={`tag ${cls}`}>{st}</span></td>
                </tr>
              )
            })}</tbody>
          </table></div>
          <p class="a-muted">Delivered sales = products after the discount, without delivery, on orders marked “delivered”. Commission owed in total: <b>{fmtLyd(owed)} LYD</b>.</p>
        </>
      ) : <div class="a-card"><p class="a-muted">No codes yet. Customers do not see a code box at checkout until at least one code is switched on.</p></div>}
    </Shell>,
  )
})

r1Pages.get('/codes/:id{new|[0-9]+}', async (c) => {
  const isNew = c.req.param('id') === 'new'
  const k = isNew
    ? ({ id: 0, code: '', owner: '', kind: 'percent', value: 10, min_total: 0, starts_at: '', ends_at: '', max_uses: 0, per_phone: 1, enabled: 1, commission_pct: 0, note: '', uses: 0 } as unknown as CodeRow)
    : await c.env.DB.prepare("SELECT k.*, (SELECT count(*) FROM orders o WHERE o.code = k.code AND o.status != 'cancelled') AS uses FROM codes k WHERE id = ?").bind(Number(c.req.param('id'))).first<CodeRow>()
  if (!k) return c.redirect('/admin/codes')
  const link = k.code ? `${SITE}/ar/?code=${k.code}` : ''
  return c.html(
    <Shell title={isNew ? 'New code' : k.code} nav="codes">
      <div class="a-head"><h1>{isNew ? 'New discount code' : <>Code <code>{k.code}</code></>}</h1><a class="a-btn" href="/admin/codes">All codes</a></div>
      <form class="a-card" data-code-form={k.id}>
        <div class="a-grid2">
          <label class="a-f">Code<input name="code" required maxlength={30} value={k.code} readonly={k.uses > 0} style="text-transform:uppercase" placeholder="SARA10" />
            <span class="a-muted">{k.uses > 0 ? 'Already used, so it can’t be renamed.' : 'Letters, numbers, - and _. Customers can type it in small or capital letters.'}</span></label>
          <label class="a-f">Owner (optional)<input name="owner" maxlength={100} value={k.owner} placeholder="e.g. the influencer’s name" /></label>
          <label class="a-f">Type<select name="kind"><option value="percent" selected={k.kind === 'percent'}>Percent off</option><option value="amount" selected={k.kind === 'amount'}>LYD off the order</option></select></label>
          <label class="a-f">Value (% or LYD)<input name="value" type="number" min="1" step="any" required value={k.kind === 'amount' ? lyd(k.value) : String(k.value)} /></label>
          <label class="a-f">Minimum order (LYD, products before discount)<input name="min_total" type="number" min="0" step="any" value={k.min_total ? lyd(k.min_total) : ''} placeholder="No minimum" /></label>
          <label class="a-f">Commission % (for the owner)<input name="commission_pct" type="number" min="0" max="100" step="any" value={k.commission_pct ? String(k.commission_pct) : ''} placeholder="0" /></label>
          <label class="a-f">Starts (Libya time, optional)<input name="starts_at" type="datetime-local" value={utcToLibyaInput(k.starts_at)} /></label>
          <label class="a-f">Ends (Libya time, optional)<input name="ends_at" type="datetime-local" value={utcToLibyaInput(k.ends_at)} /></label>
          <label class="a-f">Total uses allowed<input name="max_uses" type="number" min="0" step="1" value={k.max_uses ? String(k.max_uses) : ''} placeholder="No limit" /></label>
          <label class="a-f">Uses per phone number<input name="per_phone" type="number" min="0" step="1" value={k.per_phone ? String(k.per_phone) : ''} placeholder="No limit" /></label>
        </div>
        <label class="a-f">Team note<input name="note" maxlength={300} value={k.note} /></label>
        <label class="a-inline"><input type="checkbox" name="enabled" checked={!!k.enabled} /> Switched on</label>
        <p class="a-muted">Products with their own crossed-out price, and products ticked “Never discount”, are not discounted by codes either.</p>
        {link ? <p class="a-row"><input readonly value={link} dir="ltr" /><button class="a-btn sm" type="button" data-copy={link}>Copy link</button></p> : null}
        <p class="a-err" data-form-err hidden></p>
        <div class="a-btns">
          <button class="a-btn p" type="submit">Save code</button>
          {!isNew && !k.uses ? <button class="a-btn danger" type="button" data-code-delete={k.id}>Delete code</button> : null}
          {!isNew && k.uses ? <span class="a-muted">Used {k.uses} time(s): switch it off instead of deleting, so the report keeps it.</span> : null}
        </div>
      </form>
    </Shell>,
  )
})

async function saveCode(c: { env: Env; req: { json: <T>() => Promise<T> } }, id: number) {
  const db = c.env.DB
  const b = await c.req.json<Record<string, unknown>>()
  const code = normalizeCode(b.code)
  if (!code) return { error: 'The code must be 2–30 letters or numbers (- and _ allowed), without spaces.' }
  const kind = b.kind === 'amount' ? 'amount' : 'percent'
  const raw = Number(b.value)
  const value = kind === 'amount' ? toDirham(raw) : Math.floor(raw)
  if (kind === 'percent' && !(value >= 1 && value <= 90)) return { error: 'Percent off must be a whole number from 1 to 90.' }
  if (kind === 'amount' && !(value >= 1000 && value <= 100_000_000)) return { error: 'The LYD amount must be at least 1.' }
  const min = Math.max(0, toDirham(Number(b.min_total) || 0))
  const starts = b.starts_at ? libyaToUtc(String(b.starts_at)) : ''
  const ends = b.ends_at ? libyaToUtc(String(b.ends_at)) : ''
  if (starts === null || ends === null) return { error: 'A date is not valid.' }
  if (starts && ends && ends <= starts) return { error: 'The code must end after it starts.' }
  const int = (k: string) => Math.max(0, Math.min(1_000_000, Math.floor(Number(b[k]) || 0)))
  const comm = Math.max(0, Math.min(100, Number(b.commission_pct) || 0))
  const vals = [code, T200(b, 'owner', 100), kind, value, min, starts, ends, int('max_uses'), int('per_phone'), b.enabled ? 1 : 0, comm, T200(b, 'note', 300)]
  const cols = ['code', 'owner', 'kind', 'value', 'min_total', 'starts_at', 'ends_at', 'max_uses', 'per_phone', 'enabled', 'commission_pct', 'note']
  try {
    if (id) {
      const old = await db.prepare("SELECT k.code, (SELECT count(*) FROM orders o WHERE o.code = k.code) AS n FROM codes k WHERE id = ?").bind(id).first<{ code: string; n: number }>()
      if (!old) return { error: 'Code not found.', status: 404 }
      if (old.n > 0 && old.code !== code) return { error: 'This code has orders, so it can’t be renamed. Make a new code instead.' }
      await db.prepare(`UPDATE codes SET ${cols.map((k) => `${k}=?`).join(', ')} WHERE id=?`).bind(...vals, id).run()
      return { ok: true, id }
    }
    const r = await db.prepare(`INSERT INTO codes (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING id`).bind(...vals).first<{ id: number }>()
    return { ok: true, id: r!.id }
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) return { error: `The code ${code} already exists.` }
    throw e
  }
}

r1Api.post('/codes', async (c) => {
  const r = await saveCode(c, 0)
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json(r)
})
r1Api.put('/codes/:id{[0-9]+}', async (c) => {
  const r = await saveCode(c, Number(c.req.param('id')))
  return 'error' in r ? c.json({ error: r.error }, (r.status ?? 400) as 400) : c.json(r)
})
r1Api.delete('/codes/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const k = await c.env.DB.prepare('SELECT k.code, (SELECT count(*) FROM orders o WHERE o.code = k.code) AS n FROM codes k WHERE id = ?').bind(id).first<{ code: string; n: number }>()
  if (!k) return c.json({ ok: true })
  if (k.n > 0) return c.json({ error: 'This code has orders: switch it off instead, so the report keeps it.' }, 400)
  await c.env.DB.prepare('DELETE FROM codes WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

/* =====================================================================
   Delivery
   ===================================================================== */

r1Pages.get('/delivery', async (c) => {
  const [s, cr, ar] = await Promise.all([
    getSettings(c.env.DB),
    c.env.DB.prepare('SELECT * FROM delivery_cities ORDER BY sort, id').all<City>(),
    c.env.DB.prepare('SELECT * FROM delivery_areas ORDER BY city_id, sort, id').all<Area>(),
  ])
  const on = s.delivery_on === '1'
  const freeMin = Number(s.free_delivery_min || 0)
  const freeOn = s.free_delivery_on !== '0' && freeMin > 0
  const noPrice = ar.results.filter((a) => a.enabled && (a.price === null || a.price === undefined)).length
  return c.html(
    <Shell title="Delivery" nav="delivery">
      <div class="a-head"><h1>Delivery</h1><button class="a-btn p" type="submit" form="dform">Save delivery</button></div>
      <form id="dform" class="a-grid-gap" data-delivery-form>
        <div class="a-card">
          <label class="a-inline"><input type="checkbox" name="delivery_on" checked={on} /> <b>Show delivery prices on the site</b></label>
          <p class="a-muted">Off: customers type their city and the delivery price is agreed in the chat (as now).
            On: customers choose their city and area, see the price and delivery time before ordering, and pay the driver in cash. An area without a price shows “agreed in the chat”.</p>
          {noPrice ? <p class="tag warn">{noPrice} area(s) have no price yet</p> : null}
        </div>
        <div class="a-card">
          <h2>Free delivery {freeOn ? <span class="tag ok">On</span> : <span class="tag">Off</span>}</h2>
          <label class="a-inline"><input type="checkbox" name="free_on" checked={freeOn} /> <b>Free delivery when the order reaches an amount</b></label>
          <label class="a-f" style="max-width:320px">Amount (LYD, products total after any discount)<input name="free_min" type="number" inputmode="decimal" min="1" step="any" value={freeMin ? lyd(freeMin) : '1000'} /></label>
          <p class="a-muted">On: an order at or above this amount has free delivery, and the cart tells the customer how much more to add.
            Off: delivery is never free (except during an offer ticked “free delivery”).</p>
        </div>
        <div class="a-card">
          <h2>Cities and areas</h2>
          <p class="a-muted">Price in LYD; leave it empty for “agreed in the chat”. Time is what the customer reads, e.g. “1–2 days” / “١–٢ يوم”.
            A city with one area called “All areas” shows no area list.</p>
          {cr.results.map((ct) => {
            const list = ar.results.filter((a) => a.city_id === ct.id)
            return (
              <section class="d-city" data-city-id={ct.id}>
                <div class="d-head">
                  <input name={`c${ct.id}_name_ar`} dir="rtl" value={ct.name_ar} aria-label="City name (Arabic)" required />
                  <input name={`c${ct.id}_name_en`} value={ct.name_en} aria-label="City name (English)" />
                  <input name={`c${ct.id}_sort`} type="number" value={String(ct.sort)} aria-label="Order" title="Order in the list" class="d-sort" />
                  <label class="a-inline"><input type="checkbox" name={`c${ct.id}_enabled`} checked={!!ct.enabled} /> Shown</label>
                  <button class="a-btn sm danger" type="button" data-del-city={ct.id}>Delete city</button>
                </div>
                <div class="d-all a-row">
                  <span class="a-muted">Whole city:</span>
                  <input type="number" min="0" step="any" placeholder="price LYD" data-all-price aria-label="Price for every area" />
                  <input placeholder="time (Arabic)" dir="rtl" data-all-time-ar aria-label="Time for every area (Arabic)" />
                  <input placeholder="time (English)" data-all-time-en aria-label="Time for every area (English)" />
                  <button class="a-btn sm" type="button" data-apply-city>Apply to all areas</button>
                </div>
                <div class="a-table-wrap"><table class="a-table d-areas">
                  <thead><tr><th>Area (Arabic)</th><th>Area (English)</th><th>Price LYD</th><th>Time (Arabic)</th><th>Time (English)</th><th>Shown</th><th></th></tr></thead>
                  <tbody>{list.map((a) => (
                    <tr data-area-id={a.id}>
                      <td><input name={`a${a.id}_name_ar`} dir="rtl" value={a.name_ar} required /></td>
                      <td><input name={`a${a.id}_name_en`} value={a.name_en} /></td>
                      <td><input name={`a${a.id}_price`} type="number" min="0" step="any" value={lyd(a.price)} placeholder="chat" data-price class="d-num" /></td>
                      <td><input name={`a${a.id}_time_ar`} dir="rtl" value={a.time_ar} data-time-ar /></td>
                      <td><input name={`a${a.id}_time_en`} value={a.time_en} data-time-en /></td>
                      <td><input type="checkbox" name={`a${a.id}_enabled`} checked={!!a.enabled} aria-label="Shown" /></td>
                      <td><button class="a-btn sm danger" type="button" data-del-area={a.id} aria-label="Delete area">✕</button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                <div class="a-row"><input placeholder="New area (Arabic)" dir="rtl" data-new-area-ar /><input placeholder="New area (English)" data-new-area-en /><button class="a-btn sm" type="button" data-add-area={ct.id}>Add area</button></div>
              </section>
            )
          })}
          <div class="a-row"><input placeholder="New city (Arabic)" dir="rtl" data-new-city-ar /><input placeholder="New city (English)" data-new-city-en /><button class="a-btn sm" type="button" data-add-city>Add city</button></div>
        </div>
        <p class="a-err" data-form-err hidden></p>
        <div class="a-btns"><button class="a-btn p" type="submit">Save delivery</button><span class="a-muted">Save before adding or deleting cities and areas, or your other changes are lost.</span></div>
      </form>
    </Shell>,
  )
})

const priceOf = (v: unknown): number | null | 'bad' => {
  const t = String(v ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 5000 ? toDirham(n) : 'bad'
}

r1Api.put('/delivery', async (c) => {
  const db = c.env.DB
  const b = await c.req.json<Record<string, unknown>>()
  const [cr, ar] = await Promise.all([
    db.prepare('SELECT id FROM delivery_cities').all<{ id: number }>(),
    db.prepare('SELECT id FROM delivery_areas').all<{ id: number }>(),
  ])
  const stmts: D1PreparedStatement[] = []
  const up = (k: string, v: string) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, v)
  const fm = String(b.free_min ?? '').trim()
  const free = fm ? Number(fm) : 0
  const freeOn = !!b.free_on
  if (!(Number.isFinite(free) && free >= 0 && free <= 1000000)) return c.json({ error: 'Free delivery amount is not a number.' }, 400)
  if (freeOn && !(free > 0)) return c.json({ error: 'Enter the amount for free delivery, or untick it.' }, 400)
  stmts.push(up('delivery_on', b.delivery_on ? '1' : '0'), up('free_delivery_on', freeOn ? '1' : '0'))
  if (free > 0) stmts.push(up('free_delivery_min', String(toDirham(free)))) // the amount is kept while switched off
  const t = (k: string, max = 60) => String(b[k] ?? '').trim().slice(0, max)
  for (const { id } of cr.results) {
    if (!(`c${id}_name_ar` in b)) continue
    if (!t(`c${id}_name_ar`)) return c.json({ error: 'Every city needs an Arabic name.' }, 400)
    stmts.push(db.prepare('UPDATE delivery_cities SET name_ar=?, name_en=?, sort=?, enabled=? WHERE id=?')
      .bind(t(`c${id}_name_ar`), t(`c${id}_name_en`), Math.floor(Number(b[`c${id}_sort`]) || 0), b[`c${id}_enabled`] ? 1 : 0, id))
  }
  for (const { id } of ar.results) {
    if (!(`a${id}_name_ar` in b)) continue
    if (!t(`a${id}_name_ar`)) return c.json({ error: 'Every area needs an Arabic name.' }, 400)
    const price = priceOf(b[`a${id}_price`])
    if (price === 'bad') return c.json({ error: `The price of “${t(`a${id}_name_ar`)}” is not valid (0–5000 LYD, or empty).` }, 400)
    stmts.push(db.prepare('UPDATE delivery_areas SET name_ar=?, name_en=?, price=?, time_ar=?, time_en=?, enabled=? WHERE id=?')
      .bind(t(`a${id}_name_ar`), t(`a${id}_name_en`), price, t(`a${id}_time_ar`), t(`a${id}_time_en`), b[`a${id}_enabled`] ? 1 : 0, id))
  }
  await db.batch(stmts)
  return c.json({ ok: true })
})

r1Api.post('/delivery/cities', async (c) => {
  const b = await c.req.json<Record<string, unknown>>()
  const ar = String(b.name_ar ?? '').trim().slice(0, 60), en = String(b.name_en ?? '').trim().slice(0, 60)
  if (!ar) return c.json({ error: 'Type the city name in Arabic.' }, 400)
  const r = await c.env.DB.prepare('INSERT INTO delivery_cities (name_ar, name_en, sort) VALUES (?, ?, (SELECT coalesce(max(sort), 0) + 1 FROM delivery_cities)) RETURNING id').bind(ar, en).first<{ id: number }>()
  // a new city starts as one "All areas" entry, so it works straight away
  await c.env.DB.prepare("INSERT INTO delivery_areas (city_id, name_ar, name_en, sort) VALUES (?, 'كل المناطق', 'All areas', 1)").bind(r!.id).run()
  return c.json({ ok: true, id: r!.id })
})
r1Api.post('/delivery/areas', async (c) => {
  const b = await c.req.json<Record<string, unknown>>()
  const city = Number(b.city_id)
  const ar = String(b.name_ar ?? '').trim().slice(0, 60), en = String(b.name_en ?? '').trim().slice(0, 60)
  if (!ar) return c.json({ error: 'Type the area name in Arabic.' }, 400)
  const r = await c.env.DB.prepare('INSERT INTO delivery_areas (city_id, name_ar, name_en, sort) SELECT id, ?, ?, (SELECT coalesce(max(sort), 0) + 1 FROM delivery_areas WHERE city_id = ?) FROM delivery_cities WHERE id = ? RETURNING id')
    .bind(ar, en, city, city).first<{ id: number }>()
  if (!r) return c.json({ error: 'City not found.' }, 404)
  return c.json({ ok: true, id: r.id })
})
r1Api.delete('/delivery/areas/:id{[0-9]+}', async (c) => {
  await c.env.DB.prepare('DELETE FROM delivery_areas WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})
r1Api.delete('/delivery/cities/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM delivery_areas WHERE city_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM delivery_cities WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})
