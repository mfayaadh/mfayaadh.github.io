// Interaction layer: language toggle, ransom-note headings, scroll reveals,
// full-screen menu, slash-wipe page transitions, title parallax and card tilt.
// Plain ES2017, no dependencies. Everything degrades to a readable static page.
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('ready');

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  var finePointer = false;
  try { finePointer = window.matchMedia('(pointer: fine)').matches; } catch (_) {}

  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Stagger indices for CSS
  $$('.menu__list li').forEach(function (li, i) { li.style.setProperty('--i', i); });
  $$('.equip__row').forEach(function (row, i) { row.style.setProperty('--i', i); });
  $$('.select__hd .w > span, .select__hd small').forEach(function (el, i) { el.style.setProperty('--k', i); });

  if (doc.classList.contains('intro')) {
    window.setTimeout(function () { doc.classList.remove('intro'); }, 1800);
  }

  /* ---------- HUD date ---------- */
  (function () {
    var now = new Date();
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    var day = document.getElementById('hud-day');
    var mon = document.getElementById('hud-month');
    var dow = document.getElementById('hud-dow');
    if (day) day.textContent = String(now.getDate());
    if (mon) mon.textContent = months[now.getMonth()];
    if (dow) dow.textContent = days[now.getDay()];
  })();

  /* ---------- Language ---------- */
  var langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      var next = doc.getAttribute('lang') === 'id' ? 'en' : 'id';
      doc.setAttribute('lang', next);
      try { localStorage.setItem('lang', next); } catch (_) {}
    });
  }

  /* ---------- Ransom-note headings ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  $$('[data-ransom]').forEach(function (el) {
    var src = el.getAttribute('data-ransom');
    var rand = rng(hash(src));
    var plain = src.replace(/\|/g, ' ');
    var frag = document.createDocumentFragment();

    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = plain;
    frag.appendChild(sr);

    var idx = 0;
    var prev = -1;
    src.split('|').forEach(function (line) {
      var lineEl = document.createElement('span');
      lineEl.className = 'ransom__line';
      lineEl.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(line, function (ch, ci) {
        var s = document.createElement('span');
        if (ch === ' ') {
          s.className = 'rl rl--sp';
          lineEl.appendChild(s);
          return;
        }
        var v;
        do { v = Math.floor(rand() * 6); } while (v === prev);
        prev = v;
        var c = 1 + Math.floor(rand() * 3);
        var first = ci === 0;
        s.className = 'rl v' + v + ' c' + c;
        s.textContent = ch;
        s.style.setProperty('--r', ((rand() * 16) - 8).toFixed(1) + 'deg');
        s.style.setProperty('--y', ((rand() * .14) - .07).toFixed(2) + 'em');
        s.style.setProperty('--s', (first ? 1.18 + rand() * .12 : .86 + rand() * .22).toFixed(2));
        s.style.setProperty('--i', idx++);
        lineEl.appendChild(s);
      });
      frag.appendChild(lineEl);
    });

    el.textContent = '';
    el.appendChild(frag);
    el.classList.add('is-split');
  });

  /* ---------- Scroll reveal ---------- */
  var revealables = $$('.rv, .ransom.is-split, .mission');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Full-screen menu ---------- */
  var menu = document.getElementById('menu');
  var menuBtn = document.getElementById('menu-btn');

  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = menu.querySelector('a');
      if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu && menu.classList.contains('open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  /* ---------- Slash-wipe navigation ---------- */
  var wipe = document.getElementById('wipe');
  var busy = false;

  function jumpTo(target, hash) {
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    if (history.pushState) history.pushState(null, '', hash);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  $$('a[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var hash = a.getAttribute('href');
      var target = hash === '#top' ? document.getElementById('top') : document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      var fromMenu = menu && menu.classList.contains('open');

      if (reduced || !wipe || busy) {
        setMenu(false);
        jumpTo(target, hash);
        return;
      }
      busy = true;
      wipe.classList.remove('out');
      wipe.classList.add('go');
      window.setTimeout(function () {
        if (fromMenu) setMenu(false);
        jumpTo(target, hash);
        wipe.classList.remove('go');
        wipe.classList.add('out');
        window.setTimeout(function () { wipe.classList.remove('out'); busy = false; }, 520);
      }, 430);
    });
  });

  /* ---------- Title parallax ---------- */
  var title = document.querySelector('.title');
  if (title && finePointer && !reduced) {
    var layers = $$('[data-depth]', title);
    var px = 0, py = 0, raf = 0;
    title.addEventListener('pointermove', function (e) {
      var r = title.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(paint);
    });
    title.addEventListener('pointerleave', function () {
      px = 0; py = 0;
      if (!raf) raf = requestAnimationFrame(paint);
    });
    function paint() {
      raf = 0;
      layers.forEach(function (l) {
        var d = parseFloat(l.getAttribute('data-depth')) || 0;
        l.style.translate = (px * d * 36).toFixed(1) + 'px ' + (py * d * 22).toFixed(1) + 'px';
      });
    }
  }

  /* ---------- Card tilt ---------- */
  if (finePointer && !reduced) {
    $$('[data-tilt]').forEach(function (fig) {
      var card = fig.querySelector('.arcana__card');
      if (!card) return;
      fig.addEventListener('pointermove', function (e) {
        var r = fig.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ty', (x * 22).toFixed(1) + 'deg');
        card.style.setProperty('--tx', (-y * 18).toFixed(1) + 'deg');
      });
      fig.addEventListener('pointerleave', function () {
        card.style.setProperty('--ty', '0deg');
        card.style.setProperty('--tx', '0deg');
      });
    });
  }

  /* ---------- Shared screenshot lightbox & OLTuee gallery ---------- */
  (function () {
    var dialog = document.getElementById('shot-lightbox');
    var lbStage = document.getElementById('lb-stage');
    var lbCap = document.getElementById('lb-cap');
    var lbPrev = document.getElementById('lb-prev');
    var lbNext = document.getElementById('lb-next');
    var lbClose = document.getElementById('lb-close');

    var activeItems = [];
    var activeIndex = 0;
    var activeOnChange = null;

    function renderLightbox() {
      if (!lbStage || !lbCap || !activeItems.length) return;
      var item = activeItems[activeIndex];
      var isId = doc.getAttribute('lang') === 'id';
      var label = isId ? (item.id || item.en || '') : (item.en || item.id || '');
      lbCap.textContent = label + ' (' + (activeIndex + 1) + '/' + activeItems.length + ')';
      var img = lbStage.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        lbStage.appendChild(img);
      }
      img.src = item.src;
      img.alt = item.alt || '';
    }

    function stepLightbox(delta) {
      if (!activeItems.length) return;
      activeIndex = (activeIndex + delta + activeItems.length) % activeItems.length;
      if (typeof activeOnChange === 'function') activeOnChange(activeIndex);
      renderLightbox();
    }

    function openLightbox(items, idx, onChange) {
      if (!dialog || typeof dialog.showModal !== 'function' || !items.length) return false;
      activeItems = items;
      activeIndex = (idx + items.length) % items.length;
      activeOnChange = onChange || null;
      renderLightbox();
      dialog.showModal();
      return true;
    }

    if (dialog) {
      if (lbPrev) lbPrev.addEventListener('click', function () { stepLightbox(-1); });
      if (lbNext) lbNext.addEventListener('click', function () { stepLightbox(1); });
      if (lbClose) lbClose.addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (e) {
        if (e.target === dialog) dialog.close();
      });
      dialog.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') stepLightbox(-1);
        else if (e.key === 'ArrowRight') stepLightbox(1);
      });
    }

    // 1. OLTuee interactive thumbnail switcher + lightbox
    var thumbs = $$('#q-oltuee .quest__thumb');
    var mainImg = document.getElementById('oltuee-main-img');
    var previewLink = document.getElementById('oltuee-preview');
    var capEl = document.getElementById('oltuee-cap');
    if (thumbs.length && mainImg) {
      var oltueeIdx = 0;
      var oltueeItems = thumbs.map(function (btn) {
        return {
          src: btn.getAttribute('data-shot'),
          alt: btn.getAttribute('data-alt') || '',
          en: btn.getAttribute('data-en') || '',
          id: btn.getAttribute('data-id') || ''
        };
      });

      function selectOltueeShot(idx) {
        oltueeIdx = (idx + oltueeItems.length) % oltueeItems.length;
        var item = oltueeItems[oltueeIdx];
        mainImg.src = item.src;
        mainImg.alt = item.alt;
        if (previewLink) previewLink.href = item.src;
        if (capEl) {
          var capEn = capEl.querySelector('.l-en');
          var capId = capEl.querySelector('.l-id');
          if (capEn) capEn.textContent = item.en;
          if (capId) capId.textContent = item.id;
        }
        thumbs.forEach(function (t, i) {
          var on = i === oltueeIdx;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }

      thumbs.forEach(function (btn, idx) {
        btn.addEventListener('click', function () { selectOltueeShot(idx); });
      });

      if (previewLink) {
        previewLink.addEventListener('click', function (e) {
          if (openLightbox(oltueeItems, oltueeIdx, selectOltueeShot)) e.preventDefault();
        });
      }
    }

    // 2. Mission & Certificate galleries (Cakap, NexusPON, Certs)
    $$('[data-gallery]').forEach(function (gallery) {
      var links = $$('[data-shot-item]', gallery);
      if (!links.length) return;
      var items = links.map(function (a) {
        var img = a.querySelector('img');
        return {
          src: a.getAttribute('href'),
          alt: img ? img.alt : '',
          en: a.getAttribute('data-en') || '',
          id: a.getAttribute('data-id') || ''
        };
      });
      links.forEach(function (a, idx) {
        a.addEventListener('click', function (e) {
          if (openLightbox(items, idx)) e.preventDefault();
        });
      });

      if (gallery.id === 'cert-gallery') {
        $$('[data-open-cert]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            var idx = parseInt(btn.getAttribute('data-open-cert'), 10) || 0;
            if (openLightbox(items, idx)) e.preventDefault();
          });
        });
      }
    });
  })();
})();
