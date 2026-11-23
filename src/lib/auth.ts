import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from './db'

const ITERATIONS = 60000
const SESSION_DAYS = 14
const COOKIE = 'sl_admin'

const enc = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer)

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ?? randomHex(16)
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS },
    key,
    256,
  )
  return { hash: hex(bits), salt }
}

const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

/** Constant-time string compare. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function verifyLogin(db: D1Database, email: string, password: string) {
  const row = await db
    .prepare('SELECT id, pass_hash, salt FROM admins WHERE email = ?')
    .bind(email.trim().toLowerCase())
    .first<{ id: number; pass_hash: string; salt: string }>()
  if (!row) {
    await hashPassword(password) // keep timing similar for unknown emails
    return null
  }
  const { hash } = await hashPassword(password, row.salt)
  return safeEqual(hash, row.pass_hash) ? row.id : null
}

export async function tooManyAttempts(db: D1Database, ip: string) {
  const r = await db
    .prepare("SELECT count(*) AS n FROM login_attempts WHERE ip = ? AND at > datetime('now', '-15 minutes')")
    .bind(ip)
    .first<{ n: number }>()
  return (r?.n ?? 0) >= 8
}

export const recordAttempt = (db: D1Database, ip: string) =>
  db.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startSession(c: Context<any>, adminId: number) {
  const token = randomHex(32)
  await (c.env as Env).DB.batch([
    (c.env as Env).DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    (c.env as Env).DB.prepare(`INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).bind(
      await sha256(token),
      adminId,
    ),
  ])
  setCookie(c, COOKIE, token, { path: '/', httpOnly: true, secure: true, sameSite: 'Strict', maxAge: SESSION_DAYS * 86400 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function endSession(c: Context<any>) {
  const token = getCookie(c, COOKIE)
  if (token) await (c.env as Env).DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  deleteCookie(c, COOKIE, { path: '/' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function currentAdmin(c: Context<any>) {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  return (c.env as Env).DB.prepare(
    "SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > datetime('now')",
  )
    .bind(await sha256(token))
    .first<{ id: number; email: string }>()
}

/** Protects admin pages (redirect to login) and admin APIs (401). Also blocks cross-site writes. */
export const requireAdmin: MiddlewareHandler<{ Bindings: Env; Variables: { admin: { id: number; email: string } } }> = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin')
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: 'Bad origin' }, 403)
  }
  const admin = await currentAdmin(c)
  if (!admin) {
    if (c.req.path.startsWith('/admin/api/')) return c.json({ error: 'Not logged in' }, 401)
    return c.redirect('/admin/login')
  }
  c.set('admin', admin)
  await next()
}

export const clientIp = (c: Context) => c.req.header('cf-connecting-ip') ?? 'unknown'
