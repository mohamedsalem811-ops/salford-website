/* Salford Libya — storefront interactions. Works without a framework; pages render fine before this loads. */
(function () {
  'use strict';
  var lang = document.body.getAttribute('data-lang') === 'en' ? 'en' : 'ar';
  var T = {
    ar: { added: 'تمت الإضافة للسلة', remove: 'حذف', items: 'المنتجات', delivery: 'التوصيل', byCity: 'حسب المدينة', total: 'المجموع',
      cont: 'كمّل طلبيتك', empty: 'سلتك فاضية. شوف الجديد وابدأ التسوق.', shop: 'تسوّق الآن', note: 'نؤكد معك السعر والتوفر قبل إرسال الطلبية.',
      cur: 'د.ل', out: 'غير متوفر حالياً', errName: 'اكتب اسمك', errPhone: 'اكتب رقم هاتف ليبي صحيح، مثل 0912345678', errCity: 'اكتب مدينتك',
      err: 'صار خطأ، حاول مرة ثانية', tooMany: 'أرسلت طلبيات كثيرة. حاول بعد ساعة أو راسلنا مباشرة.', unavailable: 'المنتجات في سلتك لم تعد متوفرة.',
      sending: 'لحظة…', copied: 'تم نسخ الرسالة، الصقها في المحادثة', copyFail: 'انسخ الرسالة من المربع بالأسفل',
      hintWa: 'أرسل الرسالة في واتساب لتصلنا الطلبية. إذا لم تُفتح المحادثة، استخدم الزر بالأسفل.',
      hintMs: 'أرسل الرسالة في ماسنجر لتصلنا الطلبية. إذا لم تُفتح المحادثة، استخدم الزر بالأسفل.',
      hintIg: 'اضغط الزر: ننسخ الرسالة ونفتح إنستغرام، ثم الصقها وأرسلها.',
      openWa: 'افتح واتساب مرة أخرى', openMs: 'افتح ماسنجر مرة أخرى', sendWa: 'أرسل الطلبية عبر واتساب', sendMs: 'أرسل الطلبية عبر ماسنجر',
      firstWa: 'خطوة أخيرة: اضغط الزر لفتح واتساب، ثم اضغط إرسال لتصلنا طلبيتك.', firstMs: 'خطوة أخيرة: اضغط الزر لفتح ماسنجر، ثم اضغط إرسال لتصلنا طلبيتك.', openIg: 'انسخ الرسالة وافتح إنستغرام', copy: 'انسخ الرسالة', missing: 'تفاصيل الطلبية غير متوفرة على هذا الجهاز.' },
    en: { added: 'Added to cart', remove: 'Remove', items: 'Items', delivery: 'Delivery', byCity: 'Depends on city', total: 'Total',
      cont: 'Continue', empty: 'Your cart is empty. Have a look at what’s new.', shop: 'Shop now', note: 'We confirm price and availability with you before sending.',
      cur: 'LYD', out: 'Out of stock', errName: 'Enter your name', errPhone: 'Enter a valid Libyan phone number, e.g. 0912345678', errCity: 'Enter your city',
      err: 'Something went wrong, please try again', tooMany: 'Too many orders. Try again in an hour or message us directly.', unavailable: 'The items in your cart are no longer available.',
      sending: 'One moment…', copied: 'Message copied. Paste it in the chat', copyFail: 'Copy the message from the box below',
      hintWa: 'Send the message in WhatsApp so your order reaches us. If the chat didn’t open, use the button below.',
      hintMs: 'Send the message in Messenger so your order reaches us. If the chat didn’t open, use the button below.',
      hintIg: 'Tap the button: we copy the message and open Instagram. Then paste and send.',
      openWa: 'Open WhatsApp again', openMs: 'Open Messenger again', sendWa: 'Send order on WhatsApp', sendMs: 'Send order on Messenger',
      firstWa: 'Last step: tap the button to open WhatsApp, then tap send so your order reaches us.', firstMs: 'Last step: tap the button to open Messenger, then tap send so your order reaches us.', openIg: 'Copy message and open Instagram', copy: 'Copy message', missing: 'Order details aren’t available on this device.' }
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
      add.classList.remove('prism'); void add.offsetWidth; add.classList.add('prism');
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
  var form = $('[data-checkout]');
  if (form) {
    var c0 = cart();
    if (!c0.length) location.replace('/' + lang + '/cart');
    fetchItems(c0).then(function (items) {
      var total = 0;
      items.forEach(function (it) { var i = c0.find(function (x) { return x.id === it.id; }); if (i && it.inStock) total += it.price * i.qty; });
      $('#co-summary').innerHTML = '<div class="tot"><span>' + T.total + ' (' + c0.reduce(function (s, i) { return s + i.qty; }, 0) + ')</span><span>' + money(total) + ' ' + T.cur + '</span></div>';
    });
    var saved = store('sl_customer') || {};
    ['name', 'phone', 'city', 'address'].forEach(function (k) { if (saved[k] && form.elements[k]) form.elements[k].value = saved[k]; });
    var submitter = null;
    form.addEventListener('click', function (e) { var b = e.target.closest('button[name="channel"]'); if (b) submitter = b; });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('.form-err', form), f = form.elements, bad = null;
      $$('input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
      var phone = f.phone.value.replace(/[^\d+]/g, '').replace(/^(\+|00)?218/, '0');
      if (/^9\d{8}$/.test(phone)) phone = '0' + phone;
      if (!f.name.value.trim()) bad = ['name', T.errName];
      else if (!/^0\d{9}$/.test(phone)) bad = ['phone', T.errPhone];
      else if (!f.city.value.trim()) bad = ['city', T.errCity];
      if (bad) { err.textContent = bad[1]; err.hidden = false; f[bad[0]].setAttribute('aria-invalid', 'true'); f[bad[0]].focus(); return; }
      err.hidden = true;
      var channel = (e.submitter || submitter || {}).value || 'whatsapp';
      var pay = form.querySelector('input[name="payment"]:checked');
      var body = { lang: lang, name: f.name.value, phone: phone, city: f.city.value, address: f.address.value, note: f.note.value, payment: pay ? pay.value : '', channel: channel, items: cart() };
      store('sl_customer', { name: body.name, phone: body.phone, city: body.city, address: body.address });
      var btns = $$('button[name="channel"]', form); btns.forEach(function (b) { b.disabled = true; });
      fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
        .then(function (res) {
          btns.forEach(function (b) { b.disabled = false; });
          if (!res.ok) { err.textContent = res.status === 429 ? T.tooMany : res.status === 409 ? T.unavailable : T.err; err.hidden = false; return; }
          var d = res.d;
          var phoneLike = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          d.opened = channel !== 'instagram' && phoneLike;
          sstore('sl_order_' + d.number, d);
          saveCart([]);
          history.replaceState(null, '', '/' + lang + '/order/' + d.number);
          // Phones: open the chat app straight away; coming back lands on the confirmation page.
          // Computers and Instagram: show the confirmation page with a button (Instagram needs a tap to copy).
          if (channel !== 'instagram' && phoneLike) location.href = d.links[channel];
          else location.href = '/' + lang + '/order/' + d.number;
        })
        .catch(function () { btns.forEach(function (b) { b.disabled = false; }); err.textContent = T.err; err.hidden = false; });
    });
  }

  /* ---------- order confirmation ---------- */
  var orderEl = $('[data-order-page]');
  if (orderEl) {
    var d = sstore('sl_order_' + orderEl.getAttribute('data-order-page'));
    var hint = $('[data-order-hint]', orderEl), acts = $('[data-order-actions]', orderEl);
    if (!d) { hint.textContent = T.missing; }
    else {
      var ch = d.channel;
      var ms = ch === 'messenger';
      hint.textContent = ch === 'instagram' ? T.hintIg : d.opened ? (ms ? T.hintMs : T.hintWa) : (ms ? T.firstMs : T.firstWa);
      var label = ch === 'instagram' ? T.openIg : d.opened ? (ms ? T.openMs : T.openWa) : (ms ? T.sendMs : T.sendWa);
      acts.innerHTML = '<a class="send ' + ch + '" href="' + esc(d.links[ch]) + '" target="_blank" rel="noopener" data-open>' + esc(label) + '</a>' +
        '<button class="btn ghost wide" type="button" data-copy>' + esc(T.copy) + '</button><textarea class="vh" readonly aria-hidden="true" data-msg></textarea>';
      $('[data-msg]', acts).value = d.message;
      var copy = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(d.message).then(function () { toast(T.copied); return true; }, fallback);
        return Promise.resolve(fallback());
      };
      var fallback = function () { var ta = $('[data-msg]', acts); ta.classList.remove('vh'); ta.removeAttribute('aria-hidden'); ta.style.width = '100%'; ta.rows = 7; ta.select(); try { document.execCommand('copy'); toast(T.copied); return true; } catch (e) { toast(T.copyFail); return false; } };
      $('[data-copy]', acts).addEventListener('click', copy);
      if (ch === 'instagram') $('[data-open]', acts).addEventListener('click', function () { copy(); });
    }
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
