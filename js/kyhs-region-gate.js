/*!
 * KYHS 主站地区人机验证闸门（纯前端 / 零依赖 / 不改 DNS）
 * ---------------------------------------------------------------
 * 目的：中国大陆 IP 访问 www.kyhsexport.com 时弹出轻量人机验证，
 *       通过后 7 天内不再打扰；港澳台（HK / MO / TW）及海外一律不触发。
 *
 * 判定：优先用 IP 归属国接口（api.country.is → ipwho.is → Cloudflare trace），
 *       全部失败时退化为「时区 = Asia/Shanghai」判断，且可通过属性关闭。
 *       任何异常一律 fail-open（不拦），避免误伤真实海外客户。
 *
 * 调试：?kyhs_gate=cn  强制触发   |   ?kyhs_gate=off  不触发
 *       window.KYHS_GATE.reset()  清除通过记录
 *
 * 注意：这是「前端软拦」——能挡住普通访客与大部分采集器，但拦不住
 *       直接抓 HTML 的程序。真要 IP 级硬拦必须上 Cloudflare 代理（会动 DNS）。
 */
(function () {
  'use strict';

  var CFG = (function () {
    var s = document.currentScript;
    function attr(n, d) {
      var v = s && s.getAttribute('data-' + n);
      return v === null || v === '' ? d : v;
    }
    return {
      days: parseInt(attr('days', '7'), 10) || 7,
      countries: attr('countries', 'CN').toUpperCase().split(','),
      tzFallback: attr('tz-fallback', '1') !== '0',
      tzList: attr('timezones', 'Asia/Shanghai').split(',')
    };
  })();

  var KEY = 'kyhs_region_gate_v1';
  var DEBUG = (/[?&]kyhs_gate=([^&]+)/.exec(location.search) || [])[1] || '';

  /* ---------- 存储 ---------- */
  function store(kind) {
    try {
      var s = window[kind];
      s.setItem('__t', '1');
      s.removeItem('__t');
      return s;
    } catch (e) {
      return null;
    }
  }
  var mem = {};
  var ls = store('localStorage') || store('sessionStorage') || {
    getItem: function (k) { return mem[k] || null; },
    setItem: function (k, v) { mem[k] = String(v); }
  };

  function passed() {
    var v = parseInt(ls.getItem(KEY) || '0', 10);
    return v > Date.now();
  }
  function markPassed() {
    try { ls.setItem(KEY, String(Date.now() + CFG.days * 864e5)); } catch (e) {}
  }

  /* ---------- 归属国判定 ---------- */
  var PROVIDERS = [
    { url: 'https://api.country.is/', json: true,
      pick: function (d) { return d && d.country; } },
    { url: 'https://ipwho.is/', json: true,
      pick: function (d) { return d && (d.country_code || (d.success === false ? '' : '')); } },
    { url: 'https://www.cloudflare.com/cdn-cgi/trace', json: false,
      pick: function (t) { var m = /(?:^|\n)loc=([A-Z]{2})/.exec(t || ''); return m && m[1]; } }
  ];

  function fetchOnce(p, cb) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { ctrl && ctrl.abort(); }, 2600);
    fetch(p.url, { mode: 'cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? (p.json ? r.json() : r.text()) : null; })
      .then(function (d) { cb(d ? (p.pick(d) || '') : ''); })
      .catch(function () { cb(''); })
      .then(function () { clearTimeout(timer); });
  }

  function detect(cb) {
    var i = 0;
    (function next() {
      if (i >= PROVIDERS.length) return cb('', 'none');
      fetchOnce(PROVIDERS[i++], function (c) {
        if (c) return cb(String(c).toUpperCase(), 'ip');
        next();
      });
    })();
  }

  function tzHint() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return CFG.tzList.indexOf(tz) > -1;
    } catch (e) { return false; }
  }

  /* ---------- 埋点 ---------- */
  function sendEvent(ev, extra) {
    var data = { event: ev, gate_country: extra && extra.country, gate_reason: extra && extra.reason, gate_path: location.pathname };
    try { if (window.dataLayer) window.dataLayer.push(data); } catch (e) {}
    try { if (typeof window.gtag === 'function') window.gtag('event', ev, data); } catch (e) {}
  }

  /* ---------- UI ---------- */
  var CSS = ''
    + '.kg-mask{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
    + 'padding:18px;background:rgba(12,18,30,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;'
    + 'animation:kg-in .22s ease-out}'
    + '@keyframes kg-in{from{opacity:0}to{opacity:1}}'
    + '.kg-box{width:100%;max-width:440px;background:#fff;color:#1a2230;border-radius:14px;'
    + 'box-shadow:0 24px 60px rgba(8,14,28,.38);overflow:hidden;animation:kg-up .26s cubic-bezier(.2,.8,.3,1)}'
    + '@keyframes kg-up{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}'
    + '.kg-head{padding:22px 22px 0}'
    + '.kg-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;letter-spacing:.02em;'
    + 'color:#1b52c4;background:#eaf1ff;border-radius:999px;padding:5px 11px}'
    + '.kg-h{font-size:19px;font-weight:700;margin:14px 0 8px;line-height:1.35}'
    + '.kg-p{font-size:13.5px;line-height:1.7;color:#5d6b7f;margin:0}'
    + '.kg-en{font-size:12.5px;line-height:1.6;color:#8b98ab;margin:8px 0 0}'
    + '.kg-body{padding:18px 22px 4px}'
    + '.kg-track{position:relative;height:52px;border-radius:10px;background:#f1f4f9;border:1px solid #e6eaf0;'
    + 'display:flex;align-items:center;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}'
    + '.kg-fill{position:absolute;left:0;top:0;bottom:0;width:52px;background:linear-gradient(90deg,#2f6fed,#5b8dff);opacity:.16}'
    + '.kg-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
    + 'font-size:13px;color:#7a8899;letter-spacing:.04em;pointer-events:none}'
    + '.kg-thumb{position:relative;width:52px;height:52px;border-radius:9px;background:#fff;border:1px solid #dbe2ec;'
    + 'box-shadow:0 2px 8px rgba(20,40,80,.12);display:flex;align-items:center;justify-content:center;'
    + 'cursor:grab;touch-action:none;transition:background .15s;z-index:2}'
    + '.kg-thumb:active{cursor:grabbing}'
    + '.kg-thumb svg{width:20px;height:20px;fill:#2f6fed}'
    + '.kg-track.is-ok .kg-thumb{background:#22a06b;border-color:#22a06b}'
    + '.kg-track.is-ok .kg-thumb svg{fill:#fff}'
    + '.kg-track.is-ok .kg-hint{color:#22a06b;font-weight:600}'
    + '.kg-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;'
    + 'padding:14px 22px 20px;font-size:12px;color:#8b98ab}'
    + '.kg-foot a{color:#2f6fed;text-decoration:none}'
    + '.kg-foot a:hover{text-decoration:underline}'
    + '@media (prefers-color-scheme: dark){'
    + '.kg-box{background:#182033;color:#e8edf6}'
    + '.kg-badge{color:#9dbaff;background:#1e2b45}'
    + '.kg-p{color:#9aa8bd}.kg-en{color:#7c8aa0}'
    + '.kg-track{background:#111a29;border-color:#28334a}'
    + '.kg-hint{color:#8595ab}'
    + '.kg-thumb{background:#1e2942;border-color:#2f3d57}'
    + '.kg-foot{color:#8595ab}.kg-foot a{color:#7aa5ff}'
    + '}'
    + '@media (max-width:420px){.kg-h{font-size:17px}.kg-head{padding:18px 18px 0}.kg-body{padding:16px 18px 2px}'
    + '.kg-foot{padding:12px 18px 16px}}';

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 4.6 16 12l-7.4 7.4-1.6-1.6L12.8 12 7 6.2z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17.2 4.8 12.5l1.6-1.6 3.1 3.1 8-8 1.6 1.6z"/></svg>';

  var shown = false;
  function gate(country, reason) {
    if (shown || document.querySelector('.kg-mask')) return;
    shown = true;

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var mask = document.createElement('div');
    mask.className = 'kg-mask';
    mask.setAttribute('role', 'dialog');
    mask.setAttribute('aria-modal', 'true');
    mask.setAttribute('aria-label', '访问验证');
    mask.innerHTML = ''
      + '<div class="kg-box">'
      + '  <div class="kg-head">'
      + '    <span class="kg-badge">🔒 访问验证 / Access check</span>'
      + '    <h2 class="kg-h">请先完成人机验证</h2>'
      + '    <p class="kg-p">本站主要面向海外采购客户，检测到您当前位于中国大陆网络，为保障站点稳定，需要一次简单验证。通过后 7 天内不再提示。</p>'
      + '    <p class="kg-en">This site serves overseas buyers. A quick human check is required for visitors from mainland China. You will not be asked again for 7 days.</p>'
      + '  </div>'
      + '  <div class="kg-body">'
      + '    <div class="kg-track" id="kgTrack">'
      + '      <div class="kg-fill" id="kgFill"></div>'
      + '      <span class="kg-hint" id="kgHint">按住滑块，拖到最右侧</span>'
      + '      <div class="kg-thumb" id="kgThumb" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="拖动滑块完成验证">' + ARROW + '</div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="kg-foot">'
      + '    <span>采购咨询可直接联系 <a href="mailto:' + 'li651852596@gmail.com">邮箱</a> 或 <a href="https://wa.me/8618853853038" target="_blank" rel="noopener">WhatsApp</a></span>'
      + '  </div>'
      + '</div>';

    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(mask);
    sendEvent('region_gate_show', { country: country, reason: reason });

    var trackEl = mask.querySelector('#kgTrack');
    var thumb = mask.querySelector('#kgThumb');
    var fill = mask.querySelector('#kgFill');
    var hint = mask.querySelector('#kgHint');
    var dragging = false, startX = 0, x = 0, max = 0, done = false;

    function measure() { max = trackEl.clientWidth - thumb.offsetWidth; }
    measure();
    window.addEventListener('resize', function () { if (!done) { measure(); setX(Math.min(x, max)); } });

    function setX(v) {
      x = Math.max(0, Math.min(max || 0, v));
      thumb.style.transform = 'translateX(' + x + 'px)';
      fill.style.width = (x + thumb.offsetWidth) + 'px';
      thumb.setAttribute('aria-valuenow', String(max ? Math.round((x / max) * 100) : 0));
    }

    function pass() {
      if (done) return;
      done = true;
      trackEl.classList.add('is-ok');
      thumb.innerHTML = CHECK;
      hint.textContent = '验证通过 · Verified';
      markPassed();
      trackPassEvent();
      setTimeout(function () {
        mask.style.transition = 'opacity .25s';
        mask.style.opacity = '0';
        setTimeout(function () {
          mask.remove();
          document.documentElement.style.overflow = '';
        }, 260);
      }, 420);
    }

    function trackPassEvent() { sendEvent('region_gate_pass', { country: country, reason: reason }); }

    function onDown(e) {
      if (done) return;
      dragging = true;
      startX = (e.touches ? e.touches[0].clientX : e.clientX) - x;
      thumb.style.transition = 'none';
      fill.style.transition = 'none';
      if (thumb.setPointerCapture && e.pointerId != null) {
        try { thumb.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging || done) return;
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      setX(cx - startX);
      if (x >= max - 1) { dragging = false; pass(); }
      e.preventDefault();
    }
    function onUp() {
      if (!dragging || done) return;
      dragging = false;
      if (x < max - 1) {
        thumb.style.transition = 'transform .18s';
        fill.style.transition = 'width .18s';
        setX(0);
      }
    }

    thumb.addEventListener('pointerdown', onDown);
    thumb.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchend', onUp);

    // 键盘可达：方向键 / 回车也可完成
    thumb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { setX(x + (max / 4)); e.preventDefault(); if (x >= max - 1) pass(); }
      else if (e.key === 'Enter' || e.key === ' ') { pass(); e.preventDefault(); }
    });
  }

  /* ---------- 启动 ---------- */
  var CKEY = 'kyhs_region_gate_country';
  function cachedCountry() {
    try {
      var o = JSON.parse(ls.getItem(CKEY) || '{}');
      if (o && o.e > Date.now() && o.c) return o.c;
    } catch (e) {}
    return '';
  }
  function saveCountry(c) {
    try { ls.setItem(CKEY, JSON.stringify({ c: c, e: Date.now() + 6 * 36e5 })); } catch (e) {}
  }

  function boot() {
    if (DEBUG === 'off') return;
    if (DEBUG === 'cn') return gate('CN', 'debug');
    if (passed()) return;

    var c0 = cachedCountry();
    if (c0) {
      if (CFG.countries.indexOf(c0) > -1) gate(c0, 'cache');
      return;
    }

    detect(function (country, reason) {
      if (country) saveCountry(country);
      if (CFG.countries.indexOf(country) > -1) return gate(country, 'ip');
      if (!country && CFG.tzFallback && tzHint()) return gate('', 'tz');
    });
  }

  window.KYHS_GATE = {
    reset: function () {
      try { ls.setItem(KEY, '0'); ls.setItem(CKEY, ''); } catch (e) {}
      location.reload();
    },
    show: function () { gate('CN', 'manual'); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
