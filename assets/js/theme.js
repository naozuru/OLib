/**
 * Light / dark theme. Loaded in the <head> of every page so the right theme is set before
 * anything is painted (no flash). The choice is remembered in this browser; the first visit
 * follows the device setting.
 */
(function () {
  var KEY = 'lib_theme';
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function system() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function current() { var s = stored(); return s === 'dark' || s === 'light' ? s : system(); }
  function apply(t) { document.documentElement.setAttribute('data-theme', t); }
  apply(current());
  window.Theme = {
    current: current,
    toggle: function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
      apply(next);
      return next;
    }
  };
})();
