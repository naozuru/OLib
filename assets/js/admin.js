/**
 * Shared helpers for admin pages (needs config.js, api.js, ui.js loaded first).
 * Admin pages live in /admin, so links are relative to that folder.
 */
const Admin = (function () {
  const NAV = [
    { key: 'dashboard', href: 'index.html', ic: 'layout-dashboard', label: 'Dashboard' },
    { key: 'books', href: 'books.html', ic: 'book-open', label: 'Books' },
    { key: 'members', href: 'members.html', ic: 'users', label: 'Members' },
    { key: 'promotion', href: 'promotion.html', ic: 'graduation-cap', label: 'Year-end promotion' },
    { key: 'loans', href: 'loans.html', ic: 'arrow-left-right', label: 'Loans' },
    { key: 'reservations', href: 'reservations.html', ic: 'bookmark', label: 'Reservations' },
    { key: 'late', href: 'loans.html?filter=late', ic: 'triangle-alert', label: 'Overdue' },
    { key: 'reports', href: 'reports.html', ic: 'trending-up', label: 'Reports' },
    { key: 'stars', href: '../leaderboard.html', ic: 'trophy', label: 'Reading stars' },
    { key: 'settings', href: 'settings.html', ic: 'settings', label: 'Settings' }
  ];
  const USER_KEY = 'lib_user';

  function getUser() {
    try { return sessionStorage.getItem(USER_KEY) || 'Admin'; } catch (e) { return 'Admin'; }
  }

  /** Call at the top of every admin page. Redirects to the login page when not signed in. */
  function guard() {
    if (!API.getToken()) { location.replace('login.html'); return false; }
    API.onSessionExpired = function () { location.replace('login.html?expired=1'); };
    return true;
  }

  async function logout() {
    try { await API.post('logout'); } catch (e) { /* sign out anyway */ }
    API.clearToken();
    try { sessionStorage.removeItem(USER_KEY); sessionStorage.removeItem('lib_default_pw'); } catch (e) { /* ignore */ }
    location.replace('login.html');
  }

  /** Fill the sidebar, top bar and footer. active = menu key, title = page title */
  function mountShell(active, title) {
    document.title = title + ' - ' + CONFIG.SCHOOL_NAME + ' ' + CONFIG.LIB_NAME + ' Admin';
    UI.applyBranding();
    const nav = NAV.map(function (n) {
      return '<a href="' + n.href + '"' + (n.key === active ? ' aria-current="page"' : '') + '>' +
        UI.icon(n.ic, 20) + '<span>' + n.label + '</span></a>';
    }).join('');

    document.getElementById('sidebar').innerHTML =
      '<a class="side-brand" href="index.html">' + UI.brandMark() +
      '<span>' + UI.esc(CONFIG.LIB_NAME) + '<small>' + UI.esc(CONFIG.SCHOOL_NAME) + '</small></span></a>' +
      '<nav class="side-nav" aria-label="Admin menu">' + nav + '</nav>' +
      '<div class="side-foot"><a href="../index.html">' + UI.icon('external-link', 20) + '<span>View student site</span></a></div>';

    const name = getUser();
    document.getElementById('topbar').innerHTML =
      '<button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open menu">' + UI.icon('menu', 20) + '</button>' +
      '<h1>' + UI.esc(title) + '</h1>' +
      '<div class="user-chip"><span class="avatar">' + UI.esc(name.charAt(0).toUpperCase()) + '</span>' +
      '<span class="user-name">' + UI.esc(name) + '</span></div>' +
      '<button class="icon-btn" id="themeBtn" type="button">' + UI.icon(UI.themeIcon(), 18) + '</button>' +
      '<button class="btn btn-outline btn-sm" id="logoutBtn" type="button">' + UI.icon('log-out', 18) + 'Sign out</button>';
    UI.bindThemeButton(document.getElementById('themeBtn'));

    if (!document.querySelector('.admin-main .site-footer')) {
      document.querySelector('.admin-main').insertAdjacentHTML('beforeend',
        '<footer class="site-footer">' + UI.footerHTML() + '</footer>');
    }

    const close = function () { document.body.classList.remove('nav-open'); };
    document.getElementById('menuBtn').onclick = function () { document.body.classList.toggle('nav-open'); };
    document.getElementById('scrim').onclick = close;
    document.getElementById('logoutBtn').onclick = logout;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /**
   * <dialog>-based modal.
   * opt: { title, html, submit, danger, narrow, wide, noSubmit, onSubmit(data), onOpen(dialog) }
   * onSubmit may throw an Error: the message is shown inside the modal and the modal stays open.
   * noSubmit: read-only modal with a single Close button.
   * Returns Promise<boolean> (true when saved).
   */
  function modal(opt) {
    return new Promise(function (resolve) {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal' + (opt.narrow ? ' narrow' : '') + (opt.wide ? ' wide' : '');
      dlg.innerHTML =
        '<form class="modal-form">' +
          '<div class="modal-head"><h2>' + UI.esc(opt.title) + '</h2>' +
            '<button type="button" class="icon-btn" data-close aria-label="Close">' + UI.icon('x', 18) + '</button></div>' +
          '<div class="modal-body">' + (opt.html || '') + '<div class="form-error" hidden></div></div>' +
          '<div class="modal-foot"><button type="button" class="btn btn-outline" data-close>' + (opt.noSubmit ? 'Close' : 'Cancel') + '</button>' +
            (opt.noSubmit ? '' : '<button type="submit" class="btn ' + (opt.danger ? 'btn-danger' : 'btn-primary') + '">' + UI.esc(opt.submit || 'Save') + '</button>') +
          '</div>' +
        '</form>';
      document.body.appendChild(dlg);

      const form = dlg.querySelector('form');
      const err = dlg.querySelector('.form-error');
      const btn = dlg.querySelector('button[type=submit]');
      let result = false;

      dlg.addEventListener('close', function () { dlg.remove(); resolve(result); });
      Array.prototype.forEach.call(dlg.querySelectorAll('[data-close]'), function (b) { b.onclick = function () { dlg.close(); }; });

      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        if (!btn) return;
        err.hidden = true;
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
          await opt.onSubmit(Object.fromEntries(new FormData(form)));
          result = true;
          dlg.close();
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
          btn.disabled = false; btn.textContent = label;
        }
      });

      if (opt.onOpen) opt.onOpen(dlg);
      dlg.showModal();
      const first = dlg.querySelector('input:not([type=hidden]), textarea, select');
      if (first) first.focus();
    });
  }

  /** Confirmation dialog. opt: { title, text (HTML, escape it yourself), submit, danger, action() } -> Promise<boolean> */
  function confirmBox(opt) {
    return modal({
      title: opt.title, narrow: true, submit: opt.submit || 'Yes, continue', danger: opt.danger,
      html: '<p>' + opt.text + '</p>', onSubmit: opt.action
    });
  }

  /* ---------- History modals ---------- */

  function tile(value, label) {
    return '<div class="mini"><b>' + UI.esc(value === null || value === undefined ? '-' : value) + '</b><span>' + label + '</span></div>';
  }

  function loanStatusCell(l) {
    if (l.status === 'Borrowed') return UI.loanBadge(l);
    return '<span class="badge muted">Returned</span>' + (l.days_late > 0 ? ' <span class="badge warn">' + l.days_late + 'd late</span>' : '');
  }

  function statsHtml(s, extra) {
    return '<div class="mini-stats">' +
      tile(s.total, 'Total loans') + tile(s.borrowed_now, 'Borrowed now') + tile(s.late_returns, 'Returned late') +
      tile(s.avg_days_kept === null ? '-' : s.avg_days_kept + ' d', 'Avg. days kept') + (extra || '') + '</div>';
  }

  function loansTable(loans, who) {
    if (!loans.length) return '<p class="empty-note">No loans recorded yet.</p>';
    return '<div class="table-scroll"><table class="tbl" style="min-width:560px"><thead><tr><th>' + (who ? 'Borrower' : 'Book') +
      '</th><th>Borrowed</th><th>Due</th><th>Returned</th><th>Status</th></tr></thead><tbody>' +
      loans.map(function (l) {
        const first = who
          ? '<div class="cell-person"><b>' + UI.esc(l.nama || '(deleted student)') + '</b><small>' + UI.esc([l.nis, l.kelas].filter(Boolean).join(', ')) + '</small></div>'
          : '<b style="font-weight:600">' + UI.esc(l.judul) + '</b>';
        return '<tr><td>' + first + '</td><td class="nowrap">' + UI.fmtDate(l.tgl_pinjam) + '</td><td class="nowrap">' +
          UI.fmtDate(l.tgl_jatuh_tempo) + '</td><td class="nowrap">' + UI.fmtDate(l.tgl_kembali) + '</td><td>' + loanStatusCell(l) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function resList(list, who) {
    if (!list.length) return '<p class="empty-note">No reservations.</p>';
    return list.map(function (r) {
      return '<div class="row"><div class="grow"><b>' + UI.esc(who ? r.nama : r.judul) + '</b><small>Reserved ' + UI.fmtDate(r.tgl_dibuat) +
        (r.tgl_selesai ? ', closed ' + UI.fmtDate(r.tgl_selesai) : '') + '</small></div>' + UI.resBadge(r) + '</div>';
    }).join('');
  }

  async function openHistory(title, loader, render) {
    let data;
    try { data = await loader(); } catch (e) { UI.toast(e.message, 'error'); return; }
    await modal({ title: title, wide: true, noSubmit: true, html: render(data) });
  }

  function showMemberHistory(id) {
    return openHistory('Member history', function () { return API.post('memberHistory', { id: id }); }, function (d) {
      const m = d.member;
      return '<div class="hist-head"><div><h3>' + UI.esc(m.nama) + '</h3><p class="muted-text">' +
        UI.esc(['ID ' + m.nis, m.type === 'Teacher' ? 'Teacher' : '', m.kelas ? (m.type === 'Teacher' ? m.kelas : 'Class ' + m.kelas) : '', m.jenjang].filter(Boolean).join(', ')) + '</p></div>' +
        (m.status === 'Graduated' ? '<span class="badge muted">Archived ' + UI.esc(m.lulus_tahun) + '</span>' : '<span class="badge ok">Active</span>') + '</div>' +
        statsHtml(d.stats) +
        '<div class="hist-section"><h4>Loans</h4>' + loansTable(d.loans, false) + '</div>' +
        '<div class="hist-section"><h4>Reservations</h4>' + resList(d.reservations, false) + '</div>';
    });
  }

  function showBookHistory(id) {
    return openHistory('Book history', function () { return API.post('bookHistory', { id: id }); }, function (d) {
      const b = d.book;
      return '<div class="hist-head"><div><h3>' + UI.esc(b.judul) + '</h3><p class="muted-text">' +
        UI.esc([b.penulis, b.kategori].filter(Boolean).join(', ') || 'No details') + '</p></div>' +
        UI.availBadge(b) + '</div>' +
        statsHtml(d.stats, tile(d.stats.unique_borrowers, 'Different borrowers') + tile(d.stats.waiting, 'Waiting in queue')) +
        '<div class="hist-section"><h4>Loans</h4>' + loansTable(d.loans, true) + '</div>' +
        '<div class="hist-section"><h4>Reservations</h4>' + resList(d.reservations, true) + '</div>';
    });
  }

  return {
    guard: guard, logout: logout, mountShell: mountShell, modal: modal, confirm: confirmBox, getUser: getUser,
    showMemberHistory: showMemberHistory, showBookHistory: showBookHistory
  };
})();
