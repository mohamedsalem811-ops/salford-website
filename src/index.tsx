import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import {
  getAllProducts, getProductById, getFeaturedProducts, getSets,
  getIndividualProducts, searchProducts, getCategories, addProduct,
  updateProduct, deleteProduct, getSettings, updateSettings, parseFilename
} from './data/products'

const app = new Hono()

app.use('/static/*', serveStatic({ root: './public' }))
app.use('/api/*', cors())

// ─── Shared HTML shell ──────────────────────────────────────────────────────
function shell(title: string, bodyContent: string, lang: string = 'ar'): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" data-lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="description" content="Salford Libya – Authorized Swarovski Luxury Jewelry Retailer | سالفورد ليبيا – وكيل معتمد لمجوهرات سواروفسكي"/>
<title>${title} | Salford Libya – SWAROVSKI</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Cormorant+Garamond:wght@300;400;500&family=Cairo:wght@300;400;600;700&display=swap"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<link rel="stylesheet" href="/static/style.css"/>
</head>
<body>
${bodyContent}
<script src="/static/app.js"></script>
</body>
</html>`
}

// ─── i18n translations ──────────────────────────────────────────────────────
const t: Record<string, Record<string, string>> = {
  ar: {
    home: 'الرئيسية', products: 'جميع المنتجات', sets: 'الأطقم والمجموعات',
    categories: 'الفئات', contact: 'تواصل معنا', search: 'بحث...',
    featured: 'المنتجات المميزة', featuredSets: 'الأطقم المميزة',
    shopNow: 'تسوق الآن', buyNow: 'اشتري الآن', buySets: 'اشتري الطقم الآن',
    outOfStock: 'غير متوفر', inStock: 'متوفر', save: 'وفر',
    heroTagline: 'وكيل معتمد لمجوهرات سواروفسكي الفاخرة',
    discoverCollection: 'اكتشف المجموعة',
    contactToBuy: 'تواصل معنا لإتمام الشراء',
    contactMsg: 'تواصل معنا عبر إحدى منصاتنا لطلب هذا المنتج',
    facebook: 'فيسبوك', instagram: 'إنستغرام', whatsapp: 'واتساب',
    productCode: 'رمز المنتج', category: 'الفئة', price: 'السعر',
    description: 'الوصف', relatedProducts: 'منتجات ذات صلة',
    setIncludes: 'يشمل الطقم', individualPrices: 'الأسعار الفردية',
    specialSetPrice: 'سعر الطقم الخاص', youSave: 'توفر',
    allProducts: 'جميع المنتجات', filterByCategory: 'تصفية حسب الفئة',
    all: 'الكل', sortBy: 'ترتيب حسب', newest: 'الأحدث', priceLow: 'السعر: من الأقل',
    priceHigh: 'السعر: من الأعلى', featured2: 'المميز', noProducts: 'لا توجد منتجات',
    necklaces: 'القلائد', earrings: 'الأقراط', bracelets: 'الأساور',
    rings: 'الخواتم', sets2: 'الأطقم',
    adminLogin: 'لوحة الإدارة', username: 'اسم المستخدم', password: 'كلمة المرور',
    login: 'دخول', logout: 'خروج', dashboard: 'لوحة التحكم',
    addProduct: 'إضافة منتج', editProduct: 'تعديل منتج', deleteProduct: 'حذف',
    save2: 'حفظ', cancel: 'إلغاء', name: 'الاسم', nameAr: 'الاسم بالعربية',
    imageUrl: 'رابط الصورة', stockQty: 'الكمية', isFeatured: 'منتج مميز',
    isSet2: 'طقم', productCodes: 'رمز/رموز المنتج', siteSettings: 'إعدادات الموقع',
    totalProducts: 'إجمالي المنتجات', totalSets: 'إجمالي الأطقم',
    featuredCount: 'المنتجات المميزة', inStockCount: 'المتوفرة',
    availableInSet: 'متوفر ضمن طقم', viewSet: 'عرض الطقم',
    backToProducts: 'عودة للمنتجات', searchResults: 'نتائج البحث',
    noResults: 'لا توجد نتائج', tryAgain: 'حاول مرة أخرى',
    copyrightText: 'جميع الحقوق محفوظة'
  },
  en: {
    home: 'Home', products: 'All Products', sets: 'Sets & Collections',
    categories: 'Categories', contact: 'Contact Us', search: 'Search...',
    featured: 'Featured Products', featuredSets: 'Featured Sets',
    shopNow: 'Shop Now', buyNow: 'Buy Now', buySets: 'Buy Set Now',
    outOfStock: 'Out of Stock', inStock: 'In Stock', save: 'Save',
    heroTagline: 'Authorized Swarovski Luxury Jewelry Retailer',
    discoverCollection: 'Discover Collection',
    contactToBuy: 'Contact us to purchase this item',
    contactMsg: 'Reach us on our social platforms to order this product',
    facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp',
    productCode: 'Product Code', category: 'Category', price: 'Price',
    description: 'Description', relatedProducts: 'Related Products',
    setIncludes: 'Set Includes', individualPrices: 'Individual Prices',
    specialSetPrice: 'Special Set Price', youSave: 'You Save',
    allProducts: 'All Products', filterByCategory: 'Filter by Category',
    all: 'All', sortBy: 'Sort By', newest: 'Newest', priceLow: 'Price: Low to High',
    priceHigh: 'Price: High to Low', featured2: 'Featured', noProducts: 'No products found',
    necklaces: 'Necklaces', earrings: 'Earrings', bracelets: 'Bracelets',
    rings: 'Rings', sets2: 'Sets',
    adminLogin: 'Admin Panel', username: 'Username', password: 'Password',
    login: 'Login', logout: 'Logout', dashboard: 'Dashboard',
    addProduct: 'Add Product', editProduct: 'Edit Product', deleteProduct: 'Delete',
    save2: 'Save', cancel: 'Cancel', name: 'Name', nameAr: 'Arabic Name',
    imageUrl: 'Image URL', stockQty: 'Stock Quantity', isFeatured: 'Featured',
    isSet2: 'Is a Set', productCodes: 'Product Code(s)', siteSettings: 'Site Settings',
    totalProducts: 'Total Products', totalSets: 'Total Sets',
    featuredCount: 'Featured', inStockCount: 'In Stock',
    availableInSet: 'Available in Set', viewSet: 'View Set',
    backToProducts: 'Back to Products', searchResults: 'Search Results',
    noResults: 'No results found', tryAgain: 'Try again',
    copyrightText: 'All rights reserved'
  }
}

function tr(key: string, lang: string): string {
  return (t[lang] && t[lang][key]) || (t['en'][key]) || key
}

// ─── NAV ────────────────────────────────────────────────────────────────────
function nav(lang: string, active: string = ''): string {
  const s = getSettings()
  const otherLang = lang === 'ar' ? 'en' : 'ar'
  const otherLangLabel = lang === 'ar' ? 'English' : 'عربي'
  return `
<header id="site-header">
  <div class="header-inner">
    <a href="/${lang}/" class="logo-link">
      <div class="logo-mark">SJ</div>
      <div class="logo-text">
        <span class="logo-salford">SALFORD</span>
        <span class="logo-jewelry">jewelry</span>
      </div>
    </a>
    <nav class="main-nav" id="main-nav">
      <a href="/${lang}/" class="nav-link ${active==='home'?'active':''}">${tr('home',lang)}</a>
      <a href="/${lang}/products" class="nav-link ${active==='products'?'active':''}">${tr('products',lang)}</a>
      <a href="/${lang}/sets" class="nav-link ${active==='sets'?'active':''}">${tr('sets',lang)}</a>
      <div class="nav-dropdown">
        <span class="nav-link dropdown-trigger">${tr('categories',lang)} <i class="fas fa-chevron-down"></i></span>
        <div class="dropdown-menu">
          <a href="/${lang}/products?category=Necklaces" class="dropdown-item"><i class="fas fa-gem"></i> ${tr('necklaces',lang)}</a>
          <a href="/${lang}/products?category=Earrings" class="dropdown-item"><i class="fas fa-circle-dot"></i> ${tr('earrings',lang)}</a>
          <a href="/${lang}/products?category=Bracelets" class="dropdown-item"><i class="fas fa-ring"></i> ${tr('bracelets',lang)}</a>
          <a href="/${lang}/sets" class="dropdown-item"><i class="fas fa-star"></i> ${tr('sets2',lang)}</a>
        </div>
      </div>
    </nav>
    <div class="header-actions">
      <div class="search-wrap">
        <input type="text" id="header-search" placeholder="${tr('search',lang)}" autocomplete="off"/>
        <button onclick="doSearch('${lang}')" class="search-btn"><i class="fas fa-search"></i></button>
        <div id="search-dropdown" class="search-dropdown"></div>
      </div>
      <a href="/${otherLang}/" class="lang-btn" title="Switch Language">${otherLangLabel}</a>
      <a href="${s.facebookUrl}" target="_blank" class="social-icon-btn" title="Facebook"><i class="fab fa-facebook-f"></i></a>
      <a href="${s.instagramUrl}" target="_blank" class="social-icon-btn" title="Instagram"><i class="fab fa-instagram"></i></a>
      <button class="hamburger" onclick="toggleMobileMenu()" aria-label="Menu"><i class="fas fa-bars"></i></button>
    </div>
  </div>
</header>`
}

function footer(lang: string): string {
  const s = getSettings()
  const year = new Date().getFullYear()
  return `
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="footer-logo">
        <div class="logo-mark small">SJ</div>
        <div class="logo-text"><span class="logo-salford">SALFORD</span><span class="logo-jewelry">jewelry</span></div>
      </div>
      <p class="footer-tagline">${tr('heroTagline',lang)}</p>
    </div>
    <div class="footer-links">
      <a href="/${lang}/">${tr('home',lang)}</a>
      <a href="/${lang}/products">${tr('products',lang)}</a>
      <a href="/${lang}/sets">${tr('sets',lang)}</a>
    </div>
    <div class="footer-social">
      <a href="${s.facebookUrl}" target="_blank" class="footer-social-btn"><i class="fab fa-facebook-f"></i> ${tr('facebook',lang)}</a>
      <a href="${s.instagramUrl}" target="_blank" class="footer-social-btn ig"><i class="fab fa-instagram"></i> ${tr('instagram',lang)}</a>
      <a href="https://wa.me/${s.whatsappNumber.replace(/\D/g,'')}" target="_blank" class="footer-social-btn wa"><i class="fab fa-whatsapp"></i> ${tr('whatsapp',lang)}</a>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© ${year} Salford Libya – SWAROVSKI Authorized Retailer. ${tr('copyrightText',lang)}</p>
  </div>
</footer>
<div id="buy-modal" class="modal-overlay" onclick="closeModal()">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    <div id="modal-content"></div>
  </div>
</div>`
}

// ─── Product card ────────────────────────────────────────────────────────────
function productCard(p: any, lang: string): string {
  const savings = p.isSet && p.savings ? `<div class="savings-badge">${tr('save',lang)} ${p.savings} ${p.currency}</div>` : ''
  const setBadge = p.isSet ? `<div class="set-badge"><i class="fas fa-layer-group"></i> SET</div>` : ''
  const outBadge = !p.inStock ? `<div class="out-badge">${tr('outOfStock',lang)}</div>` : ''
  const btnText = p.isSet ? tr('buySets',lang) : tr('buyNow',lang)
  const codesStr = p.productCodes.join('+')
  const img = p.images[0] || 'https://via.placeholder.com/400x400/0a0a0a/c9a96e?text=SWAROVSKI'
  return `
<article class="product-card" onclick="window.location.href='/${lang}/product/${p.id}'">
  <div class="card-img-wrap">
    <img src="${img}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/0a0a0a/c9a96e?text=SWAROVSKI'"/>
    ${p.images[1] ? `<img src="${p.images[1]}" class="card-img-hover" alt="${p.name} alt" loading="lazy"/>` : ''}
    ${setBadge}${savings}${outBadge}
    <div class="card-overlay">
      <button class="quick-buy-btn" onclick="event.stopPropagation();openBuyModal('${p.id}','${p.name.replace(/'/g,"\\'")}','${codesStr}','${p.isSet}','${lang}')">${btnText}</button>
    </div>
  </div>
  <div class="card-body">
    <p class="card-code">SWAROVSKI-${codesStr}</p>
    <h3 class="card-name">${p.name}</h3>
    ${p.isSet && p.setComponents ? `<p class="card-includes"><i class="fas fa-layer-group"></i> ${p.setComponents.map((c:any)=>c.name.split('–')[0].trim()).join(' + ')}</p>` : ''}
    <div class="card-price-row">
      <span class="card-price">${p.displayPrice}</span>
      ${p.isSet && p.savings ? `<span class="card-savings">-${p.savings} ${p.currency}</span>` : ''}
    </div>
    <button class="buy-btn ${!p.inStock?'disabled':''}" onclick="event.stopPropagation();${p.inStock?`openBuyModal('${p.id}','${p.name.replace(/'/g,"\\'")}','${codesStr}','${p.isSet}','${lang}')`:'void(0)'}">${p.inStock ? btnText : tr('outOfStock',lang)}</button>
  </div>
</article>`
}

// ─── HOME ───────────────────────────────────────────────────────────────────
app.get('/', (c) => c.redirect('/ar/'))
app.get('/en', (c) => c.redirect('/en/'))
app.get('/ar', (c) => c.redirect('/ar/'))

app.get('/:lang/', (c) => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const s = getSettings()
  const featured = getFeaturedProducts().filter(p => !p.isSet).slice(0, 8)
  const featuredSets = getFeaturedProducts().filter(p => p.isSet).slice(0, 3)
  const cats = [
    { key: 'Necklaces', icon: 'fas fa-gem', labelAr: 'القلائد', labelEn: 'Necklaces' },
    { key: 'Earrings', icon: 'fas fa-circle-dot', labelAr: 'الأقراط', labelEn: 'Earrings' },
    { key: 'Bracelets', icon: 'fas fa-ring', labelAr: 'الأساور', labelEn: 'Bracelets' },
    { key: 'Sets', icon: 'fas fa-layer-group', labelAr: 'الأطقم', labelEn: 'Sets' },
  ]
  const body = `
${nav(lang, 'home')}
<main>
<!-- HERO -->
<section class="hero" id="hero-section">
  <div class="hero-bg">
    <div class="hero-particles" id="particles"></div>
    <div class="hero-glow"></div>
  </div>
  <div class="hero-content">
    <div class="hero-brand-tag">SWAROVSKI × SALFORD</div>
    <h1 class="hero-title">
      <span class="hero-sj">SJ</span>
      <span>${lang==='ar'?s.heroTitleAr:s.heroTitleEn}</span>
    </h1>
    <p class="hero-subtitle">${lang==='ar'?s.heroSubtitleAr:s.heroSubtitleEn}</p>
    <div class="hero-actions">
      <a href="/${lang}/products" class="btn-primary"><i class="fas fa-gem"></i> ${tr('shopNow',lang)}</a>
      <a href="/${lang}/sets" class="btn-outline"><i class="fas fa-layer-group"></i> ${tr('sets',lang)}</a>
    </div>
    <div class="hero-stats">
      <div class="stat"><span class="stat-num">${getAllProducts().filter(p=>!p.isSet).length}+</span><span>${lang==='ar'?'منتج':'Products'}</span></div>
      <div class="stat-sep"></div>
      <div class="stat"><span class="stat-num">${getSets().length}</span><span>${lang==='ar'?'طقم':'Sets'}</span></div>
      <div class="stat-sep"></div>
      <div class="stat"><span class="stat-num">100%</span><span>${lang==='ar'?'أصلي':'Authentic'}</span></div>
    </div>
  </div>
  <div class="hero-scroll"><i class="fas fa-chevron-down"></i></div>
</section>

<!-- CATEGORIES -->
<section class="section categories-section">
  <div class="section-inner">
    <div class="section-header"><span class="section-tag">COLLECTION</span><h2>${lang==='ar'?'تصفح حسب الفئة':'Browse by Category'}</h2></div>
    <div class="categories-grid">
      ${cats.map(cat => `
      <a href="/${lang}/${cat.key==='Sets'?'sets':`products?category=${cat.key}`}" class="cat-card">
        <div class="cat-icon"><i class="${cat.icon}"></i></div>
        <div class="cat-name">${lang==='ar'?cat.labelAr:cat.labelEn}</div>
        <div class="cat-count">${getAllProducts().filter(p=>cat.key==='Sets'?p.isSet:p.category===cat.key).length} ${lang==='ar'?'قطعة':'items'}</div>
      </a>`).join('')}
    </div>
  </div>
</section>

<!-- FEATURED PRODUCTS -->
<section class="section products-section">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-tag">FEATURED</span>
      <h2>${tr('featured',lang)}</h2>
      <a href="/${lang}/products" class="section-link">${lang==='ar'?'عرض الكل':'View All'} <i class="fas fa-arrow-${lang==='ar'?'left':'right'}"></i></a>
    </div>
    <div class="products-grid">
      ${featured.map(p => productCard(p, lang)).join('')}
    </div>
  </div>
</section>

<!-- FEATURED SETS -->
${featuredSets.length > 0 ? `
<section class="section sets-section">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-tag">SETS</span>
      <h2>${tr('featuredSetsAr'||'featuredSets',lang)}</h2>
      <a href="/${lang}/sets" class="section-link">${lang==='ar'?'عرض الكل':'View All'} <i class="fas fa-arrow-${lang==='ar'?'left':'right'}"></i></a>
    </div>
    <div class="sets-grid">
      ${featuredSets.map(p => `
      <article class="set-card" onclick="window.location.href='/${lang}/product/${p.id}'">
        <div class="set-card-imgs">
          ${p.images.slice(0,3).map((img:string,i:number)=>`<img src="${img}" class="set-img set-img-${i}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/0a0a0a/c9a96e?text=SWAROVSKI'"/>`).join('')}
          <div class="set-img-badge"><i class="fas fa-layer-group"></i> SET</div>
        </div>
        <div class="set-card-body">
          <p class="card-code">SWAROVSKI-${p.productCodes.join('+')}</p>
          <h3 class="set-name">${p.name}</h3>
          <p class="set-includes"><i class="fas fa-check-circle"></i> ${p.setComponents?.map((c:any)=>c.name.split('–')[0].trim()).join(' + ') || ''}</p>
          <div class="set-pricing">
            <span class="set-price">${p.displayPrice}</span>
            ${p.savings ? `<span class="set-savings">${tr('save',lang)} ${p.savings} ${p.currency}</span>` : ''}
          </div>
          <button class="buy-btn" onclick="event.stopPropagation();openBuyModal('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.productCodes.join('+')}','true','${lang}')">${tr('buySets',lang)}</button>
        </div>
      </article>`).join('')}
    </div>
  </div>
</section>` : ''}

<!-- BRAND STRIP -->
<section class="brand-strip">
  <div class="brand-strip-inner">
    <div class="sparkle-row">
      ${Array(12).fill(0).map((_,i)=>`<i class="fas fa-sparkles sparkle-icon" style="animation-delay:${i*0.2}s"></i>`).join('')}
    </div>
    <p>${lang==='ar'?'مجوهرات سواروفسكي الأصلية – متوفرة الآن في ليبيا':'Authentic SWAROVSKI Jewelry – Now Available in Libya'}</p>
    <div class="sparkle-row">
      ${Array(12).fill(0).map((_,i)=>`<i class="fas fa-sparkles sparkle-icon" style="animation-delay:${i*0.2+0.1}s"></i>`).join('')}
    </div>
  </div>
</section>
</main>
${footer(lang)}`
  return c.html(shell(lang==='ar'?'سالفورد ليبيا':'Salford Libya', body, lang))
})

// ─── PRODUCTS ───────────────────────────────────────────────────────────────
app.get('/:lang/products', (c) => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const category = c.req.query('category') || ''
  const sort = c.req.query('sort') || 'featured'
  const search = c.req.query('q') || ''
  let prods = getIndividualProducts()
  if (search) prods = prods.filter(p => !p.isSet && (p.name.toLowerCase().includes(search.toLowerCase()) || p.nameAr.includes(search) || p.productCodes.some(c2 => c2.includes(search))))
  if (category) prods = prods.filter(p => p.category === category)
  if (sort === 'price_asc') prods = prods.sort((a,b) => a.price - b.price)
  else if (sort === 'price_desc') prods = prods.sort((a,b) => b.price - a.price)
  else if (sort === 'featured') prods = prods.sort((a,b) => (b.featured?1:0) - (a.featured?1:0))
  const cats = getCategories()
  const body = `
${nav(lang,'products')}
<main>
<section class="page-hero">
  <div class="page-hero-inner">
    <h1>${tr('allProducts',lang)}</h1>
    <div class="breadcrumb"><a href="/${lang}/">${tr('home',lang)}</a> <i class="fas fa-chevron-${lang==='ar'?'left':'right'}"></i> <span>${tr('allProducts',lang)}</span></div>
  </div>
</section>
<section class="catalog-section">
  <div class="catalog-inner">
    <aside class="catalog-filters" id="catalog-filters">
      <div class="filter-group">
        <h4>${tr('filterByCategory',lang)}</h4>
        <a href="/${lang}/products${sort?`?sort=${sort}`:''}" class="filter-btn ${!category?'active':''}">${tr('all',lang)}</a>
        ${cats.map(cat => `<a href="/${lang}/products?category=${cat}${sort?`&sort=${sort}`:''}" class="filter-btn ${category===cat?'active':''}">${lang==='ar'?(cat==='Necklaces'?'القلائد':cat==='Earrings'?'الأقراط':cat==='Bracelets'?'الأساور':cat==='Rings'?'الخواتم':cat):cat}</a>`).join('')}
      </div>
      <div class="filter-group">
        <h4>${tr('sortBy',lang)}</h4>
        <a href="/${lang}/products?${category?`category=${category}&`:''}" class="filter-btn ${!sort||sort==='featured'?'active':''}">${tr('featured2',lang)}</a>
        <a href="/${lang}/products?${category?`category=${category}&`:''}&sort=price_asc" class="filter-btn ${sort==='price_asc'?'active':''}">${tr('priceLow',lang)}</a>
        <a href="/${lang}/products?${category?`category=${category}&`:''}&sort=price_desc" class="filter-btn ${sort==='price_desc'?'active':''}">${tr('priceHigh',lang)}</a>
      </div>
    </aside>
    <div class="catalog-main">
      <div class="catalog-toolbar">
        <span class="result-count">${prods.length} ${lang==='ar'?'منتج':'products'}</span>
        <button class="filter-toggle-btn" onclick="toggleFilters()"><i class="fas fa-sliders-h"></i> ${tr('filterByCategory',lang)}</button>
      </div>
      ${prods.length === 0 ? `<div class="empty-state"><i class="fas fa-gem"></i><p>${tr('noProducts',lang)}</p></div>` : `<div class="products-grid">${prods.map(p => productCard(p, lang)).join('')}</div>`}
    </div>
  </div>
</section>
</main>
${footer(lang)}`
  return c.html(shell(tr('allProducts',lang), body, lang))
})

// ─── SETS ────────────────────────────────────────────────────────────────────
app.get('/:lang/sets', (c) => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const sets = getSets()
  const body = `
${nav(lang,'sets')}
<main>
<section class="page-hero">
  <div class="page-hero-inner">
    <h1>${tr('sets',lang)}</h1>
    <p>${lang==='ar'?'مجموعات منسقة من مجوهرات سواروفسكي الأصيلة بأسعار خاصة':'Curated Swarovski jewelry sets at special bundle prices'}</p>
    <div class="breadcrumb"><a href="/${lang}/">${tr('home',lang)}</a> <i class="fas fa-chevron-${lang==='ar'?'left':'right'}"></i> <span>${tr('sets',lang)}</span></div>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <div class="sets-list">
      ${sets.map(p => `
      <article class="set-detail-card" onclick="window.location.href='/${lang}/product/${p.id}'">
        <div class="set-detail-imgs">
          ${p.images.slice(0,2).map((img:string)=>`<img src="${img}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/0a0a0a/c9a96e?text=SWAROVSKI'"/>`).join('')}
        </div>
        <div class="set-detail-info">
          <div class="set-badge-top"><i class="fas fa-layer-group"></i> ${p.subCategory||'SET'}</div>
          <p class="card-code">SWAROVSKI-${p.productCodes.join('+')}</p>
          <h3>${p.name}</h3>
          <div class="set-components-list">
            ${(p.setComponents||[]).map((comp:any) => `
            <div class="comp-row">
              <img src="${comp.images[0]||''}" alt="${comp.name}" onerror="this.src='https://via.placeholder.com/60x60/0a0a0a/c9a96e?text=SW'"/>
              <div><strong>${comp.name}</strong><span>${comp.individualPrice} ${p.currency}</span></div>
            </div>`).join('')}
          </div>
          <div class="set-price-table">
            ${(p.setComponents||[]).map((comp:any)=>`<div class="price-row"><span>${comp.name}</span><span>${comp.individualPrice} ${p.currency}</span></div>`).join('')}
            <div class="price-row total-row"><span>${tr('specialSetPrice',lang)}</span><span class="special-price">${p.displayPrice}</span></div>
            ${p.savings ? `<div class="price-row savings-row"><span>${tr('youSave',lang)}</span><span class="savings-amount">-${p.savings} ${p.currency}</span></div>` : ''}
          </div>
          <button class="buy-btn big" onclick="event.stopPropagation();openBuyModal('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.productCodes.join('+')}','true','${lang}')">${tr('buySets',lang)}</button>
        </div>
      </article>`).join('')}
    </div>
  </div>
</section>
</main>
${footer(lang)}`
  return c.html(shell(tr('sets',lang), body, lang))
})

// ─── PRODUCT DETAIL ──────────────────────────────────────────────────────────
app.get('/:lang/product/:id', (c) => {
  const lang = c.req.param('lang') === 'en' ? 'en' : 'ar'
  const id = c.req.param('id')
  const p = getProductById(id)
  if (!p) return c.html(shell('404', `${nav(lang)}<main><div class="empty-state" style="margin:8rem auto"><i class="fas fa-gem"></i><p>Product not found</p><a href="/${lang}/products" class="btn-primary">Back</a></div></main>${footer(lang)}`, lang))
  
  const related = getAllProducts().filter(r => r.id !== id && !r.isSet && r.category === p.category).slice(0,4)
  const inSets = getSets().filter(s => s.productCodes.some(c2 => p.productCodes.includes(c2)))
  const codesStr = p.productCodes.join('+')

  const body = `
${nav(lang)}
<main>
<section class="product-detail-section">
  <div class="product-detail-inner">
    <!-- GALLERY -->
    <div class="product-gallery">
      <div class="gallery-main-wrap">
        <img id="main-img" src="${p.images[0]||'https://via.placeholder.com/600x600/0a0a0a/c9a96e?text=SWAROVSKI'}" alt="${p.name}" class="gallery-main-img" onerror="this.src='https://via.placeholder.com/600x600/0a0a0a/c9a96e?text=SWAROVSKI'"/>
        ${!p.inStock?`<div class="out-overlay">${tr('outOfStock',lang)}</div>`:''}
        ${p.isSet?`<div class="set-overlay-badge"><i class="fas fa-layer-group"></i> SET</div>`:''}
      </div>
      ${p.images.length > 1 ? `
      <div class="gallery-thumbs">
        ${p.images.map((img:string,i:number)=>`<img src="${img}" class="gallery-thumb ${i===0?'active':''}" onclick="switchImg(this,'${img}')" alt="thumb ${i+1}" loading="lazy" onerror="this.src='https://via.placeholder.com/80x80/0a0a0a/c9a96e?text=SW'"/>`).join('')}
      </div>` : ''}
    </div>
    <!-- INFO -->
    <div class="product-info">
      <div class="breadcrumb">
        <a href="/${lang}/">${tr('home',lang)}</a>
        <i class="fas fa-chevron-${lang==='ar'?'left':'right'}"></i>
        <a href="/${lang}/products">${tr('allProducts',lang)}</a>
        <i class="fas fa-chevron-${lang==='ar'?'left':'right'}"></i>
        <span>${p.category}</span>
      </div>
      <div class="product-badges">
        <span class="brand-badge">SWAROVSKI</span>
        ${p.isSet?`<span class="set-badge-inline"><i class="fas fa-layer-group"></i> SET</span>`:''}
        ${p.inStock?`<span class="stock-badge in"><i class="fas fa-check-circle"></i> ${tr('inStock',lang)}</span>`:`<span class="stock-badge out"><i class="fas fa-times-circle"></i> ${tr('outOfStock',lang)}</span>`}
      </div>
      <h1 class="product-title">${p.name}</h1>
      <p class="product-name-ar">${p.nameAr}</p>
      <p class="product-code-display">SWAROVSKI-${codesStr}</p>
      
      ${p.isSet && p.setComponents ? `
      <div class="set-price-box">
        <table class="set-price-table">
          <thead><tr><th>${tr('setIncludes',lang)}</th><th>${lang==='ar'?'السعر الفردي':'Individual Price'}</th></tr></thead>
          <tbody>
            ${p.setComponents.map((comp:any)=>`<tr><td>${comp.name}</td><td>${comp.individualPrice} ${p.currency}</td></tr>`).join('')}
            <tr class="set-total-row"><td><strong>${tr('specialSetPrice',lang)}</strong></td><td><strong class="special-price-big">${p.displayPrice}</strong></td></tr>
            ${p.savings?`<tr class="savings-final-row"><td>${tr('youSave',lang)}</td><td class="savings-text">-${p.savings} ${p.currency}</td></tr>`:''}
          </tbody>
        </table>
      </div>` : `
      <div class="price-display">
        <span class="big-price">${p.displayPrice}</span>
      </div>`}
      
      <div class="buy-actions">
        <button class="buy-btn big ${!p.inStock?'disabled':''}" onclick="${p.inStock?`openBuyModal('${id}','${p.name.replace(/'/g,"\\'")}','${codesStr}','${p.isSet}','${lang}')`:''}">${p.inStock?(p.isSet?tr('buySets',lang):tr('buyNow',lang)):tr('outOfStock',lang)}</button>
      </div>
      
      <div class="product-desc">
        <h3>${tr('description',lang)}</h3>
        <div class="desc-text">${p.description.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>')}</div>
      </div>

      ${inSets.length > 0 ? `
      <div class="in-set-notice">
        <i class="fas fa-layer-group"></i>
        <div>
          <strong>${tr('availableInSet',lang)}</strong>
          ${inSets.map(s=>`<a href="/${lang}/product/${s.id}" class="set-link">${s.name} – ${tr('save',lang)} ${s.savings} ${s.currency}</a>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </div>
</section>

${related.length > 0 ? `
<section class="section">
  <div class="section-inner">
    <div class="section-header"><h2>${tr('relatedProducts',lang)}</h2></div>
    <div class="products-grid">${related.map(r => productCard(r, lang)).join('')}</div>
  </div>
</section>` : ''}
</main>
${footer(lang)}`
  return c.html(shell(p.name, body, lang))
})

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.get('/api/products', (c) => {
  const q = c.req.query('q')
  const cat = c.req.query('category')
  const setsOnly = c.req.query('sets')
  let prods = getAllProducts()
  if (setsOnly === 'true') prods = prods.filter(p => p.isSet)
  else if (setsOnly === 'false') prods = prods.filter(p => !p.isSet)
  if (q) prods = searchProducts(q)
  if (cat) prods = prods.filter(p => p.category === cat)
  return c.json({ products: prods, total: prods.length })
})
app.get('/api/products/:id', (c) => {
  const p = getProductById(c.req.param('id'))
  if (!p) return c.json({ error: 'Not found' }, 404)
  return c.json(p)
})
app.post('/api/products', async (c) => {
  const body = await c.req.json()
  const p = addProduct(body)
  return c.json(p, 201)
})
app.put('/api/products/:id', async (c) => {
  const body = await c.req.json()
  const p = updateProduct(c.req.param('id'), body)
  if (!p) return c.json({ error: 'Not found' }, 404)
  return c.json(p)
})
app.delete('/api/products/:id', (c) => {
  const ok = deleteProduct(c.req.param('id'))
  return c.json({ success: ok })
})
app.get('/api/settings', (c) => c.json(getSettings()))
app.put('/api/settings', async (c) => {
  const body = await c.req.json()
  return c.json(updateSettings(body))
})
app.post('/api/parse-filename', async (c) => {
  const { filename } = await c.req.json()
  const result = parseFilename(filename)
  if (!result) return c.json({ error: 'Invalid filename format' }, 400)
  return c.json(result)
})

// ─── ADMIN ───────────────────────────────────────────────────────────────────
app.get('/admin', (c) => c.redirect('/admin/login'))
app.get('/admin/login', (c) => {
  const body = `
<div class="admin-login-wrap">
  <div class="admin-login-box">
    <div class="admin-logo">
      <div class="logo-mark">SJ</div>
      <div class="logo-text"><span class="logo-salford">SALFORD</span><span class="logo-jewelry">jewelry</span></div>
    </div>
    <h2>Admin Panel</h2>
    <form id="login-form" onsubmit="adminLogin(event)">
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="admin-user" required placeholder="admin"/>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="admin-pass" required placeholder="••••••••"/>
      </div>
      <div id="login-error" class="login-error" style="display:none"></div>
      <button type="submit" class="btn-primary full-width">Login <i class="fas fa-arrow-right"></i></button>
    </form>
  </div>
</div>`
  return c.html(shell('Admin Login', body))
})

app.get('/admin/dashboard', (c) => {
  const all = getAllProducts()
  const sets = getSets()
  const individuals = getIndividualProducts()
  const featured = all.filter(p=>p.featured)
  const inStock = all.filter(p=>p.inStock)
  const body = `
<div class="admin-layout">
  ${adminNav()}
  <main class="admin-main">
    <div class="admin-header">
      <h1><i class="fas fa-chart-bar"></i> Dashboard</h1>
      <div class="admin-actions-top">
        <button class="btn-primary" onclick="showAddModal()"><i class="fas fa-plus"></i> Add Product</button>
        <button class="btn-outline" onclick="window.location.href='/ar/'" target="_blank"><i class="fas fa-eye"></i> View Site</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-gem"></i></div><div class="stat-info"><span class="stat-val">${individuals.length}</span><span class="stat-lbl">Individual Products</span></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-layer-group"></i></div><div class="stat-info"><span class="stat-val">${sets.length}</span><span class="stat-lbl">Sets & Collections</span></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-star"></i></div><div class="stat-info"><span class="stat-val">${featured.length}</span><span class="stat-lbl">Featured Items</span></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-info"><span class="stat-val">${inStock.length}</span><span class="stat-lbl">In Stock</span></div></div>
    </div>
    <div class="admin-table-wrap">
      <div class="table-toolbar">
        <h2>Product Management</h2>
        <input type="text" id="admin-search" placeholder="Search products..." oninput="filterAdminTable(this.value)"/>
      </div>
      <div class="table-responsive">
        <table class="admin-table" id="admin-products-table">
          <thead><tr><th>Image</th><th>Name</th><th>Code(s)</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>Actions</th></tr></thead>
          <tbody>
            ${all.map(p => `
            <tr data-name="${p.name.toLowerCase()} ${p.nameAr}">
              <td><img src="${p.images[0]||''}" class="admin-thumb" alt="${p.name}" onerror="this.src='https://via.placeholder.com/50x50/0a0a0a/c9a96e?text=SW'"/></td>
              <td><strong>${p.name}</strong>${p.isSet?'<span class="badge-set-sm">SET</span>':''}<br/><small>${p.nameAr}</small></td>
              <td><code>${p.productCodes.join('+')}</code></td>
              <td>${p.category}</td>
              <td class="price-cell">${p.displayPrice}</td>
              <td><span class="stock-dot ${p.inStock?'in':'out'}">${p.inStock?'In Stock':'Out'}</span></td>
              <td><span class="feat-dot ${p.featured?'yes':'no'}">${p.featured?'⭐':'-'}</span></td>
              <td class="action-cell">
                <button class="btn-icon edit" onclick="editProduct('${p.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn-icon del" onclick="deleteProductAdmin('${p.id}','${p.name.replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="admin-table-wrap" style="margin-top:2rem">
      <h2><i class="fas fa-cog"></i> Site Settings</h2>
      <div id="settings-form-area">${settingsForm()}</div>
    </div>
  </main>
</div>
<!-- Product Modal -->
<div id="product-modal" class="modal-overlay" onclick="closeProductModal(event)">
  <div class="modal-box large" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="document.getElementById('product-modal').style.display='none'"><i class="fas fa-times"></i></button>
    <h2 id="modal-title">Add Product</h2>
    <form id="product-form" onsubmit="saveProduct(event)">
      <div class="form-grid">
        <div class="form-group"><label>Product Code(s) <small>(use + for sets, e.g. 5647946+5642977)</small></label><input type="text" id="f-codes" required placeholder="5647946"/></div>
        <div class="form-group"><label>Price (numeric)</label><input type="number" id="f-price" required placeholder="500"/></div>
        <div class="form-group"><label>English Name</label><input type="text" id="f-name" required placeholder="Swan Necklace"/></div>
        <div class="form-group"><label>Arabic Name</label><input type="text" id="f-nameAr" required placeholder="قلادة البجعة"/></div>
        <div class="form-group full"><label>Category</label>
          <select id="f-category">
            <option value="Necklaces">Necklaces</option>
            <option value="Earrings">Earrings</option>
            <option value="Bracelets">Bracelets</option>
            <option value="Rings">Rings</option>
            <option value="Sets">Sets</option>
          </select>
        </div>
        <div class="form-group full"><label>Image URL(s) <small>(one per line)</small></label><textarea id="f-images" rows="3" placeholder="https://example.com/image.jpg"></textarea></div>
        <div class="form-group full"><label>Description (English)</label><textarea id="f-description" rows="4" placeholder="Product description..."></textarea></div>
        <div class="form-group full"><label>Short Description</label><input type="text" id="f-short" placeholder="Brief description for cards"/></div>
        <div class="form-group"><label>Stock Quantity</label><input type="number" id="f-qty" value="10"/></div>
        <div class="form-group"><label><input type="checkbox" id="f-featured"/> Featured Product</label></div>
        <div class="form-group"><label><input type="checkbox" id="f-instock" checked/> In Stock</label></div>
        <div class="form-group"><label><input type="checkbox" id="f-isset"/> Is a Set</label></div>
      </div>
      <input type="hidden" id="f-id"/>
      <div class="form-actions">
        <button type="button" class="btn-outline" onclick="document.getElementById('product-modal').style.display='none'">Cancel</button>
        <button type="submit" class="btn-primary">Save Product</button>
      </div>
    </form>
    <div class="filename-parser">
      <h4><i class="fas fa-file-import"></i> Parse from Filename</h4>
      <div class="parse-row">
        <input type="text" id="parse-filename" placeholder="SWAROVSKI-5647946(500 دينار).jpg"/>
        <button type="button" class="btn-outline" onclick="parseFilenameAdmin()">Parse</button>
      </div>
      <p class="parse-hint">Format: SWAROVSKI-[CODE(S)]([PRICE] دينار)</p>
    </div>
  </div>
</div>`
  return c.html(shell('Admin Dashboard', body))
})

function adminNav(): string {
  return `<aside class="admin-sidebar">
    <div class="admin-brand">
      <div class="logo-mark small">SJ</div>
      <span>Admin Panel</span>
    </div>
    <nav class="admin-nav">
      <a href="/admin/dashboard" class="admin-nav-link active"><i class="fas fa-chart-bar"></i> Dashboard</a>
      <a href="/ar/" target="_blank" class="admin-nav-link"><i class="fas fa-eye"></i> View Site (AR)</a>
      <a href="/en/" target="_blank" class="admin-nav-link"><i class="fas fa-eye"></i> View Site (EN)</a>
    </nav>
    <button class="admin-logout" onclick="adminLogout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
  </aside>`
}

function settingsForm(): string {
  const s = getSettings()
  return `<form onsubmit="saveSettings(event)" class="settings-form">
    <div class="form-grid">
      <div class="form-group"><label>Facebook URL</label><input type="url" id="s-facebook" value="${s.facebookUrl}"/></div>
      <div class="form-group"><label>Instagram URL</label><input type="url" id="s-instagram" value="${s.instagramUrl}"/></div>
      <div class="form-group"><label>WhatsApp Number</label><input type="text" id="s-whatsapp" value="${s.whatsappNumber}"/></div>
      <div class="form-group"><label>Hero Title (Arabic)</label><input type="text" id="s-heroAr" value="${s.heroTitleAr}"/></div>
      <div class="form-group"><label>Hero Title (English)</label><input type="text" id="s-heroEn" value="${s.heroTitleEn}"/></div>
    </div>
    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Save Settings</button>
  </form>`
}

export default app
