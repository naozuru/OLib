/**
 * Look up book details by ISBN (used by the admin Books page).
 * Sources: Google Books first, Open Library as a fallback. Both allow requests straight
 * from the browser, so no extra server code is needed. Needs an internet connection.
 *
 * ISBN.lookup('9789793062792') -> { judul, penulis, penerbit, tahun, kategori, deskripsi, cover_url, source }
 *                                 or null when no database knows the book.
 */
const ISBN = (function () {
  function clean(s) { return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); }
  function valid(s) { const c = clean(s); return c.length === 10 || c.length === 13; }
  function year(s) { const m = /(\d{4})/.exec(String(s || '')); return m ? m[1] : ''; }
  function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function fromGoogle(isbn) {
    const d = await getJson('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn + '&maxResults=1');
    const v = d.items && d.items[0] && d.items[0].volumeInfo;
    if (!v) return null;
    const img = v.imageLinks || {};
    return {
      judul: [v.title, v.subtitle].filter(Boolean).join(': '),
      penulis: (v.authors || []).join(', '),
      penerbit: v.publisher || '',
      tahun: year(v.publishedDate),
      kategori: (v.categories && v.categories[0]) || '',
      deskripsi: stripHtml(v.description),
      cover_url: (img.thumbnail || img.smallThumbnail || '').replace(/^http:/, 'https:').replace('&edge=curl', ''),
      source: 'Google Books'
    };
  }

  async function fromOpenLibrary(isbn) {
    const d = await getJson('https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data');
    const v = d['ISBN:' + isbn];
    if (!v) return null;
    return {
      judul: [v.title, v.subtitle].filter(Boolean).join(': '),
      penulis: (v.authors || []).map(function (a) { return a.name; }).join(', '),
      penerbit: (v.publishers && v.publishers[0] && v.publishers[0].name) || '',
      tahun: year(v.publish_date),
      kategori: (v.subjects && v.subjects[0] && v.subjects[0].name) || '',
      deskripsi: '',
      cover_url: (v.cover && (v.cover.medium || v.cover.small)) || '',
      source: 'Open Library'
    };
  }

  /** Resolves to the book details, or null when nothing was found. Throws when both services are unreachable. */
  async function lookup(raw) {
    const isbn = clean(raw);
    if (!valid(isbn)) throw new Error('Enter a valid 10 or 13 digit ISBN');
    let found = null, failures = 0;
    try { found = await fromGoogle(isbn); } catch (e) { failures++; }
    if (!found || !found.judul) {
      found = null;
      try { found = await fromOpenLibrary(isbn); } catch (e) { failures++; }
    }
    if (!found || !found.judul) {
      if (failures >= 2) throw new Error('Could not reach the book databases. Check the internet connection and try again.');
      return null;
    }
    return found;
  }

  return { clean: clean, valid: valid, lookup: lookup };
})();
