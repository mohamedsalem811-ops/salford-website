/* ══════════════════════════════════════════════════════════════
   SALFORD LIBYA – SWAROVSKI SHOWCASE
   Frontend JavaScript: Bilingual, RTL/LTR, Modals, Admin
   ══════════════════════════════════════════════════════════════ */

// ── Language & Direction ──────────────────────────────────────
const lang = document.documentElement.getAttribute('data-lang') || 'ar';
const dir  = lang === 'ar' ? 'rtl' : 'ltr';

// ── Settings (loaded from DOM context) ──────────────────────
let siteSettings = {};

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    siteSettings = await res.json();
  } catch(e) {}
}

// ── Particles ────────────────────────────────────────────────
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#c9a96e','#e8d5a3','#6b4dff','#ffffff','#9a7a4a'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      width: ${Math.random() * 4 + 1}px;
      height: ${Math.random() * 4 + 1}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 8 + 4}s;
      animation-delay: ${Math.random() * 6}s;
      opacity: 0;
    `;
    container.appendChild(p);
  }
}

// ── Header scroll effect ─────────────────────────────────────
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      header.style.background = 'rgba(5,5,5,0.97)';
      header.style.boxShadow = '0 4px 30px rgba(0,0,0,0.5)';
    } else {
      header.style.background = 'rgba(5,5,5,0.9)';
      header.style.boxShadow = 'none';
    }
  });
}

// ── Mobile Menu ──────────────────────────────────────────────
function toggleMobileMenu() {
  let overlay = document.getElementById('mobile-nav-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-nav-overlay';
    overlay.className = 'mobile-nav';
    overlay.innerHTML = `
      <button class="mobile-nav-close" onclick="closeMobileMenu()"><i class="fas fa-times"></i></button>
      <a href="/${lang}/" class="nav-link" onclick="closeMobileMenu()">${lang==='ar'?'الرئيسية':'Home'}</a>
      <a href="/${lang}/products" class="nav-link" onclick="closeMobileMenu()">${lang==='ar'?'جميع المنتجات':'All Products'}</a>
      <a href="/${lang}/sets" class="nav-link" onclick="closeMobileMenu()">${lang==='ar'?'الأطقم والمجموعات':'Sets & Collections'}</a>
      <a href="/${lang}/products?category=Necklaces" class="nav-link" onclick="closeMobileMenu()">${lang==='ar'?'القلائد':'Necklaces'}</a>
      <a href="/${lang}/products?category=Earrings" class="nav-link" onclick="closeMobileMenu()">${lang==='ar'?'الأقراط':'Earrings'}</a>
      <a href="/${lang}/products?category=Bracelets" class="nav-link" onclick="closeMobileMenu()">${lang==='ar'?'الأساور':'Bracelets'}</a>
    `;
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const overlay = document.getElementById('mobile-nav-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ── Live Search ──────────────────────────────────────────────
let searchTimeout;
function doSearch(lang) {
  const input = document.getElementById('header-search');
  if (!input) return;
  const q = input.value.trim();
  if (!q) {
    window.location.href = `/${lang}/products`;
    return;
  }
  window.location.href = `/${lang}/products?q=${encodeURIComponent(q)}`;
}

function initLiveSearch() {
  const input = document.getElementById('header-search');
  const dropdown = document.getElementById('search-dropdown');
  if (!input || !dropdown) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch(lang);
  });

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (!q) { dropdown.style.display = 'none'; return; }
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const items = (data.products || []).slice(0, 5);
        if (!items.length) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = items.map(p => `
          <div class="search-item" onclick="window.location.href='/${lang}/product/${p.id}'">
            <img src="${p.images[0] || ''}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/40x40/0a0a0a/c9a96e?text=SW'"/>
            <div class="search-item-info">
              <div class="search-item-name">${p.name}</div>
              <div class="search-item-price">${p.displayPrice}</div>
            </div>
          </div>
        `).join('');
        dropdown.style.display = 'block';
      } catch(e) { dropdown.style.display = 'none'; }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

// ── Gallery ──────────────────────────────────────────────────
function switchImg(thumb, src) {
  const mainImg = document.getElementById('main-img');
  if (mainImg) mainImg.src = src;
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

// ── Buy Modal ────────────────────────────────────────────────
let currentProductData = null;

async function openBuyModal(id, name, codes, isSet, lang) {
  const modal = document.getElementById('buy-modal');
  const content = document.getElementById('modal-content');
  if (!modal || !content) return;

  // Fetch product data for image and price
  let product = null;
  try {
    const res = await fetch(`/api/products/${id}`);
    product = await res.json();
  } catch(e) {}

  const settings = await fetchSettings();
  const fbUrl    = settings.facebookUrl    || 'https://www.facebook.com/SalfordLibya';
  const igUrl    = settings.instagramUrl   || 'https://www.instagram.com/SalfordLibya';
  const waNumber = (settings.whatsappNumber || '+218911234567').replace(/\D/g,'');

  const isSetBool = isSet === 'true' || isSet === true;
  const codesDisplay = `SWAROVSKI-${codes}`;

  // Pre-filled message
  const msgAr = isSetBool
    ? `مرحباً، أريد الاستفسار عن الطقم: ${codesDisplay} - ${name}`
    : `مرحباً، أريد الاستفسار عن: ${codesDisplay} - ${name}`;
  const msgEn = isSetBool
    ? `Hi! I'm interested in the set: ${codesDisplay} - ${name}`
    : `Hi! I'm interested in: ${codesDisplay} - ${name}`;
  const msg = lang === 'ar' ? msgAr : msgEn;
  const encodedMsg = encodeURIComponent(msg);

  const fbMsgUrl = `https://m.me/${fbUrl.split('/').pop()}?text=${encodedMsg}`;
  const igMsgUrl = igUrl;
  const waMsgUrl = `https://wa.me/${waNumber}?text=${encodedMsg}`;

  const img = product?.images?.[0] || '';
  const price = product?.displayPrice || '';

  const contactTitle = lang === 'ar'
    ? (isSetBool ? 'اشتري هذا الطقم الآن' : 'اشتري الآن')
    : (isSetBool ? 'Buy This Set Now' : 'Buy Now');
  const contactSub = lang === 'ar'
    ? 'تواصل معنا عبر إحدى منصاتنا لإتمام الشراء'
    : 'Contact us on any of our platforms to complete your purchase';

  content.innerHTML = `
    <div class="modal-product">
      ${img ? `<img src="${img}" alt="${name}" onerror="this.style.display='none'"/>` : ''}
      <div class="modal-product-info">
        <p class="brand">SWAROVSKI</p>
        <h4>${name}</h4>
        <p class="code">${codesDisplay}</p>
        ${price ? `<p class="mprice">${price}</p>` : ''}
        ${isSetBool ? `<span style="font-size:0.7rem;color:#6b4dff;letter-spacing:1.5px;text-transform:uppercase;"><i class="fas fa-layer-group"></i> SET</span>` : ''}
      </div>
    </div>
    <div class="modal-cta">
      <h3>${contactTitle}</h3>
      <p>${contactSub}</p>
      <div class="modal-btns">
        <a href="${igMsgUrl}" target="_blank" class="modal-btn ig">
          <i class="fab fa-instagram"></i>
          ${lang === 'ar' ? 'تواصل عبر إنستغرام' : 'Contact via Instagram'}
        </a>
        <a href="${fbMsgUrl}" target="_blank" class="modal-btn fb">
          <i class="fab fa-facebook-f"></i>
          ${lang === 'ar' ? 'تواصل عبر فيسبوك' : 'Contact via Facebook'}
        </a>
        <a href="${waMsgUrl}" target="_blank" class="modal-btn wa">
          <i class="fab fa-whatsapp"></i>
          ${lang === 'ar' ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
        </a>
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('buy-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeProductModal(null, true); }
});

async function fetchSettings() {
  if (Object.keys(siteSettings).length) return siteSettings;
  try {
    const res = await fetch('/api/settings');
    siteSettings = await res.json();
    return siteSettings;
  } catch(e) { return {}; }
}

// ── Catalog Filters toggle ───────────────────────────────────
function toggleFilters() {
  const filters = document.getElementById('catalog-filters');
  if (filters) filters.classList.toggle('hidden');
}

// ── Intersection Observer for animations ────────────────────
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card, .set-card, .cat-card, .set-detail-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease, border-color 0.3s, box-shadow 0.3s';
    observer.observe(el);
  });
}

// ══════════════════════════════════════════════════════════════
//   ADMIN PANEL
// ══════════════════════════════════════════════════════════════

// ── Admin Auth ───────────────────────────────────────────────
async function adminLogin(e) {
  e.preventDefault();
  const user = document.getElementById('admin-user')?.value;
  const pass = document.getElementById('admin-pass')?.value;
  const errEl = document.getElementById('login-error');

  try {
    const settings = await fetchSettings();
    if (user === settings.adminUsername && pass === settings.adminPasswordHash) {
      sessionStorage.setItem('salford_admin', 'authenticated');
      window.location.href = '/admin/dashboard';
    } else {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Invalid username or password'; }
    }
  } catch(err) {
    // Fallback: check against defaults
    if (user === 'admin' && pass === 'salford2024') {
      sessionStorage.setItem('salford_admin', 'authenticated');
      window.location.href = '/admin/dashboard';
    } else {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Login failed. Try: admin / salford2024'; }
    }
  }
}

function adminLogout() {
  sessionStorage.removeItem('salford_admin');
  window.location.href = '/admin/login';
}

function checkAdminAuth() {
  if (window.location.pathname.startsWith('/admin/dashboard')) {
    if (!sessionStorage.getItem('salford_admin')) {
      window.location.href = '/admin/login';
    }
  }
}

// ── Admin Table Filter ────────────────────────────────────────
function filterAdminTable(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#admin-products-table tbody tr').forEach(row => {
    const name = row.getAttribute('data-name') || '';
    row.style.display = name.includes(q) ? '' : 'none';
  });
}

// ── Product Modal ────────────────────────────────────────────
function showAddModal() {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  document.getElementById('modal-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  document.getElementById('f-id').value = '';
  document.getElementById('f-instock').checked = true;
  modal.style.display = 'flex';
}

async function editProduct(id) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  try {
    const res = await fetch(`/api/products/${id}`);
    const p = await res.json();
    document.getElementById('modal-title').textContent = 'Edit Product';
    document.getElementById('f-id').value = p.id;
    document.getElementById('f-codes').value = p.productCodes.join('+');
    document.getElementById('f-price').value = p.price;
    document.getElementById('f-name').value = p.name;
    document.getElementById('f-nameAr').value = p.nameAr;
    document.getElementById('f-category').value = p.category;
    document.getElementById('f-images').value = p.images.join('\n');
    document.getElementById('f-description').value = p.description;
    document.getElementById('f-short').value = p.shortDescription;
    document.getElementById('f-qty').value = p.quantity;
    document.getElementById('f-featured').checked = p.featured;
    document.getElementById('f-instock').checked = p.inStock;
    document.getElementById('f-isset').checked = p.isSet;
    modal.style.display = 'flex';
  } catch(err) { alert('Failed to load product: ' + err.message); }
}

function closeProductModal(e, force = false) {
  if (force) {
    const modal = document.getElementById('product-modal');
    if (modal) modal.style.display = 'none';
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const codesRaw = document.getElementById('f-codes').value.trim();
  const price = parseInt(document.getElementById('f-price').value);
  const isSet = document.getElementById('f-isset').checked || codesRaw.includes('+');
  const productCodes = codesRaw.split('+').map(c => c.trim()).filter(Boolean);
  const images = document.getElementById('f-images').value.split('\n').map(s => s.trim()).filter(Boolean);
  const category = document.getElementById('f-category').value;

  const productData = {
    isSet,
    productCodes,
    brand: 'SWAROVSKI',
    name: document.getElementById('f-name').value.trim(),
    nameAr: document.getElementById('f-nameAr').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    shortDescription: document.getElementById('f-short').value.trim(),
    category: isSet ? 'Sets' : category,
    price,
    currency: 'دينار',
    displayPrice: `${price} دينار`,
    images,
    originalImage: images[0] || '',
    inStock: document.getElementById('f-instock').checked,
    quantity: parseInt(document.getElementById('f-qty').value) || 0,
    featured: document.getElementById('f-featured').checked,
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(productData)
      });
    } else {
      res = await fetch('/api/products', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(productData)
      });
    }
    if (res.ok) {
      showToast(id ? 'Product updated successfully!' : 'Product added successfully!', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      const err = await res.json();
      showToast('Error: ' + (err.error || 'Save failed'), 'error');
    }
  } catch(err) { showToast('Network error: ' + err.message, 'error'); }
}

async function deleteProductAdmin(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Product deleted!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast('Delete failed', 'error');
    }
  } catch(err) { showToast('Network error', 'error'); }
}

// ── Filename Parser ──────────────────────────────────────────
async function parseFilenameAdmin() {
  const filename = document.getElementById('parse-filename')?.value?.trim();
  if (!filename) { showToast('Please enter a filename', 'error'); return; }
  try {
    const res = await fetch('/api/parse-filename', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast('Parse error: ' + err.error, 'error');
      return;
    }
    const data = await res.json();
    // Fill in the form
    document.getElementById('f-codes').value = data.productCodes.join('+');
    document.getElementById('f-price').value = data.price;
    document.getElementById('f-isset').checked = data.isSet;
    if (data.isSet) document.getElementById('f-category').value = 'Sets';
    showToast(`Parsed! Code(s): ${data.productCodes.join('+')} | Price: ${data.price} دينار`, 'success');
  } catch(err) { showToast('Parse failed: ' + err.message, 'error'); }
}

// ── Settings ─────────────────────────────────────────────────
async function saveSettings(e) {
  e.preventDefault();
  const data = {
    facebookUrl:    document.getElementById('s-facebook')?.value,
    instagramUrl:   document.getElementById('s-instagram')?.value,
    whatsappNumber: document.getElementById('s-whatsapp')?.value,
    heroTitleAr:    document.getElementById('s-heroAr')?.value,
    heroTitleEn:    document.getElementById('s-heroEn')?.value,
  };
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    if (res.ok) {
      showToast('Settings saved!', 'success');
      siteSettings = {};
    } else {
      showToast('Save failed', 'error');
    }
  } catch(err) { showToast('Network error', 'error'); }
}

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.style.cssText = `
    position:fixed;bottom:2rem;${lang==='ar'?'left':'right'}:2rem;z-index:9999;
    padding:1rem 1.5rem;border-radius:12px;font-size:0.85rem;font-weight:600;
    display:flex;align-items:center;gap:0.6rem;
    animation:slideInToast 0.3s ease;
    ${type === 'success'
      ? 'background:linear-gradient(135deg,#1a6b1a,#2d9e2d);color:#fff;'
      : 'background:linear-gradient(135deg,#6b1a1a,#9e2d2d);color:#fff;'}
    box-shadow:0 8px 30px rgba(0,0,0,0.4);
  `;
  toast.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${message}`;
  document.body.appendChild(toast);

  const style = document.createElement('style');
  style.textContent = '@keyframes slideInToast{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(style);

  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, 3500);
}

// ── Smooth scroll to sections ────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
}

// ── Image lazy loading fallback ──────────────────────────────
function initImageFallbacks() {
  document.querySelectorAll('img[onerror]').forEach(img => {
    if (!img.complete || img.naturalHeight === 0) {
      img.onerror = () => {
        img.src = 'https://via.placeholder.com/400x400/0a0a0a/c9a96e?text=SWAROVSKI';
      };
    }
  });
}

// ── Hero number counter animation ─────────────────────────────
function initCounters() {
  const counters = document.querySelectorAll('.stat-num');
  counters.forEach(counter => {
    const target = parseInt(counter.textContent.replace(/\D/g,''));
    if (!target) return;
    const suffix = counter.textContent.replace(/\d/g,'');
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      counter.textContent = current + suffix;
      if (current >= target) clearInterval(timer);
    }, 40);
  });
}

// ── Admin: Toggle stock status quickly ───────────────────────
async function toggleStock(id, current) {
  try {
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ inStock: !current })
    });
    window.location.reload();
  } catch(e) {}
}

// ── Admin: Toggle featured quickly ─────────────────────────────
async function toggleFeatured(id, current) {
  try {
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ featured: !current })
    });
    window.location.reload();
  } catch(e) {}
}

// ── Keyboard navigation ──────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Close modals on Escape
    if (e.key === 'Escape') {
      closeModal();
      const pm = document.getElementById('product-modal');
      if (pm) pm.style.display = 'none';
    }
  });
}

// ── Initialize all ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  initParticles();
  initHeaderScroll();
  initLiveSearch();
  initAnimations();
  initSmoothScroll();
  initImageFallbacks();
  initKeyboard();

  // Counter animation on hero
  if (document.querySelector('.stat-num')) {
    setTimeout(initCounters, 500);
  }

  // Auto-detect language if none set and redirect
  const storedLang = localStorage.getItem('salford_lang');
  if (storedLang && storedLang !== lang) {
    const path = window.location.pathname;
    if (path === '/' || path === '/ar/' || path === '/en/') {
      window.location.href = `/${storedLang}/`;
    }
  }

  // Store language preference
  if (lang) localStorage.setItem('salford_lang', lang);
});

// ── Public API ────────────────────────────────────────────────
window.openBuyModal     = openBuyModal;
window.closeModal       = closeModal;
window.closeProductModal= closeProductModal;
window.switchImg        = switchImg;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu  = closeMobileMenu;
window.doSearch         = doSearch;
window.toggleFilters    = toggleFilters;
window.adminLogin       = adminLogin;
window.adminLogout      = adminLogout;
window.filterAdminTable = filterAdminTable;
window.showAddModal     = showAddModal;
window.editProduct      = editProduct;
window.deleteProductAdmin = deleteProductAdmin;
window.saveProduct      = saveProduct;
window.saveSettings     = saveSettings;
window.parseFilenameAdmin = parseFilenameAdmin;
window.toggleStock      = toggleStock;
window.toggleFeatured   = toggleFeatured;
