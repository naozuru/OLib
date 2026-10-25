/**
 * English / Indonesian switch for the student pages.
 *
 * English is the default. When the visitor picks "ID" the choice is remembered in this browser and
 * the page is shown in Indonesian: every text on the page is looked up in the EXACT dictionary, or
 * matched against the RULES (for sentences that contain numbers or names). Text that is not found
 * (book titles, student names, anything new you add) simply stays as it is, so nothing breaks.
 *
 * To translate a new sentence, add it to EXACT as  'English text': 'Teks Indonesia',
 * or add a rule to RULES when the sentence contains a number or a name.
 * Credit text ("Copyright by ...") is intentionally left untranslated.
 */
const I18N = (function () {
  const KEY = 'lib_lang';
  let lang = 'en';
  try { const s = localStorage.getItem(KEY); if (s === 'id' || s === 'en') lang = s; } catch (e) { /* ignore */ }

  const EXACT = {
    // ----- menu, header, titles -----
    'Catalog': 'Katalog', 'My loans': 'Pinjamanku', 'Reading stars': 'Bintang Baca', 'Admin': 'Admin', 'Library': 'Perpustakaan',
    'Main menu': 'Menu utama', 'Admin sign in': 'Masuk admin', 'Change language': 'Ganti bahasa',
    'Switch to dark mode': 'Ganti ke mode gelap', 'Switch to light mode': 'Ganti ke mode terang',
    'Book Catalog': 'Katalog Buku', 'My Loans': 'Pinjamanku', 'Reading Stars': 'Bintang Baca', 'Book Details': 'Detail Buku',

    // ----- catalog -----
    'Find a book you want to read': 'Temukan buku yang ingin kamu baca',
    'Browse the library shelves and check whether a book is available before you visit.': 'Telusuri rak perpustakaan dan cek apakah bukunya tersedia sebelum kamu datang.',
    'Search by title, author or ISBN': 'Cari judul, penulis, atau ISBN', 'Search books': 'Cari buku', 'Search': 'Cari',
    'A few books on the shelf': 'Beberapa buku di rak', 'Category filter': 'Filter kategori', 'All': 'Semua',
    'Available only': 'Hanya yang tersedia', 'New arrivals': 'Buku baru', 'Most borrowed lately': 'Paling sering dipinjam belakangan ini',
    'Most borrowed': 'Paling sering dipinjam', 'All books': 'Semua buku', 'Show more': 'Tampilkan lebih banyak', 'New': 'Baru',
    'Loading books...': 'Memuat buku...', 'No books found': 'Buku tidak ditemukan',
    'Try a different keyword, or clear the active filters.': 'Coba kata kunci lain, atau hapus filter yang aktif.',
    'Clear filters': 'Hapus filter', 'The catalog could not be loaded': 'Katalog tidak bisa dimuat',
    'The backend is not connected yet': 'Backend belum tersambung', 'Try again': 'Coba lagi',
    'Unknown author': 'Penulis tidak diketahui', 'On loan': 'Sedang dipinjam',

    // ----- book page -----
    'Back to catalog': 'Kembali ke katalog', 'More in this category': 'Buku lain di kategori ini',
    'No copies recorded yet': 'Belum ada eksemplar tercatat', 'All copies are on loan': 'Semua eksemplar sedang dipinjam',
    'Your ID number (NIS / NIP)': 'Nomor induk kamu (NIS / NIP)', 'ID number': 'Nomor induk',
    'Reserve this book': 'Pesan buku ini', 'Reserving...': 'Memesan...',
    'Publisher': 'Penerbit', 'Year': 'Tahun', 'Category': 'Kategori', 'About this book': 'Tentang buku ini', 'How to borrow': 'Cara meminjam',
    'Find the book on the shelf by category, or ask the librarian.': 'Cari bukunya di rak sesuai kategori, atau tanya petugas perpustakaan.',
    'Take it to the desk and give your ID number (NIS or NIP).': 'Bawa ke meja petugas dan sebutkan nomor induk kamu (NIS atau NIP).',
    'Track your due date on the My loans page.': 'Pantau tenggat pengembalian di halaman Pinjamanku.',
    'No book selected': 'Belum ada buku dipilih', 'Open a book from the catalog page.': 'Buka sebuah buku dari halaman katalog.',
    'Go to catalog': 'Ke katalog', 'This book could not be loaded': 'Buku ini tidak bisa dimuat',

    // ----- my loans -----
    'Enter your ID number (NIS for students, NIP for teachers) to see the books you borrowed, how many days are left, and your reservations.':
      'Masukkan nomor induk kamu (NIS untuk siswa, NIP untuk guru) untuk melihat buku yang kamu pinjam, sisa harinya, dan pemesananmu.',
    'ID number (NIS / NIP)': 'Nomor induk (NIS / NIP)', 'Example: 2024001': 'Contoh: 2024001', 'Check': 'Cek', 'Checking...': 'Memeriksa...',
    'Teacher': 'Guru', 'Just getting started': 'Baru memulai',
    'This account is archived. Ask the librarian if you need access.': 'Akun ini diarsipkan. Tanyakan ke petugas perpustakaan jika kamu perlu akses.',
    'You reached the top level. Amazing!': 'Kamu sudah di level tertinggi. Luar biasa!',
    'Progress to the next reading level': 'Kemajuan ke level membaca berikutnya',
    'No books borrowed': 'Tidak ada buku yang dipinjam',
    'You are not borrowing any books right now. Find your next read in the catalog.': 'Kamu sedang tidak meminjam buku. Cari bacaan berikutnya di katalog.',
    'Browse the catalog': 'Lihat katalog', 'All your loans are within the due date.': 'Semua pinjamanmu masih dalam batas waktu.',
    'My reservations': 'Pemesananku', 'Cancel reservation': 'Batalkan pemesanan', 'Cancel this reservation?': 'Batalkan pemesanan ini?',
    'Reservation cancelled': 'Pemesanan dibatalkan', 'We could not show this data': 'Data tidak bisa ditampilkan',

    // ----- badges -----
    'Due today': 'Jatuh tempo hari ini', 'Returned': 'Dikembalikan', 'Ready for pickup': 'Siap diambil', 'Picked up': 'Sudah diambil',
    'Expired': 'Kedaluwarsa', 'Cancelled': 'Dibatalkan', 'Goal reached': 'Target tercapai',

    // ----- reading levels -----
    'Page Turner': 'Pembalik Halaman', 'Bookworm': 'Kutu Buku', 'Reading Star': 'Bintang Baca', 'Library Legend': 'Legenda Perpustakaan',

    // ----- reading stars page -----
    'Celebrating the readers and classes who keep the pages turning. A book counts as read when it is returned.':
      'Mengapresiasi pembaca dan kelas yang terus membalik halaman. Sebuah buku dihitung terbaca saat dikembalikan.',
    'Admin preview: full names are shown. Students see this page only when you switch it on in Settings, and with shortened names unless you turn that off.':
      'Pratinjau admin: nama lengkap ditampilkan. Siswa hanya melihat halaman ini jika kamu mengaktifkannya di Settings, dan dengan nama disingkat kecuali kamu mematikannya.',
    'Period': 'Periode', 'This month': 'Bulan ini', 'Last month': 'Bulan lalu', 'This school year': 'Tahun ajaran ini',
    'Reader of the month (so far)': 'Pembaca bulan ini (sementara)', 'Reader of last month': 'Pembaca bulan lalu',
    'Reader of the school year': 'Pembaca tahun ajaran ini', 'Top readers': 'Pembaca teratas',
    'No student readers yet.': 'Belum ada siswa pembaca.', 'Class reading challenge': 'Tantangan membaca antarkelas',
    'Classes are ranked by books per student, so every class has a fair chance.': 'Kelas diurutkan berdasarkan buku per siswa, jadi setiap kelas punya peluang yang adil.',
    'No classes on the board yet.': 'Belum ada kelas di papan.', 'Reading teachers': 'Guru pembaca', 'Reading levels': 'Level membaca',
    'Return books to level up. Your level counts every book you have ever returned.': 'Kembalikan buku untuk naik level. Levelmu menghitung semua buku yang pernah kamu kembalikan.',
    'No books returned in this period yet': 'Belum ada buku yang dikembalikan di periode ini',
    'Borrow a book, read it, and bring it back to be the first one on the board!': 'Pinjam buku, baca, lalu kembalikan agar jadi yang pertama di papan!',
    'Reading stars is not open yet': 'Bintang Baca belum dibuka',
    'The librarian has not switched on the reading leaderboard. Keep reading and check back soon!': 'Petugas perpustakaan belum mengaktifkan papan peringkat membaca. Teruslah membaca dan cek lagi nanti!',
    'Reading stars could not be loaded': 'Bintang Baca tidak bisa dimuat',

    // ----- messages from the server and the network -----
    'Could not reach the server. Check your internet connection and try again.': 'Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.',
    'The Web App URL is not set in assets/js/config.js yet': 'URL Web App belum diatur di assets/js/config.js',
    'The server did not respond correctly. Check the Web App URL in config.js and make sure the deployment access is "Anyone".':
      'Server tidak merespons dengan benar. Periksa URL Web App di config.js dan pastikan akses deploy-nya "Anyone".',
    'This book is available now. Visit the library to borrow it.': 'Buku ini sedang tersedia. Datang ke perpustakaan untuk meminjamnya.',
    'You are already borrowing this book': 'Kamu sedang meminjam buku ini', 'You already reserved this book': 'Kamu sudah memesan buku ini',
    'ID number (NIS / NIP) is required': 'Nomor induk (NIS / NIP) wajib diisi', 'ID number not found': 'Nomor induk tidak ditemukan',
    'This account is archived': 'Akun ini sudah diarsipkan', 'Book not found': 'Buku tidak ditemukan',
    'Reservation not found': 'Pemesanan tidak ditemukan', 'This reservation is already closed': 'Pemesanan ini sudah ditutup'
  };

  function ex(s) { return Object.prototype.hasOwnProperty.call(EXACT, s) ? EXACT[s] : undefined; }
  function word(s) { const r = ex(s); return r === undefined ? s : r; }
  const plural = function (n, one, many) { return n + ' ' + (Number(n) === 1 ? one : many); };

  // Sentences with numbers or names. Each rule returns the Indonesian text, or undefined to leave the text alone.
  const RULES = [
    [/^Showing (\d+) of (\d+) books?$/, function (m) { return 'Menampilkan ' + m[1] + ' dari ' + m[2] + ' buku'; }],
    [/^(\d+) titles? in (\d+) categor(?:y|ies), (\d+) ready to borrow\.$/, function (m) { return m[1] + ' judul di ' + m[2] + ' kategori, ' + m[3] + ' siap dipinjam.'; }],
    [/^(\d+) loans?$/, function (m) { return m[1] + ' kali dipinjam'; }],
    [/^Available (\d+)$/, function (m) { return 'Tersedia ' + m[1]; }],
    [/^by (.+)$/, function (m) { return 'oleh ' + m[1]; }],
    [/^(\d+) of (\d+) cop(?:y is|ies are) on the shelf$/, function (m) { return m[1] + ' dari ' + m[2] + ' eksemplar ada di rak'; }],
    [/^(?:(\d+) (?:person is|people are) already waiting\. |Nobody is waiting yet\. )Reserve this book and you will be in the queue\. When a copy comes back, the library holds it for you for a few days\.$/,
      function (m) { return (m[1] ? m[1] + ' orang sudah mengantre. ' : 'Belum ada yang mengantre. ') + 'Pesan buku ini dan kamu akan masuk antrean. Saat ada eksemplar yang kembali, perpustakaan menahannya untukmu selama beberapa hari.'; }],
    [/^Reserved! You are number (\d+) in the queue\. We will hold a copy for you when it is ready\. Follow it on$/,
      function (m) { return 'Berhasil dipesan! Kamu antrean nomor ' + m[1] + '. Kami akan menahan satu eksemplar untukmu saat sudah siap. Pantau di'; }],
    [/^You can have at most (\d+) active reservations$/, function (m) { return 'Kamu hanya bisa punya maksimal ' + m[1] + ' pemesanan aktif'; }],
    [/^Class (.+)$/, function (m) { return 'Kelas ' + m[1]; }],
    [/^Teacher, (.+)$/, function (m) { return 'Guru, ' + m[1]; }],
    [/^(\d+) reserved books? (?:is|are) ready for pickup\.$/, function (m) { return m[1] + ' buku pesanan siap diambil.'; }],
    [/^(\d+) books? read in total, (\d+) this month\.$/, function (m) { return m[1] + ' buku dibaca sejauh ini, ' + m[2] + ' bulan ini.'; }],
    [/^(\d+) more books? to reach (.+)\.$/, function (m) { return m[1] + ' buku lagi untuk mencapai ' + word(m[2]) + '.'; }],
    [/^(\d+) books? (?:is|are) overdue\. Please return (?:it|them) to the library as soon as possible\.$/, function (m) { return m[1] + ' buku sudah lewat jatuh tempo. Segera kembalikan ke perpustakaan.'; }],
    [/^Borrowed (.+), return by (.+)$/, function (m) { return 'Dipinjam ' + m[1] + ', kembalikan sebelum ' + m[2]; }],
    [/^(\d+) percent of the loan period used$/, function (m) { return m[1] + ' persen masa pinjam terpakai'; }],
    [/^(\d+) percent of the class goal$/, function (m) { return m[1] + ' persen dari target kelas'; }],
    [/^Fine (.+)$/, function (m) { return 'Denda ' + m[1]; }],
    [/^Overdue (\d+) days?$/, function (m) { return 'Terlambat ' + m[1] + ' hari'; }],
    [/^(\d+) days? left$/, function (m) { return 'Sisa ' + m[1] + ' hari'; }],
    [/^A copy is held for you\. Collect it at the library by (.+)\.$/, function (m) { return 'Satu eksemplar ditahan untukmu. Ambil di perpustakaan sebelum ' + m[1] + '.'; }],
    [/^You are number (\d+) in the queue\. We will hold a copy for you when it is returned\.$/, function (m) { return 'Kamu antrean nomor ' + m[1] + '. Kami akan menahan satu eksemplar untukmu saat dikembalikan.'; }],
    [/^Queue #(\d+|\?)$/, function (m) { return 'Antrean #' + m[1]; }],
    [/^(This month|Last month|This school year): (.+) to (.+)$/, function (m) { return word(m[1]) + ': ' + m[2] + ' sampai ' + m[3]; }],
    [/^(\d+) books?(, .+?)?( each)?$/, function (m) { return m[1] + ' buku' + (m[2] || '') + (m[3] ? ' masing-masing' : ''); }],
    [/^(\d+) books? returned by (\d+) readers?\.$/, function (m) { return m[1] + ' buku dikembalikan oleh ' + m[2] + ' pembaca.'; }],
    [/^Goal: (\d+) books? per student this month\. Classes are ranked by books per student, so every class has a fair chance\.$/,
      function (m) { return 'Target: ' + m[1] + ' buku per siswa bulan ini. Kelas diurutkan berdasarkan buku per siswa, jadi setiap kelas punya peluang yang adil.'; }],
    [/^([\d.]+) books per student \((\d+) books? from (\d+) students?\)$/, function (m) { return m[1] + ' buku per siswa (' + m[2] + ' buku dari ' + m[3] + ' siswa)'; }],
    // browser tab title: "Page - School Library"
    [/^(.+?) - (.+)$/, function (m) {
      const first = ex(m[1]);
      if (first === undefined) return undefined;
      return first + ' - ' + m[2].replace(/ Library$/, ' Perpustakaan');
    }],
    // footer / brand: "SMA S ... Library"
    [/^(.+) Library$/, function (m) { return m[1] + ' Perpustakaan'; }]
  ];

  function tr(str) {
    if (lang !== 'id' || typeof str !== 'string') return str;
    const trimmed = str.trim();
    if (!trimmed) return str;
    let out = ex(trimmed);
    if (out === undefined) {
      for (let i = 0; i < RULES.length; i++) {
        const m = RULES[i][0].exec(trimmed);
        if (m) { out = RULES[i][1](m); if (out !== undefined) break; }
      }
    }
    if (out === undefined) return str;
    return str.slice(0, str.indexOf(trimmed)) + out + str.slice(str.indexOf(trimmed) + trimmed.length);
  }

  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };

  function walk(node) {
    if (node.nodeType === 3) {
      const v = tr(node.nodeValue);
      if (v !== node.nodeValue) node.nodeValue = v;
      return;
    }
    if (node.nodeType !== 1 || SKIP[node.nodeName] || (node.hasAttribute && node.hasAttribute('data-no-i18n'))) return;
    ATTRS.forEach(function (a) {
      if (node.hasAttribute(a)) { const v = tr(node.getAttribute(a)); if (v !== node.getAttribute(a)) node.setAttribute(a, v); }
    });
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function start() {
    document.documentElement.setAttribute('lang', 'id');
    walk(document.documentElement);
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        if (mu.type === 'childList') { Array.prototype.forEach.call(mu.addedNodes, walk); }
        else if (mu.type === 'characterData') { const v = tr(mu.target.nodeValue); if (v !== mu.target.nodeValue) mu.target.nodeValue = v; }
        else if (mu.type === 'attributes') { const v = tr(mu.target.getAttribute(mu.attributeName)); if (v !== mu.target.getAttribute(mu.attributeName)) mu.target.setAttribute(mu.attributeName, v); }
      });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  if (lang === 'id') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }

  return {
    lang: function () { return lang; },
    locale: function () { return lang === 'id' ? 'id-ID' : 'en-GB'; },
    t: tr,
    toggle: function () {
      try { localStorage.setItem(KEY, lang === 'id' ? 'en' : 'id'); } catch (e) { /* ignore */ }
      location.reload();
    }
  };
})();

// A top-level const is not a property of window, and ui.js checks window.I18N.
window.I18N = I18N;
