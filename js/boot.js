// Runs in <head> before first paint: language, motion preference and the intro
// curtain settle without a flash. If main.js never runs (blocked, offline, error),
// the safety timer strips the .js class so every section stays visible.
(function () {
  var d = document.documentElement;
  d.classList.add('js');

  function get(store, k) { try { return window[store].getItem(k); } catch (_) { return null; } }
  function set(store, k, v) { try { window[store].setItem(k, v); } catch (_) {} }

  var lang = get('localStorage', 'lang');
  if (lang !== 'en' && lang !== 'id') {
    var nav = (navigator.language || 'en').toLowerCase();
    lang = nav.indexOf('id') === 0 || nav.indexOf('ms') === 0 ? 'id' : 'en';
  }
  d.setAttribute('lang', lang);

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  if (!reduced && !location.hash && !get('sessionStorage', 'intro')) {
    d.classList.add('intro');
    set('sessionStorage', 'intro', '1');
  }

  window.setTimeout(function () {
    if (!d.classList.contains('ready')) d.classList.remove('js', 'intro');
  }, 3000);
})();
