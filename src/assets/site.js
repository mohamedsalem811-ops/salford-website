/* Salford Libya — storefront interactions. Works without a framework; pages render fine before this loads. */
(function () {
  'use strict';
  var lang = document.body.getAttribute('data-lang') === 'en' ? 'en' : 'ar';
  var T = {
    ar: { added: 'تمت الإضافة للسلة', remove: 'حذف', items: 'المنتجات', delivery: 'التوصيل', byCity: 'حسب المدينة', total: 'المجموع',
      cont: 'كمّل طلبيتك', empty: 'سلتك فاضية. شوف الجديد وابدأ التسوق.', shop: 'تسوّق الآن', note: 'نؤكد معك السعر والتوفر قبل إرسال الطلبية.',
      cur: 'د.ل', out: 'غير متوفر حالياً', errName: 'اكتب اسمك', errPhone: 'اكتب رقم هاتف ليبي صحيح، مثل 0912345678', errCity: 'اكتب مدينتك',
      err: 'صار خطأ، حاول مرة ثانية', tooMany: 'أرسلت طلبيات كثيرة. حاول بعد ساعة أو راسلنا مباشرة.', unavailable: 'المنتجات في سلتك لم تعد متوفرة.',
      copied: 'تم نسخ الرسالة، الصقها في المحادثة', copyFail: 'انسخ الرسالة من المربع بالأسفل',
      disc: 'الخصم', codeW: 'كود', loyal: 'خصم الوفاء', loyalHi: function (p) { return 'أهلاً بعودتك! طبّقنا خصم الوفاء ' + p + '% على طلبيتك'; }, byArea: 'اختر منطقتك', delFree: 'مجاني', delChat: 'نتفق عليه في المحادثة', cash: 'نقداً للمندوب', time: 'مدة التوصيل',
      totDel: 'المجموع مع التوصيل', freeYes: 'التوصيل مجاني لطلبيتك', freeMore: function (x) { return 'أضف ' + x + ' د.ل وتحصل على توصيل مجاني'; },
      errArea: 'اختر منطقتك', errCityPick: 'اختر مدينتك', codeSaved: function (c) { return 'تم حفظ كود الخصم ' + c + '، يُطبّق عند إكمال الطلبية'; },
      code: { ok: function (x) { return 'تم تطبيق الكود، وفّرت ' + x + ' د.ل'; }, not_better: function (o) { return 'عرض ' + o + ' يعطيك سعراً أفضل، فطبّقناه بدل الكود'; }, not_better_loyal: 'خصم الوفاء يعطيك سعراً أفضل، فطبّقناه بدل الكود',
        invalid: 'هذا الكود غير صحيح', expired: 'هذا الكود منتهي أو لم يبدأ بعد', used_up: 'هذا الكود وصل للحد الأقصى من الاستخدام',
        used: 'استخدمت هذا الكود من قبل بهذا الرقم', min: function (x) { return 'هذا الكود يعمل للطلبيات من ' + x + ' د.ل'; },
        no_items: 'هذا الكود لا ينطبق على القطع في سلتك', slow: 'محاولات كثيرة، حاول بعد قليل' },
      tierNext: function (x, p) { return 'أضف ' + x + ' د.ل وتحصل على خصم ' + p + '%'; }, tierOn: function (p) { return 'طبّقنا خصم ' + p + '% على طلبيتك'; },
      tierTop: function (p) { return 'حصلت على أعلى خصم: ' + p + '%'; },
      giftMore: function (x, n) { return 'أضف ' + x + ' د.ل وتحصل على هدية مجانية: ' + n; }, giftYes: 'هدية مجانية مع طلبيتك', giftW: 'هدية مجانية',
      flashShort: function (n) { return 'بقي ' + n + ' فقط بسعر العرض الخاطف، فحسبنا القطعة بسعرها العادي. قلّل الكمية إلى ' + n + ' لتحصل على سعر العرض'; } },
    en: { added: 'Added to cart', remove: 'Remove', items: 'Items', delivery: 'Delivery', byCity: 'Depends on city', total: 'Total',
      cont: 'Continue', empty: 'Your cart is empty. Have a look at what’s new.', shop: 'Shop now', note: 'We confirm price and availability with you before sending.',
      cur: 'LYD', out: 'Out of stock', errName: 'Enter your name', errPhone: 'Enter a valid Libyan phone number, e.g. 0912345678', errCity: 'Enter your city',
      err: 'Something went wrong, please try again', tooMany: 'Too many orders. Try again in an hour or message us directly.', unavailable: 'The items in your cart are no longer available.',
      copied: 'Message copied. Paste it in the chat', copyFail: 'Copy the message from the box below',
      disc: 'Discount', codeW: 'code', loyal: 'loyalty', loyalHi: function (p) { return 'Welcome back! Your ' + p + '% loyalty discount is applied'; }, byArea: 'Choose your area', delFree: 'Free', delChat: 'Agreed in the chat', cash: 'cash to the driver', time: 'Delivery time',
      totDel: 'Total with delivery', freeYes: 'Your delivery is free', freeMore: function (x) { return 'Add ' + x + ' LYD for free delivery'; },
      errArea: 'Choose your area', errCityPick: 'Choose your city', codeSaved: function (c) { return 'Discount code ' + c + ' saved. It is applied at checkout'; },
      code: { ok: function (x) { return 'Code applied: you save ' + x + ' LYD'; }, not_better: function (o) { return 'The ' + o + ' offer gives you a better price, so we applied it instead'; }, not_better_loyal: 'Your loyalty discount gives you a better price, so we applied it instead',
        invalid: 'This code is not valid', expired: 'This code has ended or has not started yet', used_up: 'This code has reached its limit',
        used: 'You have already used this code with this phone number', min: function (x) { return 'This code works on orders from ' + x + ' LYD'; },
        no_items: 'This code does not apply to the pieces in your cart', slow: 'Too many tries, please wait a little' },
      tierNext: function (x, p) { return 'Add ' + x + ' LYD to get ' + p + '% off'; }, tierOn: function (p) { return p + '% off is applied to your order'; },
      tierTop: function (p) { return 'You have the top discount: ' + p + '%'; },
      giftMore: function (x, n) { return 'Add ' + x + ' LYD for a free gift: ' + n; }, giftYes: 'Free gift with your order', giftW: 'Free gift',
      flashShort: function (n) { return 'Only ' + n + ' left at the flash price, so this piece is at its normal price. Lower the quantity to ' + n + ' to get the flash price'; } }
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

  /* ---------- discount code from a link (?code=SARA10): kept on this phone for 30 days ---------- */
  function normCode(v) { v = String(v || '').trim().toUpperCase().replace(/\s+/g, ''); return /^[A-Z0-9_-]{2,30}$/.test(v) ? v : ''; }
  function savedCode() { var c = store('sl_code'); return c && c.c && Date.now() - (c.at || 0) < 30 * 864e5 ? c.c : ''; }
  (function () {
    var m = /[?&]code=([^&#]*)/i.exec(location.search); if (!m) return;
    var c = normCode(decodeURIComponent(m[1].replace(/\+/g, ' ')));
    if (c) { store('sl_code', { c: c, at: Date.now() }); setTimeout(function () { toast(T.codeSaved(c)); }, 300); }
    try { var u = new URL(location.href); u.searchParams.delete('code'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
  })();

  /* ---------- prices: always from the server (/api/quote), the same sums the order is charged ---------- */
  var cartEl = $('[data-cart-page]');
  function quote(extra) {
    var body = { lang: lang, items: cart() };
    for (var k in extra) body[k] = extra[k];
    return fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('quote'); return r.json(); });
  }
  function cur(d) { return money(d) + ' ' + T.cur; }
  function row(label, value, cls) { return '<div' + (cls ? ' class="' + cls + '"' : '') + '><span>' + esc(label) + '</span><span>' + value + '</span></div>'; }
  function discRows(d) {
    if (!(d.discount > 0)) return '';
    var why = d.kind === 'code' && d.code ? T.codeW + ' ' + d.code.code : d.kind === 'loyalty' && d.loyalty ? T.loyal + ' ' + d.loyalty.pct + '%' : d.offer ? d.offer.name : '';
    return row(T.items, cur(d.subtotal)) + row(why ? T.disc + ' (' + why + ')' : T.disc, '−' + cur(d.discount), 'r-disc');
  }
  function lineHtml(it, withQty) {
    var was = it.price < it.orig ? it.orig : it.was;
    return '<span class="price' + (it.price < it.orig ? ' sale' : '') + '">' + cur(it.price * it.qty) + (was ? ' <s>' + money(was * it.qty) + '</s>' : '') + '</span>';
  }
  function freeHint(d) {
    if (!d.deliveryOn || !d.freeMin) return '';
    return '<p class="freehint">' + esc(d.items >= d.freeMin ? T.freeYes : T.freeMore(money(d.freeMin - d.items))) + '</p>';
  }
  // Release 4: spend-more levels, free gift and flash-deal notes (all from the server's quote)
  function offerHints(d) {
    var h = '', t = d.tier;
    if (t && (t.next || t.pct)) {
      var w = t.next ? Math.max(4, Math.min(100, Math.round(t.base * 100 / t.next.min))) : 100;
      h += '<div class="tierbar"><p>' + esc(t.next ? (t.pct ? T.tierOn(t.pct) + ' · ' : '') + T.tierNext(money(t.next.need), t.next.pct) : T.tierTop(t.pct)) +
        '</p><span class="bar" aria-hidden="true"><i style="width:' + w + '%"></i></span></div>';
    }
    if (d.gift) h += '<p class="freehint gift">🎁 ' + esc(T.giftYes) + ': ' + esc(d.gift.name) + '</p>';
    else if (d.giftNeed > 0 && d.giftName) h += '<p class="freehint gift">🎁 ' + esc(T.giftMore(money(d.giftNeed), d.giftName)) + '</p>';
    (d.flashShort || []).forEach(function (f) { h += '<p class="code-msg bad">' + esc(T.flashShort(f.left)) + '</p>'; });
    return h;
  }
  function giftLine(d, img) {
    if (!d.gift) return '';
    return img
      ? '<div class="line gift">' + (d.gift.image ? '<img src="' + esc(d.gift.image) + '" alt="" loading="lazy">' : '<span></span>') + '<div><span class="bd">🎁 ' + esc(T.giftW) + '</span><div class="nm"><bdi>' + esc(d.gift.name) + '</bdi></div></div><span class="price sale">' + esc(T.delFree) + ' <s>' + money(d.gift.orig) + '</s></span></div>'
      : '<div class="r-gift"><span><bdi>🎁 ' + esc(d.gift.name) + '</bdi></span><span>' + esc(T.giftW) + '</span></div>';
  }
  function renderCart() {
    var c = cart();
    if (!c.length) { cartEl.innerHTML = '<p class="empty">' + esc(T.empty) + '</p><a class="btn wide" href="/' + lang + '/">' + esc(T.shop) + '</a>'; return; }
    quote({ code: savedCode() }).then(function (d) {
      var byId = {}; (d.products || []).forEach(function (it) { byId[it.id] = it; });
      var keep = c.filter(function (i) { return byId[i.id]; });
      if (keep.length !== c.length) saveCart(keep);
      if (!keep.length) { cartEl.innerHTML = '<p class="empty">' + esc(T.empty) + '</p>'; return; }
      var html = '';
      keep.forEach(function (i) {
        var it = byId[i.id];
        html += '<div class="line"><a href="/' + lang + '/p/' + it.id + '"><img src="' + esc(it.image) + '" alt="" loading="lazy"></a><div><span class="bd">' + esc(it.brand) +
          '</span><div class="nm"><bdi>' + esc(it.name) + '</bdi></div>' + (it.inStock
            ? '<span class="qty"><button type="button" data-q="' + it.id + ':-1" aria-label="−">−</button><span>' + i.qty + '</span><button type="button" data-q="' + it.id + ':1" aria-label="+">+</button></span>'
            : '<span class="soldout">' + esc(T.out) + '</span>') +
          ' <button class="linkbtn" type="button" data-rm="' + it.id + '">' + esc(T.remove) + '</button></div>' + (it.inStock ? lineHtml(it) : '<span class="price muted">—</span>') + '</div>';
      });
      html += giftLine(d, true);
      html += '<div class="sum">' + discRows(d) + row(T.delivery, '<span class="muted">' + esc(d.deliveryOn ? T.byArea : T.byCity) + '</span>') +
        '<div class="tot"><span>' + T.total + '</span><span>' + cur(d.items) + '</span></div></div>' + offerHints(d) + freeHint(d) + '<p class="muted">' + esc(T.note) + '</p>' +
        (d.items ? '<a class="btn wide" href="/' + lang + '/checkout">' + esc(T.cont) + '</a>' : '');
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
    var F = form.elements, citySel = $('[data-city]', form), areaSel = $('[data-area]', form), areaWrap = $('[data-area-wrap]', form), otherWrap = $('[data-city-other]', form);
    var AD = null; try { AD = JSON.parse(($('#areas-data') || {}).textContent || 'null'); } catch (e) { AD = null; }
    var codeIn = F.code, codeMsg = $('[data-code-msg]', form), code = codeIn ? savedCode() : '';
    if (codeIn && code) codeIn.value = code;
    var areaId = function () {
      if (!citySel || !citySel.value || citySel.value === 'other') return 0;
      return Number(areaSel && areaSel.value) || 0;
    };
    var fillAreas = function (keep) {
      if (!citySel) return;
      var v = citySel.value, list = (AD && AD.areas || []).filter(function (a) { return String(a.c) === v; });
      otherWrap.hidden = v !== 'other';
      if (F.city) F.city.required = v === 'other';
      if (!v || v === 'other' || !list.length) { areaWrap.hidden = true; areaSel.innerHTML = ''; return; }
      if (list.length === 1 && list[0].one) { areaWrap.hidden = true; areaSel.innerHTML = '<option value="' + list[0].id + '"></option>'; areaSel.value = String(list[0].id); return; }
      areaWrap.hidden = false;
      areaSel.innerHTML = '<option value="">' + esc(AD.ph) + '</option>' + list.map(function (a) { return '<option value="' + a.id + '">' + esc(a.n) + '</option>'; }).join('') + '<option value="0">' + esc(AD.other) + '</option>';
      if (keep) areaSel.value = String(keep);
      if (areaSel.value === '' && keep === 0) areaSel.value = '0';
    };
    var last = null, seq = 0;
    var renderSum = function (d) {
      last = d;
      var html = '', n = 0;
      (d.products || []).forEach(function (it) {
        if (!it.inStock) return;
        n += it.qty;
        html += '<div><span><bdi>' + esc(it.brand) + ' · ' + esc(it.name) + '</bdi>' + (it.qty > 1 ? ' × ' + it.qty : '') + '</span>' + lineHtml(it) + '</div>';
      });
      html += giftLine(d, false);
      html += discRows(d);
      var dl = d.delivery || { mode: 'off' }, needArea = d.deliveryOn && citySel && (!citySel.value || (!areaWrap.hidden && areaSel.value === ''));
      if (d.deliveryOn) {
        var dv = needArea ? '<span class="muted">' + esc(T.byArea) + '</span>' : dl.mode === 'fee' ? cur(dl.fee) + ' <small class="muted">(' + esc(T.cash) + ')</small>' : dl.mode === 'free' ? esc(T.delFree) : esc(T.delChat);
        html += row(T.delivery, dv, 'r-del');
        if (!needArea && dl.time) html += row(T.time, esc(dl.time));
      }
      html += '<div class="tot"><span>' + (d.fee > 0 ? T.totDel : T.total) + ' (' + n + ')</span><span>' + cur(d.total) + '</span></div>';
      $('#co-summary').innerHTML = html + offerHints(d) + freeHint(d) + (d.kind === 'loyalty' && d.loyalty ? '<p class="freehint loyal">' + esc(T.loyalHi(d.loyalty.pct)) + '</p>' : '');
      if (codeMsg) {
        var cs = d.code, m = '';
        if (cs) {
          var f = T.code[cs.status];
          m = cs.status === 'ok' ? f(money(cs.saving)) : cs.status === 'not_better' ? (d.kind === 'loyalty' ? T.code.not_better_loyal : f(d.offer ? d.offer.name : '')) : cs.status === 'min' ? f(money(cs.min)) : f || '';
        }
        codeMsg.textContent = m; codeMsg.hidden = !m; codeMsg.className = 'code-msg' + (cs && cs.status === 'ok' ? ' ok' : cs && cs.status === 'not_better' ? '' : ' bad');
      }
    };
    var requote = function () {
      var my = ++seq;
      return quote({ code: code, phone: libyanPhone(F.phone.value), area_id: areaId() }).then(function (d) { if (my === seq) renderSum(d); }).catch(function () {});
    };
    var saved = store('sl_customer') || {};
    ['name', 'phone', 'address'].forEach(function (k) { if (saved[k] && F[k]) F[k].value = saved[k]; });
    if (citySel) {
      if (saved.city_id && citySel.querySelector('option[value="' + saved.city_id + '"]')) { citySel.value = String(saved.city_id); fillAreas(saved.area_id); }
      if (citySel.value === 'other' && saved.city) F.city.value = saved.city;
      citySel.addEventListener('change', function () { fillAreas(); requote(); });
      areaSel.addEventListener('change', requote);
    } else if (saved.city && F.city) F.city.value = saved.city;
    F.phone.addEventListener('change', requote);
    if (codeIn) {
      var apply = function () { code = normCode(codeIn.value); codeIn.value = code; if (code) store('sl_code', { c: code, at: Date.now() }); else store('sl_code', null); requote(); };
      $('[data-code-apply]', form).addEventListener('click', apply);
      codeIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    }
    requote();
    var submitter = null;
    form.addEventListener('click', function (e) { var b = e.target.closest('button[name="channel"]'); if (b) submitter = b; });
    var showErr = function (field, msg) {
      var err = $('.form-err', form);
      err.textContent = msg; err.hidden = false;
      var el = field && (field.nodeType ? field : F[field]);
      if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
    };
    // fixing the field that was flagged clears the message straight away
    var clearOne = function (e) {
      if (e.target.getAttribute('aria-invalid') !== 'true') return;
      e.target.removeAttribute('aria-invalid'); $('.form-err', form).hidden = true;
    };
    form.addEventListener('input', clearOne); form.addEventListener('change', clearOne);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      $$('input, select', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
      var phone = libyanPhone(F.phone.value);
      var cityText = F.city ? F.city.value.trim() : '';
      if (citySel && citySel.value && citySel.value !== 'other') cityText = citySel.options[citySel.selectedIndex].text;
      if (!F.name.value.trim()) bad = ['name', T.errName];
      else if (!phone) bad = ['phone', T.errPhone];
      else if (citySel && !citySel.value) bad = [citySel, T.errCityPick];
      else if (citySel && !areaWrap.hidden && areaSel.value === '') bad = [areaSel, T.errArea];
      else if (!cityText) bad = ['city', T.errCity];
      if (bad) { showErr(bad[0], bad[1]); return; }
      $('.form-err', form).hidden = true;
      var channel = (e.submitter || submitter || {}).value || 'whatsapp';
      var pay = form.querySelector('input[name="payment"]:checked');
      var body = { lang: lang, name: F.name.value, phone: phone, city: cityText, area_id: areaId(), code: code, address: F.address.value, note: F.note.value, payment: pay ? pay.value : '', channel: channel, items: cart(), website: F.website ? F.website.value : '' };
      store('sl_customer', { name: body.name, phone: body.phone, city: citySel && citySel.value !== 'other' && citySel.value ? saved.city || '' : body.city, address: body.address, city_id: citySel ? citySel.value : '', area_id: citySel ? (areaSel.value === '' ? '' : Number(areaSel.value)) : '' });
      var btns = $$('button[name="channel"]', form); btns.forEach(function (b) { b.disabled = true; });
      fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
        .then(function (res) {
          btns.forEach(function (b) { b.disabled = false; });
          if (!res.ok) {
            var fields = (res.d && res.d.fields) || [], has = function (k) { return res.status === 422 && fields.indexOf(k) > -1; };
            if (has('name')) return showErr('name', T.errName);
            if (has('phone')) return showErr('phone', T.errPhone);
            if (has('city')) return showErr(citySel || 'city', citySel ? T.errCityPick : T.errCity);
            return showErr(null, res.status === 429 ? T.tooMany : res.status === 409 || has('items') ? T.unavailable : T.err);
          }
          var d = res.d, url = '/' + lang + '/order/' + d.number + '?t=' + d.token;
          var phoneLike = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          var autoOpen = channel === 'whatsapp' && phoneLike && d.links && d.links.whatsapp;
          if (autoOpen) sstore('sl_opened_' + d.number, true);
          saveCart([]);
          if (code && !d.codeNote) store('sl_code', null); // a used code is not kept for the next order
          history.replaceState(null, '', url);
          // Phones + WhatsApp: open the chat straight away (the message is filled in); coming back lands on the order page.
          // Messenger and Instagram may not fill the message in, so the order page copies it on the tap that opens them.
          location.href = autoOpen ? d.links.whatsapp : url;
        })
        .catch(function () { btns.forEach(function (b) { b.disabled = false; }); showErr(null, T.err); });
    });
  }

  /* ---------- offer countdown: boxes on the banner, hh:mm:ss in the strip ---------- */
  var cds = $$('[data-cd]');
  if (cds.length) {
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    var reloadAt = function (target) {
      // the offer just ended (or a coming-soon offer just started): show the new prices once, never in a loop
      var k = 'sl_cd_' + target;
      try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (err) { return; }
      setTimeout(function () { location.reload(); }, 3000);
    };
    var tick = function () {
      var now = Date.now();
      cds.forEach(function (el) {
        var target = el.getAttribute('data-cd');
        var left = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
        if (left > 0) el.setAttribute('data-live', '1');
        else if (el.getAttribute('data-live') === '1') { el.removeAttribute('data-live'); reloadAt(target); }
        var d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
        if (el.hasAttribute('data-txt')) { el.textContent = two(d * 24 + h) + ':' + two(m) + ':' + two(s); return; }
        var set = function (f, v) { var b = el.querySelector('[data-f="' + f + '"]'); if (b) b.textContent = two(v); };
        if (el.hasAttribute('data-nodays')) { set('h', d * 24 + h); } else { set('d', d); set('h', h); }
        set('m', m); set('s', s);
      });
    };
    tick(); setInterval(tick, 1000);
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

  /* ---------- Release 3: waiting list and reviews ---------- */
  var R3 = {
    ar: { rating: 'اختر عدد النجوم', photo: 'لم نقدر نقرأ هذه الصورة. جرّب صورة أخرى.', done: 'وصلنا رأيك من قبل، شكراً لك!', back: 'رجعت متوفرة! نحدّث الصفحة…', sending: 'جاري الإرسال…', many: 'محاولات كثيرة. حاول بعد ساعة.' },
    en: { rating: 'Choose the number of stars', photo: 'We could not read this photo. Try another one.', done: 'We already have your review, thank you!', back: 'It is back in stock! Refreshing…', sending: 'Sending…', many: 'Too many tries. Please try again in an hour.' },
  }[lang];
  /** Resizes a photo in the browser (at most 1600 px) and re-encodes it, which also drops hidden data such as location. */
  function shrinkPhoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1600 / Math.max(w, h, 1));
        var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        var done = function (b) { cv.width = cv.height = 0; if (b && b.size) res(b); else rej(new Error('encode')); };
        cv.toBlob(function (b) { if (b && b.type === 'image/webp') done(b); else cv.toBlob(done, 'image/jpeg', 0.85); }, 'image/webp', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function r3Form(form, send) {
    var err = $('[data-form-err]', form), btn = $('button[type="submit"]', form);
    var show = function (msg, field) {
      err.textContent = msg || ''; err.hidden = !msg;
      var el = field && form.elements[field];
      if (el && el.setAttribute && !el.length) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
    };
    form.addEventListener('input', function (e) { if (e.target.getAttribute && e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); err.hidden = true; } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      show('');
      var ready = send(show);
      if (!ready) return;
      btn.disabled = true; var label = btn.textContent; btn.textContent = R3.sending;
      ready.then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.ok) { $$('.field, .wl-h, .wl-row, button[type="submit"], small.muted', form).forEach(function (x) { x.hidden = true; }); $('[data-ok]', form).hidden = false; return; }
          var f = (d.fields || [])[0];
          if (r.status === 429) show(R3.many);
          else if (d.error === 'done') show(R3.done);
          else if (d.error === 'gone') { var g = $('[data-form-err]', form); show(g.getAttribute('data-gone') || T.err); }
          else if (d.error === 'in_stock') { show(R3.back); setTimeout(function () { location.reload(); }, 1200); }
          else if (d.error === 'photo' || r.status === 413) show(R3.photo, 'photo');
          else if (f === 'name') show(T.errName, 'name');
          else if (f === 'phone') show(T.errPhone, 'phone');
          else if (f === 'rating') show(R3.rating);
          else show(T.err);
        });
      }).catch(function (x) { show(x && x.message === 'photo' ? R3.photo : T.err); }).then(function () { btn.disabled = false; btn.textContent = label; });
    });
  }
  $$('[data-waitlist]').forEach(function (form) {
    r3Form(form, function (show) {
      var F = form.elements, name = F.name.value.trim(), phone = libyanPhone(F.phone.value);
      if (!name) { show(T.errName, 'name'); return null; }
      if (!phone) { show(T.errPhone, 'phone'); return null; }
      return fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_id: Number(form.getAttribute('data-waitlist')), name: name, phone: phone, lang: lang, website: F.website.value }) });
    });
  });
  $$('[data-remind]').forEach(function (form) {
    r3Form(form, function (show) {
      var F = form.elements, name = F.name.value.trim(), phone = libyanPhone(F.phone.value);
      if (!name) { show(T.errName, 'name'); return null; }
      if (!phone) { show(T.errPhone, 'phone'); return null; }
      return fetch('/api/remind', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offer_id: Number(form.getAttribute('data-remind')), name: name, phone: phone, lang: lang, website: F.website.value }) });
    });
  });
  $$('[data-review-form]').forEach(function (form) {
    r3Form(form, function (show) {
      var F = form.elements, rated = $('input[name="rating"]:checked', form);
      if (!rated) { show(R3.rating); return null; }
      if (!F.name.value.trim()) { show(T.errName, 'name'); return null; }
      if (F.phone && F.phone.value.trim() && !libyanPhone(F.phone.value)) { show(T.errPhone, 'phone'); return null; }
      var file = F.photo.files && F.photo.files[0];
      var fd = new FormData();
      $$('input, select, textarea', form).forEach(function (el) {
        if (!el.name || el.type === 'file' || ((el.type === 'radio' || el.type === 'checkbox') && !el.checked)) return;
        fd.append(el.name, el.name === 'phone' ? libyanPhone(el.value) : el.value);
      });
      var go = function () { return fetch('/api/reviews', { method: 'POST', body: fd }); };
      if (!file) return go();
      return shrinkPhoto(file).then(function (b) { fd.append('photo', b, b.type === 'image/webp' ? 'photo.webp' : 'photo.jpg'); return go(); }, function () { throw new Error('photo'); });
    });
  });

  /* ---------- broken photos: hide the broken icon, keep the soft background ---------- */
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('pimg')) t.classList.add('broken'); }, true);
})();
