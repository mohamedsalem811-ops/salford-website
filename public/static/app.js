/* ══════════════════════════════════════════════════════════════
   SALFORD LIBYA — Luxury Jewelry Showcase
   Frontend JavaScript: Bilingual, RTL/LTR, Modals, Admin
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ── Language & Direction ──────────────────────────────────────
const lang = document.documentElement.getAttribute('data-lang') || 'ar';
const dir  = lang === 'ar' ? 'rtl' : 'ltr';

// ── Cached settings ───────────────────────────────────────────
let _settings = null;

async function fetchSettings() {
  if (_settings) return _settings;
  try {
    const res = await fetch('/api/settings');
    _settings = await res.json();
  } catch(e) { _settings = {}; }
  return _settings;
}

// ═══════════════════════════════════════════════════════════════
//  HEADER EFFECTS
// ═══════════════════════════════════════════════════════════════

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      header.style.background = 'rgba(0,0,0,0.98)';
      header.style.boxShadow  = '0 4px 30px rgba(0,0,0,0.8)';
    } else {
      header.style.background = 'rgba(0,0,0,0.92)';
      header.style.boxShadow  = 'none';
    }
  }, { passive: true });
}

// ── Search bar toggle ─────────────────────────────────────────
let searchOpen = false;
function toggleSearch() {
  const bar = document.getElementById('search-bar');
  if (!bar) return;
  searchOpen = !searchOpen;
  bar.style.display = searchOpen ? 'block' : 'none';
  if (searchOpen) {
    const inp = bar.querySelector('input');
    if (inp) setTimeout(() => inp.focus(), 50);
  }
}
// Close search on outside click
document.addEventListener('click', e => {
  if (!searchOpen) return;
  const bar  = document.getElementById('search-bar');
  const btn  = document.querySelector('.search-toggle');
  if (bar && btn && !bar.contains(e.target) && !btn.contains(e.target)) {
    bar.style.display = 'none';
    searchOpen = false;
  }
});

// ── Mobile menu toggle ────────────────────────────────────────
let menuOpen = false;
function toggleMenu() {
  menuOpen ? closeMenu() : openMenu();
}
function openMenu() {
  let overlay = document.getElementById('mobile-nav-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-nav-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9000;
      background:rgba(0,0,0,0.97);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:2rem;padding:2rem;
      animation:fadeInMenu 0.25s ease;
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes fadeInMenu{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}';
    document.head.appendChild(style);

    const close = document.createElement('button');
    close.style.cssText = 'position:absolute;top:1.5rem;right:1.5rem;font-size:1.8rem;color:#bfd7ff;background:none;border:none;cursor:pointer;';
    close.innerHTML = '<i class="fa fa-times"></i>';
    close.onclick = closeMenu;
    overlay.appendChild(close);

    const links = [
      { href: `/${lang}/`,                      label: lang==='ar' ? 'الرئيسية'           : 'Home'              },
      { href: `/${lang}/products`,               label: lang==='ar' ? 'جميع المنتجات'      : 'All Products'       },
      { href: `/${lang}/sets`,                   label: lang==='ar' ? 'الأطقم والمجموعات'  : 'Sets & Collections' },
      { href: `/${lang}/products?cat=necklaces`, label: lang==='ar' ? 'القلائد'            : 'Necklaces'          },
      { href: `/${lang}/products?cat=earrings`,  label: lang==='ar' ? 'الأقراط'            : 'Earrings'           },
      { href: `/${lang}/products?cat=bracelets`, label: lang==='ar' ? 'الأساور'            : 'Bracelets'          },
    ];
    links.forEach(l => {
      const a = document.createElement('a');
      a.href = l.href;
      a.textContent = l.label;
      a.style.cssText = 'color:#bfd7ff;font-size:1.4rem;font-weight:600;letter-spacing:0.05em;transition:color 0.2s;';
      a.onmouseenter = () => a.style.color = '#ffffff';
      a.onmouseleave = () => a.style.color = '#bfd7ff';
      overlay.appendChild(a);
    });

    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  menuOpen = true;

  const ham = document.getElementById('hamburger');
  if (ham) ham.classList.add('open');
}
function closeMenu() {
  const overlay = document.getElementById('mobile-nav-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  menuOpen = false;
  const ham = document.getElementById('hamburger');
  if (ham) ham.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
//  BUY MODAL  (FB + IG only)
// ═══════════════════════════════════════════════════════════════

async function openBuy(id, name, code) {
  const modal = document.getElementById('buy-modal');
  if (!modal) return;

  const nameEl = document.getElementById('modal-product-name');
  if (nameEl) nameEl.textContent = name;

  const msg = lang === 'ar'
    ? `مرحباً، أريد الاستفسار عن: ${code} — ${name}`
    : `Hi! I'm interested in: ${code} — ${name}`;
  const enc = encodeURIComponent(msg);

  const s = await fetchSettings();
  const fbBase = (s.facebookUrl || 'https://www.facebook.com/salfordlibya').replace(/\/$/, '');
  const igUrl  = s.instagramUrl  || 'https://www.instagram.com/salford.libya/';

  const fbPageId = fbBase.split('/').pop();
  const fbLink   = `https://m.me/${fbPageId}?text=${enc}`;
  const igLink   = igUrl;

  const fbBtn = document.getElementById('modal-fb-btn');
  const igBtn = document.getElementById('modal-ig-btn');
  if (fbBtn) fbBtn.href = fbLink;
  if (igBtn) igBtn.href = igLink;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  setTimeout(() => { const first = modal.querySelector('a,button'); if (first) first.focus(); }, 50);
}

function closeBuyModal() {
  const modal = document.getElementById('buy-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  const modal = document.getElementById('buy-modal');
  if (modal && e.target === modal) closeBuyModal();
});

function trackBuy(productId, channel) {
  try {
    const key   = `salford_track_${productId}_${channel}`;
    const count = parseInt(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, count);
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
//  GALLERY & LIGHTBOX  (storefront)
// ═══════════════════════════════════════════════════════════════

function switchImg(src) {
  const mainImg = document.getElementById('main-img');
  if (mainImg) {
    mainImg.style.opacity = '0';
    setTimeout(() => {
      mainImg.src = src;
      mainImg.style.opacity = '1';
    }, 150);
  }
  document.querySelectorAll('.gallery-thumbs img').forEach(t => {
    t.classList.toggle('thumb-active', t.src.endsWith(src) || t.getAttribute('src') === src);
  });
}

function openLightbox(src) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,0.95);
      display:flex;align-items:center;justify-content:center;
      cursor:zoom-out;
    `;
    lb.innerHTML = '<img id="lightbox-img" style="max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,0.8);"/>';
    lb.onclick = closeLightbox;
    document.body.appendChild(lb);
  }
  document.getElementById('lightbox-img').src = src;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Admin lightbox (separate from storefront) ─────────────────
function openLightboxAdmin(src) {
  const lb  = document.getElementById('admin-lightbox');
  const img = document.getElementById('admin-lightbox-img');
  if (!lb || !img) {
    // Fallback: create dynamically if not in HTML
    openLightbox(src);
    return;
  }
  img.src = src;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAdminLightbox() {
  const lb = document.getElementById('admin-lightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════
//  PRODUCT CARD ANIMATIONS
// ═══════════════════════════════════════════════════════════════

function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.product-card, .set-card, .cat-card').forEach((el, i) => {
    el.style.cssText += `
      opacity:0;transform:translateY(28px);
      transition:opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s,
                 border-color 0.3s, box-shadow 0.3s;
    `;
    observer.observe(el);
  });
}

// ── Hero particles (icy blue palette) ────────────────────────
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#bfd7ff','#ffffff','#4a7ab5','#e8f0ff','#8ab4f8'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position:absolute;border-radius:50%;pointer-events:none;
      left:${Math.random()*100}%;top:${Math.random()*100}%;
      width:${Math.random()*3+1}px;height:${Math.random()*3+1}px;
      background:${colors[i % colors.length]};
      animation:floatUp ${Math.random()*8+6}s ${Math.random()*6}s infinite ease-in-out;
      opacity:0;
    `;
    container.appendChild(p);
  }
  const style = document.createElement('style');
  style.textContent = `
    @keyframes floatUp {
      0%   { opacity:0; transform:translateY(0) scale(1); }
      20%  { opacity:0.8; }
      80%  { opacity:0.4; }
      100% { opacity:0; transform:translateY(-80px) scale(0.6); }
    }
  `;
  document.head.appendChild(style);
}

// ── Smooth scroll ─────────────────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
  });
}

// ── Image error fallback ──────────────────────────────────────
function initImageFallbacks() {
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
      if (!this.dataset.errored) {
        this.dataset.errored = '1';
        this.src = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23000000"/><text x="200" y="210" text-anchor="middle" fill="%23bfd7ff" font-family="serif" font-size="18" letter-spacing="4">SALFORD</text></svg>';
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
  const old = document.getElementById('toast-msg');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-msg';
  const isSuccess = type === 'success';
  toast.style.cssText = `
    position:fixed;bottom:2rem;${lang==='ar'?'left':'right'}:2rem;z-index:99999;
    padding:1rem 1.5rem;border-radius:12px;
    display:flex;align-items:center;gap:0.6rem;
    font-size:0.875rem;font-weight:600;
    color:#fff;max-width:340px;word-break:break-word;
    background:${isSuccess
      ? 'linear-gradient(135deg,#1a4a1a,#2d7e2d)'
      : 'linear-gradient(135deg,#4a1a1a,#8e2d2d)'};
    box-shadow:0 8px 32px rgba(0,0,0,0.6);
    animation:toastIn 0.3s ease;
  `;
  toast.innerHTML = `<i class="fas fa-${isSuccess?'check-circle':'exclamation-circle'}"></i> ${message}`;
  document.body.appendChild(toast);

  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}';
    document.head.appendChild(s);
  }
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════════
//  IMAGE UPLOAD — BASE64 HANDLER
// ═══════════════════════════════════════════════════════════════

function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;

  // Size check (5 MB max)
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image too large — max 5 MB', 'error');
    input.value = '';
    return;
  }

  // Type check
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', 'error');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const base64 = e.target.result;

    // Store in hidden field
    setField('pf-image', base64);

    // Show preview
    const preview     = document.getElementById('upload-preview');
    const placeholder = document.getElementById('upload-placeholder');
    if (preview) {
      preview.src          = base64;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';

    // Clear URL field to avoid conflict
    const urlField = document.getElementById('pf-image-url');
    if (urlField) urlField.value = '';

    showToast('Image uploaded successfully', 'success');
  };
  reader.onerror = () => showToast('Failed to read image file', 'error');
  reader.readAsDataURL(file);
}

function handleImageUrl(url) {
  const preview     = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');

  if (url && url.trim()) {
    setField('pf-image', url.trim());
    if (preview) {
      preview.src           = url.trim();
      preview.style.display = 'block';
      preview.onerror       = () => {
        preview.style.display  = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        showToast('Could not load image from URL', 'error');
      };
    }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    setField('pf-image', '');
    if (preview)     { preview.style.display = 'none'; preview.src = ''; }
    if (placeholder)   placeholder.style.display = 'flex';
  }
}

function resetImageUpload() {
  setField('pf-image', '');
  const preview     = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');
  const fileInput   = document.getElementById('pf-image-file');
  const urlInput    = document.getElementById('pf-image-url');
  if (preview)     { preview.style.display = 'none'; preview.src = ''; }
  if (placeholder)   placeholder.style.display = 'flex';
  if (fileInput)     fileInput.value = '';
  if (urlInput)      urlInput.value  = '';
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN AUTHENTICATION
// ═══════════════════════════════════════════════════════════════

function checkAdminAuth() {
  if (window.location.pathname.startsWith('/admin/dashboard')) {
    if (!sessionStorage.getItem('salford_admin')) {
      window.location.href = '/admin/login';
    }
  }
}

async function doLogin(e) {
  e.preventDefault();
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const errEl  = document.getElementById('login-err');
  if (!userEl || !passEl) return;

  const username = userEl.value.trim();
  const password = passEl.value;

  try {
    const res  = await fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem('salford_admin', 'yes');
      window.location.href = '/admin/dashboard';
    } else {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Invalid username or password'; }
      passEl.value = '';
      passEl.focus();
    }
  } catch(err) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Connection error — please retry'; }
  }
}

function adminLogout() {
  sessionStorage.removeItem('salford_admin');
  window.location.href = '/admin/login';
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN TABS
// ═══════════════════════════════════════════════════════════════

function showTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const tab = document.getElementById(tabName + '-tab');
  if (tab) tab.style.display = 'block';

  document.querySelectorAll('.sidebar-link').forEach(l => {
    if (l.getAttribute('href') === '#' + tabName + '-tab') l.classList.add('active');
  });
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN FILENAME PARSER  (renamed to parseFilenameAdmin)
// ═══════════════════════════════════════════════════════════════

async function parseFilenameAdmin() {
  const inp = document.getElementById('parse-input');
  const res = document.getElementById('parse-result');
  if (!inp) return;
  const filename = inp.value.trim();
  if (!filename) { showToast('Enter a filename first', 'error'); return; }

  try {
    const r = await fetch('/api/parse-filename', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ filename })
    });
    if (!r.ok) { showToast('Invalid filename format. Example: 5642976(550)', 'error'); return; }
    const data = await r.json();

    // Auto-fill form if modal is open
    const codeF  = document.getElementById('pf-code');
    const priceF = document.getElementById('pf-price');
    const isSetF = document.getElementById('pf-isset');
    const catF   = document.getElementById('pf-cat');
    if (codeF)  codeF.value   = data.codes.join('+');
    if (priceF) priceF.value  = data.price;
    if (isSetF) isSetF.checked = data.isSet;
    if (catF && data.isSet)  catF.value = 'sets';

    if (res) {
      res.style.display = 'block';
      res.innerHTML = `
        <strong><i class="fa fa-check" style="color:#27ae60"></i> Parsed!</strong><br/>
        Code(s): <code>${data.codes.join(' + ')}</code><br/>
        Price: <strong>${data.price} LYD</strong><br/>
        ${data.isSet ? '<em>Detected as a SET</em>' : ''}
      `;
    }
    showToast(`Code: ${data.codes.join('+')} · Price: ${data.price} LYD`, 'success');
  } catch(err) { showToast('Parse failed: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN PRODUCT MODAL  (Add / Edit)
// ═══════════════════════════════════════════════════════════════

/**
 * Open the Add Product modal.
 * @param {boolean} isSet — pre-check the "Is Set" checkbox when true
 */
function openAddModal(isSet = false) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const title = document.getElementById('modal-title');
  const form  = document.getElementById('product-form');
  if (title) title.textContent = isSet ? 'Add New Set' : 'Add New Product';
  if (form)  form.reset();

  // Clear all fields explicitly
  setField('pf-id', '');
  setCheck('pf-instock',  true);
  setCheck('pf-featured', false);
  setCheck('pf-isset',    isSet);

  // Reset image upload area
  resetImageUpload();

  // If opening as a set, also set category
  if (isSet) {
    const catF = document.getElementById('pf-cat');
    if (catF) catF.value = 'sets';
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function openEditModal(product) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const title = document.getElementById('modal-title');
  if (title) title.textContent = product.isSet ? 'Edit Set' : 'Edit Product';

  setField('pf-id',         product.id);
  setField('pf-code',       product.code);
  setField('pf-price',      product.price   || '');
  setField('pf-orig-price', product.originalPrice || '');
  setField('pf-name',       product.name);
  setField('pf-short-desc', product.shortDesc   || '');
  setField('pf-desc',       product.description || '');
  setCheck('pf-instock',    product.inStock);
  setCheck('pf-featured',   product.featured);
  setCheck('pf-isset',      product.isSet);

  const catF = document.getElementById('pf-cat');
  if (catF) catF.value = product.category || 'necklaces';

  // Restore image into upload area
  const existingImg = product.image || (product.images && product.images[0]) || '';
  setField('pf-image', existingImg);

  const preview     = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');
  const urlField    = document.getElementById('pf-image-url');

  if (existingImg) {
    if (preview) {
      preview.src           = existingImg;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    // Only populate URL field if it's a real URL (not base64)
    if (urlField && !existingImg.startsWith('data:')) {
      urlField.value = existingImg;
    }
  } else {
    if (preview)     { preview.style.display = 'none'; preview.src = ''; }
    if (placeholder)   placeholder.style.display = 'flex';
    if (urlField)      urlField.value = '';
  }

  // Clear file input
  const fileInput = document.getElementById('pf-image-file');
  if (fileInput) fileInput.value = '';

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

async function saveProduct(e) {
  e.preventDefault();

  const id       = getField('pf-id');
  const codeRaw  = getField('pf-code').trim();
  const price    = parseInt(getField('pf-price'))      || 0;
  const origP    = parseInt(getField('pf-orig-price')) || undefined;
  const isSet    = getChecked('pf-isset') || codeRaw.includes('+');
  const codes    = codeRaw.split('+').map(c => c.trim()).filter(Boolean);
  const image    = getField('pf-image').trim();
  const category = isSet ? 'sets' : (getField('pf-cat') || 'necklaces');

  // Validation — code and image are required; price is optional
  if (!codeRaw) {
    showToast('Product code is required', 'error');
    return;
  }
  if (!image) {
    showToast('Please upload an image or enter an image URL', 'error');
    return;
  }

  const payload = {
    code:          codes.join('+'),
    setCodes:      isSet ? codes : undefined,
    isSet,
    name:          getField('pf-name').trim(),
    shortDesc:     getField('pf-short-desc').trim(),
    description:   getField('pf-desc').trim(),
    category,
    price,
    originalPrice: origP,
    image,
    images:        [image],
    inStock:       getChecked('pf-instock'),
    featured:      getChecked('pf-featured'),
  };

  // Show saving state
  const saveBtn = document.getElementById('save-product-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...'; }

  try {
    const url    = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    if (r.ok) {
      showToast(id ? 'Product updated!' : 'Product added!', 'success');
      closeProductModal();
      setTimeout(() => location.reload(), 900);
    } else {
      const err = await r.json().catch(() => ({}));
      showToast('Save failed: ' + (err.error || r.status), 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa fa-save"></i> Save Product'; }
    }
  } catch(err) {
    showToast('Network error: ' + err.message, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa fa-save"></i> Save Product'; }
  }
}

// ── Delete confirm modal ──────────────────────────────────────
let _deleteId = null;

function confirmDelete(id, name) {
  _deleteId = id;
  const modal = document.getElementById('delete-modal');
  const msg   = document.getElementById('delete-msg');
  if (!modal) return;
  if (msg) msg.innerHTML = `Are you sure you want to delete <strong>"${name}"</strong>?<br/><small style="color:#e74c3c">This action cannot be undone.</small>`;
  modal.style.display = 'flex';
}

function closeDeleteModal() {
  _deleteId = null;
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'none';
}

async function executeDelete() {
  if (!_deleteId) return;
  const btn = document.getElementById('confirm-delete-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Deleting...'; }
  try {
    const r = await fetch(`/api/products/${_deleteId}`, { method: 'DELETE' });
    if (r.ok) {
      showToast('Product deleted!', 'success');
      closeDeleteModal();
      setTimeout(() => location.reload(), 800);
    } else {
      showToast('Delete failed', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-trash"></i> Delete'; }
    }
  } catch(err) {
    showToast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-trash"></i> Delete'; }
  }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN SETTINGS FORM
// ═══════════════════════════════════════════════════════════════

async function saveSettings(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    facebookUrl:    form.facebookUrl?.value?.trim()    || '',
    instagramUrl:   form.instagramUrl?.value?.trim()   || '',
    heroTitleAr:    form.heroTitleAr?.value?.trim()    || '',
    heroTitleEn:    form.heroTitleEn?.value?.trim()    || '',
    heroSubtitleAr: form.heroSubtitleAr?.value?.trim() || '',
    heroSubtitleEn: form.heroSubtitleEn?.value?.trim() || '',
    adminUser:      form.adminUser?.value?.trim()      || '',
  };
  // Only include password if changed
  const newPass = form.adminPass?.value;
  if (newPass) data.adminPass = newPass;

  const btn = form.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...'; }

  try {
    const r = await fetch('/api/settings', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    });
    if (r.ok) {
      _settings = null; // invalidate cache
      showToast('Settings saved successfully!', 'success');
    } else {
      showToast('Failed to save settings', 'error');
    }
  } catch(err) { showToast('Network error: ' + err.message, 'error'); }
  finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save Settings'; }
  }
}

// ── Quick toggle stock inline ─────────────────────────────────
async function toggleStock(id, current) {
  try {
    const r = await fetch(`/api/products/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inStock: !current })
    });
    if (r.ok) {
      location.reload();
    } else {
      showToast('Update failed', 'error');
    }
  } catch(e) { showToast('Update failed', 'error'); }
}

// ── Quick toggle featured inline ──────────────────────────────
async function toggleFeatured(id, current) {
  try {
    const r = await fetch(`/api/products/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ featured: !current })
    });
    if (r.ok) {
      location.reload();
    } else {
      showToast('Update failed', 'error');
    }
  } catch(e) { showToast('Update failed', 'error'); }
}

// ── Table search filter ───────────────────────────────────────
/**
 * Filter an admin table by text query.
 * @param {string} q       — search query
 * @param {string} tableId — id of the <table> element (default: 'products-table')
 */
function filterAdminTable(q, tableId = 'products-table') {
  const query = q.toLowerCase().trim();
  const table = document.getElementById(tableId);
  if (!table) {
    // Fallback: search all admin tables
    document.querySelectorAll('.admin-table tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
    return;
  }
  table.querySelectorAll('tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
}

// ── Featured grid card toggle (Featured tab) ──────────────────
async function toggleFeaturedCard(id, current) {
  const btn = document.querySelector(`[data-feat-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    const r = await fetch(`/api/products/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ featured: !current })
    });
    if (r.ok) {
      showToast(!current ? 'Marked as Featured ★' : 'Removed from Featured', 'success');
      setTimeout(() => location.reload(), 700);
    } else {
      showToast('Update failed', 'error');
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
  } catch(e) {
    showToast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function getField(id)      { const el = document.getElementById(id); return el ? el.value : ''; }
function setField(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function getChecked(id)    { const el = document.getElementById(id); return el ? el.checked : false; }
function setCheck(id, val) { const el = document.getElementById(id); if (el) el.checked = !!val; }

// ═══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeBuyModal();
    closeProductModal();
    closeDeleteModal();
    closeLightbox();
    closeAdminLightbox();
    if (menuOpen) closeMenu();
    const sb = document.getElementById('search-bar');
    if (sb && searchOpen) { sb.style.display = 'none'; searchOpen = false; }
  }
});

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  initHeaderScroll();
  initParticles();
  initAnimations();
  initSmoothScroll();
  initImageFallbacks();

  // Wire up confirm-delete button
  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', executeDelete);

  // Wire up admin login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', doLogin);

  // Admin lightbox backdrop click to close
  const adminLb = document.getElementById('admin-lightbox');
  if (adminLb) adminLb.addEventListener('click', e => {
    if (e.target === adminLb) closeAdminLightbox();
  });

  // Language preference storage
  if (lang) localStorage.setItem('salford_lang', lang);
});

// ═══════════════════════════════════════════════════════════════
//  GLOBAL EXPORTS  (called from inline onclick attributes)
// ═══════════════════════════════════════════════════════════════

// ── Storefront ────────────────────────────────────────────────
window.openBuy           = openBuy;
window.closeBuyModal     = closeBuyModal;
window.trackBuy          = trackBuy;
window.switchImg         = switchImg;
window.openLightbox      = openLightbox;
window.closeLightbox     = closeLightbox;
window.toggleSearch      = toggleSearch;
window.toggleMenu        = toggleMenu;
window.closeMenu         = closeMenu;

// ── Admin — auth & nav ────────────────────────────────────────
window.doLogin           = doLogin;
window.adminLogout       = adminLogout;
window.showTab           = showTab;

// ── Admin — product modal ─────────────────────────────────────
window.openAddModal      = openAddModal;
window.openEditModal     = openEditModal;
window.closeProductModal = closeProductModal;
window.saveProduct       = saveProduct;

// ── Admin — image upload ──────────────────────────────────────
window.handleImageUpload = handleImageUpload;
window.handleImageUrl    = handleImageUrl;
window.resetImageUpload  = resetImageUpload;

// ── Admin — lightbox ─────────────────────────────────────────
window.openLightboxAdmin  = openLightboxAdmin;
window.closeAdminLightbox = closeAdminLightbox;

// ── Admin — delete ────────────────────────────────────────────
window.confirmDelete     = confirmDelete;
window.closeDeleteModal  = closeDeleteModal;
window.executeDelete     = executeDelete;

// ── Admin — filename parser (renamed) ─────────────────────────
window.parseFilenameAdmin = parseFilenameAdmin;

// ── Admin — settings ─────────────────────────────────────────
window.saveSettings      = saveSettings;

// ── Admin — table & toggles ───────────────────────────────────
window.filterAdminTable     = filterAdminTable;
window.toggleStock          = toggleStock;
window.toggleFeatured       = toggleFeatured;
window.toggleFeaturedCard   = toggleFeaturedCard;
