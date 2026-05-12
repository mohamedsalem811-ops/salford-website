# Salford Libya — Swarovski Showcase Website

A complete bilingual (Arabic/English) luxury product showcase website for **Salford Libya**, an authorized Swarovski jewelry retailer in Libya. Built with Hono on Cloudflare Pages.

---

## Project Overview

| | |
|---|---|
| **Brand** | Salford Libya × Swarovski |
| **Type** | Digital catalog (no e-commerce — customers contact via social media to purchase) |
| **Languages** | Arabic (RTL) + English (LTR) with auto-detection |
| **Platform** | Cloudflare Pages + Hono Framework |
| **Theme** | Luxury dark: black `#050505`, gold `#c9a96e`, purple `#6b4dff`, silver `#c8ccd4` |

---

## Live URLs

| Environment | URL |
|---|---|
| **Production (Cloudflare)** | _Pending deployment — see Deploy tab_ |
| **Sandbox (dev)** | `http://localhost:3000` |

---

## Features

### Customer-Facing
- **Bilingual AR/EN** — full RTL/LTR layout switching, auto-detects language from URL (`/ar/`, `/en/`)
- **28 individual Swarovski products** with real product images
- **3 product sets/bundles** (ID 101, 102, 103) with savings display and component breakdown
- **"Buy Now" modal** — opens Facebook Messenger, Instagram DM, and WhatsApp with pre-filled Arabic purchase messages
- **Live search** — dropdown results as you type
- **Category filtering** — Rings, Necklaces, Bracelets, Earrings
- **Responsive grid** — 4→3→2→1 columns across breakpoints
- **Hero section** — animated particles background, counter animation
- **Luxury dark aesthetic** — Google Fonts (Cairo for Arabic, Cormorant Garamond for English)

### Admin Panel
- **Login**: `/admin/login` — default credentials: `admin` / `salford2024`
- **Dashboard**: `/admin/dashboard` — full product management
- **Product CRUD**: add, edit, delete products
- **Filename parser**: paste `SWAROVSKI-CODE(PRICE دينار)` to auto-fill product details
- **Settings management**: social media URLs, WhatsApp number, hero text, admin credentials
- **Stats cards**: total products, sets, in-stock count, featured products

---

## URL Structure

### Public Pages
| Route | Description |
|---|---|
| `/` | Redirects to `/ar/` |
| `/ar/` | Arabic homepage |
| `/en/` | English homepage |
| `/ar/products` | Full product catalog (Arabic) |
| `/en/products` | Full product catalog (English) |
| `/ar/sets` | Product sets listing (Arabic) |
| `/en/sets` | Product sets listing (English) |
| `/ar/product/:id` | Individual product detail page (Arabic) |
| `/en/product/:id` | Individual product detail page (English) |

### Admin Panel
| Route | Description |
|---|---|
| `/admin/login` | Admin login form |
| `/admin/dashboard` | Admin dashboard (requires login) |

### API Endpoints
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/products` | List products (query: `q`, `category`, `sets`) |
| `POST` | `/api/products` | Create new product |
| `PUT` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Delete product |
| `GET` | `/api/settings` | Get site settings |
| `PUT` | `/api/settings` | Update site settings |
| `POST` | `/api/parse-filename` | Parse Swarovski filename → product data |

---

## Product Filename Format

Products can be auto-imported by pasting their filename in the admin panel:

```
SWAROVSKI-[CODE(S)]([PRICE] دينار)
```

**Single product:**
```
SWAROVSKI-5614925(420 دينار)
```

**Product set (codes joined with `+`):**
```
SWAROVSKI-5614925+5007751(750 دينار)
```

---

## Product Catalog

### Individual Products (28 items)
| ID | Code | Name | Price |
|---|---|---|---|
| 1 | 5614925 | Hyperbola Necklace | 420 LYD |
| 2 | 5007751 | Constella Earrings | 380 LYD |
| 3 | 5636512 | Millenia Necklace | 520 LYD |
| 4 | 5514979 | Angelic Bracelet | 310 LYD |
| 5 | 5579187 | Attract Ring | 290 LYD |
| 6 | 5600937 | Remix Bracelet | 350 LYD |
| 7 | 5636428 | Millenia Earrings | 460 LYD |
| 8 | 5517798 | Tennis Deluxe Bracelet | 580 LYD |
| 9 | 5511550 | Constella Ring | 320 LYD |
| 10 | 5568781 | Matrix Necklace | 440 LYD |
| 11 | 5572608 | Gema Ring | 270 LYD |
| 12 | 5599194 | Hyperbola Earrings | 390 LYD |
| 13 | 5636246 | Ortyx Bracelet | 410 LYD |
| 14 | 5614931 | Hyperbola Pendant | 480 LYD |
| 15 | 5524087 | Attract Earrings | 360 LYD |
| 16 | 5601580 | Constella Necklace | 540 LYD |
| 17 | 5636435 | Millenia Ring | 430 LYD |
| 18 | 5620553 | Gema Earrings | 300 LYD |
| 19 | 5613733 | Matrix Bracelet | 370 LYD |
| 20 | 5619178 | Signum Necklace | 560 LYD |
| 21 | 5636257 | Ortyx Earrings | 490 LYD |
| 22 | 5615006 | Hyperbola Ring | 400 LYD |
| 23 | 5636468 | Millenia Bracelet | 510 LYD |
| 24 | 5619190 | Signum Earrings | 330 LYD |
| 25 | 5614443 | Swan Lake Necklace | 620 LYD |
| 26 | 5655642 | Imber Pendant | 450 LYD |
| 27 | 5647553 | Numina Earrings | 340 LYD |
| 28 | 5664151 | Dextera Bracelet | 395 LYD |

### Product Sets (3 bundles)
| ID | Name | Price | Savings |
|---|---|---|---|
| 101 | Hyperbola Complete Set | 670 LYD | 130 LYD |
| 102 | Constella Full Collection | 850 LYD | 120 LYD |
| 103 | Millenia Luxury Set | 1,250 LYD | 200 LYD |

---

## Social Media Purchase Flow

When a customer clicks **"Buy Now"**, a modal appears with three buttons:

1. **Facebook Messenger** — opens `m.me/SalfordLibya` with pre-filled Arabic message
2. **Instagram DM** — opens `instagram.com/direct/new/` with the product name
3. **WhatsApp** — opens `wa.me/{number}?text=...` with full Arabic message including product code

**Example Arabic message (auto-generated):**
```
مرحباً، أريد الاستفسار عن: SWAROVSKI-5614925 - Hyperbola Necklace
```

---

## Data Architecture

| Layer | Technology | Notes |
|---|---|---|
| **Backend** | Hono on Cloudflare Workers | Edge runtime, no Node.js APIs |
| **Data Storage** | In-memory (module-level variables) | Resets on Worker restart — see D1 upgrade path |
| **Static Assets** | `public/static/` served via `serveStatic` | CSS + JS loaded via CDN-compatible path |
| **Fonts** | Google Fonts CDN | Cairo (AR), Cormorant Garamond + Playfair Display (EN) |
| **Icons** | Font Awesome 6.4 CDN | Used throughout UI |

> **Note on persistence**: The current data store is in-memory and resets when the Cloudflare Worker cold-starts. For production persistence, upgrade to **Cloudflare D1** (SQLite) — migrations are ready to be written.

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | [Hono](https://hono.dev/) v4 |
| Runtime | Cloudflare Workers (edge) |
| Build tool | Vite 5 + `@hono/vite-cloudflare-pages` |
| Language | TypeScript |
| CSS | Custom luxury dark theme (~950 lines) |
| Frontend JS | Vanilla JS (~430 lines) |
| Dev server | Wrangler Pages Dev via PM2 |
| Version control | Git (branch: `main`) |

---

## Admin Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `salford2024` |
| Login URL | `/admin/login` |

> **Security note**: Change these credentials immediately via the Admin → Settings panel before going to production.

---

## Deployment

### Cloudflare Pages (Production)

1. Set up your Cloudflare API key in the **Deploy tab** of this sandbox
2. Run deployment:
   ```bash
   cd /home/user/webapp
   npm run build
   npx wrangler pages project create salford-libya --production-branch main
   npx wrangler pages deploy dist --project-name salford-libya
   ```

### Local Development (Sandbox)
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
# Service available at http://localhost:3000
```

### Key Scripts
```bash
npm run build        # Build for Cloudflare Pages (outputs dist/)
npm run dev          # Vite dev server (local machine only)
pm2 list             # Check service status
pm2 logs --nostream  # View recent logs
pm2 restart salford-libya  # Restart service
```

---

## Customization Guide

### Change Social Media Links
Go to `/admin/login` → login → **Settings** tab:
- Facebook Page URL
- Instagram Profile URL  
- WhatsApp Number (include country code, e.g. `218912345678`)

### Change Hero Text
Admin → Settings → Hero Title / Hero Subtitle (both Arabic and English)

### Add a New Product
**Method 1 — Filename Parser (recommended):**
1. Admin → Dashboard → "Add Product" button
2. Paste the filename: `SWAROVSKI-5614925(420 دينار)`
3. Fields auto-fill — add image URL, description, then save

**Method 2 — Manual:**
1. Admin → Dashboard → "Add Product"
2. Fill all fields manually

---

## File Structure

```
webapp/
├── src/
│   ├── index.tsx          # Main Hono app (~650 lines): all routes, HTML, API
│   ├── renderer.tsx       # Original JSX renderer (unused)
│   └── data/
│       └── products.ts    # Data layer: 28 products, 3 sets, CRUD, filename parser
├── public/
│   └── static/
│       ├── style.css      # Luxury dark theme CSS (~950 lines)
│       └── app.js         # Frontend JS (~430 lines): buy modal, admin, search
├── dist/                  # Build output (auto-generated)
│   └── _worker.js         # Compiled Cloudflare Worker (~91 kB)
├── ecosystem.config.cjs   # PM2 config for sandbox dev
├── wrangler.jsonc         # Cloudflare Pages configuration
├── vite.config.ts         # Vite build configuration
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

---

## Status

| Item | Status |
|---|---|
| Product catalog (28 items) | ✅ Complete |
| Product sets (3 bundles) | ✅ Complete |
| Bilingual AR/EN | ✅ Complete |
| RTL/LTR layout | ✅ Complete |
| Buy Now modal (FB/IG/WA) | ✅ Complete |
| Admin panel (CRUD + settings) | ✅ Complete |
| Filename parser | ✅ Complete |
| Build (`npm run build`) | ✅ 91.58 kB |
| Sandbox service (PM2) | ✅ Running on :3000 |
| Cloudflare Pages deployment | ⏳ Pending API key setup |
| D1 persistent database | 🔲 Optional enhancement |

---

*Last updated: 2026-05-12 — Salford Libya Swarovski Showcase v1.0*
