// Injected into every page while capturing. Draws the visible cursor, click ripple,
// step caption and highlight box, and blurs any selectors listed in blurSelectors.
// Everything lives in shadow roots so the app's CSS can't affect it.
function __docInit(opts) {
  if (window.__doc) return;
  var Z = 2147483647;
  var hosts = {};

  function host(id) {
    var existing = hosts[id];
    if (existing && existing.isConnected) return existing.shadowRoot;
    var root = document.documentElement;
    if (!root) return null;
    var el = document.createElement('div');
    el.id = id;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:' + Z + ';';
    el.attachShadow({ mode: 'open' });
    root.appendChild(el);
    hosts[id] = el;
    return el.shadowRoot;
  }

  // ---- blur sensitive content -------------------------------------------
  function addBlurStyle() {
    if (!opts.blurSelectors || !opts.blurSelectors.length) return;
    if (!document.documentElement) return requestAnimationFrame(addBlurStyle);
    var s = document.createElement('style');
    s.id = '__doc-blur';
    s.textContent = opts.blurSelectors.join(',\n') + ' { filter: blur(6px) !important; }';
    document.documentElement.appendChild(s);
  }
  addBlurStyle();

  // ---- cursor -------------------------------------------------------------
  var pos = null;
  try { pos = JSON.parse(sessionStorage.getItem('__docCursor') || 'null'); } catch (e) {}
  if (!pos) pos = { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) };

  var CURSOR_SVG =
    '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5l15 11.2-6.6.9 3.9 7.4-3 1.5-3.8-7.5L4.6 20z" ' +
    'fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  function cursorRoot() {
    if (!opts.cursor) return null;
    var sr = host('__doc-cursor');
    if (!sr) return null;
    if (!sr.getElementById('c')) {
      sr.innerHTML =
        '<style>' +
        '#c{position:fixed;left:0;top:0;width:26px;height:26px;margin:-3px 0 0 -4px;' +
        'filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));will-change:transform}' +
        '.r{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;' +
        'background:rgba(' + opts.accentRgb + ',.28);border:2px solid rgba(' + opts.accentRgb + ',.9);' +
        'animation:rp .6s ease-out forwards}' +
        '@keyframes rp{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}' +
        '</style><div id="c">' + CURSOR_SVG + '</div>';
    }
    return sr;
  }

  function place() {
    var sr = cursorRoot();
    if (!sr) return;
    sr.getElementById('c').style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
  }

  function ripple(x, y) {
    var sr = cursorRoot();
    if (!sr) return;
    var r = document.createElement('div');
    r.className = 'r';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    sr.appendChild(r);
    setTimeout(function () { r.remove(); }, 700);
  }

  addEventListener('mousemove', function (e) {
    pos = { x: e.clientX, y: e.clientY };
    place();
    try { sessionStorage.setItem('__docCursor', JSON.stringify(pos)); } catch (err) {}
  }, true);
  addEventListener('mousedown', function (e) { ripple(e.clientX, e.clientY); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();

  // ---- caption + highlight ---------------------------------------------------
  var api = {
    caption: function (n, text) {
      if (!opts.captions) return;
      var sr = host('__doc-caption');
      if (!sr) return;
      sr.innerHTML =
        '<style>' +
        '.cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;' +
        'max-width:80vw;padding:12px 20px 12px 12px;border-radius:999px;background:rgba(17,24,39,.92);color:#fff;' +
        'font:600 17px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);' +
        'animation:in .3s ease-out}' +
        '.n{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;' +
        'background:' + opts.accentColor + ';font-size:15px}' +
        '@keyframes in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}' +
        '</style><div class="cap"><span class="n"></span><span class="t"></span></div>';
      sr.querySelector('.n').textContent = String(n);
      sr.querySelector('.t').textContent = text;
    },
    hideCaption: function () {
      var sr = host('__doc-caption');
      if (sr) sr.innerHTML = '';
    },
    highlight: function (el) {
      var sr = host('__doc-hl');
      if (!sr || !el) return;
      var r = el.getBoundingClientRect();
      var pad = 6;
      var spotlight = opts.highlightStyle === 'spotlight' ? ',0 0 0 9999px rgba(15,23,42,.45)' : '';
      sr.innerHTML =
        '<style>.b{position:fixed;border:3px solid ' + opts.accentColor + ';border-radius:10px;' +
        'box-shadow:0 0 0 5px rgba(' + opts.accentRgb + ',.22)' + spotlight + ';animation:hl .25s ease-out}' +
        '@keyframes hl{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}</style><div class="b"></div>';
      var b = sr.querySelector('.b');
      b.style.left = (r.left - pad) + 'px';
      b.style.top = (r.top - pad) + 'px';
      b.style.width = (r.width + pad * 2) + 'px';
      b.style.height = (r.height + pad * 2) + 'px';
    },
    clearHighlight: function () {
      var sr = host('__doc-hl');
      if (sr) sr.innerHTML = '';
    },
  };
  window.__doc = api;
}
