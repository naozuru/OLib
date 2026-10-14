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

  function fmtDate(s) {
    if (!s) return '-';
    return new Date(parseDate(s)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  /** '2026-10' -> "Oct 26" */
  function fmtMonth(ym) {
    const p = ym.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
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

  /* ---------- Page chrome (student pages) ---------- */

  function footerHTML() {
    return '<div class="wrap footer-row"><span>' + esc(CONFIG.LIB_NAME) + ' ' + esc(CONFIG.SCHOOL_NAME) + '</span>' +
      '<span>Copyright by NaoZuru (Mr. Rayhan)</span></div>';
  }

  /** Header and footer of student pages. active: 'catalog' | 'status' */
  function mountChrome(active) {
    const items = [
      { key: 'catalog', href: 'index.html', ic: 'library', label: 'Catalog' },
      { key: 'status', href: 'status.html', ic: 'clock', label: 'My loans' }
    ];
    const nav = items.map(function (i) {
      return '<a href="' + i.href + '" title="' + i.label + '"' + (i.key === active ? ' aria-current="page"' : '') + '>' +
        icon(i.ic, 18) + '<span class="lbl">' + i.label + '</span></a>';
    }).join('') +
      '<a href="admin/login.html" title="Admin sign in">' + icon('lock', 18) + '<span class="lbl">Admin</span></a>';

    const header = document.getElementById('site-header');
    if (header) {
      header.innerHTML = '<div class="wrap bar">' +
        '<a class="brand" href="index.html"><span class="brand-mark">' + icon('book-open', 22) + '</span>' +
        '<span>' + esc(CONFIG.LIB_NAME) + '<small>' + esc(CONFIG.SCHOOL_NAME) + '</small></span></a>' +
        '<nav class="nav" aria-label="Main menu">' + nav + '</nav></div>';
    }
    const footer = document.getElementById('site-footer');
    if (footer) footer.innerHTML = footerHTML();
  }

  return {
    esc: esc, icon: icon, cover: cover, spine: spine, availBadge: availBadge, loanBadge: loanBadge, resBadge: resBadge,
    diffDays: diffDays, fmtDate: fmtDate, fmtMonth: fmtMonth, rupiah: rupiah, debounce: debounce, state: state,
    toast: toast, parseCSV: parseCSV, downloadCSV: downloadCSV, mountChrome: mountChrome, footerHTML: footerHTML
  };
})();
