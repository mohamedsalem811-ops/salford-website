// Bundles the tests for Node. Files imported with "?raw" (the worker's own scripts and styles) load as text, as in Vite.
import { build } from 'esbuild'
import { readFileSync, readdirSync } from 'node:fs'

const raw = {
  name: 'raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: new URL(a.path.slice(0, -4), `file://${a.resolveDir}/`).pathname, namespace: 'raw' }))
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: readFileSync(a.path, 'utf8'), loader: 'text' }))
  },
}
await build({
  entryPoints: readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => `tests/${f}`),
  bundle: true, platform: 'node', format: 'esm', outdir: '.test-build', outExtension: { '.js': '.mjs' }, logLevel: 'warning',
  define: { __BUILD__: '"test"' }, jsx: 'automatic', jsxImportSource: 'hono/jsx', plugins: [raw],
})
