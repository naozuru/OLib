/**
 * Shared UI helpers (student and admin pages).
 * Icons: Iconify (Lucide set). ALL icons use ONE colour through the CSS variable --icon.
 */
const UI = (function () {
  const COVER_COLORS = ['#4338CA', '#0E7490', '#9D2B6B', '#3F6B45', '#B45309', '#334155', '#6D28D9', '#9F1239'];

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function icon(name, size) {
    size = size || 18;
    return '<iconify-icon icon="lucide:' + name + '" width="' + size + '" height="' + size + '" aria-hidden="true"></iconify-icon>';
  }

  function hash(s) {
    let h = 0;
    String(s).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) | 0; });
    return Math.abs(h);
  }

  function coverColor(b) { return COVER_COLORS[hash(b.judul) % COVER_COLORS.length]; }

  /** Book cover. Falls back to a generated cover with the title when there is no image. size: '', 'sm', 'lg' */
  function cover(b, size) {
    const img = b.cover_url
      ? '<img src="' + esc(b.cover_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">'
      : '';
    return '<div class="cover ' + (size || '') + '" style="--c:' + coverColor(b) + '">' + img +
      '<span class="cover-title">' + esc(b.judul) + '</span>' +
      '<span class="cover-author">' + esc(b.penulis || '') + '</span></div>';
  }

  /** Book spine for the shelf illustration on the home page */
  function spine(b, i) {
    const h = 130 + (hash(b.judul) % 60);
    const w = 36 + (hash(b.penulis || b.judul) % 14);
    return '<a class="spine" href="book.html?id=' + encodeURIComponent(b.id) + '" title="' + esc(b.judul) +
      '" style="--c:' + coverColor(b) + ';--h:' + h + 'px;--w:' + w + 'px;--i:' + i + '"><span>' + esc(b.judul) + '</span></a>';
  }

  function availBadge(b) {
    const n = Number(b.stok_tersedia);
    return n > 0
      ? '<span class="badge ok">Available ' + n + '</span>'
      : '<span class="badge bad">On loan</span>';
  }

  /** Badge for an active or returned loan (uses time_status, days_left, days_late from the API) */
  function loanBadge(l) {
    const plural = function (n) { return n + (n === 1 ? ' day' : ' days'); };
    switch (l.time_status) {
      case 'late': return '<span class="badge bad">Overdue ' + plural(l.days_late) + '</span>';
      case 'due_today': return '<span class="badge warn">Due today</span>';
      case 'soon': return '<span class="badge warn">' + plural(l.days_left) + ' left</span>';
      case 'ok': return '<span class="badge ok">' + plural(l.days_left) + ' left</span>';
      default: return '<span class="badge muted">Returned</span>';
    }
  }

  /** Badge for a reservation record */
  function resBadge(r) {
    switch (r.status) {
      case 'Ready': return '<span class="badge ok">Ready for pickup</span>';
      case 'Waiting': return '<span class="badge">Queue #' + (r.position || '?') + '</span>';
      case 'Fulfilled': return '<span class="badge ok">Picked up</span>';
      case 'Expired': return '<span class="badge warn">Expired</span>';
      default: return '<span class="badge muted">' + esc(r.status) + '</span>';
    }
  }

  function parseDate(s) {
    const p = String(s).split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / 86400000); }

  function locale() { return window.I18N && I18N.locale ? I18N.locale() : 'en-GB'; }

  function fmtDate(s) {
    if (!s) return '-';
    return new Date(parseDate(s)).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  /** '2026-10' -> "Oct 26" */
  function fmtMonth(ym) {
    const p = ym.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString(locale(), { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }

  function rupiah(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /** Empty / error / info block */
  function state(o) {
    return '<div class="state span-all"><div class="state-icon">' + icon(o.icon || 'info', 26) + '</div>' +
      '<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') + (o.action || '') + '</div>';
  }

  function toast(msg, type) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 250); }, 3600);
  }

  /* ---------- CSV ---------- */

  /** Parse CSV text (comma, semicolon or tab separated, quotes supported) into an array of rows. */
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const count = function (ch) { return first.split(ch).length; };
    const delim = count(';') > count(',') ? ';' : (count('\t') > count(',') ? '\t' : ',');
    const rows = [];
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  /** Download a CSV file. rows = array of arrays (first row = headers). Opens correctly in Excel (UTF-8 BOM). */
  function downloadCSV(filename, rows) {
    const cell = function (v) {
      v = String(v === null || v === undefined ? '' : v);
      return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const csv = '\uFEFF' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ---------- Branding: logo slot, page titles, theme button ---------- */

  /** Relative asset paths work from both the site root and the /admin folder. */
  function assetUrl(p) {
    if (!p) return '';
    if (/^(https?:|data:|\/)/i.test(p)) return p;
    return (location.pathname.indexOf('/admin/') > -1 ? '../' : '') + p;
  }

  function logoFallback(img) {
    const mark = img.parentNode;
    if (mark && mark.classList) mark.classList.remove('has-logo');
    img.outerHTML = icon('book-open', 22);
  }

  /** The logo from config.js when set, otherwise the book icon. */
  function brandMark() {
    if (CONFIG.LOGO_URL) {
      return '<span class="brand-mark has-logo"><img class="brand-logo" src="' + esc(assetUrl(CONFIG.LOGO_URL)) +
        '" alt="' + esc(CONFIG.SCHOOL_NAME) + ' logo" onerror="UI.logoFallback(this)"></span>';
    }
    return '<span class="brand-mark">' + icon('book-open', 22) + '</span>';
  }

  function setTitle(page) { document.title = page + ' - ' + CONFIG.SCHOOL_NAME + ' ' + CONFIG.LIB_NAME; }

  function applyBranding() {
    const url = CONFIG.FAVICON_URL || CONFIG.LOGO_URL;
    if (!url) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = assetUrl(url);
  }

  function themeIcon() { return window.Theme && Theme.current() === 'dark' ? 'sun' : 'moon'; }

  /** Makes a button toggle light/dark. The button must contain an iconify-icon element. */
  function bindThemeButton(btn) {
    if (!btn) return;
    const label = function () { return window.Theme && Theme.current() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; };
    btn.setAttribute('aria-label', label()); btn.title = label();
    btn.addEventListener('click', function () {
      if (!window.Theme) return;
      Theme.toggle();
      const ic = btn.querySelector('iconify-icon');
      if (ic) ic.setAttribute('icon', 'lucide:' + themeIcon());
      btn.setAttribute('aria-label', label()); btn.title = label();
    });
  }

  /* ---------- Page chrome (student pages) ---------- */

  function footerHTML() {
    return '<div class="wrap footer-row"><span>' + esc(CONFIG.SCHOOL_NAME) + ' ' + esc(CONFIG.LIB_NAME) + '</span>' +
      '<span>Copyright by NaoZuru (Mr. Rayhan)</span></div>';
  }

  /** Header and footer of student pages. active: 'catalog' | 'status' | 'stars' */
  function mountChrome(active) {
    applyBranding();
    const TITLES = { catalog: 'Book Catalog', status: 'My Loans', stars: 'Reading Stars' };
    if (TITLES[active]) setTitle(TITLES[active]);
    const items = [
      { key: 'catalog', href: 'index.html', ic: 'library', label: 'Catalog' },
      { key: 'stars', href: 'leaderboard.html', ic: 'trophy', label: 'Reading stars' },
      { key: 'status', href: 'status.html', ic: 'clock', label: 'My loans' }
    ];
    const nav = items.map(function (i) {
      return '<a href="' + i.href + '" title="' + i.label + '"' + (i.key === active ? ' aria-current="page"' : '') + '>' +
        icon(i.ic, 18) + '<span class="lbl">' + i.label + '</span></a>';
    }).join('') +
      '<a href="admin/login.html" title="Admin sign in">' + icon('lock', 18) + '<span class="lbl">Admin</span></a>' +
      '<div class="tools">' +
        (window.I18N ? '<button class="lang-btn" id="langBtn" type="button" title="Language / Bahasa" aria-label="Change language">' +
          '<span class="' + (I18N.lang() === 'en' ? 'on' : '') + '">EN</span><span class="' + (I18N.lang() === 'id' ? 'on' : '') + '">ID</span></button>' : '') +
        '<button class="hbtn" id="themeBtn" type="button">' + icon(themeIcon(), 18) + '</button>' +
      '</div>';

    const header = document.getElementById('site-header');
    if (header) {
      header.innerHTML = '<div class="wrap bar">' +
        '<a class="brand" href="index.html">' + brandMark() +
        '<span>' + esc(CONFIG.LIB_NAME) + '<small>' + esc(CONFIG.SCHOOL_NAME) + '</small></span></a>' +
        '<nav class="nav" aria-label="Main menu">' + nav + '</nav></div>';
      bindThemeButton(document.getElementById('themeBtn'));
      const lb = document.getElementById('langBtn');
      if (lb) lb.addEventListener('click', function () { I18N.toggle(); });
    }
    const footer = document.getElementById('site-footer');
    if (footer) footer.innerHTML = footerHTML();
  }

  return {
    esc: esc, icon: icon, cover: cover, spine: spine, availBadge: availBadge, loanBadge: loanBadge, resBadge: resBadge,
    diffDays: diffDays, fmtDate: fmtDate, fmtMonth: fmtMonth, rupiah: rupiah, debounce: debounce, state: state,
    toast: toast, parseCSV: parseCSV, downloadCSV: downloadCSV, mountChrome: mountChrome, footerHTML: footerHTML,
    brandMark: brandMark, logoFallback: logoFallback, setTitle: setTitle, applyBranding: applyBranding,
    themeIcon: themeIcon, bindThemeButton: bindThemeButton, assetUrl: assetUrl
  };
})();
