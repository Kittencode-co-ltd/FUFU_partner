/**
 * Responsive enhancements applied to whatever partner modules render into <main>.
 *
 * - Wraps every <table> that is not already inside a horizontal scroll container in
 *   `.table-scroll`, so wide tables scroll sideways on phones instead of breaking layout.
 *
 * Modules can opt a table out with `data-no-scroll-wrap`.
 */

function _hasScrollParent(el, stop) {
  for (let p = el.parentElement, depth = 0; p && p !== stop && depth < 3; p = p.parentElement, depth++) {
    const ox = getComputedStyle(p).overflowX;
    if (ox === 'auto' || ox === 'scroll' || p.classList.contains('table-scroll')) return true;
  }
  return false;
}

function _wrapTables(root) {
  root.querySelectorAll('table:not([data-no-scroll-wrap])').forEach(table => {
    if (table.dataset.scrollChecked) return;
    table.dataset.scrollChecked = '1';
    if (_hasScrollParent(table, root)) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
}

export function initResponsiveEnhancements(root = document.getElementById('app-main')) {
  if (!root) return;

  // Topbar gets a border + shadow once content scrolls under it
  const onScroll = () => document.body.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let queued = false;
  const run = () => { queued = false; _wrapTables(root); };
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }).observe(root, { childList: true, subtree: true });
  run();
}
