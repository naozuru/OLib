/**
 * =====================================================================
 *  SCHOOL LIBRARY - BACKEND (Google Apps Script + Google Sheets) v2
 * =====================================================================
 *  SETUP (details in README.md):
 *  1. Create a Google Spreadsheet -> Extensions > Apps Script.
 *  2. Paste this whole file into Code.gs.
 *  3. Project Settings -> Time zone: (GMT+07:00) Asia/Jakarta.
 *  4. Run setup() once (authorize when asked).
 *     Optional: run seedSampleData() for demo data.
 *  5. Deploy > New deployment > Web app
 *       Execute as : Me
 *       Who has access : Anyone
 *     Copy the Web App URL into assets/js/config.js in the frontend.
 *  6. First login: username "admin", password "admin123" (change it!).
 *
 *  UPGRADING FROM v1: paste this file over the old one, run setup() again
 *  (it keeps your data and only adds the new columns/sheets/settings),
 *  then deploy a NEW VERSION of the existing Web App.
 *
 *  API FORMAT
 *  - Every response is JSON: { ok: true, data: ... } or { ok: false, error: "..." }
 *  - GET  ?action=...           public read actions (catalog, my loans)
 *  - POST JSON body             { "action": "...", "token": "...", ...params }
 *    (send with Content-Type: text/plain to avoid a CORS preflight)
 *
 *  TECHNICAL NOTE: sheet column names and a few API field names (judul,
 *  penulis, nis, kelas, ...) are kept from v1 so existing data keeps working.
 *  All user-facing text is English.
 * =====================================================================
 */

const TZ = 'Asia/Jakarta';
const TOKEN_TTL = 21600; // 6 hours (max for CacheService)

// Values stored in the Loans sheet (kept from v1 for compatibility).
const ST_BORROWED = 'Dipinjam';
const ST_RETURNED = 'Dikembalikan';

const SHEETS = {
  Books:        ['id', 'judul', 'penulis', 'kategori', 'penerbit', 'tahun', 'isbn', 'stok_total', 'stok_tersedia', 'cover_url', 'deskripsi', 'tgl_ditambahkan'],
  Members:      ['id', 'nis', 'nama', 'kelas', 'jenjang', 'status', 'lulus_tahun', 'tipe'],
  Loans:        ['id', 'id_buku', 'id_anggota', 'tgl_pinjam', 'tgl_jatuh_tempo', 'tgl_kembali', 'status', 'perpanjangan'],
  Reservations: ['id', 'id_buku', 'id_anggota', 'tgl_dibuat', 'status', 'tgl_siap', 'tgl_kedaluwarsa', 'tgl_selesai'],
  Settings:     ['key', 'value'],
  Admins:       ['username', 'password_hash', 'nama']
};

// Columns stored as plain text (so Sheets does not convert IDs/ISBNs/dates).
const TEXT_COLS = {
  Books: ['tahun', 'isbn', 'tgl_ditambahkan'],
  Members: ['nis', 'lulus_tahun'],
  Loans: ['tgl_pinjam', 'tgl_jatuh_tempo', 'tgl_kembali'],
  Reservations: ['tgl_dibuat', 'tgl_siap', 'tgl_kedaluwarsa', 'tgl_selesai']
};

const DEFAULT_SETTINGS = {
  durasi_pinjam_default: 7,        // default loan length (days)
  maks_buku_per_siswa: 3,          // max books per student
  maks_perpanjangan: 1,            // max extensions per loan
  durasi_perpanjangan: 7,          // days added per extension
  denda_per_hari: 0,               // fine per late day (0 = no fines)
  hampir_jatuh_tempo_hari: 2,      // "due soon" threshold (days)
  maks_reservasi: 2,               // max active reservations per student
  masa_tahan_reservasi_hari: 3,    // days a reserved copy is held for pickup
  maks_buku_guru: 5,               // max books per teacher
  durasi_pinjam_guru: 14,          // default loan length for teachers (days)
  buku_baru_hari: 30,              // a book carries the "New" tag for this many days
  papan_peringkat_publik: 0,       // 1 = students can see the Reading stars page
  peringkat_nama_singkat: 1,       // 1 = public leaderboard shows "Aisyah P." instead of the full name
  tantangan_target_per_siswa: 2,   // class challenge goal: books per student per month
  tahun_ajaran_mulai_bulan: 7      // month the school year starts (7 = July)
};

// Reading levels are earned by the total number of books a member has returned.
const READING_LEVELS = [
  { name: 'Page Turner', min: 5 },
  { name: 'Bookworm', min: 15 },
  { name: 'Reading Star', min: 30 },
  { name: 'Library Legend', min: 60 }
];

/* ===================================================================
 *  SETUP
 * =================================================================== */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  Object.keys(SHEETS).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers]).setFontWeight('bold').setBackground('#EEF2FF');
    sh.setFrozenRows(1);
    (TEXT_COLS[name] || []).forEach(function (col) {
      const i = headers.indexOf(col) + 1;
      sh.getRange(2, i, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    });
  });

  // Remove the empty default sheet (Sheet1 / Lembar1)
  ss.getSheets().forEach(function (s) {
    if (!SHEETS[s.getName()] && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  // Add any missing settings (keeps existing values)
  const have = {};
  readAll_('Settings').forEach(function (r) { have[r.key] = true; });
  const missing = Object.keys(DEFAULT_SETTINGS).filter(function (k) { return !have[k]; });
  appendRows_('Settings', missing.map(function (k) { return { key: k, value: DEFAULT_SETTINGS[k] }; }));

  if (readAll_('Admins').length === 0) {
    appendRows_('Admins', [{ username: 'admin', password_hash: hashPassword_('admin123'), nama: 'Administrator' }]);
  }
  Logger.log('Setup complete. First login: admin / admin123 (change the password right away!).');
}

function seedSampleData() {
  const books = [
    ['Laskar Pelangi', 'Andrea Hirata', 'Novel', 'Bentang Pustaka', '2005', '9789793062792', 3, 'The story of ten children in Belitung fighting for an education.'],
    ['Bumi Manusia', 'Pramoedya Ananta Toer', 'Novel', 'Lentera Dipantara', '1980', '9789799731234', 2, 'A historical novel about Minke in the colonial era.'],
    ['Atomic Habits', 'James Clear', 'Self-development', 'Gramedia', '2019', '9786020633176', 2, 'How to build good habits and break bad ones.'],
    ['Fisika Dasar', 'Halliday & Resnick', 'Science', 'Erlangga', '2010', '9789790000001', 4, 'A physics reference book for senior high school students.'],
    ['Sejarah Indonesia Modern', 'M.C. Ricklefs', 'History', 'Serambi', '2008', '9789790000002', 2, 'Indonesian history from 1200 to the present.']
  ].map(function (b) {
    return { id: newId_('B'), judul: b[0], penulis: b[1], kategori: b[2], penerbit: b[3], tahun: b[4], isbn: b[5],
      stok_total: b[6], stok_tersedia: b[6], cover_url: '', deskripsi: b[7], tgl_ditambahkan: today_() };
  });
  appendRows_('Books', books);
  appendRows_('Members', [
    ['2024001', 'Aisyah Putri', 'X-A', 'SHS'], ['2024002', 'Budi Santoso', 'IX-B', 'JHS'], ['2024003', 'Citra Dewi', 'XI-C', 'SHS']
  ].map(function (m) {
    return { id: newId_('M'), nis: m[0], nama: m[1], kelas: m[2], jenjang: m[3], status: 'Active', lulus_tahun: '', tipe: 'Student' };
  }));
  appendRows_('Members', [{ id: newId_('M'), nis: '198001012005011001', nama: 'Andi Pratama, S.Pd.', kelas: 'Mathematics',
    jenjang: '', status: 'Active', lulus_tahun: '', tipe: 'Teacher' }]);
}

/** Optional: run once to sweep expired reservations every day around 01:00. */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyMaintenance') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyMaintenance').timeBased().everyDays(1).atHour(1).create();
}

function dailyMaintenance() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { sweepReservations_(); } finally { lock.releaseLock(); }
}

/* ===================================================================
 *  ENTRY POINTS & ROUTER
 * =================================================================== */

function doGet(e) {
  const req = e && e.parameter ? e.parameter : {};
  if (!req.action) return json_({ ok: true, data: 'School Library API is running' });
  return route_(req, false);
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request format' });
  }
  return route_(req, true);
}

const PUBLIC_READ = {
  listBooks: listBooks_,
  getBook: getBook_,
  listCategories: listCategories_,
  publicStats: publicStats_,
  memberStatus: memberStatus_,
  shelves: shelves_,
  leaderboard: leaderboard_
};

const PUBLIC_WRITE = {
  reserveBook: reserveBook_,
  cancelReservation: cancelReservation_
};

const ADMIN_ACTIONS = {
  dashboard: dashboard_,
  createBook: createBook_,
  updateBook: updateBook_,
  deleteBook: deleteBook_,
  importBooks: importBooks_,
  bookHistory: bookHistory_,
  listMembers: listMembers_,
  createMember: createMember_,
  updateMember: updateMember_,
  deleteMember: deleteMember_,
  importMembers: importMembers_,
  archiveMember: archiveMember_,
  restoreMember: restoreMember_,
  applyPromotion: applyPromotion_,
  memberHistory: memberHistory_,
  listLoans: listLoans_,
  createLoan: createLoan_,
  returnLoan: returnLoan_,
  extendLoan: extendLoan_,
  listReservations: listReservations_,
  adminCancelReservation: adminCancelReservation_,
  reports: reports_,
  leaderboardAdmin: leaderboardAdmin_,
  getSettings: getSettingsAction_,
  updateSettings: updateSettings_,
  changePassword: changePassword_
};

function route_(req, viaPost) {
  try {
    const action = String(req.action || '');

    if (PUBLIC_READ[action]) return json_({ ok: true, data: PUBLIC_READ[action](req) });
    if (!viaPost) throw new Error('This action must be sent with POST');

    if (PUBLIC_WRITE[action]) return json_({ ok: true, data: withLock_(function () { return PUBLIC_WRITE[action](req); }) });
    if (action === 'login') return json_({ ok: true, data: login_(req) });
    if (action === 'logout') { logout_(req); return json_({ ok: true, data: true }); }

    const user = requireAdmin_(req.token);
    const fn = ADMIN_ACTIONS[action];
    if (!fn) throw new Error('Unknown action: ' + action);
    return json_({ ok: true, data: withLock_(function () { return fn(req, user); }) });
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================================================================
 *  AUTH
 * =================================================================== */

function hashPassword_(pw, salt) {
  salt = salt || Utilities.getUuid().slice(0, 8);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw, Utilities.Charset.UTF_8);
  const hex = digest.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  return salt + '$' + hex;
}

function checkPassword_(pw, stored) {
  const salt = String(stored).split('$')[0];
  return hashPassword_(pw, salt) === stored;
}

function login_(req) {
  const username = str_(req.username).toLowerCase();
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + username;
  if (Number(cache.get(failKey) || 0) >= 5) {
    throw new Error('Too many failed attempts. Please try again in 5 minutes.');
  }
  const admin = readAll_('Admins').filter(function (a) { return String(a.username).toLowerCase() === username; })[0];
  if (!admin || !checkPassword_(str_(req.password), admin.password_hash)) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 300);
    throw new Error('Incorrect username or password');
  }
  cache.remove(failKey);
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, admin.username, TOKEN_TTL);
  return { token: token, nama: admin.nama, username: admin.username, expires_in: TOKEN_TTL };
}

function logout_(req) {
  if (req.token) CacheService.getScriptCache().remove('tok_' + req.token);
}

function requireAdmin_(token) {
  const user = token ? CacheService.getScriptCache().get('tok_' + token) : null;
  if (!user) throw new Error('Session expired, please sign in again');
  return user;
}

function changePassword_(req, user) {
  const admin = readAll_('Admins').filter(function (a) { return a.username === user; })[0];
  if (!admin || !checkPassword_(str_(req.password_lama), admin.password_hash)) throw new Error('Current password is incorrect');
  const next = str_(req.password_baru);
  if (next.length < 6) throw new Error('New password must be at least 6 characters');
  update_('Admins', admin._row, { password_hash: hashPassword_(next) });
  return true;
}

/* ===================================================================
 *  SPREADSHEET HELPERS
 * =================================================================== */

function sheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function normalize_(v, header, sheetName) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && (TEXT_COLS[sheetName] || []).indexOf(header) > -1) return String(v);
  return v;
}

function readAll_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = SHEETS[name];
  return sh.getRange(2, 1, last - 1, headers.length).getValues().map(function (r, i) {
    const o = { _row: i + 2 };
    headers.forEach(function (h, j) { o[h] = normalize_(r[j], h, name); });
    return o;
  });
}

function insert_(name, obj) { appendRows_(name, [obj]); }

/** Append many rows at once (grows the sheet if needed). */
function appendRows_(name, objs) {
  if (!objs.length) return;
  const headers = SHEETS[name];
  const sh = sheet_(name);
  const start = sh.getLastRow() + 1;
  const end = start + objs.length - 1;
  if (end > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), end - sh.getMaxRows());
  (TEXT_COLS[name] || []).forEach(function (col) {
    sh.getRange(start, headers.indexOf(col) + 1, objs.length, 1).setNumberFormat('@');
  });
  const rows = objs.map(function (o) {
    return headers.map(function (h) { return o[h] === undefined ? '' : o[h]; });
  });
  sh.getRange(start, 1, rows.length, headers.length).setValues(rows);
}

function update_(name, row, patch) {
  const headers = SHEETS[name];
  const sh = sheet_(name);
  const current = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const merged = headers.map(function (h, j) { return patch[h] === undefined ? current[j] : patch[h]; });
  sh.getRange(row, 1, 1, headers.length).setValues([merged]);
}

/** Update many rows with a single read and a single write. items: [{_row, patch}] */
function updateMany_(name, items) {
  if (!items.length) return;
  const headers = SHEETS[name];
  const sh = sheet_(name);
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length);
  const vals = range.getValues();
  items.forEach(function (it) {
    const r = vals[it._row - 2];
    headers.forEach(function (h, j) { if (it.patch[h] !== undefined) r[j] = it.patch[h]; });
  });
  range.setValues(vals);
}

function remove_(name, row) { sheet_(name).deleteRow(row); }

function findBy_(name, field, value) {
  const v = String(value);
  return readAll_(name).filter(function (r) { return String(r[field]) === v; })[0] || null;
}

function indexBy_(arr, field) {
  const m = {};
  arr.forEach(function (x) { m[x[field]] = x; });
  return m;
}

function clean_(o) {
  const c = {};
  Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; });
  return c;
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function str_(v) { return String(v === null || v === undefined ? '' : v).trim(); }

function int_(v, def) {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

/* ===================================================================
 *  DATE HELPERS (stored as yyyy-MM-dd text, Asia/Jakarta time)
 * =================================================================== */

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function parseDate_(s) {
  const p = String(s).split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

function addDays_(s, n) {
  const d = parseDate_(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day difference a - b (positive when a is after b) */
function diffDays_(a, b) {
  return Math.round((parseDate_(a) - parseDate_(b)) / 86400000);
}

function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }

/* ===================================================================
 *  SETTINGS
 * =================================================================== */

function getSettings_() {
  const out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  readAll_('Settings').forEach(function (r) {
    if (DEFAULT_SETTINGS.hasOwnProperty(r.key) && r.value !== '') out[r.key] = Number(r.value);
  });
  return out;
}

function getSettingsAction_() { return getSettings_(); }

function updateSettings_(req) {
  const rows = readAll_('Settings');
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (req[k] === undefined) return;
    const val = Number(req[k]);
    if (isNaN(val) || val < 0) throw new Error('Invalid value for ' + k);
    const existing = rows.filter(function (r) { return r.key === k; })[0];
    if (existing) update_('Settings', existing._row, { value: val });
    else insert_('Settings', { key: k, value: val });
  });
  return getSettings_();
}

/* ===================================================================
 *  RESERVATION ENGINE
 *  stok_tersedia = copies free to borrow right now. A copy held for a
 *  reservation ("Ready") is NOT counted in stok_tersedia.
 * =================================================================== */

function isActiveRes_(r) { return r.status === 'Waiting' || r.status === 'Ready'; }

function byCreated_(a, b) {
  return String(a.tgl_dibuat).localeCompare(String(b.tgl_dibuat)) || a._row - b._row;
}

/** Give free copies of a book to the people waiting (oldest first). */
function fillQueue_(bookId) {
  const book = findBy_('Books', 'id', bookId);
  if (!book) return;
  let free = Number(book.stok_tersedia);
  if (free < 1) return;
  const waiting = readAll_('Reservations')
    .filter(function (r) { return r.id_buku === bookId && r.status === 'Waiting'; })
    .sort(byCreated_);
  if (!waiting.length) return;
  const st = getSettings_();
  const today = today_();
  let used = 0;
  for (let i = 0; i < waiting.length && free > 0; i++) {
    update_('Reservations', waiting[i]._row, {
      status: 'Ready', tgl_siap: today, tgl_kedaluwarsa: addDays_(today, st.masa_tahan_reservasi_hari)
    });
    free--; used++;
  }
  if (used) update_('Books', book._row, { stok_tersedia: free });
}

/** A copy came back or was released: add it to the shelf, then serve the queue. */
function releaseCopies_(bookId, n) {
  const book = findBy_('Books', 'id', bookId);
  if (!book) return;
  update_('Books', book._row, { stok_tersedia: Math.min(Number(book.stok_tersedia) + n, Number(book.stok_total)) });
  fillQueue_(bookId);
}

/** Expire "Ready" reservations that were not picked up in time. */
function sweepReservations_() {
  const today = today_();
  readAll_('Reservations').forEach(function (r) {
    if (r.status === 'Ready' && r.tgl_kedaluwarsa && diffDays_(r.tgl_kedaluwarsa, today) < 0) {
      update_('Reservations', r._row, { status: 'Expired', tgl_selesai: today });
      releaseCopies_(r.id_buku, 1);
    }
  });
}

/** Public reads call this at most once every 5 minutes. */
function sweepThrottled_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('swept')) return;
  cache.put('swept', '1', 300);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try { sweepReservations_(); } finally { lock.releaseLock(); }
}

function cancelReservationRow_(r) {
  if (!isActiveRes_(r)) throw new Error('This reservation is already closed');
  update_('Reservations', r._row, { status: 'Cancelled', tgl_selesai: today_() });
  if (r.status === 'Ready') releaseCopies_(r.id_buku, 1);
}

/** Cancel all active reservations of the given member ids (set). */
function cancelReservationsForMembers_(idSet) {
  readAll_('Reservations').forEach(function (r) {
    if (idSet[r.id_anggota] && isActiveRes_(r)) cancelReservationRow_(r);
  });
}

function queuePositions_(reservations) {
  // reservation id -> position among Waiting reservations of the same book
  const byBook = {};
  reservations.filter(function (r) { return r.status === 'Waiting'; }).sort(byCreated_).forEach(function (r) {
    byBook[r.id_buku] = (byBook[r.id_buku] || 0) + 1;
    byBook[r.id] = byBook[r.id_buku];
  });
  return byBook;
}

function reserveBook_(req) {
  sweepReservations_();
  const nis = str_(req.nis);
  if (!nis) throw new Error('ID number (NIS / NIP) is required');
  const member = findBy_('Members', 'nis', nis);
  if (!member) throw new Error('ID number not found');
  if (!isMemberActive_(member)) throw new Error('This account is archived');
  const book = findBy_('Books', 'id', req.id_buku);
  if (!book) throw new Error('Book not found');
  if (Number(book.stok_tersedia) > 0) throw new Error('This book is available now. Visit the library to borrow it.');

  const loans = readAll_('Loans');
  if (loans.some(function (l) { return l.id_anggota === member.id && l.id_buku === book.id && l.status === ST_BORROWED; })) {
    throw new Error('You are already borrowing this book');
  }
  const res = readAll_('Reservations');
  const mine = res.filter(function (r) { return r.id_anggota === member.id && isActiveRes_(r); });
  if (mine.some(function (r) { return r.id_buku === book.id; })) throw new Error('You already reserved this book');
  const st = getSettings_();
  if (mine.length >= st.maks_reservasi) throw new Error('You can have at most ' + st.maks_reservasi + ' active reservations');

  const rec = {
    id: newId_('R'), id_buku: book.id, id_anggota: member.id, tgl_dibuat: today_(),
    status: 'Waiting', tgl_siap: '', tgl_kedaluwarsa: '', tgl_selesai: ''
  };
  insert_('Reservations', rec);
  const position = res.filter(function (r) { return r.id_buku === book.id && r.status === 'Waiting'; }).length + 1;
  return { id: rec.id, position: position };
}

function cancelReservation_(req) {
  const r = findBy_('Reservations', 'id', req.id);
  const m = r ? findBy_('Members', 'id', r.id_anggota) : null;
  if (!r || !m || String(m.nis) !== str_(req.nis)) throw new Error('Reservation not found');
  cancelReservationRow_(r);
  return true;
}

function adminCancelReservation_(req) {
  const r = findBy_('Reservations', 'id', req.id);
  if (!r) throw new Error('Reservation not found');
  cancelReservationRow_(r);
  return true;
}

/** filter: active (default) | ready | waiting | history | all */
function listReservations_(req) {
  sweepReservations_();
  const filter = str_(req.filter) || 'active';
  const all = readAll_('Reservations');
  const pos = queuePositions_(all);
  const books = indexBy_(readAll_('Books'), 'id');
  const members = indexBy_(readAll_('Members'), 'id');
  const list = all.filter(function (r) {
    if (filter === 'active') return isActiveRes_(r);
    if (filter === 'ready') return r.status === 'Ready';
    if (filter === 'waiting') return r.status === 'Waiting';
    if (filter === 'history') return !isActiveRes_(r);
    return true;
  }).map(function (r) {
    const b = books[r.id_buku] || {}, m = members[r.id_anggota] || {};
    return {
      id: r.id, id_buku: r.id_buku, id_anggota: r.id_anggota, status: r.status,
      judul: b.judul || '(deleted book)', cover_url: b.cover_url || '',
      nama: m.nama || '(deleted member)', nis: m.nis || '', kelas: m.kelas || '',
      tgl_dibuat: r.tgl_dibuat, tgl_siap: r.tgl_siap, tgl_kedaluwarsa: r.tgl_kedaluwarsa, tgl_selesai: r.tgl_selesai,
      position: r.status === 'Waiting' ? pos[r.id] : null,
      days_to_pickup: r.status === 'Ready' ? diffDays_(r.tgl_kedaluwarsa, today_()) : null
    };
  });
  list.sort(function (a, b) {
    if (filter === 'history') return String(b.tgl_selesai).localeCompare(String(a.tgl_selesai));
    if (a.status !== b.status) return a.status === 'Ready' ? -1 : 1;
    return String(a.judul).localeCompare(String(b.judul)) || (a.position || 0) - (b.position || 0);
  });
  return list;
}

/* ===================================================================
 *  BOOKS - PUBLIC
 * =================================================================== */

function listBooks_(req) {
  sweepThrottled_();
  const q = str_(req.q).toLowerCase();
  const kategori = str_(req.kategori);
  const available = String(req.tersedia) === 'true';
  const pageSize = Math.min(Math.max(int_(req.pageSize, 12), 1), 100);
  const page = Math.max(int_(req.page, 1), 1);

  let items = readAll_('Books').filter(function (b) {
    if (kategori && b.kategori !== kategori) return false;
    if (available && Number(b.stok_tersedia) < 1) return false;
    if (!q) return true;
    return [b.judul, b.penulis, b.isbn, b.kategori, b.penerbit].join(' ').toLowerCase().indexOf(q) > -1;
  });
  items.sort(function (a, b) { return String(a.judul).localeCompare(String(b.judul)); });

  const total = items.length;
  const newDays = getSettings_().buku_baru_hari;
  items = items.slice((page - 1) * pageSize, page * pageSize).map(function (b) {
    const c = clean_(b);
    c.is_new = isNewBook_(b, newDays);
    return c;
  });
  return { items: items, total: total, page: page, pageSize: pageSize };
}

function getBook_(req) {
  sweepThrottled_();
  const b = findBy_('Books', 'id', req.id);
  if (!b) throw new Error('Book not found');
  const out = clean_(b);
  out.is_new = isNewBook_(b, getSettings_().buku_baru_hari);
  out.queue = readAll_('Reservations').filter(function (r) { return r.id_buku === b.id && r.status === 'Waiting'; }).length;
  return out;
}

function listCategories_() {
  const count = {};
  readAll_('Books').forEach(function (b) {
    if (b.kategori) count[b.kategori] = (count[b.kategori] || 0) + 1;
  });
  return Object.keys(count).sort().map(function (k) { return { nama: k, jumlah: count[k] }; });
}

function publicStats_() {
  const books = readAll_('Books');
  return {
    total_judul: books.length,
    total_eksemplar: books.reduce(function (s, b) { return s + Number(b.stok_total || 0); }, 0),
    judul_tersedia: books.filter(function (b) { return Number(b.stok_tersedia) > 0; }).length,
    total_kategori: listCategories_().length
  };
}

/* ===================================================================
 *  STUDENT SELF-SERVICE (public, by Student ID)
 * =================================================================== */

function memberStatus_(req) {
  sweepThrottled_();
  const nis = str_(req.nis);
  if (!nis) throw new Error('ID number (NIS / NIP) is required');
  const m = findBy_('Members', 'nis', nis);
  if (!m) throw new Error('ID number not found');
  const books = indexBy_(readAll_('Books'), 'id');
  const st = getSettings_();
  const allLoans = readAll_('Loans');
  const loans = allLoans
    .filter(function (l) { return l.id_anggota === m.id && l.status === ST_BORROWED; })
    .map(function (l) { return enrichLoan_(l, books, indexBy_([m], 'id'), st); })
    .map(function (l) {
      return {
        judul: l.judul, cover_url: l.cover_url, tgl_pinjam: l.tgl_pinjam, tgl_jatuh_tempo: l.tgl_jatuh_tempo,
        days_left: l.days_left, days_late: l.days_late, time_status: l.time_status, fine: l.fine
      };
    })
    .sort(function (a, b) { return a.days_left - b.days_left; });

  const allRes = readAll_('Reservations');
  const pos = queuePositions_(allRes);
  const reservations = allRes.filter(function (r) { return r.id_anggota === m.id && isActiveRes_(r); }).map(function (r) {
    const b = books[r.id_buku] || {};
    return {
      id: r.id, judul: b.judul || '(deleted book)', cover_url: b.cover_url || '', status: r.status,
      position: r.status === 'Waiting' ? pos[r.id] : null, tgl_siap: r.tgl_siap, tgl_kedaluwarsa: r.tgl_kedaluwarsa
    };
  });
  return {
    nama: m.nama, kelas: m.kelas, jenjang: m.jenjang, type: isTeacher_(m) ? 'Teacher' : 'Student', archived: !isMemberActive_(m),
    loans: loans, reservations: reservations,
    reading: readingSummary_(m.id, allLoans, st)
  };
}

/* ===================================================================
 *  BOOKS - ADMIN
 * =================================================================== */

function validateBook_(req) {
  const judul = str_(req.judul);
  if (!judul) throw new Error('Title is required');
  const stok = int_(req.stok_total, -1);
  if (stok < 0) throw new Error('Copies must be a number, 0 or more');
  return {
    judul: judul, penulis: str_(req.penulis), kategori: str_(req.kategori), penerbit: str_(req.penerbit),
    tahun: str_(req.tahun), isbn: str_(req.isbn), stok_total: stok, cover_url: str_(req.cover_url), deskripsi: str_(req.deskripsi)
  };
}

function createBook_(req) {
  const data = validateBook_(req);
  data.id = newId_('B');
  data.stok_tersedia = data.stok_total;
  data.tgl_ditambahkan = today_();
  insert_('Books', data);
  return clean_(data);
}

function updateBook_(req) {
  const b = findBy_('Books', 'id', req.id);
  if (!b) throw new Error('Book not found');
  const data = validateBook_(req);
  const out = Number(b.stok_total) - Number(b.stok_tersedia); // on loan + held for reservations
  if (data.stok_total < out) {
    throw new Error('Copies cannot be lower than the number currently on loan or held for reservations (' + out + ')');
  }
  data.stok_tersedia = data.stok_total - out;
  update_('Books', b._row, data);
  fillQueue_(b.id);
  return clean_(findBy_('Books', 'id', req.id));
}

function deleteBook_(req) {
  const b = findBy_('Books', 'id', req.id);
  if (!b) throw new Error('Book not found');
  const active = readAll_('Loans').some(function (l) { return l.id_buku === b.id && l.status === ST_BORROWED; });
  if (active) throw new Error('This book is still on loan and cannot be deleted');
  readAll_('Reservations').forEach(function (r) {
    if (r.id_buku === b.id && isActiveRes_(r)) update_('Reservations', r._row, { status: 'Cancelled', tgl_selesai: today_() });
  });
  remove_('Books', b._row);
  return true;
}

function bookKey_(b) {
  return String(b.judul).trim().toLowerCase() + '|' + String(b.penulis).trim().toLowerCase();
}

function isbnKey_(s) { return String(s).replace(/[^0-9Xx]/g, '').toUpperCase(); }

/**
 * req.rows = [{judul, penulis, kategori, penerbit, tahun, isbn, stok_total, cover_url, deskripsi}]
 * req.mode = 'skip' (default) | 'add'   -> what to do when the book already exists
 * A book "exists" when the ISBN matches, or title + author match.
 */
function importBooks_(req) {
  const rows = req.rows || [];
  if (!rows.length) throw new Error('There is no data to import');
  if (rows.length > 2000) throw new Error('At most 2000 rows per import');
  const mode = req.mode === 'add' ? 'add' : 'skip';

  const byIsbn = {}, byTA = {};
  readAll_('Books').forEach(function (b) {
    if (b.isbn) byIsbn[isbnKey_(b.isbn)] = b;
    byTA[bookKey_(b)] = b;
  });

  const toAdd = [], touched = {}, errors = [];
  let skipped = 0, merged = 0;

  rows.forEach(function (r, i) {
    try {
      if (str_(r.stok_total) === '') r.stok_total = 1;
      const d = validateBook_(r);
      const existing = (d.isbn && byIsbn[isbnKey_(d.isbn)]) || byTA[bookKey_(d)];
      if (existing) {
        if (mode === 'skip') { skipped++; return; }
        existing.stok_total = Number(existing.stok_total) + d.stok_total;
        existing.stok_tersedia = Number(existing.stok_tersedia) + d.stok_total;
        if (existing._row) touched[existing._row] = existing;
        merged++;
        return;
      }
      d.id = newId_('B');
      d.stok_tersedia = d.stok_total;
      d.tgl_ditambahkan = today_();
      if (d.isbn) byIsbn[isbnKey_(d.isbn)] = d;
      byTA[bookKey_(d)] = d;
      toAdd.push(d);
    } catch (e) {
      errors.push('Row ' + (i + 1) + ': ' + e.message);
    }
  });

  appendRows_('Books', toAdd);
  const patches = Object.keys(touched).map(function (k) {
    const b = touched[k];
    return { _row: b._row, patch: { stok_total: b.stok_total, stok_tersedia: b.stok_tersedia } };
  });
  updateMany_('Books', patches);
  Object.keys(touched).forEach(function (k) { fillQueue_(touched[k].id); });

  return { added: toAdd.length, merged: merged, skipped: skipped, failed: errors.length, errors: errors.slice(0, 20) };
}

/* ===================================================================
 *  MEMBERS (STUDENTS) - ADMIN
 * =================================================================== */

function isMemberActive_(m) { return m.status !== 'Graduated'; }

/** Members are students (default) or teachers. The 'kelas' column holds the class for students and the subject/position for teachers. */
function isTeacher_(m) { return m.tipe === 'Teacher'; }

function activeLoanCounts_() {
  const c = {};
  readAll_('Loans').forEach(function (l) {
    if (l.status === ST_BORROWED) c[l.id_anggota] = (c[l.id_anggota] || 0) + 1;
  });
  return c;
}

function validateMember_(m) {
  const nis = str_(m.nis), nama = str_(m.nama);
  if (!nis) throw new Error('ID number (NIS / NIP) is required');
  if (!nama) throw new Error('Name is required');
  const type = /^(teacher|guru)/i.test(str_(m.tipe || m.type)) ? 'Teacher' : 'Student';
  const level = str_(m.jenjang).toUpperCase();
  return {
    nis: nis, nama: nama, kelas: str_(m.kelas), tipe: type,
    jenjang: type === 'Teacher' ? '' : ((level === 'JHS' || level === 'SHS') ? level : '')
  };
}

/** req.status: active (default) | graduated | all */
function listMembers_(req) {
  const status = str_(req.status) || 'active';
  const type = str_(req.type);   // student | teacher | (empty = everyone)
  const q = str_(req.q).toLowerCase();
  const counts = activeLoanCounts_();
  return readAll_('Members')
    .filter(function (m) {
      if (status === 'active' && !isMemberActive_(m)) return false;
      if (status === 'graduated' && isMemberActive_(m)) return false;
      if (type === 'student' && isTeacher_(m)) return false;
      if (type === 'teacher' && !isTeacher_(m)) return false;
      return !q || [m.nis, m.nama, m.kelas].join(' ').toLowerCase().indexOf(q) > -1;
    })
    .sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); })
    .map(function (m) {
      const c = clean_(m);
      c.status = isMemberActive_(m) ? 'Active' : 'Graduated';
      c.type = isTeacher_(m) ? 'Teacher' : 'Student';
      c.pinjaman_aktif = counts[m.id] || 0;
      return c;
    });
}

function createMember_(req) {
  const data = validateMember_(req);
  if (findBy_('Members', 'nis', data.nis)) throw new Error('This ID number is already registered');
  data.id = newId_('M');
  data.status = 'Active';
  data.lulus_tahun = '';
  insert_('Members', data);
  return clean_(data);
}

function updateMember_(req) {
  const m = findBy_('Members', 'id', req.id);
  if (!m) throw new Error('Member not found');
  const data = validateMember_(req);
  const dup = findBy_('Members', 'nis', data.nis);
  if (dup && dup.id !== m.id) throw new Error('This ID number belongs to another member');
  update_('Members', m._row, data);
  return clean_(findBy_('Members', 'id', req.id));
}

function deleteMember_(req) {
  const m = findBy_('Members', 'id', req.id);
  if (!m) throw new Error('Member not found');
  const active = readAll_('Loans').some(function (l) { return l.id_anggota === m.id && l.status === ST_BORROWED; });
  if (active) throw new Error('This member still has borrowed books');
  const set = {}; set[m.id] = true;
  cancelReservationsForMembers_(set);
  remove_('Members', m._row);
  return true;
}

function archiveMember_(req) {
  const m = findBy_('Members', 'id', req.id);
  if (!m) throw new Error('Member not found');
  const active = readAll_('Loans').some(function (l) { return l.id_anggota === m.id && l.status === ST_BORROWED; });
  if (active) throw new Error('This member still has borrowed books. Return them first.');
  const set = {}; set[m.id] = true;
  cancelReservationsForMembers_(set);
  update_('Members', m._row, { status: 'Graduated', lulus_tahun: String(int_(req.year, new Date().getFullYear())) });
  return true;
}

function restoreMember_(req) {
  const m = findBy_('Members', 'id', req.id);
  if (!m) throw new Error('Member not found');
  update_('Members', m._row, { status: 'Active', lulus_tahun: '' });
  return true;
}

/** req.rows = [{nis, nama, kelas, jenjang}] */
function importMembers_(req) {
  const rows = req.rows || [];
  if (!rows.length) throw new Error('There is no data to import');
  if (rows.length > 2000) throw new Error('At most 2000 rows per import');
  const exist = {};
  readAll_('Members').forEach(function (m) { exist[m.nis] = true; });
  const toAdd = [], errors = [];
  let skipped = 0;
  rows.forEach(function (r, i) {
    try {
      const d = validateMember_(r);
      if (exist[d.nis]) { skipped++; return; }
      exist[d.nis] = true;
      d.id = newId_('M'); d.status = 'Active'; d.lulus_tahun = '';
      toAdd.push(d);
    } catch (e) {
      errors.push('Row ' + (i + 1) + ': ' + e.message);
    }
  });
  appendRows_('Members', toAdd);
  return { added: toAdd.length, skipped: skipped, failed: errors.length, errors: errors.slice(0, 20) };
}

/**
 * Year-end promotion.
 * req.moves    = [{ from: 'X-A', to: 'XI-A', jenjang: 'SHS' | '' }]   (jenjang '' keeps the current level)
 * req.graduate = ['XII-A', ...]   classes to archive as graduated
 * req.year     = graduation year (e.g. 2026)
 * Every student is processed once, from the ORIGINAL class, so chains such as
 * X-A -> XI-A and XI-A -> XII-A work correctly. Students with borrowed books are
 * not archived (they are reported back as skipped).
 */
function applyPromotion_(req) {
  const moves = {};
  (req.moves || []).forEach(function (m) {
    const from = str_(m.from), to = str_(m.to);
    if (from && to) moves[from] = { to: to, jenjang: str_(m.jenjang).toUpperCase() };
  });
  const grad = {};
  (req.graduate || []).forEach(function (c) { if (str_(c)) grad[str_(c)] = true; });
  const year = String(int_(req.year, new Date().getFullYear()));
  if (!/^\d{4}$/.test(year)) throw new Error('Enter a valid graduation year');

  const counts = activeLoanCounts_();
  const patches = [], skipped = [], graduatedIds = {};
  let promoted = 0, graduated = 0;

  readAll_('Members').forEach(function (m) {
    if (!isMemberActive_(m) || isTeacher_(m)) return;
    const cls = str_(m.kelas);
    if (grad[cls]) {
      if (counts[m.id]) { skipped.push({ nama: m.nama, nis: m.nis, kelas: cls, reason: 'has borrowed books' }); return; }
      patches.push({ _row: m._row, patch: { status: 'Graduated', lulus_tahun: year } });
      graduatedIds[m.id] = true;
      graduated++;
    } else if (moves[cls]) {
      const mv = moves[cls];
      const level = (mv.jenjang === 'JHS' || mv.jenjang === 'SHS') ? mv.jenjang : m.jenjang;
      if (mv.to === cls && level === m.jenjang) return;
      patches.push({ _row: m._row, patch: { kelas: mv.to, jenjang: level } });
      promoted++;
    }
  });

  updateMany_('Members', patches);
  cancelReservationsForMembers_(graduatedIds);
  return { promoted: promoted, graduated: graduated, skipped: skipped.length, skipped_list: skipped.slice(0, 50) };
}

/* ===================================================================
 *  LOANS
 * =================================================================== */

function enrichLoan_(l, books, members, st) {
  const b = books[l.id_buku] || {};
  const m = members[l.id_anggota] || {};
  const borrowed = l.status === ST_BORROWED;
  const out = {
    id: l.id, id_buku: l.id_buku, id_anggota: l.id_anggota,
    judul: b.judul || '(deleted book)', penulis: b.penulis || '', cover_url: b.cover_url || '',
    nama: m.nama || '', nis: m.nis || '', kelas: m.kelas || '', member_type: isTeacher_(m) ? 'Teacher' : 'Student',
    tgl_pinjam: l.tgl_pinjam, tgl_jatuh_tempo: l.tgl_jatuh_tempo, tgl_kembali: l.tgl_kembali,
    extensions: Number(l.perpanjangan || 0), status: borrowed ? 'Borrowed' : 'Returned'
  };
  if (borrowed) {
    const left = diffDays_(l.tgl_jatuh_tempo, today_());
    out.days_left = left;
    out.days_late = left < 0 ? -left : 0;
    out.time_status = left < 0 ? 'late' : left === 0 ? 'due_today' : left <= st.hampir_jatuh_tempo_hari ? 'soon' : 'ok';
  } else {
    out.days_left = null;
    out.days_late = Math.max(0, diffDays_(l.tgl_kembali, l.tgl_jatuh_tempo));
    out.time_status = 'returned';
  }
  out.fine = isTeacher_(m) ? 0 : out.days_late * st.denda_per_hari;   // fines apply to students only
  return out;
}

function allEnrichedLoans_() {
  const books = indexBy_(readAll_('Books'), 'id');
  const members = indexBy_(readAll_('Members'), 'id');
  const st = getSettings_();
  return readAll_('Loans').map(function (l) { return enrichLoan_(l, books, members, st); });
}

/** req.filter: active (default) | late | returned | all ; req.q: search name/ID/title */
function listLoans_(req) {
  const filter = str_(req.filter) || 'active';
  const q = str_(req.q).toLowerCase();
  const list = allEnrichedLoans_().filter(function (l) {
    if (filter === 'active' && l.status !== 'Borrowed') return false;
    if (filter === 'late' && l.time_status !== 'late') return false;
    if (filter === 'returned' && l.status !== 'Returned') return false;
    return !q || [l.nama, l.nis, l.judul, l.kelas].join(' ').toLowerCase().indexOf(q) > -1;
  });
  if (filter === 'late') list.sort(function (a, b) { return b.days_late - a.days_late; });
  else if (filter === 'active') list.sort(function (a, b) { return a.days_left - b.days_left; });
  else list.sort(function (a, b) { return String(b.tgl_pinjam).localeCompare(String(a.tgl_pinjam)); });
  return list;
}

function createLoan_(req) {
  sweepReservations_();
  const book = findBy_('Books', 'id', req.id_buku);
  if (!book) throw new Error('Book not found');
  const member = findBy_('Members', 'id', req.id_anggota);
  if (!member) throw new Error('Member not found');
  if (!isMemberActive_(member)) throw new Error('This member is archived and cannot borrow books');

  const st = getSettings_();
  const teacher = isTeacher_(member);
  const maxBooks = teacher ? st.maks_buku_guru : st.maks_buku_per_siswa;
  const active = readAll_('Loans').filter(function (l) { return l.id_anggota === member.id && l.status === ST_BORROWED; });
  if (active.length >= maxBooks) {
    throw new Error('This ' + (teacher ? 'teacher' : 'student') + ' has reached the limit of ' + maxBooks + ' books');
  }
  if (active.some(function (l) { return l.id_buku === book.id; })) {
    throw new Error('This member is already borrowing this book');
  }

  const ready = readAll_('Reservations').filter(function (r) {
    return r.id_anggota === member.id && r.id_buku === book.id && r.status === 'Ready';
  })[0];
  if (!ready && Number(book.stok_tersedia) < 1) {
    throw new Error('No copies are available right now (they may be on loan or held for reservations)');
  }

  const duration = Math.min(Math.max(int_(req.durasi, teacher ? st.durasi_pinjam_guru : st.durasi_pinjam_default), 1), 90);
  const loanDate = today_();
  const loan = {
    id: newId_('L'), id_buku: book.id, id_anggota: member.id,
    tgl_pinjam: loanDate, tgl_jatuh_tempo: addDays_(loanDate, duration),
    tgl_kembali: '', status: ST_BORROWED, perpanjangan: 0
  };
  insert_('Loans', loan);
  if (ready) {
    // the held copy is already excluded from stok_tersedia
    update_('Reservations', ready._row, { status: 'Fulfilled', tgl_selesai: loanDate });
  } else {
    update_('Books', book._row, { stok_tersedia: Number(book.stok_tersedia) - 1 });
  }
  return { id: loan.id, tgl_jatuh_tempo: loan.tgl_jatuh_tempo, from_reservation: !!ready };
}

function returnLoan_(req) {
  const l = findBy_('Loans', 'id', req.id);
  if (!l) throw new Error('Loan record not found');
  if (l.status === ST_RETURNED) throw new Error('This book has already been returned');
  update_('Loans', l._row, { tgl_kembali: today_(), status: ST_RETURNED });
  releaseCopies_(l.id_buku, 1);
  return true;
}

function extendLoan_(req) {
  const l = findBy_('Loans', 'id', req.id);
  if (!l) throw new Error('Loan record not found');
  if (l.status !== ST_BORROWED) throw new Error('This loan is already closed');
  const st = getSettings_();
  if (Number(l.perpanjangan || 0) >= st.maks_perpanjangan) {
    throw new Error('The extension limit (' + st.maks_perpanjangan + ') has been reached');
  }
  const waiting = readAll_('Reservations').some(function (r) { return r.id_buku === l.id_buku && isActiveRes_(r); });
  if (waiting) throw new Error('Cannot extend: other students have reserved this book');
  // If already late, count from today; otherwise from the current due date
  const base = diffDays_(l.tgl_jatuh_tempo, today_()) < 0 ? today_() : l.tgl_jatuh_tempo;
  const next = addDays_(base, st.durasi_perpanjangan);
  update_('Loans', l._row, { tgl_jatuh_tempo: next, perpanjangan: Number(l.perpanjangan || 0) + 1 });
  return { tgl_jatuh_tempo: next };
}

/* ===================================================================
 *  HISTORY (per student / per book)
 * =================================================================== */

function loanStats_(loans) {
  const returned = loans.filter(function (l) { return l.status === 'Returned'; });
  const kept = returned.map(function (l) { return Math.max(0, diffDays_(l.tgl_kembali, l.tgl_pinjam)); });
  return {
    total: loans.length,
    returned: returned.length,
    borrowed_now: loans.filter(function (l) { return l.status === 'Borrowed'; }).length,
    overdue_now: loans.filter(function (l) { return l.time_status === 'late'; }).length,
    late_returns: returned.filter(function (l) { return l.days_late > 0; }).length,
    avg_days_kept: kept.length ? Math.round(kept.reduce(function (a, b) { return a + b; }, 0) / kept.length * 10) / 10 : null
  };
}

function memberHistory_(req) {
  const m = findBy_('Members', 'id', req.id);
  if (!m) throw new Error('Member not found');
  const loans = allEnrichedLoans_()
    .filter(function (l) { return l.id_anggota === m.id; })
    .sort(function (a, b) { return String(b.tgl_pinjam).localeCompare(String(a.tgl_pinjam)); });
  const books = indexBy_(readAll_('Books'), 'id');
  const reservations = readAll_('Reservations')
    .filter(function (r) { return r.id_anggota === m.id; })
    .sort(function (a, b) { return String(b.tgl_dibuat).localeCompare(String(a.tgl_dibuat)); })
    .map(function (r) {
      return { id: r.id, judul: (books[r.id_buku] || {}).judul || '(deleted book)', status: r.status, tgl_dibuat: r.tgl_dibuat, tgl_selesai: r.tgl_selesai };
    });
  const out = clean_(m);
  out.status = isMemberActive_(m) ? 'Active' : 'Graduated';
  out.type = isTeacher_(m) ? 'Teacher' : 'Student';
  return { member: out, stats: loanStats_(loans), loans: loans, reservations: reservations };
}

function bookHistory_(req) {
  const b = findBy_('Books', 'id', req.id);
  if (!b) throw new Error('Book not found');
  const loans = allEnrichedLoans_()
    .filter(function (l) { return l.id_buku === b.id; })
    .sort(function (a, b2) { return String(b2.tgl_pinjam).localeCompare(String(a.tgl_pinjam)); });
  const members = indexBy_(readAll_('Members'), 'id');
  const all = readAll_('Reservations');
  const pos = queuePositions_(all);
  const reservations = all.filter(function (r) { return r.id_buku === b.id; })
    .sort(function (a, c) { return String(c.tgl_dibuat).localeCompare(String(a.tgl_dibuat)); })
    .map(function (r) {
      const m = members[r.id_anggota] || {};
      return { id: r.id, nama: m.nama || '(deleted member)', kelas: m.kelas || '', status: r.status,
        position: r.status === 'Waiting' ? pos[r.id] : null, tgl_dibuat: r.tgl_dibuat, tgl_selesai: r.tgl_selesai };
    });
  const stats = loanStats_(loans);
  const borrowers = {};
  loans.forEach(function (l) { borrowers[l.id_anggota] = true; });
  stats.unique_borrowers = Object.keys(borrowers).length;
  stats.waiting = reservations.filter(function (r) { return r.status === 'Waiting'; }).length;
  return { book: clean_(b), stats: stats, loans: loans, reservations: reservations };
}

/* ===================================================================
 *  REPORTS & STATISTICS
 * =================================================================== */

function lastMonths_(endStr, n) {
  const p = endStr.split('-').map(Number);
  let y = p[0], m = p[1];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.unshift(y + '-' + ('0' + m).slice(-2));
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return out;
}

function topN_(counter, n, mapFn) {
  return Object.keys(counter)
    .map(function (k) { return mapFn(k, counter[k]); })
    .sort(function (a, b) { return b.count - a.count || String(a.name || a.judul || '').localeCompare(String(b.name || b.judul || '')); })
    .slice(0, n);
}

/** req.from, req.to = yyyy-MM-dd (loan date range) */
function reports_(req) {
  sweepReservations_();
  const today = today_();
  let from = isDate_(req.from) ? req.from : addDays_(today, -29);
  let to = isDate_(req.to) ? req.to : today;
  if (from > to) { const t = from; from = to; to = t; }
  if (diffDays_(to, from) > 3660) throw new Error('The date range is too long (max 10 years)');

  const books = readAll_('Books');
  const booksById = indexBy_(books, 'id');
  const members = readAll_('Members');
  const membersById = indexBy_(members, 'id');
  const loans = readAll_('Loans');
  const inRange = function (d) { return d && d >= from && d <= to; };

  const loaned = loans.filter(function (l) { return inRange(l.tgl_pinjam); });
  const returnedIn = loans.filter(function (l) { return l.status === ST_RETURNED && inRange(l.tgl_kembali); });
  const lateReturns = returnedIn.filter(function (l) { return l.tgl_kembali > l.tgl_jatuh_tempo; });
  const kept = returnedIn.map(function (l) { return Math.max(0, diffDays_(l.tgl_kembali, l.tgl_pinjam)); });
  const borrowedNow = loans.filter(function (l) { return l.status === ST_BORROWED; });
  const overdueNow = borrowedNow.filter(function (l) { return diffDays_(l.tgl_jatuh_tempo, today) < 0; });

  const byBook = {}, byMember = {}, byCategory = {}, byLevel = {}, byClass = {}, byType = {};
  const borrowers = {}, loanedTitles = {};
  loaned.forEach(function (l) {
    byBook[l.id_buku] = (byBook[l.id_buku] || 0) + 1;
    byMember[l.id_anggota] = (byMember[l.id_anggota] || 0) + 1;
    borrowers[l.id_anggota] = true;
    loanedTitles[l.id_buku] = true;
    const b = booksById[l.id_buku], m = membersById[l.id_anggota];
    if (b && b.kategori) byCategory[b.kategori] = (byCategory[b.kategori] || 0) + 1;
    if (m) { const t = isTeacher_(m) ? 'Teachers' : 'Students'; byType[t] = (byType[t] || 0) + 1; }
    if (m && !isTeacher_(m) && m.jenjang) byLevel[m.jenjang] = (byLevel[m.jenjang] || 0) + 1;
    if (m && !isTeacher_(m) && m.kelas) byClass[m.kelas] = (byClass[m.kelas] || 0) + 1;
  });

  const monthCount = {};
  loans.forEach(function (l) { if (l.tgl_pinjam) monthCount[l.tgl_pinjam.slice(0, 7)] = (monthCount[l.tgl_pinjam.slice(0, 7)] || 0) + 1; });
  const monthly = lastMonths_(to, 12).map(function (k) { return { month: k, loans: monthCount[k] || 0 }; });

  const res = readAll_('Reservations');
  return {
    from: from, to: to,
    summary: {
      loans: loaned.length,
      returns: returnedIn.length,
      late_returns: lateReturns.length,
      on_time_rate: returnedIn.length ? Math.round((1 - lateReturns.length / returnedIn.length) * 100) : null,
      avg_days_kept: kept.length ? Math.round(kept.reduce(function (a, b) { return a + b; }, 0) / kept.length * 10) / 10 : null,
      active_borrowers: Object.keys(borrowers).length,
      titles_loaned: Object.keys(loanedTitles).length,
      idle_titles: books.filter(function (b) { return !loanedTitles[b.id]; }).length,
      borrowed_now: borrowedNow.length,
      overdue_now: overdueNow.length,
      reservations_created: res.filter(function (r) { return inRange(r.tgl_dibuat); }).length,
      reservations_fulfilled: res.filter(function (r) { return r.status === 'Fulfilled' && inRange(r.tgl_selesai); }).length
    },
    collection: {
      titles: books.length,
      copies: books.reduce(function (s, b) { return s + Number(b.stok_total || 0); }, 0),
      students_active: members.filter(function (m) { return isMemberActive_(m) && !isTeacher_(m); }).length,
      teachers_active: members.filter(function (m) { return isMemberActive_(m) && isTeacher_(m); }).length,
      students_graduated: members.filter(function (m) { return !isMemberActive_(m) && !isTeacher_(m); }).length
    },
    monthly: monthly,
    top_books: topN_(byBook, 10, function (id, c) { const b = booksById[id] || {}; return { id: id, judul: b.judul || '(deleted book)', penulis: b.penulis || '', count: c }; }),
    top_readers: topN_(byMember, 10, function (id, c) { const m = membersById[id] || {}; return { id: id, nama: m.nama || '(deleted member)', kelas: m.kelas || '', count: c }; }),
    by_category: topN_(byCategory, 10, function (k, c) { return { name: k, count: c }; }),
    by_level: topN_(byLevel, 5, function (k, c) { return { name: k, count: c }; }),
    by_type: topN_(byType, 5, function (k, c) { return { name: k, count: c }; }),
    by_class: topN_(byClass, 10, function (k, c) { return { name: k, count: c }; })
  };
}

/* ===================================================================
 *  DASHBOARD
 * =================================================================== */

function dashboard_() {
  sweepReservations_();
  const books = readAll_('Books');
  const loans = allEnrichedLoans_();
  const active = loans.filter(function (l) { return l.status === 'Borrowed'; });
  const late = active.filter(function (l) { return l.time_status === 'late'; })
    .sort(function (a, b) { return b.days_late - a.days_late; });
  const res = readAll_('Reservations');
  const activeMembers = readAll_('Members').filter(isMemberActive_);
  return {
    total_judul: books.length,
    total_eksemplar: books.reduce(function (s, b) { return s + Number(b.stok_total || 0); }, 0),
    total_anggota: activeMembers.length,
    total_students: activeMembers.filter(function (m) { return !isTeacher_(m); }).length,
    total_teachers: activeMembers.filter(isTeacher_).length,
    borrowed_now: active.length,
    due_today: active.filter(function (l) { return l.time_status === 'due_today'; }).length,
    due_soon: active.filter(function (l) { return l.time_status === 'soon'; }).length,
    overdue: late.length,
    reservations_ready: res.filter(function (r) { return r.status === 'Ready'; }).length,
    reservations_waiting: res.filter(function (r) { return r.status === 'Waiting'; }).length,
    top_overdue: late.slice(0, 5),
    recent_loans: loans.sort(function (a, b) { return String(b.tgl_pinjam).localeCompare(String(a.tgl_pinjam)); }).slice(0, 5)
  };
}


/* ===================================================================
 *  NEW ARRIVALS & MOST BORROWED (home page shelves)
 * =================================================================== */

function isNewBook_(b, days) {
  return !!b.tgl_ditambahkan && isDate_(b.tgl_ditambahkan) && diffDays_(today_(), b.tgl_ditambahkan) <= days;
}

function shelves_() {
  const st = getSettings_();
  const books = readAll_('Books');
  const byId = indexBy_(books, 'id');
  const loans = readAll_('Loans');

  const newest = books
    .filter(function (b) { return isNewBook_(b, st.buku_baru_hari); })
    .sort(function (a, b) {
      return String(b.tgl_ditambahkan).localeCompare(String(a.tgl_ditambahkan)) || String(a.judul).localeCompare(String(b.judul));
    })
    .slice(0, 12)
    .map(function (b) { const c = clean_(b); c.is_new = true; return c; });

  // Most borrowed in the last 90 days; if that is too little data, fall back to all time.
  const since = addDays_(today_(), -90);
  const countLoans = function (from) {
    const c = {};
    loans.forEach(function (l) { if (!from || l.tgl_pinjam >= from) c[l.id_buku] = (c[l.id_buku] || 0) + 1; });
    return c;
  };
  let counts = countLoans(since), windowDays = 90;
  if (Object.keys(counts).filter(function (id) { return byId[id]; }).length < 3) { counts = countLoans(''); windowDays = 0; }
  const top = Object.keys(counts)
    .filter(function (id) { return byId[id]; })
    .sort(function (a, b) { return counts[b] - counts[a] || String(byId[a].judul).localeCompare(String(byId[b].judul)); })
    .slice(0, 10)
    .map(function (id) {
      const c = clean_(byId[id]);
      c.loans = counts[id];
      c.is_new = isNewBook_(byId[id], st.buku_baru_hari);
      return c;
    });

  return { new_arrivals: newest, most_borrowed: top, window_days: windowDays };
}

/* ===================================================================
 *  READING LEVELS & LEADERBOARD ("Reading stars")
 * =================================================================== */

function readingLevel_(n) {
  let current = null, next = null;
  READING_LEVELS.forEach(function (l) {
    if (n >= l.min) current = l;
    else if (!next) next = l;
  });
  return { level: current ? current.name : '', next_level: next ? next.name : '', to_next: next ? next.min - n : 0 };
}

function readingSummary_(memberId, allLoans, st) {
  const finished = allLoans.filter(function (l) { return l.id_anggota === memberId && l.status === ST_RETURNED; });
  const lv = readingLevel_(finished.length);
  const monthStart = periodRange_('month', st).from;
  return {
    total_read: finished.length,
    this_month: finished.filter(function (l) { return l.tgl_kembali >= monthStart; }).length,
    level: lv.level, next_level: lv.next_level, to_next: lv.to_next
  };
}

/** period: month | last_month | year (school year, starting in tahun_ajaran_mulai_bulan) */
function periodRange_(period, st) {
  const today = today_();
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const pad = function (n) { return ('0' + n).slice(-2); };
  const first = function (yy, mm) { return yy + '-' + pad(mm) + '-01'; };
  const last = function (yy, mm) { return new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); };
  if (period === 'last_month') {
    let yy = y, mm = m - 1;
    if (mm < 1) { mm = 12; yy--; }
    return { from: first(yy, mm), to: last(yy, mm) };
  }
  if (period === 'year') {
    const start = Math.min(Math.max(int_(st.tahun_ajaran_mulai_bulan, 7), 1), 12);
    return { from: first(m >= start ? y : y - 1, start), to: today };
  }
  return { from: first(y, m), to: today };
}

function shortName_(name) {
  const base = String(name).split(',')[0].trim();
  const parts = base.split(/\s+/);
  return parts.length < 2 ? base : parts[0] + ' ' + parts[1].charAt(0).toUpperCase() + '.';
}

/** Standard competition ranking (1, 2, 2, 4). rows must already be sorted. */
function rankRows_(rows, keyFn) {
  let rank = 0, prev = null;
  rows.forEach(function (r, i) {
    const k = keyFn(r);
    if (k !== prev) { rank = i + 1; prev = k; }
    r.rank = rank;
  });
  return rows;
}

function buildLeaderboard_(period, fullNames) {
  period = ['month', 'last_month', 'year'].indexOf(period) > -1 ? period : 'month';
  const st = getSettings_();
  const range = periodRange_(period, st);
  const members = readAll_('Members');
  const byId = indexBy_(members, 'id');

  // A book counts as "read" when it is returned.
  const allTime = {}, cnt = {};
  readAll_('Loans').forEach(function (l) {
    if (l.status !== ST_RETURNED) return;
    allTime[l.id_anggota] = (allTime[l.id_anggota] || 0) + 1;
    if (l.tgl_kembali >= range.from && l.tgl_kembali <= range.to) cnt[l.id_anggota] = (cnt[l.id_anggota] || 0) + 1;
  });

  const people = Object.keys(cnt).map(function (id) {
    const m = byId[id];
    if (!m) return null;
    return {
      name: fullNames ? m.nama : shortName_(m.nama), kelas: m.kelas || '',
      type: isTeacher_(m) ? 'Teacher' : 'Student',
      count: cnt[id], total: allTime[id] || 0, level: readingLevel_(allTime[id] || 0).level
    };
  }).filter(Boolean);
  const sorter = function (a, b) { return b.count - a.count || b.total - a.total || a.name.localeCompare(b.name); };
  const students = rankRows_(people.filter(function (p) { return p.type === 'Student'; }).sort(sorter), function (r) { return r.count; });
  const teachers = rankRows_(people.filter(function (p) { return p.type === 'Teacher'; }).sort(sorter), function (r) { return r.count; });
  const topCount = students.length ? students[0].count : 0;
  const winners = topCount > 0
    ? students.filter(function (r) { return r.count === topCount; }).map(function (r) { return { name: r.name, kelas: r.kelas, count: r.count, level: r.level }; })
    : [];

  // Class challenge: ranked by books per student so small classes are not at a disadvantage.
  const size = {};
  members.forEach(function (m) {
    if (isMemberActive_(m) && !isTeacher_(m) && m.kelas) size[m.kelas] = (size[m.kelas] || 0) + 1;
  });
  const classCount = {};
  Object.keys(cnt).forEach(function (id) {
    const m = byId[id];
    if (m && !isTeacher_(m) && m.kelas) classCount[m.kelas] = (classCount[m.kelas] || 0) + cnt[id];
  });
  const target = period === 'year' ? 0 : st.tantangan_target_per_siswa;
  const classes = Object.keys(classCount).map(function (k) {
    const per = Math.round(classCount[k] / Math.max(size[k] || 1, 1) * 10) / 10;
    return {
      name: k, count: classCount[k], students: size[k] || 0, per_student: per,
      goal_pct: target ? Math.min(100, Math.round(per / target * 100)) : null, goal_reached: target ? per >= target : false
    };
  }).sort(function (a, b) { return b.per_student - a.per_student || b.count - a.count || a.name.localeCompare(b.name); });
  rankRows_(classes, function (r) { return r.per_student; });

  return {
    enabled: true, period: period, from: range.from, to: range.to, full_names: !!fullNames,
    target_per_student: target || null,
    totals: { books: Object.keys(cnt).reduce(function (s2, id) { return s2 + cnt[id]; }, 0), readers: Object.keys(cnt).length },
    winners: winners, students: students.slice(0, 10), teachers: teachers.slice(0, 5), classes: classes.slice(0, 10),
    levels: READING_LEVELS
  };
}

/** Public: only when the librarian switched it on in Settings. */
function leaderboard_(req) {
  const st = getSettings_();
  if (!st.papan_peringkat_publik) return { enabled: false };
  return buildLeaderboard_(str_(req.period), !st.peringkat_nama_singkat);
}

/** Admin preview: always on, always full names. */
function leaderboardAdmin_(req) {
  return buildLeaderboard_(str_(req.period), true);
}
