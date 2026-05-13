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
      header.style.background = 'rgba(247,241,236,0.98)';
      header.style.boxShadow  = '0 4px 20px rgba(183,110,121,0.15)';
    } else {
      header.style.background = 'rgba(247,241,236,0.94)';
      header.style.boxShadow  = '0 2px 20px rgba(183,110,121,0.08)';
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
document.addEventListener('click', e => {
  if (!searchOpen) return;
  const bar  = document.getElementById('search-bar');
  const btn  = document.querySelector('.search-toggle');
  if (bar && btn && !bar.contains(e.target) && !btn.contains(e.target)) {
    bar.style.display = 'none';
    searchOpen = false;
  }
});

// ── Mobile menu toggle — iOS compatible ──────────────────────
let menuOpen = false;
function toggleMenu() {
  menuOpen ? closeMenu() : openMenu();
}
function openMenu() {
  let overlay = document.getElementById('mobile-nav-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-nav-overlay';
    // iOS: use -webkit-overflow-scrolling and avoid fixed positioning issues
    overlay.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;z-index:9000;
      background:rgba(247,241,236,0.98);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:2rem;padding:2rem;
      -webkit-overflow-scrolling:touch;
      overflow-y:auto;
    `;

    // inject animation style once
    if (!document.getElementById('mobile-nav-style')) {
      const style = document.createElement('style');
      style.id = 'mobile-nav-style';
      style.textContent = `
        @keyframes fadeInMenu{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
        #mobile-nav-overlay { animation: fadeInMenu 0.22s ease; }
        #mobile-nav-overlay a:hover { color: #B76E79 !important; }
        .hamburger.open span:nth-child(1){transform:rotate(45deg) translate(5px,5px);}
        .hamburger.open span:nth-child(2){opacity:0;}
        .hamburger.open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px);}
      `;
      document.head.appendChild(style);
    }

    const close = document.createElement('button');
    close.style.cssText = 'position:absolute;top:1.2rem;right:1.2rem;font-size:1.6rem;color:#B76E79;background:none;border:none;cursor:pointer;padding:8px;-webkit-tap-highlight-color:transparent;';
    close.innerHTML = '<i class="fa fa-times"></i>';
    close.setAttribute('aria-label', 'Close menu');
    // use touchend for instant iOS response
    close.addEventListener('touchend', e => { e.preventDefault(); closeMenu(); });
    close.addEventListener('click', closeMenu);
    overlay.appendChild(close);

    // Rose gold divider
    const divider = document.createElement('div');
    divider.style.cssText = 'width:48px;height:2px;background:linear-gradient(90deg,transparent,#B76E79,transparent);border-radius:2px;margin-bottom:0.5rem;';
    overlay.appendChild(divider);

    const links = [
      { href: `/${lang}/`,                      icon:'fa-home',        label: lang==='ar' ? 'الرئيسية'           : 'Home'              },
      { href: `/${lang}/products`,               icon:'fa-gem',         label: lang==='ar' ? 'جميع المنتجات'      : 'All Products'       },
      { href: `/${lang}/sets`,                   icon:'fa-layer-group', label: lang==='ar' ? 'الأطقم والمجموعات'  : 'Sets & Collections' },
      { href: `/${lang}/products?cat=necklaces`, icon:'fa-diamond',     label: lang==='ar' ? 'القلائد'            : 'Necklaces'          },
      { href: `/${lang}/products?cat=earrings`,  icon:'fa-star',        label: lang==='ar' ? 'الأقراط'            : 'Earrings'           },
      { href: `/${lang}/products?cat=bracelets`, icon:'fa-link',        label: lang==='ar' ? 'الأساور'            : 'Bracelets'          },
    ];

    links.forEach(l => {
      const a = document.createElement('a');
      a.href = l.href;
      a.innerHTML = `<i class="fa ${l.icon}" style="width:22px;text-align:center;color:#B76E79;margin-${lang==='ar'?'left':'right'}:10px;"></i>${l.label}`;
      a.style.cssText = `
        color:#2F2A2C;font-size:1.25rem;font-weight:600;letter-spacing:0.03em;
        display:flex;align-items:center;padding:10px 20px;
        border-radius:12px;width:100%;max-width:300px;
        transition:background 0.2s,color 0.2s;
        -webkit-tap-highlight-color:transparent;
        text-decoration:none;
      `;
      // Touch-friendly active state
      a.addEventListener('touchstart', () => { a.style.background='rgba(183,110,121,0.10)'; }, {passive:true});
      a.addEventListener('touchend',   () => { a.style.background=''; });
      overlay.appendChild(a);
    });

    // Language switch at bottom
    const otherLang = lang === 'ar' ? 'en' : 'ar';
    const otherLabel = lang === 'ar' ? 'English' : 'العربية';
    const langBtn = document.createElement('a');
    langBtn.href = `/${otherLang}/`;
    langBtn.innerHTML = `<i class="fa fa-globe" style="margin-${lang==='ar'?'left':'right'}:8px;"></i>${otherLabel}`;
    langBtn.style.cssText = `
      margin-top:1rem;color:#B76E79;font-size:0.95rem;font-weight:700;
      border:1.5px solid rgba(183,110,121,0.35);border-radius:20px;
      padding:8px 24px;display:flex;align-items:center;
      -webkit-tap-highlight-color:transparent;
    `;
    overlay.appendChild(langBtn);

    document.body.appendChild(overlay);
  }

  overlay.style.display = 'flex';
  // iOS scroll lock: use position fixed on body
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  menuOpen = true;
  const ham = document.getElementById('hamburger');
  if (ham) ham.classList.add('open');
}

function closeMenu() {
  const overlay = document.getElementById('mobile-nav-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  menuOpen = false;
  const ham = document.getElementById('hamburger');
  if (ham) ham.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
//  BUY MODAL
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

  const fbBtn = document.getElementById('modal-fb-btn');
  const igBtn = document.getElementById('modal-ig-btn');
  if (fbBtn) fbBtn.href = `https://m.me/${fbPageId}?text=${enc}`;
  if (igBtn) igBtn.href = igUrl;

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
//  GALLERY & LIGHTBOX
// ═══════════════════════════════════════════════════════════════

function switchImg(src) {
  switchMedia('image', src, null);
}

/**
 * switchMedia(type, src, clickedThumb)
 * type  = 'image' | 'video'
 * src   = URL or data-URL of the media
 * clickedThumb = the DOM element that was clicked (for active highlight), or null
 */
function switchMedia(type, src, clickedThumb) {
  const mainImg   = document.getElementById('main-img');
  const mainVideo = document.getElementById('main-video');

  if (type === 'video') {
    if (mainImg)   { mainImg.style.display = 'none'; }
    if (mainVideo) {
      mainVideo.style.display = 'block';
      mainVideo.src = src + '#t=0.5';
      mainVideo.load();
      mainVideo.play().catch(() => {});
    }
  } else {
    if (mainVideo) { mainVideo.style.display = 'none'; mainVideo.pause(); mainVideo.src = ''; }
    if (mainImg)   {
      mainImg.style.opacity = '0';
      mainImg.style.display = 'block';
      mainImg.src = src;
      setTimeout(() => { mainImg.style.opacity = '1'; }, 80);
    }
  }

  // Update active border on all thumbs
  document.querySelectorAll('.gallery-thumbs .gthumb').forEach(t => {
    const active = clickedThumb ? t === clickedThumb : (t.dataset.src === src);
    t.style.borderColor = active ? '#B76E79' : 'rgba(183,110,121,0.3)';
    t.classList.toggle('thumb-active', active);
  });
}

function openLightbox(src) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(47,42,44,0.95);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    lb.innerHTML = '<img id="lightbox-img" style="max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,0.6);"/>';
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
function openLightboxAdmin(src) {
  const lb  = document.getElementById('admin-lightbox');
  const img = document.getElementById('admin-lightbox-img');
  if (!lb || !img) { openLightbox(src); return; }
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
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.product-card, .set-card, .cat-card').forEach((el, i) => {
    el.style.cssText += `opacity:0;transform:translateY(28px);transition:opacity 0.5s ease ${i*0.06}s,transform 0.5s ease ${i*0.06}s,border-color 0.3s,box-shadow 0.3s;`;
    observer.observe(el);
  });
}

function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#B76E79','#F3C6CF','#8B4A53','#F0A0AD','#EAA8B4'];
  for (let i = 0; i < 32; i++) {
    const p = document.createElement('div');
    p.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${Math.random()*3+1}px;height:${Math.random()*3+1}px;background:${colors[i%colors.length]};animation:floatUp ${Math.random()*8+6}s ${Math.random()*6}s infinite ease-in-out;opacity:0;`;
    container.appendChild(p);
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes floatUp{0%{opacity:0;transform:translateY(0) scale(1)}20%{opacity:0.8}80%{opacity:0.4}100%{opacity:0;transform:translateY(-80px) scale(0.6)}}';
  document.head.appendChild(style);
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
  });
}

function initImageFallbacks() {
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
      if (!this.dataset.errored) {
        this.dataset.errored = '1';
        this.src = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23F7F1EC"/><text x="200" y="210" text-anchor="middle" fill="%23B76E79" font-family="serif" font-size="18" letter-spacing="4">SALFORD</text></svg>';
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
    background:${isSuccess?'linear-gradient(135deg,#7a3d45,#B76E79)':'linear-gradient(135deg,#4a1a1a,#8e2d2d)'};
    box-shadow:0 8px 32px rgba(0,0,0,0.25);
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
//  MULTI-IMAGE + VIDEO UPLOAD  (up to 5 media items)
// ═══════════════════════════════════════════════════════════════

// Stores array of { type:'image'|'video', data: base64|url, name: string }
let _mediaSlots = [];   // max 5
const MAX_SLOTS  = 5;
const MAX_IMG_MB = 10;
const MAX_VID_MB = 50; // video stored as URL only — base64 videos not supported in D1

/**
 * Compress an image File using Canvas → JPEG, targeting ≤ 200 KB.
 * Returns a base64 data URL string.
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Scale down so longest side ≤ 1200px
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const MAX_DIM = 1200;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w >= h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Iteratively lower quality until size ≤ 200 KB
      let quality = 0.82;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 200 * 1024 * (4/3) && quality > 0.3) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/**
 * Rebuild the visual media strip from _mediaSlots.
 * Called after every add / remove operation.
 */
function renderMediaStrip() {
  const strip = document.getElementById('media-strip');
  const count = document.getElementById('media-count');
  if (!strip) return;

  strip.innerHTML = '';

  _mediaSlots.forEach((slot, idx) => {
    const item = document.createElement('div');
    item.className = 'media-slot';
    item.style.cssText = `
      position:relative;width:90px;height:90px;border-radius:10px;overflow:hidden;
      border:2px solid rgba(183,110,121,0.35);background:#1a1215;flex-shrink:0;
      cursor:pointer;transition:border-color 0.2s;
    `;
    item.title = slot.name || '';

    if (slot.type === 'video') {
      item.innerHTML = `
        <video src="${slot.data}" style="width:100%;height:100%;object-fit:cover;" muted playsinline preload="metadata"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);">
          <i class="fa fa-play-circle" style="font-size:1.8rem;color:#fff;"></i>
        </div>
      `;
    } else {
      item.innerHTML = `<img src="${slot.data}" style="width:100%;height:100%;object-fit:cover;" />`;
    }

    // Remove button
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.style.cssText = `
      position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;
      background:rgba(231,76,60,0.85);color:#fff;border:none;cursor:pointer;
      font-size:0.65rem;display:flex;align-items:center;justify-content:center;
      z-index:2;line-height:1;
    `;
    rm.innerHTML = '<i class="fa fa-times"></i>';
    rm.onclick = (e) => { e.stopPropagation(); removeMediaSlot(idx); };
    item.appendChild(rm);

    // Primary badge on first item
    if (idx === 0) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        position:absolute;bottom:3px;left:3px;background:rgba(183,110,121,0.9);
        color:#fff;font-size:0.55rem;font-weight:700;padding:2px 5px;
        border-radius:4px;letter-spacing:0.04em;text-transform:uppercase;
      `;
      badge.textContent = 'MAIN';
      item.appendChild(badge);
    }

    strip.appendChild(item);
  });

  // Add more slot (if under max)
  if (_mediaSlots.length < MAX_SLOTS) {
    const addBtn = document.createElement('div');
    addBtn.style.cssText = `
      width:90px;height:90px;border-radius:10px;flex-shrink:0;
      border:2px dashed rgba(183,110,121,0.35);background:rgba(183,110,121,0.04);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      cursor:pointer;transition:border-color 0.2s,background 0.2s;
      color:#B76E79;font-size:0.7rem;font-weight:600;gap:6px;
    `;
    addBtn.innerHTML = '<i class="fa fa-plus" style="font-size:1.2rem;"></i><span>Add</span>';
    addBtn.onmouseenter = () => { addBtn.style.borderColor='#B76E79'; addBtn.style.background='rgba(183,110,121,0.08)'; };
    addBtn.onmouseleave = () => { addBtn.style.borderColor='rgba(183,110,121,0.35)'; addBtn.style.background='rgba(183,110,121,0.04)'; };
    addBtn.onclick = () => document.getElementById('pf-media-file').click();
    strip.appendChild(addBtn);
  }

  // Update count badge
  if (count) count.textContent = `${_mediaSlots.length} / ${MAX_SLOTS}`;

  // Sync hidden fields
  syncMediaToFields();
}

function removeMediaSlot(idx) {
  _mediaSlots.splice(idx, 1);
  renderMediaStrip();
}

/**
 * Sync _mediaSlots → hidden pf-image (primary) and pf-images-json (all)
 */
function syncMediaToFields() {
  const primary = _mediaSlots[0] ? _mediaSlots[0].data : '';
  setField('pf-image', primary);

  const allData = _mediaSlots.map(s => ({ type: s.type, data: s.data }));
  setField('pf-images-json', JSON.stringify(allData));
}

/**
 * Upload a video file to the server via /api/upload (multipart).
 * Shows a progress bar while uploading.
 * Returns the served URL string on success, or null on failure.
 */
async function uploadVideoToServer(file) {
  // Show upload progress UI
  const progWrap = document.getElementById('vid-upload-progress');
  const progBar  = document.getElementById('vid-upload-bar');
  const progTxt  = document.getElementById('vid-upload-status');
  if (progWrap) progWrap.style.display = 'block';
  if (progBar)  progBar.style.width = '0%';
  if (progTxt)  progTxt.textContent  = 'Uploading…';

  return new Promise((resolve) => {
    const xhr  = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      if (progBar) progBar.style.width = pct + '%';
      if (progTxt) progTxt.textContent  = `Uploading… ${pct}%`;
    };

    xhr.onload = () => {
      if (progWrap) progWrap.style.display = 'none';
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.ok && res.url) { resolve(res.url); return; }
        } catch {}
        resolve(null);
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
        showToast(msg, 'error');
        resolve(null);
      }
    };

    xhr.onerror = () => {
      if (progWrap) progWrap.style.display = 'none';
      showToast('Upload failed — network error', 'error');
      resolve(null);
    };

    xhr.open('POST', '/api/upload');
    xhr.send(form);
  });
}

/**
 * Handle file input change — supports images and videos.
 * Images  → compressed via Canvas, stored as base64 in D1.
 * Videos  → uploaded to /api/upload, stored as URL in D1.
 */
function handleMediaFiles(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const remaining = MAX_SLOTS - _mediaSlots.length;
  const toProcess = files.slice(0, remaining);

  if (files.length > remaining) {
    showToast(`Max ${MAX_SLOTS} media items — only first ${remaining} added`, 'error');
  }

  // Process files one by one (async-safe counter)
  let processed = 0;
  function oneDone() {
    processed++;
    if (processed === toProcess.length) {
      renderMediaStrip();
      showToast(`${toProcess.length} file(s) added`, 'success');
    }
  }

  toProcess.forEach(file => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      showToast(`Unsupported file: ${file.name}`, 'error');
      oneDone();
      return;
    }

    if (isVideo) {
      // Upload video to server → get back a permanent URL
      showToast(`Uploading video "${file.name}"…`, 'success');
      uploadVideoToServer(file).then(url => {
        if (url) {
          _mediaSlots.push({ type: 'video', data: url, name: file.name });
        } else {
          showToast(`Video upload failed for: ${file.name}`, 'error');
        }
        oneDone();
      });
      return;
    }

    // Images — compress via Canvas before storing as base64
    if (file.size > MAX_IMG_MB * 1024 * 1024) {
      showToast(`${file.name} too large — max ${MAX_IMG_MB} MB`, 'error');
      oneDone();
      return;
    }

    showToast('Compressing image…', 'success');
    compressImage(file)
      .then(dataUrl => {
        _mediaSlots.push({ type: 'image', data: dataUrl, name: file.name });
        oneDone();
      })
      .catch(() => {
        showToast(`Failed to compress: ${file.name}`, 'error');
        oneDone();
      });
  });

  // Reset input so same files can be re-selected
  input.value = '';
}

/**
 * Add a media item by URL (image or video).
 */
function handleMediaUrl(url) {
  const trimmed = (url || '').trim();
  const urlInput = document.getElementById('pf-media-url');

  if (!trimmed) return;
  if (_mediaSlots.length >= MAX_SLOTS) {
    showToast(`Max ${MAX_SLOTS} media items reached`, 'error');
    return;
  }

  // Detect if it's a video URL by extension
  const isVideo = /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(trimmed);
  _mediaSlots.push({ type: isVideo ? 'video' : 'image', data: trimmed, name: trimmed.split('/').pop() });
  renderMediaStrip();
  showToast('URL added to media', 'success');
  if (urlInput) urlInput.value = '';
}

function resetMediaSlots() {
  _mediaSlots = [];
  renderMediaStrip();
}

// Legacy compat shims (used by old onclick handlers)
function handleImageUpload(input) { handleMediaFiles(input); }
function handleImageUrl(url)       { handleMediaUrl(url); }
function resetImageUpload()        { resetMediaSlots(); }

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
  try {
    const res  = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userEl.value.trim(), password: passEl.value })
    });
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem('salford_admin', 'yes');
      window.location.href = '/admin/dashboard';
    } else {
      if (errEl) { errEl.style.display = 'flex'; errEl.textContent = 'Invalid username or password'; }
      passEl.value = ''; passEl.focus();
    }
  } catch(err) {
    if (errEl) { errEl.style.display = 'flex'; errEl.textContent = 'Connection error — please retry'; }
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
  // Close mobile sidebar if open
  const sidebar = document.getElementById('mobile-admin-sidebar');
  if (sidebar) sidebar.style.display = 'none';
}

// ─── Mobile admin sidebar toggle ─────────────────────────────
function toggleAdminSidebar() {
  let sidebar = document.getElementById('mobile-admin-sidebar');
  if (!sidebar) {
    // Clone the desktop sidebar content
    const desktopSidebar = document.querySelector('.admin-sidebar');
    if (!desktopSidebar) return;

    sidebar = document.createElement('div');
    sidebar.id = 'mobile-admin-sidebar';
    sidebar.style.cssText = `
      position:fixed;top:0;left:0;width:280px;height:100%;z-index:8000;
      background:#211619;border-right:1px solid rgba(183,110,121,0.20);
      overflow-y:auto;-webkit-overflow-scrolling:touch;
      box-shadow:4px 0 30px rgba(0,0,0,0.5);
      transition:transform 0.28s ease;
    `;
    sidebar.innerHTML = desktopSidebar.innerHTML;
    document.body.appendChild(sidebar);

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'admin-sidebar-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:7999;background:rgba(0,0,0,0.5);';
    backdrop.onclick = () => { sidebar.style.display='none'; backdrop.style.display='none'; };
    document.body.appendChild(backdrop);
  }

  const backdrop = document.getElementById('admin-sidebar-backdrop');
  const isVisible = sidebar.style.display === 'flex' || sidebar.style.display === 'block';
  sidebar.style.display   = isVisible ? 'none' : 'block';
  if (backdrop) backdrop.style.display = isVisible ? 'none' : 'block';
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN FILENAME PARSER
// ═══════════════════════════════════════════════════════════════

async function parseFilenameAdmin() {
  const inp = document.getElementById('parse-input');
  const res = document.getElementById('parse-result');
  if (!inp) return;
  const filename = inp.value.trim();
  if (!filename) { showToast('Enter a filename first', 'error'); return; }
  try {
    const r = await fetch('/api/parse-filename', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!r.ok) { showToast('Invalid filename format. Example: 5642976(550)', 'error'); return; }
    const data = await r.json();
    const codeF  = document.getElementById('pf-code');
    const priceF = document.getElementById('pf-price');
    const isSetF = document.getElementById('pf-isset');
    const catF   = document.getElementById('pf-cat');
    if (codeF)  codeF.value   = data.codes.join('+');
    if (priceF) priceF.value  = data.price;
    if (isSetF) isSetF.checked = data.isSet;
    if (catF && data.isSet) catF.value = 'sets';
    if (res) {
      res.style.display = 'block';
      res.innerHTML = `<strong><i class="fa fa-check" style="color:#27ae60"></i> Parsed!</strong><br/>Code(s): <code>${data.codes.join(' + ')}</code><br/>Price: <strong>${data.price} LYD</strong>${data.isSet?'<br/><em>Detected as a SET</em>':''}`;
    }
    showToast(`Code: ${data.codes.join('+')} · Price: ${data.price} LYD`, 'success');
  } catch(err) { showToast('Parse failed: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN PRODUCT MODAL  — FIXED Edit + Multi-media
// ═══════════════════════════════════════════════════════════════

function openAddModal(isSet = false) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const title = document.getElementById('modal-title');
  const form  = document.getElementById('product-form');
  if (title) title.textContent = isSet ? 'Add New Set' : 'Add New Product';
  if (form)  form.reset();

  setField('pf-id',      '');
  setField('pf-image',   '');
  setField('pf-images-json', '[]');
  setCheck('pf-instock',  true);
  setCheck('pf-featured', false);
  setCheck('pf-isset',    isSet);

  // Reset media slots
  _mediaSlots = [];
  renderMediaStrip();

  if (isSet) {
    const catF = document.getElementById('pf-cat');
    if (catF) catF.value = 'sets';
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // Scroll modal to top on reopen
  const box = modal.querySelector('.modal-box');
  if (box) box.scrollTop = 0;
}

/**
 * openEditModal — FIXED: properly loads ALL existing images/videos
 * Works for both newly added products and existing ones.
 */
function openEditModal(product) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const title = document.getElementById('modal-title');
  if (title) title.textContent = product.isSet ? 'Edit Set' : 'Edit Product';

  // ── Text fields ──
  setField('pf-id',         product.id           || '');
  setField('pf-code',       product.code         || '');
  setField('pf-price',      product.price > 0 ? product.price : '');
  setField('pf-orig-price', product.originalPrice || '');
  setField('pf-name',       product.name         || '');
  setField('pf-short-desc', product.shortDesc    || '');
  setField('pf-desc',       product.description  || '');
  setCheck('pf-instock',    !!product.inStock);
  setCheck('pf-featured',   !!product.featured);
  setCheck('pf-isset',      !!product.isSet);

  const catF = document.getElementById('pf-cat');
  if (catF) catF.value = product.category || 'necklaces';

  // ── Restore media slots from product data ──
  _mediaSlots = [];

  // Support both new format (mediaItems array) and old format (images array)
  const mediaItems = product.mediaItems || [];
  const imagesList = product.images     || [];
  const primaryImg = product.image      || '';

  if (mediaItems.length > 0) {
    // New multi-media format
    mediaItems.forEach(m => {
      if (m && m.data) {
        _mediaSlots.push({ type: m.type || 'image', data: m.data, name: m.name || '' });
      }
    });
  } else if (imagesList.length > 0) {
    // Old images[] format — treat all as images
    imagesList.forEach((img, i) => {
      if (img) _mediaSlots.push({ type: 'image', data: img, name: `image-${i+1}` });
    });
  } else if (primaryImg) {
    // Fallback: just the single image
    _mediaSlots.push({ type: 'image', data: primaryImg, name: 'image-1' });
  }

  renderMediaStrip();

  // Clear file input
  const fileInput = document.getElementById('pf-media-file');
  if (fileInput) fileInput.value = '';

  const urlInput = document.getElementById('pf-media-url');
  if (urlInput) urlInput.value = '';

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // Scroll to top
  const box = modal.querySelector('.modal-box');
  if (box) box.scrollTop = 0;
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

async function saveProduct(e) {
  e.preventDefault();

  const id      = getField('pf-id');
  const codeRaw = getField('pf-code').trim();
  const price   = parseInt(getField('pf-price'))      || 0;
  const origP   = parseInt(getField('pf-orig-price')) || null;
  const isSet   = getChecked('pf-isset') || codeRaw.includes('+');
  const codes   = codeRaw.split('+').map(c => c.trim()).filter(Boolean);
  const category = isSet ? 'sets' : (getField('pf-cat') || 'necklaces');

  if (!codeRaw) { showToast('Product code is required', 'error'); return; }
  if (_mediaSlots.length === 0) {
    showToast('Please add at least one image or video', 'error');
    return;
  }

  const primaryMedia = _mediaSlots[0];
  const allImages    = _mediaSlots.filter(s => s.type === 'image').map(s => s.data);
  const mediaItems   = _mediaSlots.map(s => ({ type: s.type, data: s.data, name: s.name || '' }));

  // `image` = first image if available, otherwise empty string
  // The product page now reads mediaItems directly, so video-only products still render
  const primaryImageField = allImages[0] || '';

  const payload = {
    code:          codes.join('+'),
    setCodes:      isSet ? codes : null,
    isSet,
    name:          getField('pf-name').trim(),
    shortDesc:     getField('pf-short-desc').trim(),
    description:   getField('pf-desc').trim(),
    category,
    price,
    originalPrice: origP,
    image:         primaryImageField,
    images:        allImages,
    mediaItems,
    inStock:       getChecked('pf-instock'),
    featured:      getChecked('pf-featured'),
  };

  const saveBtn = document.getElementById('save-product-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...'; }

  try {
    const url    = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
//  ADMIN SETTINGS
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
    heroMediaUrl:   document.getElementById('hero-media-url-field')?.value  || '',
    heroMediaType:  document.getElementById('hero-media-type-field')?.value || 'image',
  };
  const newPass = form.adminPass?.value;
  if (newPass) data.adminPass = newPass;
  const btn = form.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...'; }
  try {
    const r = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (r.ok) { _settings = null; showToast('Settings saved! Reload the homepage to see the new background.', 'success'); }
    else showToast('Failed to save settings', 'error');
  } catch(err) { showToast('Network error: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save All Settings'; } }
}

// ── Hero Media upload & preview ──────────────────────────────
function handleHeroMediaUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const maxMB = 8;
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`File too large. Max ${maxMB} MB allowed.`, 'error');
    return;
  }

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    showToast('Unsupported file type. Use JPG, PNG, WEBP or MP4.', 'error');
    return;
  }

  // Show progress bar
  const prog = document.getElementById('hero-upload-progress');
  const bar  = document.getElementById('hero-upload-bar');
  const stat = document.getElementById('hero-upload-status');
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '0%';
  if (stat) stat.textContent = 'Reading file...';

  const reader = new FileReader();

  // Animate progress bar while reading
  let pct = 0;
  const tick = setInterval(() => {
    pct = Math.min(pct + 3, 85);
    if (bar) bar.style.width = pct + '%';
  }, 60);

  reader.onload = function(e) {
    clearInterval(tick);
    if (bar)  bar.style.width = '100%';
    if (stat) stat.textContent = 'Done!';

    const dataUrl = e.target.result;
    const mediaType = isVideo ? 'video' : 'image';

    // Write into hidden fields
    const urlField  = document.getElementById('hero-media-url-field');
    const typeField = document.getElementById('hero-media-type-field');
    if (urlField)  urlField.value  = dataUrl;
    if (typeField) typeField.value = mediaType;

    // Update URL input box too
    const urlInput = document.getElementById('hero-url-input');
    if (urlInput) urlInput.value = dataUrl;

    // Update preview
    _renderHeroPreview(dataUrl, mediaType);

    setTimeout(() => { if (prog) prog.style.display = 'none'; }, 1200);
    showToast('Media ready — click "Save All Settings" to apply.', 'success');
  };

  reader.onerror = function() {
    clearInterval(tick);
    if (prog) prog.style.display = 'none';
    showToast('Failed to read file.', 'error');
  };

  reader.readAsDataURL(file);
}

function previewHeroUrl(url) {
  // live-update URL input without applying yet
  const typeField = document.getElementById('hero-media-type-field');
  const mediaType = (url.match(/\.(mp4|webm|mov)(\?|$)/i)) ? 'video' : 'image';
  if (typeField) typeField.value = mediaType;
}

function applyHeroUrl() {
  const url = (document.getElementById('hero-url-input')?.value || '').trim();
  if (!url) return;
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const mediaType = isVideo ? 'video' : 'image';

  const urlField  = document.getElementById('hero-media-url-field');
  const typeField = document.getElementById('hero-media-type-field');
  if (urlField)  urlField.value  = url;
  if (typeField) typeField.value = mediaType;

  _renderHeroPreview(url, mediaType);
  showToast('URL applied — click "Save All Settings" to save.', 'success');
}

function _renderHeroPreview(src, mediaType) {
  const wrap  = document.getElementById('hero-media-preview');
  const badge = document.getElementById('hero-media-type-badge');
  if (!wrap) return;

  // Remove existing media child (img or video), keep badge
  const existing = wrap.querySelector('img, video');
  if (existing) existing.remove();

  let el;
  if (mediaType === 'video') {
    el = document.createElement('video');
    el.src = src;
    el.muted = true;
    el.loop  = true;
    el.autoplay = true;
    el.playsInline = true;
    el.style.cssText = 'width:100%;max-height:280px;object-fit:cover;display:block;pointer-events:none;';
    el.play().catch(()=>{});
  } else {
    el = document.createElement('img');
    el.src = src;
    el.alt = 'Hero background preview';
    el.style.cssText = 'width:100%;max-height:280px;object-fit:cover;display:block;';
  }

  wrap.insertBefore(el, wrap.firstChild);
  if (badge) badge.textContent = mediaType === 'video' ? '▶ VIDEO' : '🖼 IMAGE';
}

// ── Stock / Featured quick toggles ───────────────────────────
async function toggleStock(id, current) {
  try {
    const r = await fetch(`/api/products/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inStock: !current })
    });
    if (r.ok) location.reload();
    else showToast('Update failed', 'error');
  } catch(e) { showToast('Update failed', 'error'); }
}
async function toggleFeatured(id, current) {
  try {
    const r = await fetch(`/api/products/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !current })
    });
    if (r.ok) location.reload();
    else showToast('Update failed', 'error');
  } catch(e) { showToast('Update failed', 'error'); }
}
async function toggleFeaturedCard(id, current) {
  const btn = document.querySelector(`[data-feat-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  try {
    const r = await fetch(`/api/products/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !current })
    });
    if (r.ok) { showToast(!current ? 'Marked as Featured ★' : 'Removed from Featured', 'success'); setTimeout(() => location.reload(), 700); }
    else { showToast('Update failed', 'error'); if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }
  } catch(e) { showToast('Network error', 'error'); if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }
}

// ── Table filter ──────────────────────────────────────────────
function filterAdminTable(q, tableId = 'products-table') {
  const query = q.toLowerCase().trim();
  const table = document.getElementById(tableId);
  if (!table) {
    document.querySelectorAll('.admin-table tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
    return;
  }
  table.querySelectorAll('tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
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
    closeBuyModal(); closeProductModal(); closeDeleteModal();
    closeLightbox(); closeAdminLightbox();
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

  // Initialize media strip if modal exists on page
  if (document.getElementById('media-strip')) {
    _mediaSlots = [];
    renderMediaStrip();
  }

  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', executeDelete);

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', doLogin);

  const adminLb = document.getElementById('admin-lightbox');
  if (adminLb) adminLb.addEventListener('click', e => { if (e.target === adminLb) closeAdminLightbox(); });

  if (lang) localStorage.setItem('salford_lang', lang);
});

// ═══════════════════════════════════════════════════════════════
//  GLOBAL EXPORTS
// ═══════════════════════════════════════════════════════════════

window.openBuy              = openBuy;
window.closeBuyModal        = closeBuyModal;
window.trackBuy             = trackBuy;
window.switchImg            = switchImg;
window.switchMedia          = switchMedia;
window.openLightbox         = openLightbox;
window.closeLightbox        = closeLightbox;
window.toggleSearch         = toggleSearch;
window.toggleMenu           = toggleMenu;
window.closeMenu            = closeMenu;
window.toggleAdminSidebar   = toggleAdminSidebar;
window.doLogin              = doLogin;
window.adminLogout          = adminLogout;
window.showTab              = showTab;
window.openAddModal         = openAddModal;
window.openEditModal        = openEditModal;
window.closeProductModal    = closeProductModal;
window.saveProduct          = saveProduct;
window.handleImageUpload    = handleImageUpload;
window.handleImageUrl       = handleImageUrl;
window.resetImageUpload     = resetImageUpload;
window.handleMediaFiles     = handleMediaFiles;
window.handleMediaUrl       = handleMediaUrl;
window.resetMediaSlots      = resetMediaSlots;
window.removeMediaSlot      = removeMediaSlot;
window.openLightboxAdmin    = openLightboxAdmin;
window.closeAdminLightbox   = closeAdminLightbox;
window.confirmDelete        = confirmDelete;
window.closeDeleteModal     = closeDeleteModal;
window.executeDelete        = executeDelete;
window.parseFilenameAdmin   = parseFilenameAdmin;
window.saveSettings         = saveSettings;
window.handleHeroMediaUpload = handleHeroMediaUpload;
window.previewHeroUrl       = previewHeroUrl;
window.applyHeroUrl         = applyHeroUrl;
window.filterAdminTable     = filterAdminTable;
window.toggleStock          = toggleStock;
window.toggleFeatured       = toggleFeatured;
window.toggleFeaturedCard   = toggleFeaturedCard;
