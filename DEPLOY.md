# 🚀 Cloudflare Pages Deployment Tutorial
## Salford Libya — Swarovski Showcase

---

## Prerequisites

Before you begin, make sure you have:
- [ ] A **Cloudflare account** (free at cloudflare.com)
- [ ] **Node.js 18+** installed on your computer
- [ ] **Git** installed on your computer
- [ ] The project files (this folder)

---

## Step 1 — Install Wrangler CLI

Wrangler is Cloudflare's command-line tool. Install it once globally:

```bash
npm install -g wrangler
```

Verify it's installed:

```bash
wrangler --version
# Should show: ⛅️ wrangler X.X.X
```

---

## Step 2 — Login to Cloudflare

```bash
wrangler login
```

This opens your browser. Log in with your Cloudflare account.  
After logging in, return to the terminal — it will say **"Successfully logged in"**.

Verify your account:

```bash
wrangler whoami
# Should show your email address
```

---

## Step 3 — Open the Project Folder

Navigate to your project folder in the terminal:

```bash
# On Windows:
cd C:\Users\YourName\Downloads\salford-libya

# On Mac/Linux:
cd ~/Downloads/salford-libya
```

Install dependencies (first time only):

```bash
npm install
```

---

## Step 4 — Build the Project

```bash
npm run build
```

You should see:
```
vite v6.x.x building SSR bundle for production...
✓ built in ~700ms
```

This creates a `dist/` folder — that's what gets deployed.

---

## Step 5 — Create a Cloudflare Pages Project

```bash
wrangler pages project create salford-libya --production-branch main
```

> **Note:** If `salford-libya` is already taken, try `salford-libya-store` or `salfordlibya`

You'll see a confirmation with your new project URL.

---

## Step 6 — Deploy to Cloudflare Pages

```bash
wrangler pages deploy dist --project-name salford-libya
```

After a few seconds you'll see:

```
✨ Success! Deployed to:
  https://XXXXXXXX.salford-libya.pages.dev
  https://main.salford-libya.pages.dev   ← use this one
```

**Your site is now live!** 🎉

---

## Step 7 — Test Your Live Site

Open these URLs in your browser:

| Page | URL |
|------|-----|
| Homepage (Arabic) | `https://main.salford-libya.pages.dev/ar/` |
| Homepage (English) | `https://main.salford-libya.pages.dev/en/` |
| All Products | `https://main.salford-libya.pages.dev/ar/products` |
| Sets Page | `https://main.salford-libya.pages.dev/ar/sets` |
| Admin Panel | `https://main.salford-libya.pages.dev/admin/login` |

**Admin login:**
- Username: `admin`
- Password: `salford2024`

---

## Step 8 — (Optional) Set a Custom Domain

If you own a domain like `salfordlibya.com`:

1. Go to **Cloudflare Dashboard** → **Pages** → **salford-libya**
2. Click **Custom Domains** → **Set up a custom domain**
3. Enter your domain and follow the DNS instructions

Or via CLI:
```bash
wrangler pages domain add salfordlibya.com --project-name salford-libya
```

---

## Updating the Site Later

Whenever you make changes, just run:

```bash
npm run build
wrangler pages deploy dist --project-name salford-libya
```

That's it — your changes go live in seconds!

---

## Changing Admin Password

1. Go to `https://main.salford-libya.pages.dev/admin/login`
2. Log in with `admin` / `salford2024`
3. Click **Settings** in the sidebar
4. Enter a new password in the **Admin Password** field
5. Click **Save Settings**

> ⚠️ **Important:** Since this app uses in-memory storage, the password resets to `salford2024` whenever Cloudflare restarts the Worker. For a permanent password, you'll need to change it in the source code (`src/data/products.ts`, `adminPass` field) and redeploy.

---

## Changing Facebook / Instagram URLs

1. Go to Admin Panel → **Settings**
2. Update **Facebook Page URL** and **Instagram Profile URL**
3. Click **Save Settings**

Or change them permanently in the source code:

```typescript
// src/data/products.ts — line ~461
let settings: SiteSettings = {
  facebookUrl: 'https://www.facebook.com/salfordlibya',   // ← change here
  instagramUrl: 'https://www.instagram.com/salford.libya/', // ← change here
  ...
}
```

Then rebuild and redeploy.

---

## Adding New Products

### Method A — Admin Panel (recommended)
1. Go to Admin Panel → **Products** → **Add Product**
2. Paste the filename in the parser: e.g. `SWAROVSKI-5642976(550)` → click **Parse**
3. Fill in the Name, Image URL, Description
4. Click **Save Product**

### Method B — Source Code
Add to `src/data/products.ts` in the `products` array:

```typescript
{
  id: '28',                    // next available number
  code: '5XXXXXX',             // Swarovski product code
  isSet: false,
  name: 'Product Name Here',
  category: 'necklaces',       // necklaces | earrings | bracelets | sets
  price: 500,                  // price in LYD
  image: 'https://www.genspark.ai/api/files/s/XXXXX',  // your image URL
  images: ['https://...'],
  description: 'Full description...',
  shortDesc: 'One line summary',
  inStock: true, quantity: 10, featured: false,
},
```

Then rebuild and redeploy.

---

## File Structure Reference

```
salford-libya/
├── src/
│   ├── index.tsx          ← Main app (all pages & API routes)
│   └── data/products.ts   ← Product database & settings
├── public/static/
│   ├── style.css          ← All styles (luxury dark theme)
│   ├── app.js             ← Frontend JavaScript
│   └── favicon.svg        ← Store icon
├── dist/                  ← Built files (auto-generated, deploy this)
├── wrangler.jsonc         ← Cloudflare configuration
├── vite.config.ts         ← Build configuration
└── package.json           ← Dependencies & scripts
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `wrangler: command not found` | Run `npm install -g wrangler` again |
| `Error: Not authenticated` | Run `wrangler login` |
| `Project name already exists` | Try `salford-libya-2` or `salfordlibya-store` |
| Build fails | Run `npm install` then `npm run build` again |
| Images not loading | Check the image URL is accessible from a browser |
| Admin login fails | Default credentials: `admin` / `salford2024` |

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name salford-libya

# View your deployments
wrangler pages deployment list --project-name salford-libya

# View logs (if something breaks)
wrangler pages deployment tail --project-name salford-libya
```

---

*Salford Libya — Authorized Swarovski Retailer in Libya*  
*FB: https://www.facebook.com/salfordlibya*  
*IG: https://www.instagram.com/salford.libya/*
