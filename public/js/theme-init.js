// Display preferences (theme + text size). Loaded synchronously in <head> so they apply before first paint.
// Both are per-device UI preferences, kept outside STORAGE_KEYS so logging out does not reset them.
//   fufu_theme       'light' | 'dark' | 'auto'   (missing = auto)
//   fufu_font_scale  'sm' | 'md' | 'lg' | 'xl'   (missing = md)
(function () {
  var THEME_KEY = 'fufu_theme';
  var SCALE_KEY = 'fufu_font_scale';
  var SCALES = { sm: '93.75%', md: '100%', lg: '112.5%', xl: '125%' };
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } }

  function getTheme() {
    var t = read(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  }
  function applyTheme() {
    var t = getTheme();
    var dark = t === 'dark' || (t === 'auto' && !!(media && media.matches));
    root.classList.toggle('dark', dark);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0B1416' : '#F5F9F8');
  }
  function getFontScale() {
    var s = read(SCALE_KEY);
    return SCALES[s] ? s : 'md';
  }
  function applyFontScale() {
    var s = getFontScale();
    root.style.fontSize = SCALES[s];
    root.dataset.fontScale = s;
  }

  applyTheme();
  applyFontScale();
  if (media && media.addEventListener) media.addEventListener('change', function () { if (getTheme() === 'auto') applyTheme(); });

  window.FufuPrefs = {
    getTheme: getTheme,
    setTheme: function (t) { write(THEME_KEY, t === 'light' || t === 'dark' ? t : 'auto'); applyTheme(); },
    getFontScale: getFontScale,
    setFontScale: function (s) { if (SCALES[s]) { write(SCALE_KEY, s); applyFontScale(); } },
  };
})();
