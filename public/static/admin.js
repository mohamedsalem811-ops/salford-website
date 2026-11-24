/* Salford admin — products, photos/videos (upload or link), orders, settings. */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var tt;
  function toast(m, bad) { var el = $('.toast'); el.textContent = m; el.className = 'toast' + (bad ? ' bad' : ''); el.hidden = false; clearTimeout(tt); tt = setTimeout(function () { el.hidden = true; }, 3500); }
  function api(method, url, body, raw) {
    var opt = { method: method, headers: {}, credentials: 'same-origin' };
    if (raw) opt.body = raw; else if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('/admin/api' + url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || ('Error ' + r.status)); e.status = r.status; throw e; } return d; });
    });
  }
  function retry(fn, n) { return fn().catch(function (e) { if (n > 1 && (!e.status || e.status >= 500)) return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return retry(fn, n - 1); }); throw e; }); }
  function formJSON(form) {
    var o = {};
    $$('input, select, textarea', form).forEach(function (el) { if (!el.name) return; o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return o;
  }
  var busy = 0;
  window.addEventListener('beforeunload', function (e) { if (busy > 0) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- product list ---------- */
  document.addEventListener('click', function (e) {
    var tg = e.target.closest('[data-toggle]');
    if (tg) {
      var p = tg.getAttribute('data-toggle').split(':');
      api('POST', '/products/' + p[0] + '/toggle', { field: p[1] }).then(function (d) {
        tg.classList.toggle('on', !!d.value); tg.setAttribute('aria-checked', d.value ? 'true' : 'false'); toast('Saved');
      }).catch(function (err) { toast(err.message, true); });
    }
    var rs = e.target.closest('[data-restore]');
    if (rs) api('POST', '/products/' + rs.getAttribute('data-restore') + '/restore').then(function () { toast('Restored'); setTimeout(function () { location.reload(); }, 600); });
    var del = e.target.closest('[data-delete]');
    if (del && confirm('Delete this product? You can restore it from Products → Deleted.')) {
      api('DELETE', '/products/' + del.getAttribute('data-delete')).then(function () { location.href = '/admin'; });
    }
    var rma = e.target.closest('[data-remove-admin]');
    if (rma && confirm('Remove this team member?')) api('DELETE', '/admins/' + rma.getAttribute('data-remove-admin')).then(function () { location.reload(); }).catch(function (err) { toast(err.message, true); });
  });

  /* ---------- bulk link check / safe copies ---------- */
  $$('[data-batch]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var op = btn.getAttribute('data-batch'), status = $('[data-batch-status]'), ok = 0, bad = [], after = 0;
      $$('[data-batch]').forEach(function (b) { b.disabled = true; }); status.hidden = false; busy++;
      (function step() {
        retry(function () { return op === 'translate' ? api('POST', '/products/translate-missing', { after: after }) : api('POST', '/media/batch', { op: op, after: after }); }, 3).then(function (d) {
          d.report.forEach(function (r) { if (r.ok) ok++; else bad.push(r); });
          status.textContent = (op === 'check' ? 'Checked ' : op === 'translate' ? 'Translated ' : 'Copied ') + ok + ' · problems ' + bad.length + ' · remaining ' + d.remaining;
          if (d.next && d.remaining > 0) { after = d.next; step(); return; }
          busy--; $$('[data-batch]').forEach(function (b) { b.disabled = false; });
          status.innerHTML = esc(status.textContent) + ' · done' + (bad.length ? '<br>' + bad.slice(0, 30).map(function (r) { return '<a href="/admin/p/' + r.product_id + '">Product ' + r.product_id + '</a>: ' + esc(r.reason || 'failed'); }).join('<br>') : '');
        }).catch(function (err) { busy--; status.textContent = 'Stopped: ' + err.message + '. Press the button again to continue.'; $$('[data-batch]').forEach(function (b) { b.disabled = false; }); });
      })();
    });
  });

  /* ---------- photo processing (on this device, never on the server) ---------- */
  var MAX_PHOTO = 25 * 1024 * 1024, MAX_VIDEO = 100 * 1024 * 1024, SIZES = [400, 900, 1800];
  var seen = {};
  function hex(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function fingerprint(file) { return file.slice(0, 4 * 1024 * 1024).arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); }).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('') + ':' + file.size; }); }
  function decode(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res(img); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(/heic|heif/i.test(file.type + file.name) ? 'This iPhone photo format (HEIC) can’t be read in this browser. Upload from the iPhone itself, or set Camera → Formats → Most Compatible.' : 'This file could not be read as a photo.')); };
      img.src = url;
    });
  }
  function toBlob(canvas, type, q) { return new Promise(function (res) { canvas.toBlob(res, type, q); }); }
  function encode(canvas) {
    return toBlob(canvas, 'image/webp', 0.82).then(function (b) { return b && b.type === 'image/webp' ? b : toBlob(canvas, 'image/jpeg', 0.85); });
  }
  /** Turns any photo into up to 3 sizes, upright, without hidden data (location etc.). */
  function processPhoto(file, widths) {
    if (file.size > MAX_PHOTO) return Promise.reject(new Error('Larger than 25 MB. Export a smaller version and try again.'));
    return decode(file).then(function (src) {
      var W = src.width, H = src.height;
      if (W * H > 50e6) throw new Error('More than 50 megapixels. Export a smaller version and try again.');
      if (Math.max(W, H) < 800) throw new Error('Too small (' + W + ' × ' + H + '). Use a photo at least 1200 px wide.');
      var warn = Math.max(W, H) < 1200 ? 'Small photo (' + W + ' × ' + H + '): it may look soft when zoomed.' : '';
      var ws = (widths || SIZES).map(function (w) { return Math.min(w, W); }).filter(function (w, i, a) { return a.indexOf(w) === i; });
      var out = [], chain = Promise.resolve();
      ws.forEach(function (w) {
        chain = chain.then(function () {
          var h = Math.round(H * w / W), c = document.createElement('canvas'); c.width = w; c.height = h;
          var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, w, h);
          return encode(c).then(function (b) { out.push({ w: w, blob: b }); c.width = c.height = 0; });
        });
      });
      return chain.then(function () { if (src.close) src.close(); return { variants: out, width: W, height: H, warn: warn }; });
    });
  }
  function uploadPhoto(file, productId, onStatus) {
    return processPhoto(file).then(function (r) {
      var base = hex(9), total = r.variants.reduce(function (s, v) { return s + v.blob.size; }, 0), done = 0;
      onStatus('Uploading · ' + (file.size / 1048576).toFixed(1) + ' MB → ' + Math.round(total / 1024) + ' KB', 0);
      var chain = Promise.resolve();
      r.variants.forEach(function (v) {
        chain = chain.then(function () {
          return retry(function () { return api('PUT', '/upload?product=' + productId + '&base=' + base + '&w=' + v.w, undefined, v.blob); }, 3)
            .then(function () { done += v.blob.size; onStatus(null, Math.round(done / total * 100)); });
        });
      });
      return chain.then(function () {
        return api('POST', '/media', { product_id: productId, kind: 'image', r2_key: 'u/' + productId + '/' + base, sizes: r.variants.map(function (v) { return v.w; }), width: r.width, height: r.height, bytes: total });
      }).then(function (d) { d.note = (file.size / 1048576).toFixed(1) + ' MB → ' + Math.round(total / 1024) + ' KB · 3 sizes · location data removed' + (r.warn ? ' · ' + r.warn : ''); return d; });
    });
  }
  function looksHevc(file) {
    var head = file.slice(0, 256 * 1024), tail = file.slice(Math.max(0, file.size - 1024 * 1024));
    return Promise.all([head.arrayBuffer(), tail.arrayBuffer()]).then(function (bs) {
      var dec = new TextDecoder('latin1'), s = bs.map(function (b) { return dec.decode(b); }).join('');
      return /hvc1|hev1/.test(s) && !/avc1/.test(s);
    }).catch(function () { return false; });
  }
  function uploadVideo(file, productId, onStatus) {
    if (file.size > MAX_VIDEO) return Promise.reject(new Error('Videos can be up to 100 MB. Trim or export a smaller version.'));
    return looksHevc(file).then(function (hevc) {
      if (hevc && !confirm('This video uses the HEVC format, which many Android phones can’t play. For best results set the iPhone camera to “Most Compatible” and record again. Upload anyway?')) throw new Error('Upload cancelled.');
      return api('POST', '/video/start', { product_id: productId, type: file.type, size: file.size });
    }).then(function (s) {
      var PART = 10 * 1024 * 1024, n = Math.ceil(file.size / PART), parts = [], chain = Promise.resolve();
      for (var i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () {
          onStatus('Uploading video · part ' + (i + 1) + ' of ' + n, Math.round(i / n * 100));
          return retry(function () { return api('PUT', '/video/part?key=' + encodeURIComponent(s.key) + '&uploadId=' + encodeURIComponent(s.uploadId) + '&n=' + (i + 1), undefined, file.slice(i * PART, (i + 1) * PART)); }, 3)
            .then(function (p) { parts.push(p); });
        });
      })(i);
      return chain.then(function () { return api('POST', '/video/complete', { key: s.key, uploadId: s.uploadId, parts: parts, product_id: productId, size: file.size }); });
    });
  }

  /* ---------- product edit: details ---------- */
  var pform = $('[data-product-form]');
  if (pform) {
    var pid = Number(pform.getAttribute('data-product-form'));
    var dirty = false;
    pform.addEventListener('input', function () { dirty = true; });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    pform.addEventListener('submit', function (e) {
      e.preventDefault();
      toast('Saving…');
      api('PUT', '/products/' + pid, formJSON(pform)).then(function (d) {
        dirty = false; fillAr(d);
        toast(d.translated === false ? 'Saved. The Arabic text could not be written right now: press “Translate again” later.' : d.translated ? 'Saved, Arabic text written' : 'Saved', d.translated === false);
      }).catch(function (err) { toast(err.message, true); });
    });
    var fillAr = function (d) {
      if (d.short_ar != null) pform.elements.short_ar.value = d.short_ar;
      if (d.desc_ar != null) pform.elements.desc_ar.value = d.desc_ar;
    };
    var tb = $('[data-translate]');
    if (tb) tb.addEventListener('click', function () {
      if (dirty) { toast('Save your changes first, then translate.', true); return; }
      if ((pform.elements.short_ar.value || pform.elements.desc_ar.value) && !confirm('Replace the Arabic short line and description with a new translation?')) return;
      tb.disabled = true; toast('Translating…');
      api('POST', '/products/' + pid + '/translate').then(function (d) { fillAr(d); toast('Arabic text written'); })
        .catch(function (err) { toast(err.message, true); }).then(function () { tb.disabled = false; });
    });
  }

  /* ---------- product edit: media manager ---------- */
  var mm = $('[data-media-manager]');
  if (mm) {
    var mpid = Number(mm.getAttribute('data-media-manager'));
    var list = $('[data-media-list]', mm);
    var items = JSON.parse($('[data-media-json]', mm).textContent || '[]');
    var draw = function () {
      $('[data-media-count]', mm).textContent = '· ' + items.filter(function (m) { return m.kind !== 'video'; }).length + ' of 8 photos, ' + items.filter(function (m) { return m.kind === 'video'; }).length + ' video';
      list.innerHTML = items.map(function (m, i) {
        var thumb = m.kind === 'image' ? '<img src="' + esc(m.preview) + '" alt="" loading="lazy">' : '<span class="vid">' + (m.kind === 'youtube' ? 'YouTube' : 'Video') + '</span>';
        var src = m.source === 'upload' ? 'Uploaded' : 'Link · ' + esc((m.url || '').replace(/^https?:\/\//, '').slice(0, 48)) + (m.r2_key ? ' · safe copy kept' : '');
        var tag = m.status === 'broken' ? '<span class="tag bad">Broken</span>' : i === 0 && m.kind === 'image' ? '<span class="tag main">Main</span>' : '<span class="tag ok">' + (m.source === 'upload' ? 'Ready' : 'Link') + '</span>';
        return '<li class="mitem" draggable="true" data-id="' + m.id + '"><span class="th">' + thumb + '</span><span class="mi"><b>' + src + '</b>' + (m.note ? '<small>' + esc(m.note) + '</small>' : '') +
          (m.bytes ? '<small>' + (m.bytes / 1048576).toFixed(2) + ' MB</small>' : '') + '</span>' + tag +
          '<span class="mbtns"><button type="button" class="a-btn sm" data-up="' + i + '" aria-label="Move up">↑</button><button type="button" class="a-btn sm" data-down="' + i + '" aria-label="Move down">↓</button><button type="button" class="a-btn sm danger" data-rm="' + m.id + '">Remove</button></span></li>';
      }).join('') + pending.map(function (p) { return '<li class="mitem pending"><span class="th"></span><span class="mi"><b>' + esc(p.name) + '</b><small>' + esc(p.status) + '</small>' + (p.pct != null ? '<span class="prog"><b style="width:' + p.pct + '%"></b></span>' : '') + '</span><span class="tag ' + (p.error ? 'bad' : 'run') + '">' + (p.error ? 'Not added' : 'Working') + '</span></li>'; }).join('');
    };
    var pending = [];
    var saveOrder = function () { api('PUT', '/media/order', { product_id: mpid, ids: items.map(function (m) { return m.id; }) }).then(function () { toast('Order saved'); }); };
    draw();

    list.addEventListener('click', function (e) {
      var up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]'), rm = e.target.closest('[data-rm]');
      if (up || down) {
        var i = Number((up || down).getAttribute(up ? 'data-up' : 'data-down')), j = up ? i - 1 : i + 1;
        if (j < 0 || j >= items.length) return;
        var t = items[i]; items[i] = items[j]; items[j] = t; draw(); saveOrder();
      }
      if (rm && confirm('Remove this photo or video?')) {
        api('DELETE', '/media/' + rm.getAttribute('data-rm')).then(function () { items = items.filter(function (m) { return String(m.id) !== rm.getAttribute('data-rm'); }); draw(); toast('Removed'); });
      }
    });
    var dragId = null;
    list.addEventListener('dragstart', function (e) { var li = e.target.closest('.mitem'); if (li) dragId = li.getAttribute('data-id'); });
    list.addEventListener('dragover', function (e) { e.preventDefault(); });
    list.addEventListener('drop', function (e) {
      e.preventDefault(); var li = e.target.closest('.mitem'); if (!li || !dragId) return;
      var from = items.findIndex(function (m) { return String(m.id) === dragId; }), to = items.findIndex(function (m) { return String(m.id) === li.getAttribute('data-id'); });
      if (from < 0 || to < 0 || from === to) return;
      var m = items.splice(from, 1)[0]; items.splice(to, 0, m); dragId = null; draw(); saveOrder();
    });

    var handleFiles = function (files) {
      var arr = Array.prototype.slice.call(files);
      var photosLeft = 8 - items.filter(function (m) { return m.kind !== 'video'; }).length;
      var chain = Promise.resolve();
      arr.forEach(function (file) {
        var isVideo = /^video\//.test(file.type), job = { name: file.name, status: 'Waiting…', pct: null };
        pending.push(job);
        if (!isVideo && photosLeft-- <= 0) { job.status = 'A product can have up to 8 photos.'; job.error = true; return; }
        chain = chain.then(function () {
          busy++; job.status = isVideo ? 'Checking video…' : 'Preparing photo…'; draw();
          return fingerprint(file).then(function (fp) {
            if (seen[fp]) throw new Error('Same photo already added — skipped.');
            seen[fp] = true;
            var on = function (msg, pct) { if (msg) job.status = msg; if (pct != null) job.pct = pct; draw(); };
            return isVideo ? uploadVideo(file, mpid, on) : uploadPhoto(file, mpid, on);
          }).then(function (d) {
            d.media.preview = d.media.r2_key ? (d.media.sizes && d.media.sizes !== '[]' ? '/m/' + d.media.r2_key + '-' + JSON.parse(d.media.sizes)[0] : '/m/' + d.media.r2_key) : d.media.url;
            d.media.note = d.note; items.push(d.media); pending.splice(pending.indexOf(job), 1); draw();
          }).catch(function (err) { job.status = err.message; job.error = true; job.pct = null; draw(); })
            .then(function () { busy--; });
        });
      });
      draw();
      chain.then(function () { setTimeout(function () { pending = pending.filter(function (p) { return !p.error; }); }, 15000); });
    };
    $('[data-media-file]', mm).addEventListener('change', function (e) { handleFiles(e.target.files); e.target.value = ''; });
    var drop = $('[data-drop]', mm);
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

    $('[data-link-add]', mm).addEventListener('click', function () {
      var input = $('[data-link-input]', mm), url = input.value.trim(), btn = this;
      if (!url) return input.focus();
      btn.disabled = true; btn.textContent = 'Checking…'; busy++;
      api('POST', '/media/link', { product_id: mpid, url: url, copy: $('[data-link-copy]', mm).checked }).then(function (d) {
        d.media.preview = d.media.kind === 'image' ? (d.media.r2_key ? '/m/' + d.media.r2_key : d.media.url) : '';
        d.media.note = d.copy ? (d.copy.ok ? 'Safe copy kept' : 'Link added, but the safe copy failed: ' + d.copy.reason) : '';
        items.push(d.media); draw(); input.value = ''; toast('Link added');
      }).catch(function (err) { toast(err.message, true); })
        .then(function () { busy--; btn.disabled = false; btn.textContent = 'Add link'; });
    });
  }

  /* ---------- quick import by file name: BRAND-CODE(PRICE).jpg ---------- */
  var qi = $('[data-quick-import]');
  if (qi) qi.addEventListener('change', function () {
    var files = Array.prototype.slice.call(qi.files), status = $('[data-batch-status]'), ok = 0, bad = [];
    status.hidden = false; busy++;
    var groups = {};
    files.forEach(function (f) {
      var m = f.name.match(/^(SWAROVSKI|TIFFANY|APM|PANDORA)[-_ ]+([0-9A-Za-z+]+)\s*\(\s*([\d.]+)/i);
      if (!m) { bad.push(f.name + ': name must look like SWAROVSKI-5642976(550).jpg'); return; }
      var key = m[1].toUpperCase() + '|' + m[2];
      (groups[key] = groups[key] || { brand: m[1].toLowerCase(), code: m[2], price: Number(m[3]), files: [] }).files.push(f);
    });
    var chain = Promise.resolve();
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      chain = chain.then(function () {
        status.textContent = 'Creating ' + g.code + '… (' + ok + ' done)';
        return api('POST', '/products/quick', { brand: g.brand, code: g.code, price: g.price }).then(function (d) {
          var c2 = Promise.resolve();
          g.files.slice(0, 8).forEach(function (f) { c2 = c2.then(function () { return uploadPhoto(f, d.id, function () {}); }); });
          return c2.then(function () { ok++; });
        }).catch(function (err) { bad.push(g.code + ': ' + err.message); });
      });
    });
    chain.then(function () {
      busy--; qi.value = '';
      status.innerHTML = esc(ok + ' draft products created. Add their names, then set them Live.') + (bad.length ? '<br>' + bad.map(esc).join('<br>') : '');
      setTimeout(function () { location.href = '/admin?show=hidden'; }, bad.length ? 6000 : 1500);
    });
  });

  /* ---------- orders ---------- */
  var of = $('[data-order-form]');
  if (of) of.addEventListener('submit', function (e) { e.preventDefault(); api('POST', '/orders/' + of.getAttribute('data-order-form'), formJSON(of)).then(function () { toast('Saved'); }).catch(function (err) { toast(err.message, true); }); });

  /* ---------- settings ---------- */
  var sf = $('[data-settings-form]');
  if (sf) {
    sf.addEventListener('submit', function (e) { e.preventDefault(); api('POST', '/settings', formJSON(sf)).then(function () { toast('Settings saved'); }).catch(function (err) { toast(err.message, true); }); });
    $$('[data-banner-upload]', sf).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files[0]; if (!f) return;
        var field = sf.elements[inp.getAttribute('data-banner-upload')], wide = /_image$/.test(field.name);
        toast('Uploading banner…'); busy++;
        processPhoto(f, [wide ? 2400 : 1080]).then(function (r) {
          var v = r.variants[0], base = hex(9);
          return api('PUT', '/upload?product=banner&base=' + base + '&w=' + v.w, undefined, v.blob);
        }).then(function (d) { field.value = d.url; toast('Banner uploaded. Press Save settings.'); })
          .catch(function (err) { toast(err.message, true); }).then(function () { busy--; inp.value = ''; });
      });
    });
  }
  var aa = $('[data-add-admin]');
  if (aa) aa.addEventListener('submit', function (e) { e.preventDefault(); api('POST', '/admins', formJSON(aa)).then(function () { location.reload(); }).catch(function (err) { toast(err.message, true); }); });
  var cp = $('[data-change-password]');
  if (cp) cp.addEventListener('submit', function (e) { e.preventDefault(); api('POST', '/password', formJSON(cp)).then(function () { cp.reset(); toast('Password changed. Other devices are signed out.'); }).catch(function (err) { toast(err.message, true); }); });
  var es = $('[data-end-sessions]');
  if (es) es.addEventListener('click', function () { if (confirm('Sign out on every other phone and computer?')) api('POST', '/sessions/end-others').then(function () { toast('Other devices are signed out'); }).catch(function (err) { toast(err.message, true); }); });
})();
