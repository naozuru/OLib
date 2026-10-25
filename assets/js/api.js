/**
 * API client for the Google Apps Script backend.
 * - get()  : public actions (catalog, student status), optional caching
 * - post() : admin actions (adds the session token automatically) and public writes
 * POST uses Content-Type text/plain so the browser does not send a CORS preflight.
 */
const API = (function () {
  const TOKEN_KEY = 'lib_token';
  const api = { onSessionExpired: null };

  api.ready = function () {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(CONFIG.API_URL);
  };

  api.getToken = function () {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  };
  api.setToken = function (t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) { /* ignore */ }
  };
  api.clearToken = function () {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  };

  async function parse(res) {
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('The server did not respond correctly. Check the Web App URL in config.js and make sure the deployment access is "Anyone".');
    }
    if (!json.ok) {
      const err = new Error(json.error || 'Something went wrong');
      if (/Session expired/.test(err.message)) {
        api.clearToken();
        if (api.onSessionExpired) api.onSessionExpired();
      }
      throw err;
    }
    return json.data;
  }

  function networkError() {
    return new Error('Could not reach the server. Check your internet connection and try again.');
  }

  /** ttl = cache lifetime in seconds (0 = no cache) */
  api.get = async function (action, params, ttl) {
    if (!api.ready()) throw new Error('The Web App URL is not set in assets/js/config.js yet');
    params = params || {};
    const qs = new URLSearchParams(Object.assign({ action: action }, params)).toString();
    const key = 'lib_cache_' + qs;
    if (ttl) {
      try {
        const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (hit && Date.now() - hit.t < ttl * 1000) return hit.d;
      } catch (e) { /* ignore */ }
    }
    let res;
    try { res = await fetch(CONFIG.API_URL + '?' + qs); } catch (e) { throw networkError(); }
    const data = await parse(res);
    if (ttl) {
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* ignore */ }
    }
    return data;
  };

  api.post = async function (action, body, opts) {
    if (!api.ready()) throw new Error('The Web App URL is not set in assets/js/config.js yet');
    const withAuth = !(opts && opts.auth === false);
    const payload = Object.assign({ action: action }, body || {});
    if (withAuth) payload.token = api.getToken();
    let res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (e) { throw networkError(); }
    return parse(res);
  };

  return api;
})();
