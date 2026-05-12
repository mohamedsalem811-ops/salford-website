import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import {
  getAll, getById, getSets, getIndividual, getFeatured, getFeaturedSets,
  byCategory, addProduct, updateProduct, deleteProduct,
  getSettings, updateSettings, parseFilename, Product
} from './data/products'

const app = new Hono()
app.use('/static/*', serveStatic({ root: './public' }))
app.use('/api/*', cors())

// ─── i18n ──────────────────────────────────────────────────────────────────────
const t: Record<string, Record<string, string>> = {
  ar: {
    home: 'الرئيسية', products: 'المنتجات', sets: 'الأطقم',
    categories: 'الفئات', admin: 'الإدارة',
    necklaces: 'القلائد', earrings: 'الأقراط',
    bracelets: 'الأساور', rings: 'الخواتم',
    buyNow: 'اشتري الآن', contactUs: 'تواصل معنا للشراء',
    chooseChannel: 'اختار منصة التواصل',
    facebook: 'فيسبوك', instagram: 'إنستغرام',
    outOfStock: 'غير متوفر', inStock: 'متوفر',
    featured: 'المميزة', allProducts: 'جميع المنتجات',
    setsTitle: 'الأطقم والمجموعات', save: 'وفر',
    setContains: 'يحتوي الطقم على', searchPlaceholder: 'ابحث عن منتج...',
    noResults: 'لا توجد نتائج', filterAll: 'الكل',
    sortNewest: 'الأحدث', sortLow: 'الأقل سعراً', sortHigh: 'الأعلى سعراً',
    adminLogin: 'دخول الإدارة', username: 'اسم المستخدم', password: 'كلمة المرور',
    loginBtn: 'دخول', dashboard: 'لوحة التحكم',
    addProduct: 'إضافة منتج', editProduct: 'تعديل', deleteProduct: 'حذف',
    saveBtn: 'حفظ', cancelBtn: 'إلغاء',
    productName: 'اسم المنتج', productCode: 'رمز المنتج',
    productPrice: 'السعر (LYD)', productCategory: 'الفئة',
    productImage: 'رابط الصورة', productDesc: 'الوصف',
    productStock: 'متوفر', productQty: 'الكمية', productFeatured: 'مميز',
    settings: 'الإعدادات', totalProducts: 'إجمالي المنتجات',
    parseFilename: 'استيراد بالاسم', heroTitle: 'عنوان الصفحة الرئيسية',
    copyright: 'جميع الحقوق محفوظة',
    currency: 'دينار', viewAll: 'عرض الكل', shopNow: 'تسوق الآن',
    heroTagline: 'وكيل معتمد لمجوهرات سواروفسكي في ليبيا',
  },
  en: {
    home: 'Home', products: 'Products', sets: 'Sets',
    categories: 'Categories', admin: 'Admin',
    necklaces: 'Necklaces', earrings: 'Earrings',
    bracelets: 'Bracelets', rings: 'Rings',
    buyNow: 'Buy Now', contactUs: 'Contact Us to Buy',
    chooseChannel: 'Choose your platform',
    facebook: 'Facebook', instagram: 'Instagram',
    outOfStock: 'Out of Stock', inStock: 'In Stock',
    featured: 'Featured', allProducts: 'All Products',
    setsTitle: 'Sets & Collections', save: 'Save',
    setContains: 'This set includes', searchPlaceholder: 'Search products...',
    noResults: 'No results found', filterAll: 'All',
    sortNewest: 'Newest', sortLow: 'Price: Low to High', sortHigh: 'Price: High to Low',
    adminLogin: 'Admin Login', username: 'Username', password: 'Password',
    loginBtn: 'Login', dashboard: 'Dashboard',
    addProduct: 'Add Product', editProduct: 'Edit', deleteProduct: 'Delete',
    saveBtn: 'Save', cancelBtn: 'Cancel',
    productName: 'Product Name', productCode: 'Product Code',
    productPrice: 'Price (LYD)', productCategory: 'Category',
    productImage: 'Image URL', productDesc: 'Description',
    productStock: 'In Stock', productQty: 'Quantity', productFeatured: 'Featured',
    settings: 'Settings', totalProducts: 'Total Products',
    parseFilename: 'Import by Filename', heroTitle: 'Hero Title',
    copyright: 'All rights reserved',
    currency: 'LYD', viewAll: 'View All', shopNow: 'Shop Now',
    heroTagline: 'Authorized Swarovski Retailer in Libya',
  }
}
const tr = (key: string, lang: string) => (t[lang]?.[key]) || (t['en'][key]) || key

// ─── HTML Shell ───────────────────────────────────────────────────────────────
function shell(content: string, lang: string, pageTitle = '') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const s = getSettings()
  const title = pageTitle ? `${pageTitle} | ${s.storeName}` : s.storeName
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" data-lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"/>
<meta name="description" content="Salford Libya — Authorized Swarovski Jewelry Retailer in Libya | سالفورد ليبيا — وكيل سواروفسكي المعتمد"/>
<meta property="og:image" content="https://www.genspark.ai/api/files/s/sl2CP5Aq"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Cairo:wght@300;400;600;700&display=swap"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<link rel="stylesheet" href="/static/style.css"/>
</head>
<body>
${content}
<div id="buy-modal" class="modal-overlay" style="display:none;">
  <div class="modal-box">
    <button class="modal-close" onclick="closeBuyModal()"><i class="fa fa-times"></i></button>
    <div class="modal-logo">
      <img src="https://www.genspark.ai/api/files/s/sl2CP5Aq" alt="Salford Libya"/>
    </div>
    <p class="modal-title" id="modal-product-name"></p>
    <p class="modal-sub">${lang === 'ar' ? 'اختار منصة التواصل للشراء' : 'Choose your preferred platform to buy'}</p>
    <div class="modal-btns">
      <a id="modal-fb-btn" href="#" target="_blank" rel="noopener" class="modal-btn fb-btn">
        <i class="fab fa-facebook-messenger"></i>
        <span>${lang === 'ar' ? 'تواصل عبر فيسبوك' : 'Contact via Facebook'}</span>
      </a>
      <a id="modal-ig-btn" href="#" target="_blank" rel="noopener" class="modal-btn ig-btn">
        <i class="fab fa-instagram"></i>
        <span>${lang === 'ar' ? 'تواصل عبر إنستغرام' : 'Contact via Instagram'}</span>
      </a>
    </div>
  </div>
</div>
<script src="/static/app.js"></script>
</body>
</html>`
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function nav(lang: string, active = '') {
  const other = lang === 'ar' ? 'en' : 'ar'
  const otherLabel = lang === 'ar' ? 'EN' : 'عربي'
  return `
<header class="site-header" id="site-header">
  <div class="header-inner">
    <a href="/${lang}/" class="logo-link">
      <img src="https://www.genspark.ai/api/files/s/sl2CP5Aq" alt="Salford Libya" class="logo-img"/>
    </a>
    <nav class="main-nav" id="main-nav">
      <a href="/${lang}/" class="${active==='home'?'active':''}">${tr('home',lang)}</a>
      <a href="/${lang}/products" class="${active==='products'?'active':''}">${tr('products',lang)}</a>
      <a href="/${lang}/sets" class="${active==='sets'?'active':''}">${tr('sets',lang)}</a>
      <div class="nav-dropdown">
        <a href="#" class="dropdown-trigger">${tr('categories',lang)} <i class="fa fa-chevron-down fa-xs"></i></a>
        <div class="dropdown-menu">
          <a href="/${lang}/products?cat=necklaces"><i class="fa fa-circle-dot"></i> ${tr('necklaces',lang)}</a>
          <a href="/${lang}/products?cat=earrings"><i class="fa fa-circle-dot"></i> ${tr('earrings',lang)}</a>
          <a href="/${lang}/products?cat=bracelets"><i class="fa fa-circle-dot"></i> ${tr('bracelets',lang)}</a>
        </div>
      </div>
    </nav>
    <div class="header-actions">
      <button class="search-toggle" onclick="toggleSearch()" aria-label="Search"><i class="fa fa-search"></i></button>
      <a href="/${other}/" class="lang-switch">${otherLabel}</a>
      <a href="/admin/login" class="admin-icon" title="Admin"><i class="fa fa-lock"></i></a>
      <button class="hamburger" id="hamburger" onclick="toggleMenu()" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
  <div class="search-bar" id="search-bar" style="display:none;">
    <form action="/${lang}/products" method="get" class="search-form">
      <input type="text" name="q" placeholder="${tr('searchPlaceholder',lang)}" autocomplete="off"/>
      <button type="submit"><i class="fa fa-search"></i></button>
    </form>
  </div>
</header>`
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
function productCard(p: Product, lang: string) {
  const savings = p.originalPrice ? p.originalPrice - p.price : 0
  const badge = !p.inStock
    ? `<span class="badge badge-out">${tr('outOfStock',lang)}</span>`
    : p.isSet && savings > 0
    ? `<span class="badge badge-save">${tr('save',lang)} ${savings} ${tr('currency',lang)}</span>`
    : p.featured ? `<span class="badge badge-new">✦</span>` : ''

  const safeName = p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')
  return `
<article class="product-card" onclick="window.location='/${lang}/product/${p.id}'">
  <div class="card-img-wrap">
    <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='/static/placeholder.jpg'"/>
    ${badge}
  </div>
  <div class="card-body">
    <p class="card-code">SWAROVSKI · ${p.code}</p>
    <h3 class="card-name">${p.name}</h3>
    <div class="card-footer">
      <div class="card-price">
        ${p.originalPrice ? `<span class="price-old">${p.originalPrice} ${tr('currency',lang)}</span>` : ''}
        <span class="price-now">${p.price} ${tr('currency',lang)}</span>
      </div>
      ${p.inStock
        ? `<button class="btn-buy" onclick="event.stopPropagation();openBuy('${p.id}','${safeName}','${p.code}')">
            <i class="fab fa-instagram"></i> ${tr('buyNow',lang)}
           </button>`
        : `<span class="out-label">${tr('outOfStock',lang)}</span>`}
    </div>
  </div>
</article>`
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function footer(lang: string) {
  const s = getSettings()
  return `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="https://www.genspark.ai/api/files/s/sl2CP5Aq" alt="Salford Libya" class="footer-logo"/>
        <p>${tr('heroTagline', lang)}</p>
      </div>
      <div class="footer-links">
        <h4>${lang==='ar'?'روابط':'Links'}</h4>
        <a href="/${lang}/">${tr('home',lang)}</a>
        <a href="/${lang}/products">${tr('products',lang)}</a>
        <a href="/${lang}/sets">${tr('sets',lang)}</a>
      </div>
      <div class="footer-social">
        <h4>${lang==='ar'?'تابعنا':'Follow Us'}</h4>
        <a href="${s.facebookUrl}" target="_blank" rel="noopener"><i class="fab fa-facebook"></i> Facebook</a>
        <a href="${s.instagramUrl}" target="_blank" rel="noopener"><i class="fab fa-instagram"></i> Instagram</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${s.storeName} · ${tr('copyright', lang)}</p>
    </div>
  </div>
</footer>`
}

// ══════════════════════════════════════════════════════════════════════════════
//  API ROUTES  ← must come BEFORE /:lang/* wildcard routes
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/products/:id', c => {
  const p = getById(c.req.param('id'))
  return p ? c.json(p) : c.json({ error: 'Not found' }, 404)
})

app.get('/api/products', c => c.json(getAll()))

app.post('/api/products', async c => {
  try {
    const data = await c.req.json()
    const id = addProduct(data)
    return c.json({ ok: true, id })
  } catch { return c.json({ ok: false }, 400) }
})

app.put('/api/products/:id', async c => {
  try {
    const data = await c.req.json()
    const ok = updateProduct(c.req.param('id'), data)
    return c.json({ ok })
  } catch { return c.json({ ok: false }, 400) }
})

app.delete('/api/products/:id', c => {
  const ok = deleteProduct(c.req.param('id'))
  return c.json({ ok })
})

app.get('/api/settings', c => c.json(getSettings()))

app.put('/api/settings', async c => {
  try {
    const data = await c.req.json()
    updateSettings(data)
    return c.json({ ok: true })
  } catch { return c.json({ ok: false }, 400) }
})

app.post('/api/parse-filename', async c => {
  try {
    const { filename } = await c.req.json()
    const result = parseFilename(filename)
    return result ? c.json({ ok: true, ...result }) : c.json({ ok: false, error: 'Invalid format' }, 400)
  } catch { return c.json({ ok: false }, 400) }
})

app.post('/api/auth', async c => {
  try {
    const { username, password } = await c.req.json()
    const s = getSettings()
    if (username === s.adminUser && password === s.adminPass) {
      return c.json({ ok: true })
    }
    return c.json({ ok: false }, 401)
  } catch { return c.json({ ok: false }, 400) }
})

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES  ← must come BEFORE /:lang/* wildcard routes
// ══════════════════════════════════════════════════════════════════════════════

app.get('/admin/login', c => {
  const html = `
<div class="admin-login-page">
  <div class="login-box">
    <img src="https://www.genspark.ai/api/files/s/sl2CP5Aq" alt="Salford Libya" class="login-logo"/>
    <h1>Admin Panel</h1>
    <p>Salford Libya — Swarovski Store</p>
    <form id="login-form" onsubmit="doLogin(event)">
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="login-user" required autocomplete="username"/>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="login-pass" required autocomplete="current-password"/>
      </div>
      <div id="login-err" class="login-err" style="display:none">Invalid credentials</div>
      <button type="submit" class="btn-primary btn-full">Login <i class="fa fa-arrow-right"></i></button>
    </form>
    <a href="/ar/" class="back-link"><i class="fa fa-arrow-left"></i> Back to Store</a>
  </div>
</div>`
  return c.html(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Admin | Salford Libya</title><link rel="icon" type="image/svg+xml" href="/static/favicon.svg"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Cairo:wght@400;600&display=swap"/><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/><link rel="stylesheet" href="/static/style.css"/></head><body class="admin-body" data-lang="en">${html}<script src="/static/app.js"></script></body></html>`)
})

app.get('/admin/dashboard', c => {
  const all = getAll()
  const s = getSettings()
  const stats = {
    total: all.length,
    sets: getSets().length,
    inStock: all.filter(p => p.inStock).length,
    featured: all.filter(p => p.featured).length
  }
  const cats = ['necklaces','earrings','bracelets','sets']

  const html = `
<div class="admin-wrap">
  <!-- Sidebar -->
  <aside class="admin-sidebar">
    <div class="sidebar-logo">
      <img src="https://www.genspark.ai/api/files/s/sl2CP5Aq" alt="Salford Libya"/>
    </div>
    <nav class="sidebar-nav">
      <a href="#products-tab" class="sidebar-link active" onclick="showTab('products');return false;"><i class="fa fa-box"></i> Products</a>
      <a href="#settings-tab" class="sidebar-link" onclick="showTab('settings');return false;"><i class="fa fa-cog"></i> Settings</a>
      <a href="/ar/" class="sidebar-link"><i class="fa fa-store"></i> View Store</a>
      <a href="#" onclick="adminLogout();return false;" class="sidebar-link sidebar-logout"><i class="fa fa-sign-out-alt"></i> Logout</a>
    </nav>
  </aside>

  <!-- Main -->
  <main class="admin-main">
    <!-- Stats -->
    <div class="admin-stats">
      <div class="stat-card"><span>${stats.total}</span><label>Total Products</label></div>
      <div class="stat-card"><span>${stats.sets}</span><label>Sets</label></div>
      <div class="stat-card"><span>${stats.inStock}</span><label>In Stock</label></div>
      <div class="stat-card"><span>${stats.featured}</span><label>Featured</label></div>
    </div>

    <!-- Products Tab -->
    <div id="products-tab" class="admin-tab">
      <div class="tab-head">
        <h2>Products</h2>
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="text" placeholder="Search products..." oninput="filterAdminTable(this.value)"
            style="padding:8px 14px;border-radius:8px;border:1px solid rgba(201,169,110,0.3);background:#1a1a1f;color:#f5f5f5;font-size:0.85rem;"/>
          <button class="btn-primary" onclick="openAddModal()"><i class="fa fa-plus"></i> Add Product</button>
        </div>
      </div>

      <!-- Filename Parser -->
      <div class="parser-box">
        <h4><i class="fa fa-magic"></i> Import by Filename</h4>
        <p>Paste a filename like: <code>SWAROVSKI-5642976(550)</code> or <code>SWAROVSKI-5416604+5512850(900)</code></p>
        <div class="parser-row">
          <input type="text" id="parse-input" placeholder="SWAROVSKI-CODE(PRICE)"/>
          <button onclick="parseFilename()" class="btn-secondary"><i class="fa fa-wand-magic-sparkles"></i> Parse</button>
        </div>
        <div id="parse-result" style="display:none;" class="parse-result"></div>
      </div>

      <!-- Products Table -->
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Image</th><th>Name</th><th>Code</th><th>Category</th>
              <th>Price</th><th>Stock</th><th>Featured</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${all.map(p => `
            <tr>
              <td><img src="${p.image}" alt="${p.name}" class="table-thumb" onerror="this.onerror=null;this.style.opacity='0.3'"/></td>
              <td><strong>${p.name}</strong>${p.isSet?'<span class="set-tag">SET</span>':''}</td>
              <td><code>${p.code}</code></td>
              <td>${p.category}</td>
              <td>${p.price} LYD${p.originalPrice?`<br/><small class="text-muted" style="color:#9a9a9a">was ${p.originalPrice}</small>`:''}</td>
              <td><span class="status-dot ${p.inStock?'dot-green':'dot-red'}"></span> ${p.inStock?'Yes':'No'} (${p.quantity})</td>
              <td>${p.featured?'<i class="fa fa-star" style="color:#c9a96e"></i>':'<i class="fa fa-star" style="color:#444"></i>'}</td>
              <td class="action-btns">
                <button onclick='openEditModal(${JSON.stringify(p)})' class="btn-sm btn-edit" title="Edit"><i class="fa fa-edit"></i></button>
                <button onclick="confirmDelete('${p.id}','${p.name.replace(/'/g,"\\'")}') " class="btn-sm btn-del" title="Delete"><i class="fa fa-trash"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Settings Tab -->
    <div id="settings-tab" class="admin-tab" style="display:none;">
      <h2>Site Settings</h2>
      <form onsubmit="saveSettings(event)" class="settings-form">
        <div class="settings-grid">
          <div class="form-group">
            <label>Facebook Page URL</label>
            <input type="url" name="facebookUrl" value="${s.facebookUrl}" placeholder="https://www.facebook.com/..."/>
          </div>
          <div class="form-group">
            <label>Instagram Profile URL</label>
            <input type="url" name="instagramUrl" value="${s.instagramUrl}" placeholder="https://www.instagram.com/..."/>
          </div>
          <div class="form-group">
            <label>Hero Title (Arabic)</label>
            <input type="text" name="heroTitleAr" value="${s.heroTitleAr}"/>
          </div>
          <div class="form-group">
            <label>Hero Title (English)</label>
            <input type="text" name="heroTitleEn" value="${s.heroTitleEn}"/>
          </div>
          <div class="form-group">
            <label>Hero Subtitle (Arabic)</label>
            <input type="text" name="heroSubtitleAr" value="${s.heroSubtitleAr}"/>
          </div>
          <div class="form-group">
            <label>Hero Subtitle (English)</label>
            <input type="text" name="heroSubtitleEn" value="${s.heroSubtitleEn}"/>
          </div>
          <div class="form-group">
            <label>Admin Username</label>
            <input type="text" name="adminUser" value="${s.adminUser}"/>
          </div>
          <div class="form-group">
            <label>Admin Password</label>
            <input type="password" name="adminPass" placeholder="Leave blank to keep current"/>
          </div>
        </div>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Save Settings</button>
      </form>
    </div>
  </main>
</div>

<!-- Add/Edit Product Modal -->
<div id="product-modal" class="modal-overlay" style="display:none;">
  <div class="modal-box modal-large">
    <button class="modal-close" onclick="closeProductModal()"><i class="fa fa-times"></i></button>
    <h2 id="modal-title">Add Product</h2>
    <form id="product-form" onsubmit="saveProduct(event)" class="product-form">
      <input type="hidden" id="pf-id"/>
      <div class="form-grid">
        <div class="form-group">
          <label>Product Name *</label>
          <input type="text" id="pf-name" required placeholder="e.g. Iconic Swan Stud Earrings"/>
        </div>
        <div class="form-group">
          <label>Product Code * <small style="color:#9a9a9a">(use + for sets)</small></label>
          <input type="text" id="pf-code" required placeholder="e.g. 5642976 or 5416604+5512850"/>
        </div>
        <div class="form-group">
          <label>Price (LYD) *</label>
          <input type="number" id="pf-price" required min="0" placeholder="e.g. 550"/>
        </div>
        <div class="form-group">
          <label>Original Price <small style="color:#9a9a9a">(for savings display)</small></label>
          <input type="number" id="pf-orig-price" min="0" placeholder="Optional — shows crossed-out price"/>
        </div>
        <div class="form-group">
          <label>Category *</label>
          <select id="pf-cat">
            ${cats.map(c => `<option value="${c}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity in Stock</label>
          <input type="number" id="pf-qty" value="10" min="0"/>
        </div>
        <div class="form-group form-full">
          <label>Image URL *</label>
          <input type="url" id="pf-image" required placeholder="https://www.genspark.ai/api/files/s/..."/>
        </div>
        <div class="form-group form-full">
          <label>Short Description <small style="color:#9a9a9a">(one line)</small></label>
          <input type="text" id="pf-short-desc" placeholder="e.g. Swan pavé studs, rhodium plated"/>
        </div>
        <div class="form-group form-full">
          <label>Full Description</label>
          <textarea id="pf-desc" rows="4" placeholder="Detailed product description..."></textarea>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="pf-instock" checked/> In Stock
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="pf-featured"/> Featured on Homepage
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="pf-isset"/> Is a Set (bundle)
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" onclick="closeProductModal()" class="btn-outline"><i class="fa fa-times"></i> Cancel</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Save Product</button>
      </div>
    </form>
  </div>
</div>

<!-- Delete Confirm Modal -->
<div id="delete-modal" class="modal-overlay" style="display:none;">
  <div class="modal-box modal-small">
    <h3><i class="fa fa-triangle-exclamation" style="color:#e74c3c"></i> Delete Product</h3>
    <p id="delete-msg" style="margin:16px 0;"></p>
    <div class="form-actions">
      <button onclick="closeDeleteModal()" class="btn-outline">Cancel</button>
      <button id="confirm-delete-btn" class="btn-danger"><i class="fa fa-trash"></i> Delete</button>
    </div>
  </div>
</div>`

  return c.html(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Admin Dashboard | Salford Libya</title><link rel="icon" type="image/svg+xml" href="/static/favicon.svg"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Cairo:wght@400;600&display=swap"/><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/><link rel="stylesheet" href="/static/style.css"/></head><body class="admin-body" data-lang="en">${html}<script src="/static/app.js"></script></body></html>`)
})

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE ROUTES  (/:lang/* — wildcard, must come LAST)
// ══════════════════════════════════════════════════════════════════════════════

app.get('/', c => c.redirect('/ar/'))
app.get('/:lang', c => {
  const lang = c.req.param('lang')
  if (lang !== 'ar' && lang !== 'en') return c.redirect('/ar/')
  return c.redirect(`/${lang}/`)
})

// ─── HOME ─────────────────────────────────────────────────────────────────────
app.get('/:lang/', c => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const s = getSettings()
  const featured = getFeatured().slice(0, 8)
  const featuredSets = getFeaturedSets()
  const cats = [
    { key: 'necklaces', icon: 'fa-circle-dot', label: tr('necklaces', lang), count: byCategory('necklaces').length },
    { key: 'earrings',  icon: 'fa-circle-dot', label: tr('earrings', lang),  count: byCategory('earrings').length  },
    { key: 'bracelets', icon: 'fa-circle-dot', label: tr('bracelets', lang), count: byCategory('bracelets').length },
  ]

  const html = `
${nav(lang, 'home')}
<main>
  <!-- HERO -->
  <section class="hero">
    <div class="hero-bg" id="particles"></div>
    <div class="hero-content">
      <p class="hero-tag">✦ ${tr('heroTagline', lang)} ✦</p>
      <h1 class="hero-title">${lang === 'ar' ? s.heroTitleAr : s.heroTitleEn}</h1>
      <p class="hero-sub">${lang === 'ar' ? s.heroSubtitleAr : s.heroSubtitleEn}</p>
      <div class="hero-actions">
        <a href="/${lang}/products" class="btn-primary"><i class="fa fa-gem"></i> ${tr('shopNow', lang)}</a>
        <a href="/${lang}/sets" class="btn-outline"><i class="fa fa-layer-group"></i> ${tr('setsTitle', lang)}</a>
      </div>
    </div>
    <div class="hero-scroll"><i class="fa fa-chevron-down"></i></div>
  </section>

  <!-- CATEGORIES -->
  <section class="section">
    <div class="container">
      <h2 class="section-title">${tr('categories', lang)}</h2>
      <div class="cat-grid">
        ${cats.map(cat => `
        <a href="/${lang}/products?cat=${cat.key}" class="cat-card">
          <div class="cat-icon"><i class="fa ${cat.icon}"></i></div>
          <h3>${cat.label}</h3>
          <span>${cat.count} ${lang === 'ar' ? 'منتج' : 'items'}</span>
        </a>`).join('')}
        <a href="/${lang}/sets" class="cat-card cat-sets">
          <div class="cat-icon"><i class="fa fa-gem"></i></div>
          <h3>${tr('setsTitle', lang)}</h3>
          <span>${featuredSets.length} ${lang === 'ar' ? 'طقم' : 'sets'}</span>
        </a>
      </div>
    </div>
  </section>

  <!-- FEATURED SETS -->
  ${featuredSets.length > 0 ? `
  <section class="section section-dark">
    <div class="container">
      <div class="section-head">
        <h2 class="section-title">${tr('setsTitle', lang)}</h2>
        <a href="/${lang}/sets" class="view-all">${tr('viewAll', lang)} <i class="fa fa-arrow-right"></i></a>
      </div>
      <div class="sets-grid">
        ${featuredSets.map(p => {
          const savings = p.originalPrice ? p.originalPrice - p.price : 0
          const safeName = p.name.replace(/'/g, "\\'")
          return `
        <article class="set-card" onclick="window.location='/${lang}/product/${p.id}'">
          <div class="set-imgs">
            ${p.images.slice(0,2).map((img,i) => `<img src="${img}" alt="${p.name}" class="set-img set-img-${i+1}" loading="lazy" onerror="this.onerror=null;this.style.opacity='0.3'"/>`).join('')}
          </div>
          <div class="set-body">
            <p class="card-code">SET · ${p.code}</p>
            <h3>${p.name}</h3>
            <p class="set-items-list">${(p.setItems||[]).map(i=>`<span>${i.split('(')[0].trim()}</span>`).join(' + ')}</p>
            <div class="set-price-row">
              <div>
                ${p.originalPrice ? `<span class="price-old">${p.originalPrice} ${tr('currency',lang)}</span>` : ''}
                <span class="price-now">${p.price} ${tr('currency',lang)}</span>
              </div>
              ${savings > 0 ? `<span class="save-badge">${tr('save',lang)} ${savings} ${tr('currency',lang)}</span>` : ''}
            </div>
            <button class="btn-buy btn-full" onclick="event.stopPropagation();openBuy('${p.id}','${safeName}','${p.code}')">
              <i class="fab fa-instagram"></i> ${tr('buyNow', lang)}
            </button>
          </div>
        </article>`}).join('')}
      </div>
    </div>
  </section>` : ''}

  <!-- FEATURED PRODUCTS -->
  <section class="section">
    <div class="container">
      <div class="section-head">
        <h2 class="section-title">${tr('featured', lang)}</h2>
        <a href="/${lang}/products" class="view-all">${tr('viewAll', lang)} <i class="fa fa-arrow-right"></i></a>
      </div>
      <div class="product-grid">
        ${featured.map(p => productCard(p, lang)).join('')}
      </div>
    </div>
  </section>

  <!-- SOCIAL STRIP -->
  <section class="social-strip">
    <div class="container">
      <p>${lang === 'ar' ? 'تابعنا على منصاتنا' : 'Follow us on our platforms'}</p>
      <div class="social-btns">
        <a href="${getSettings().facebookUrl}" target="_blank" rel="noopener" class="social-btn fb">
          <i class="fab fa-facebook"></i> Facebook
        </a>
        <a href="${getSettings().instagramUrl}" target="_blank" rel="noopener" class="social-btn ig">
          <i class="fab fa-instagram"></i> Instagram
        </a>
      </div>
    </div>
  </section>
</main>
${footer(lang)}`
  return c.html(shell(html, lang))
})

// ─── PRODUCTS PAGE ────────────────────────────────────────────────────────────
app.get('/:lang/products', c => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const q    = c.req.query('q')   || ''
  const cat  = c.req.query('cat') || ''
  const sort = c.req.query('sort')|| 'newest'

  let items = getIndividual()
  if (q)   items = items.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.code.toLowerCase().includes(q.toLowerCase()) ||
    p.shortDesc.toLowerCase().includes(q.toLowerCase())
  )
  if (cat) items = items.filter(p => p.category === cat)
  if (sort === 'low')  items = [...items].sort((a, b) => a.price - b.price)
  else if (sort === 'high') items = [...items].sort((a, b) => b.price - a.price)

  const catList = ['necklaces', 'earrings', 'bracelets']
  const html = `
${nav(lang, 'products')}
<main>
  <section class="page-hero">
    <div class="container">
      <h1>${q ? `"${q}"` : cat ? tr(cat, lang) : tr('allProducts', lang)}</h1>
      <p>${items.length} ${lang === 'ar' ? 'منتج' : 'products'}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="filter-bar">
        <div class="filter-cats">
          <a href="/${lang}/products" class="filter-tag ${!cat?'active':''}">${tr('filterAll',lang)}</a>
          ${catList.map(c => `<a href="/${lang}/products?cat=${c}" class="filter-tag ${cat===c?'active':''}">${tr(c,lang)}</a>`).join('')}
        </div>
        <div class="filter-sort">
          <select onchange="location='/${lang}/products?${cat?'cat='+cat+'&':''}${q?'q='+encodeURIComponent(q)+'&':''}sort='+this.value">
            <option value="newest" ${sort==='newest'?'selected':''}>${tr('sortNewest',lang)}</option>
            <option value="low"    ${sort==='low'?'selected':''}>${tr('sortLow',lang)}</option>
            <option value="high"   ${sort==='high'?'selected':''}>${tr('sortHigh',lang)}</option>
          </select>
        </div>
      </div>
      ${items.length === 0
        ? `<div class="empty-state"><i class="fa fa-search"></i><p>${tr('noResults',lang)}</p></div>`
        : `<div class="product-grid">${items.map(p => productCard(p, lang)).join('')}</div>`}
    </div>
  </section>
</main>
${footer(lang)}`
  return c.html(shell(html, lang, tr('allProducts', lang)))
})

// ─── SETS PAGE ────────────────────────────────────────────────────────────────
app.get('/:lang/sets', c => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const sets = getSets()
  const html = `
${nav(lang, 'sets')}
<main>
  <section class="page-hero">
    <div class="container">
      <h1>${tr('setsTitle', lang)}</h1>
      <p>${sets.length} ${lang === 'ar' ? 'طقم' : 'sets'}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="sets-grid sets-grid-lg">
        ${sets.map(p => {
          const savings = p.originalPrice ? p.originalPrice - p.price : 0
          const safeName = p.name.replace(/'/g, "\\'")
          return `
        <article class="set-card set-card-lg" onclick="window.location='/${lang}/product/${p.id}'">
          <div class="set-imgs">
            ${p.images.slice(0,2).map((img,i) => `<img src="${img}" alt="${p.name}" class="set-img set-img-${i+1}" loading="lazy" onerror="this.onerror=null;this.style.opacity='0.3'"/>`).join('')}
          </div>
          <div class="set-body">
            <p class="card-code">SET · ${p.code}</p>
            <h3>${p.name}</h3>
            <div class="set-items-detail">
              <p class="set-includes-label">${tr('setContains', lang)}:</p>
              <ul>${(p.setItems||[]).map(item => `<li><i class="fa fa-check"></i> ${item.split('(')[0].trim()}</li>`).join('')}</ul>
            </div>
            <div class="set-price-row">
              <div>
                ${p.originalPrice ? `<span class="price-old">${p.originalPrice} ${tr('currency',lang)}</span>` : ''}
                <span class="price-now">${p.price} ${tr('currency',lang)}</span>
              </div>
              ${savings > 0 ? `<span class="save-badge">${tr('save',lang)} ${savings} ${tr('currency',lang)}</span>` : ''}
            </div>
            <button class="btn-buy btn-full" onclick="event.stopPropagation();openBuy('${p.id}','${safeName}','${p.code}')">
              <i class="fab fa-instagram"></i> ${tr('buyNow', lang)}
            </button>
          </div>
        </article>`}).join('')}
      </div>
    </div>
  </section>
</main>
${footer(lang)}`
  return c.html(shell(html, lang, tr('setsTitle', lang)))
})

// ─── PRODUCT DETAIL ───────────────────────────────────────────────────────────
app.get('/:lang/product/:id', c => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const p    = getById(c.req.param('id'))
  if (!p) return c.redirect(`/${lang}/products`)

  const savings = p.originalPrice ? p.originalPrice - p.price : 0
  const related = getAll()
    .filter(r => r.id !== p.id && r.category === p.category && !r.isSet)
    .slice(0, 4)

  const html = `
${nav(lang)}
<main>
  <div class="container">
    <div class="breadcrumb">
      <a href="/${lang}/">${tr('home',lang)}</a>
      <i class="fa fa-chevron-right fa-xs"></i>
      <a href="/${lang}/${p.isSet?'sets':'products'}">${p.isSet?tr('setsTitle',lang):tr('products',lang)}</a>
      <i class="fa fa-chevron-right fa-xs"></i>
      <span>${p.name}</span>
    </div>
  </div>

  <section class="product-detail section">
    <div class="container">
      <div class="detail-grid">
        <!-- Gallery -->
        <div class="detail-gallery">
          <div class="gallery-main">
            <img src="${p.image}" alt="${p.name}" id="main-img"
              onclick="openLightbox(this.src)"
              onerror="this.onerror=null;this.style.opacity='0.3'"
              style="cursor:zoom-in;transition:opacity 0.15s;"/>
          </div>
          ${p.images.length > 1 ? `
          <div class="gallery-thumbs">
            ${p.images.map((img,i) => `
            <img src="${img}" alt="${p.name} ${i+1}"
              onclick="switchImg('${img}')"
              class="${i===0?'thumb-active':''}"
              loading="lazy"
              onerror="this.onerror=null;this.style.opacity='0.2'"/>`).join('')}
          </div>` : ''}
        </div>

        <!-- Info -->
        <div class="detail-info">
          <p class="detail-code">SWAROVSKI · ${p.code}</p>
          <h1 class="detail-name">${p.name}</h1>
          <div class="detail-price">
            ${p.originalPrice ? `<span class="price-old">${p.originalPrice} ${tr('currency',lang)}</span>` : ''}
            <span class="price-big">${p.price} ${tr('currency',lang)}</span>
            ${savings > 0 ? `<span class="save-badge">${tr('save',lang)} ${savings} ${tr('currency',lang)}</span>` : ''}
          </div>

          <p class="detail-stock ${p.inStock?'stock-in':'stock-out'}">
            <i class="fa fa-circle fa-xs"></i>
            ${p.inStock ? tr('inStock',lang) : tr('outOfStock',lang)}
            ${p.inStock && p.quantity > 0 ? ` · ${p.quantity} ${lang==='ar'?'قطعة متبقية':'remaining'}` : ''}
          </p>

          ${p.inStock ? `
          <div class="buy-btns">
            <a href="${getSettings().facebookUrl}" target="_blank" rel="noopener"
               class="btn-channel fb-channel" onclick="trackBuy('${p.id}','fb')">
              <i class="fab fa-facebook-messenger"></i>
              <div>
                <span>${tr('buyNow',lang)}</span>
                <small>Facebook</small>
              </div>
            </a>
            <a href="${getSettings().instagramUrl}" target="_blank" rel="noopener"
               class="btn-channel ig-channel" onclick="trackBuy('${p.id}','ig')">
              <i class="fab fa-instagram"></i>
              <div>
                <span>${tr('buyNow',lang)}</span>
                <small>Instagram</small>
              </div>
            </a>
          </div>` : `<div class="out-of-stock-notice"><i class="fa fa-clock"></i> ${tr('outOfStock',lang)}</div>`}

          <div class="detail-desc">
            <p>${p.description}</p>
          </div>

          ${p.isSet && p.setItems ? `
          <div class="set-includes-box">
            <h4><i class="fa fa-box-open"></i> ${tr('setContains', lang)}</h4>
            <ul>${p.setItems.map(item => `<li><i class="fa fa-check"></i> ${item.split('(')[0].trim()}</li>`).join('')}</ul>
          </div>` : ''}

          <div class="detail-meta">
            <span><i class="fa fa-gem"></i> SWAROVSKI</span>
            <span><i class="fa fa-tag"></i> ${p.code}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  ${related.length > 0 ? `
  <section class="section section-dark">
    <div class="container">
      <h2 class="section-title">${lang==='ar'?'منتجات مشابهة':'Similar Products'}</h2>
      <div class="product-grid">
        ${related.map(r => productCard(r, lang)).join('')}
      </div>
    </div>
  </section>` : ''}
</main>
${footer(lang)}`
  return c.html(shell(html, lang, p.name))
})

export default app
