// A small stand-in for Cloudflare D1 over Node's built-in SQLite, loaded with the real migrations.
// Enough for the shop's own queries, so tests catch wrong column names and broken SQL before a deploy.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'

type Val = string | number | bigint | null | Uint8Array

const toVal = (v: unknown): Val => {
  if (v === undefined) throw new Error('D1_TYPE_ERROR: undefined is not a valid value') // same as D1
  if (typeof v === 'boolean') return v ? 1 : 0
  return v as Val
}
const plain = (r: unknown) => (r ? { ...(r as object) } : null)

class Stmt {
  constructor(private db: DatabaseSync, readonly sql: string, private args: Val[] = []) {}
  bind(...a: unknown[]) { return new Stmt(this.db, this.sql, a.map(toVal)) }
  private st() { return this.db.prepare(this.sql) }
  async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
    const r = plain(this.st().get(...this.args)) as Record<string, unknown> | null
    return (col ? (r?.[col] ?? null) : r) as T | null
  }
  allSync() { return { results: this.st().all(...this.args).map(plain), success: true, meta: {} } }
  async all<T = Record<string, unknown>>() { return this.allSync() as unknown as { results: T[]; success: true; meta: object } }
  async run() {
    const r = this.st().run(...this.args)
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
  }
  async raw() { return this.st().all(...this.args).map((r) => Object.values(r as object)) }
}

export function makeD1() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const dir = new URL('../migrations/', import.meta.url)
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'))
  return {
    sqlite: db,
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(list: Stmt[]) {
      db.exec('BEGIN')
      try {
        const out = list.map((s) => s.allSync())
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    async exec(sql: string) { db.exec(sql); return { count: 1, duration: 0 } },
  }
}
