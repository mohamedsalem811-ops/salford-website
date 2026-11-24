import type { Env } from './db'

/* Arabic short line and description, written by Cloudflare Workers AI from the English text.
   Product names stay in English everywhere, so they are never translated. */
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const FALLBACK = '@cf/meta/m2m100-1.2b'
const AR = /[؀-ۿ]/

const system = (kind: 'short' | 'desc') =>
  'You translate jewellery product texts from English to Arabic for Salford, an online jewellery store in Libya. ' +
  'Write clear, warm Modern Standard Arabic that Libyan customers read easily. ' +
  'Keep brand names, collection names, product names, article numbers, codes, numbers and measurements exactly as written, in Latin letters. ' +
  'Translate words like rose gold-tone, rhodium plated, crystal, length and motif size. ' +
  (kind === 'short' ? 'This is a short line under the product name: keep it short, one line.' : 'Keep the same line breaks and the same order of lines.') +
  ' Answer with the Arabic text only: no quotes, no notes, no English version.'

export async function toArabic(env: Env, text: string, kind: 'short' | 'desc'): Promise<string> {
  const src = text.trim()
  if (!src || !env.AI) return ''
  if (AR.test(src)) return '' // already Arabic: nothing to translate
  try {
    const r = (await env.AI.run(MODEL as never, { messages: [{ role: 'system', content: system(kind) }, { role: 'user', content: src }], max_tokens: kind === 'short' ? 200 : 1200, temperature: 0.2 } as never)) as { response?: string }
    const out = clean(r?.response || '')
    if (AR.test(out)) return out
  } catch { /* use the fallback below */ }
  try {
    const parts = kind === 'desc' ? src.split('\n') : [src]
    const done: string[] = []
    for (const line of parts) {
      if (!/[A-Za-z]{3}/.test(line)) { done.push(line); continue }
      const r = (await env.AI.run(FALLBACK as never, { text: line, source_lang: 'en', target_lang: 'ar' } as never)) as { translated_text?: string }
      done.push(r?.translated_text?.trim() || line)
    }
    const out = clean(done.join('\n'))
    return AR.test(out) ? out : ''
  } catch { return '' }
}

const clean = (s: string) => s.trim().replace(/^["'«“]+|["'»”]+$/g, '').replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').slice(0, 4000)

/* Fills the Arabic fields of one product. `force` rewrites them, otherwise only empty ones are filled. */
export async function translateProduct(env: Env, id: number, force = false): Promise<{ ok: boolean; short_ar?: string; desc_ar?: string; reason?: string }> {
  if (!env.AI) return { ok: false, reason: 'Automatic translation is not switched on for this site yet.' }
  const p = await env.DB.prepare('SELECT short_en, short_ar, desc_en, desc_ar FROM products WHERE id = ?').bind(id).first<{ short_en: string; short_ar: string; desc_en: string; desc_ar: string }>()
  if (!p) return { ok: false, reason: 'Product not found' }
  const short_ar = (force || !p.short_ar) && p.short_en ? await toArabic(env, p.short_en, 'short') : p.short_ar
  const desc_ar = (force || !p.desc_ar) && p.desc_en ? await toArabic(env, p.desc_en, 'desc') : p.desc_ar
  if ((p.short_en && !short_ar) || (p.desc_en && !desc_ar)) {
    await env.DB.prepare("UPDATE products SET short_ar = CASE WHEN ? <> '' THEN ? ELSE short_ar END, desc_ar = CASE WHEN ? <> '' THEN ? ELSE desc_ar END WHERE id = ?").bind(short_ar, short_ar, desc_ar, desc_ar, id).run()
    return { ok: false, short_ar, desc_ar, reason: 'The translation service did not answer. Try again in a minute.' }
  }
  await env.DB.prepare('UPDATE products SET short_ar = ?, desc_ar = ? WHERE id = ?').bind(short_ar, desc_ar, id).run()
  return { ok: true, short_ar, desc_ar }
}
