import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify(Date.now().toString(36)),
  },
  plugins: [
    build({ entry: 'src/index.tsx' }),
    devServer({ adapter, entry: 'src/index.tsx' }),
  ],
})
