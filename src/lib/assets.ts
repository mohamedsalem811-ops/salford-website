import siteJs from '../assets/site.js?raw'
import siteCss from '../assets/site.css?raw'
import adminJs from '../assets/admin.js?raw'
import adminCss from '../assets/admin.css?raw'

/**
 * The site's own scripts and styles are served by the worker (at /a/<name>.<build>.<ext>), not as Pages static files,
 * so a release that changes them deploys as one piece. Each address carries the build, so browsers keep a copy for a year.
 */
const FILES: Record<string, { body: string; type: string }> = {
  'site.js': { body: siteJs, type: 'text/javascript; charset=utf-8' },
  'site.css': { body: siteCss, type: 'text/css; charset=utf-8' },
  'admin.js': { body: adminJs, type: 'text/javascript; charset=utf-8' },
  'admin.css': { body: adminCss, type: 'text/css; charset=utf-8' },
}

export const assetPath = (name: keyof typeof FILES | string, v: string) => {
  const dot = name.lastIndexOf('.')
  return `/a/${name.slice(0, dot)}.${v}${name.slice(dot)}`
}

/** "site.k3x9.js" → the file, when the build matches; an old build's address gets the current file without long caching. */
export function assetFor(file: string, v: string) {
  const m = /^([a-z]+)\.([a-z0-9]+)\.(js|css)$/.exec(file)
  if (!m) return null
  const f = FILES[`${m[1]}.${m[3]}`]
  if (!f) return null
  return { ...f, immutable: m[2] === v }
}
