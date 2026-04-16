/**
 * FUFU Partner – Error Boundary
 * Global error handling, loading states, and empty states.
 * @module error-boundary
 */

/**
 * Wrap an async function with error handling.
 * Shows toast on error and logs to console.
 * @param {Function} fn - Async function to wrap
 * @param {string} fallbackMessage - Message to show on error
 * @returns {Function}
 */
export function withErrorBoundary(fn, fallbackMessage = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') {
  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      console.error('[ErrorBoundary]', error);
      // Dynamically import to avoid circular dependencies
      const { showToast } = await import('./notifications.js');
      showToast(fallbackMessage, 'error');
      return null;
    }
  };
}

/**
 * Show a loading skeleton inside a container.
 * @param {HTMLElement} container
 * @param {number} rows - Number of skeleton rows
 */
export function showLoading(container, rows = 3) {
  if (!container) return;
  const skeletons = Array.from({ length: rows }, () =>
    `<div style="padding:16px 0;border-bottom:1px solid var(--border-soft);">
      <div style="height:12px;width:${60 + Math.random() * 30}%;background:var(--bg-subtle);border-radius:6px;margin-bottom:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
      <div style="height:10px;width:${40 + Math.random() * 20}%;background:var(--bg-subtle);border-radius:6px;animation:pulse 1.5s ease-in-out infinite;"></div>
    </div>`
  ).join('');

  container.innerHTML = `
    <style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }</style>
    ${skeletons}
  `;
}

/**
 * Show an empty state message inside a container.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {string} icon - FontAwesome icon class
 */
export function showEmptyState(container, message = 'ยังไม่มีข้อมูล', icon = 'fa-inbox') {
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
      <i class="fas ${icon}" style="font-size:2rem;margin-bottom:12px;opacity:0.4;display:block;"></i>
      <div style="font-family:'Sarabun',sans-serif;font-size:14px;">${message}</div>
    </div>
  `;
}

/**
 * Set up global unhandled error listeners.
 * Call once during app initialization.
 */
export function initGlobalErrorHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
  });

  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);
  });
}
