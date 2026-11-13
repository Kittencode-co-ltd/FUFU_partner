// Minimal dialog: centred panel on desktop, bottom sheet on phones. Returns { root, body, foot, close }.
let _openCount = 0;

export function openSheet({ title = '', subtitle = '', wide = false, onClose } = {}) {
  const root = document.createElement('div');
  root.className = 'sh';
  root.innerHTML = `
    <div class="sh-panel ${wide ? 'is-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sh-title-${_openCount}">
      <div class="sh-grab" aria-hidden="true"></div>
      <header class="sh-head">
        <div class="min-w-0">
          <h2 class="sh-title" id="sh-title-${_openCount}"></h2>
          <p class="sh-sub"></p>
        </div>
        <button type="button" class="icon-btn" data-sh-close aria-label="ปิด">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </header>
      <div class="sh-body"></div>
      <footer class="sh-foot"></footer>
    </div>`;
  _openCount += 1;
  root.querySelector('.sh-title').textContent = title;
  const sub = root.querySelector('.sh-sub');
  if (subtitle) sub.textContent = subtitle; else sub.remove();
  document.body.appendChild(root);
  document.body.classList.add('sh-open');
  requestAnimationFrame(() => root.classList.add('is-open'));

  const previousFocus = document.activeElement;
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', e => {
    if (e.target === root || e.target.closest('[data-sh-close]')) close();
  });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    root.classList.remove('is-open');
    setTimeout(() => {
      root.remove();
      if (!document.querySelector('.sh')) document.body.classList.remove('sh-open');
    }, 220);
    previousFocus?.focus?.();
    onClose?.();
  }

  setTimeout(() => root.querySelector('[data-sh-close]')?.focus(), 50);
  return { root, body: root.querySelector('.sh-body'), foot: root.querySelector('.sh-foot'), close };
}
