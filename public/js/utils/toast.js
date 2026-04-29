let _toastEl = null;
let _timer   = null;

function _ensure() {
  if (_toastEl) return;
  _toastEl = document.createElement('div');
  _toastEl.id = 'fufu-toast';
  _toastEl.className = [
    'fixed bottom-6 right-6 z-50 flex items-center gap-3',
    'bg-white border rounded-xl px-5 py-4 shadow-card-hover',
    'text-sm font-semibold font-sans',
    'translate-y-24 opacity-0 transition-all duration-300 pointer-events-none',
  ].join(' ');
  document.body.appendChild(_toastEl);
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'success', duration = 3000) {
  _ensure();
  clearTimeout(_timer);

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const colors = {
    success: 'border-primary text-primary',
    error:   'border-red-400 text-red-600',
    info:    'border-accent text-accent-dark',
  };

  _toastEl.className = _toastEl.className
    .replace(/border-\S+|text-(?:primary|red|accent)\S*/g, '')
    .trim();
  _toastEl.className += ` ${colors[type] || colors.success}`;
  _toastEl.innerHTML = `<span>${icons[type] || icons.success}</span><span>${message}</span>`;

  // Slide in
  requestAnimationFrame(() => {
    _toastEl.classList.remove('translate-y-24', 'opacity-0');
    _toastEl.classList.add('translate-y-0', 'opacity-100');
  });

  _timer = setTimeout(() => {
    _toastEl.classList.add('translate-y-24', 'opacity-0');
    _toastEl.classList.remove('translate-y-0', 'opacity-100');
  }, duration);
}
