/* Salford Libya — storefront interactions. Works without a framework; pages render fine before this loads. */
(function () {
  'use strict';
  var lang = document.body.getAttribute('data-lang') === 'en' ? 'en' : 'ar';
  var T = {
    ar: { added: 'تمت الإضافة للسلة', remove: 'حذف', items: 'المنتجات', delivery: 'التوصيل', byCity: 'حسب المدينة', total: 'المجموع',
      cont: 'كمّل طلبيتك', empty: 'سلتك فاضية. شوف الجديد وابدأ التسوق.', shop: 'تسوّق الآن', note: 'نؤكد معك السعر والتوفر قبل إرسال الطلبية.',
      cur: 'د.ل', out: 'غير متوفر حالياً', errName: 'اكتب اسمك', errPhone: 'اكتب رقم هاتف ليبي صحيح، مثل 0912345678', errCity: 'اكتب مدينتك',
      err: 'صار خطأ، حاول مرة ثانية', tooMany: 'أرسلت طلبيات كثيرة. حاول بعد ساعة أو راسلنا مباشرة.', unavailable: 'المنتجات في سلتك لم تعد متوفرة.',
      copied: 'تم نسخ الرسالة، الصقها في المحادثة', copyFail: 'انسخ الرسالة من المربع بالأسفل' },
    en: { added: 'Added to cart', remove: 'Remove', items: 'Items', delivery: 'Delivery', byCity: 'Depends on city', total: 'Total',
      cont: 'Continue', empty: 'Your cart is empty. Have a look at what’s new.', shop: 'Shop now', note: 'We confirm price and availability with you before sending.',
      cur: 'LYD', out: 'Out of stock', errName: 'Enter your name', errPhone: 'Enter a valid Libyan phone number, e.g. 0912345678', errCity: 'Enter your city',
      err: 'Something went wrong, please try again', tooMany: 'Too many orders. Try again in an hour or message us directly.', unavailable: 'The items in your cart are no longer available.',
      copied: 'Message copied. Paste it in the chat', copyFail: 'Copy the message from the box below' }
  }[lang];

  /* ---------- small helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(d) { var v = d / 1000; return v.toLocaleString('en-US', { maximumFractionDigits: v % 1 ? 3 : 0 }); }
  var toastTimer;
  function toast(msg) {
    var el = $('.toast'); if (!el) return;
    el.textContent = msg; el.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  /* ---------- cart (kept on this phone only) ---------- */
  function cart() { var c = store('sl_cart'); return Array.isArray(c) ? c.filter(function (i) { return i && i.id > 0 && i.qty > 0; }) : []; }
  function saveCart(c) { store('sl_cart', c); badge(); }
  function badge() {
    var n = cart().reduce(function (s, i) { return s + i.qty; }, 0);
    $$('[data-cart-count]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }
  function addToCart(id) {
    var c = cart(), f = c.find(function (i) { return i.id === id; });
    if (f) f.qty = Math.min(f.qty + 1, 10); else c.push({ id: id, qty: 1 });
    saveCart(c);
  }
  badge();

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      addToCart(Number(add.getAttribute('data-add')));
      add.classList.toggle('prism', false); void add.offsetWidth; add.classList.toggle('prism', true);
      clearTimeout(add._pt); add._pt = setTimeout(function () { add.classList.toggle('prism', false); }, 1000);
      toast(T.added);
    }
  });

  /* ---------- cart page ---------- */
  var cartEl = $('[data-cart-page]');
  function fetchItems(c) {
    if (!c.length) return Promise.resolve([]);
    return fetch('/api/cart?lang=' + lang + '&ids=' + c.map(function (i) { return i.id; }).join(','))
      .then(function (r) { return r.json(); }).then(function (d) { return d.items || []; });
  }
  function renderCart() {
    var c = cart();
    if (!c.length) { cartEl.innerHTML = '<p class="empty">' + esc(T.empty) + '</p><a class="btn wide" href="/' + lang + '/">' + esc(T.shop) + '</a>'; return; }
    fetchItems(c).then(function (items) {
      var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
      var keep = c.filter(function (i) { return byId[i.id]; });
      if (keep.length !== c.length) saveCart(keep);
      if (!keep.length) { cartEl.innerHTML = '<p class="empty">' + esc(T.empty) + '</p>'; return; }
      var total = 0, html = '';
      keep.forEach(function (i) {
        var it = byId[i.id]; if (it.inStock) total += it.price * i.qty;
        html += '<div class="line"><a href="/' + lang + '/p/' + it.id + '"><img src="' + esc(it.image) + '" alt="" loading="lazy"></a><div><span class="bd">' + esc(it.brand) +
          '</span><div class="nm">' + esc(it.name) + '</div>' + (it.inStock
            ? '<span class="qty"><button type="button" data-q="' + it.id + ':-1" aria-label="−">−</button><span>' + i.qty + '</span><button type="button" data-q="' + it.id + ':1" aria-label="+">+</button></span>'
            : '<span class="soldout">' + esc(T.out) + '</span>') +
          ' <button class="linkbtn" type="button" data-rm="' + it.id + '">' + esc(T.remove) + '</button></div><span class="price">' + money(it.price * i.qty) + ' ' + T.cur + '</span></div>';
      });
      html += '<div class="sum"><div><span>' + T.items + '</span><span>' + money(total) + ' ' + T.cur + '</span></div><div><span>' + T.delivery + '</span><span class="muted">' + T.byCity +
        '</span></div><div class="tot"><span>' + T.total + '</span><span>' + money(total) + ' ' + T.cur + '</span></div></div><p class="muted">' + esc(T.note) + '</p>' +
        (total ? '<a class="btn wide" href="/' + lang + '/checkout">' + esc(T.cont) + '</a>' : '');
      cartEl.innerHTML = html;
    }).catch(function () { cartEl.innerHTML = '<p class="form-err">' + esc(T.err) + '</p>'; });
  }
  if (cartEl) {
    renderCart();
    cartEl.addEventListener('click', function (e) {
      var q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]'), c = cart();
      if (q) { var p = q.getAttribute('data-q').split(':'), it = c.find(function (i) { return i.id === Number(p[0]); }); if (it) { it.qty = Math.max(1, Math.min(10, it.qty + Number(p[1]))); saveCart(c); renderCart(); } }
      if (rm) { saveCart(c.filter(function (i) { return i.id !== Number(rm.getAttribute('data-rm')); })); renderCart(); }
    });
  }

  /* ---------- checkout ---------- */
  // ٠١٢… / ۰۱۲… (Arabic keyboards) → 012…, then the same rule the server uses
  function westernDigits(v) { return String(v || '').replace(/[٠-٩۰-۹]/g, function (ch) { return String(ch.charCodeAt(0) & 15); }); }
  function libyanPhone(v) {
    var p = westernDigits(v).replace(/[^\d+]/g, '').replace(/^(\+|00)?218/, '0').replace(/^\+/, '');
    if (/^9\d{8}$/.test(p)) p = '0' + p;
    return /^0(9[1-6]|2\d|6\d|5\d|7\d)\d{7}$/.test(p) ? p : '';
  }
  var form = $('[data-checkout]');
  if (form) {
    var c0 = cart();
    if (!c0.length) location.replace('/' + lang + '/cart');
    fetchItems(c0).then(function (items) {
      var total = 0, n = 0, html = '';
      items.forEach(function (it) {
        var i = c0.find(function (x) { return x.id === it.id; });
        if (!i || !it.inStock) return;
        total += it.price * i.qty; n += i.qty;
        html += '<div><span><bdi>' + esc(it.brand) + ' · ' + esc(it.name) + '</bdi>' + (i.qty > 1 ? ' × ' + i.qty : '') + '</span><span>' + money(it.price * i.qty) + ' ' + T.cur + '</span></div>';
      });
      $('#co-summary').innerHTML = html + '<div class="tot"><span>' + T.total + ' (' + n + ')</span><span>' + money(total) + ' ' + T.cur + '</span></div>';
    });
    var saved = store('sl_customer') || {};
    ['name', 'phone', 'city', 'address'].forEach(function (k) { if (saved[k] && form.elements[k]) form.elements[k].value = saved[k]; });
    var submitter = null;
    form.addEventListener('click', function (e) { var b = e.target.closest('button[name="channel"]'); if (b) submitter = b; });
    var showErr = function (field, msg) {
      var err = $('.form-err', form);
      err.textContent = msg; err.hidden = false;
      if (field && form.elements[field]) { form.elements[field].setAttribute('aria-invalid', 'true'); form.elements[field].focus(); }
    };
    // fixing the field that was flagged clears the message straight away
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') !== 'true') return;
      e.target.removeAttribute('aria-invalid'); $('.form-err', form).hidden = true;
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements, bad = null;
      $$('input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
      var phone = libyanPhone(f.phone.value);
      if (!f.name.value.trim()) bad = ['name', T.errName];
      else if (!phone) bad = ['phone', T.errPhone];
      else if (!f.city.value.trim()) bad = ['city', T.errCity];
      if (bad) { showErr(bad[0], bad[1]); return; }
      $('.form-err', form).hidden = true;
      var channel = (e.submitter || submitter || {}).value || 'whatsapp';
      var pay = form.querySelector('input[name="payment"]:checked');
      var body = { lang: lang, name: f.name.value, phone: phone, city: f.city.value, address: f.address.value, note: f.note.value, payment: pay ? pay.value : '', channel: channel, items: cart(), website: f.website ? f.website.value : '' };
      store('sl_customer', { name: body.name, phone: body.phone, city: body.city, address: body.address });
      var btns = $$('button[name="channel"]', form); btns.forEach(function (b) { b.disabled = true; });
      fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
        .then(function (res) {
          btns.forEach(function (b) { b.disabled = false; });
          if (!res.ok) {
            var fields = (res.d && res.d.fields) || [], has = function (k) { return res.status === 422 && fields.indexOf(k) > -1; };
            if (has('name')) return showErr('name', T.errName);
            if (has('phone')) return showErr('phone', T.errPhone);
            if (has('city')) return showErr('city', T.errCity);
            return showErr(null, res.status === 429 ? T.tooMany : res.status === 409 || has('items') ? T.unavailable : T.err);
          }
          var d = res.d, url = '/' + lang + '/order/' + d.number + '?t=' + d.token;
          var phoneLike = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          var autoOpen = channel === 'whatsapp' && phoneLike && d.links && d.links.whatsapp;
          if (autoOpen) sstore('sl_opened_' + d.number, true);
          saveCart([]);
          history.replaceState(null, '', url);
          // Phones + WhatsApp: open the chat straight away (the message is filled in); coming back lands on the order page.
          // Messenger and Instagram may not fill the message in, so the order page copies it on the tap that opens them.
          location.href = autoOpen ? d.links.whatsapp : url;
        })
        .catch(function () { btns.forEach(function (b) { b.disabled = false; }); showErr(null, T.err); });
    });
  }

  /* ---------- order page (rendered by the server; this only wires the buttons) ---------- */
  var orderEl = $('[data-order-page]');
  if (orderEl) {
    var num = orderEl.getAttribute('data-order-page');
    var openA = $('[data-open]', orderEl), hint = $('[data-order-hint]', orderEl), msgEl = $('[data-msg]', orderEl);
    if (sstore('sl_opened_' + num)) {
      if (hint && hint.getAttribute('data-opened-hint')) hint.textContent = hint.getAttribute('data-opened-hint');
      if (openA && openA.getAttribute('data-opened-label')) $('span', openA).textContent = openA.getAttribute('data-opened-label');
    }
    var fallback = function () {
      msgEl.classList.remove('vh'); msgEl.removeAttribute('aria-hidden'); msgEl.style.width = '100%'; msgEl.rows = 8; msgEl.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
      toast(ok ? T.copied : T.copyFail);
    };
    var copy = function () {
      if (!msgEl) return;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msgEl.value).then(function () { toast(T.copied); }, fallback);
      else fallback();
    };
    var cb = $('[data-copy]', orderEl);
    if (cb) cb.addEventListener('click', copy);
    if (openA && orderEl.hasAttribute('data-copy-first')) openA.addEventListener('click', copy);
  }

  /* ---------- product: small add-to-cart bar whenever the main button is off screen (not over the footer) ---------- */
  var fbuy = $('[data-fbuy]'), buybar = $('[data-buybar]'), foot = $('.foot');
  if (fbuy && buybar) {
    var fbBtn = fbuy.querySelector('button'), fbTick = false;
    var fbCheck = function () {
      fbTick = false;
      if (getComputedStyle(fbuy).display === 'none') return; // computers: the button sits next to the photos
      var vh = window.innerHeight, r = buybar.getBoundingClientRect();
      // "off screen" also means hidden under the tab bar and this bar (about 140px from the bottom)
      var off = r.bottom < 0 || r.top > vh - 140;
      var on = off && !(foot && foot.getBoundingClientRect().top < vh);
      if (on === fbuy.classList.contains('show')) return;
      fbuy.classList.toggle('show', on);
      fbuy.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (fbBtn) fbBtn.tabIndex = on ? 0 : -1;
    };
    var fbQueue = function () { if (!fbTick) { fbTick = true; window.requestAnimationFrame(fbCheck); } };
    window.addEventListener('scroll', fbQueue, { passive: true });
    window.addEventListener('resize', fbQueue);
    fbCheck();
  }

  /* ---------- hero brand line: no dot left hanging at the end of a line when it wraps ---------- */
  var sepLine = $('[data-seps]');
  if (sepLine) {
    var seps = function () {
      $$('.sep', sepLine).forEach(function (d) {
        d.classList.toggle('end', false);
        var n = d.nextElementSibling;
        if (n && n.offsetTop > d.offsetTop + 2) d.classList.toggle('end', true);
      });
    };
    seps(); window.addEventListener('resize', seps);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(seps);
  }

  /* ---------- listing sort ---------- */
  $$('select[data-nav]').forEach(function (s) { s.addEventListener('change', function () { location.href = s.value; }); });

  /* ---------- product gallery ---------- */
  var track = $('[data-gallery]');
  if (track) {
    var thumbs = $$('.g-thumb');
    var go = function (i) { var item = track.children[i]; if (item) track.scrollTo({ left: item.offsetLeft - track.offsetLeft, behavior: 'smooth' }); };
    thumbs.forEach(function (t) { t.addEventListener('click', function () { go(Number(t.getAttribute('data-goto'))); }); });
    var onScroll = function () {
      var i = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
      thumbs.forEach(function (t, k) { t.classList.toggle('on', k === i); });
    };
    track.addEventListener('scroll', function () { window.requestAnimationFrame(onScroll); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      var i = Math.round(Math.abs(track.scrollLeft) / track.clientWidth), dir = document.dir === 'rtl' ? -1 : 1;
      if (e.key === 'ArrowRight') go(i + dir); if (e.key === 'ArrowLeft') go(i - dir);
    });
    // videos play muted only while visible, and never on data saver
    var saver = navigator.connection && navigator.connection.saveData;
    if ('IntersectionObserver' in window && !saver) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { var v = en.target; if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }); }, { threshold: 0.6 });
      $$('video[data-autoplay]', track).forEach(function (v) { io.observe(v); });
    }
    track.addEventListener('click', function (e) {
      var yt = e.target.closest('[data-yt]');
      if (yt) {
        var f = document.createElement('iframe');
        f.className = 'yt-frame'; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = 'YouTube';
        f.src = 'https://www.youtube-nocookie.com/embed/' + yt.getAttribute('data-yt') + '?autoplay=1&playsinline=1&rel=0';
        yt.replaceWith(f); return;
      }
      var img = e.target.closest('img[data-zoom]');
      if (img) {
        var lb = document.createElement('div');
        lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
        lb.innerHTML = '<img alt=""><button type="button" aria-label="Close">×</button>';
        $('img', lb).src = img.getAttribute('data-zoom'); $('img', lb).alt = img.alt;
        var close = function () { lb.remove(); document.removeEventListener('keydown', onKey); img.focus && img.focus(); };
        var onKey = function (k) { if (k.key === 'Escape') close(); };
        lb.addEventListener('click', function (k) { if (k.target === lb || k.target.tagName === 'BUTTON') close(); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(lb); $('button', lb).focus();
      }
    });
  }

  /* ---------- broken photos: hide the broken icon, keep the soft background ---------- */
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('pimg')) t.classList.add('broken'); }, true);
})();
