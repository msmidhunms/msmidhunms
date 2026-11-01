/* Theme: chosen theme, else the device setting. Adds a switch button to the top navigation.
   The choice is saved in localStorage and also carried in internal links (?theme=),
   because some browsers keep storage separate per page (for example when opening files locally). */
(function () {
  var root = document.documentElement, KEY = 'theme';
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }
  function system() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function apply(t) { root.setAttribute('data-theme', t); }
  var chosen = null;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    if (q === 'light' || q === 'dark') { chosen = q; save(q); }
  } catch (e) {}
  chosen = chosen || saved();
  apply(chosen || system());
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!chosen) { apply(system()); document.dispatchEvent(new Event('themechange')); } };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  function label(btn) {
    var dark = root.getAttribute('data-theme') === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.title = btn.getAttribute('aria-label');
  }
  function isInternal(a) {
    var h = a.getAttribute('href') || '';
    if (!h || h.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(h)) return false;
    if (/^[a-z]+:\/\//i.test(h)) return a.host === location.host && a.protocol === location.protocol;
    return /(\/|\.html)(#.*)?$/.test(h) || h === './' || h === '../';
  }
  function tagLinks() {
    if (!chosen) return;
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (!isInternal(a)) return;
      var h = a.getAttribute('href').replace(/([?&])theme=(light|dark)&?/, '$1').replace(/[?&]$/, '');
      var hash = '', i = h.indexOf('#'); if (i >= 0) { hash = h.slice(i); h = h.slice(0, i); }
      a.setAttribute('href', h + (h.indexOf('?') >= 0 ? '&' : '?') + 'theme=' + chosen + hash);
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    tagLinks();
    var ul = document.querySelector('nav.top ul');
    if (!ul) return;
    var li = document.createElement('li'), btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'theme-btn'; label(btn);
    btn.addEventListener('click', function () {
      chosen = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(chosen); save(chosen); label(btn); tagLinks();
      document.dispatchEvent(new Event('themechange'));
    });
    li.appendChild(btn); ul.appendChild(li);
  });
})();
