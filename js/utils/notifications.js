/**
 * FUFU Partner – Toast Notifications
 * Provides showToast for user feedback messages.
 * @module notifications
 */

let toastTimeout = null;

/**
 * Show a toast notification message.
 * Automatically finds or creates the toast DOM element.
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'} type - Toast type (affects icon)
 * @param {number} duration - How long to show (ms)
 */
export function showToast(message, type = 'success', duration = 3500) {
  let toast = document.getElementById('toast');
  let toastText = document.getElementById('toast-text');
  let toastIcon = document.querySelector('.toast-icon');

  // Create toast element if it doesn't exist on the page
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    toast.innerHTML = `
      <i class="fas fa-check-circle toast-icon"></i>
      <div class="toast-text" id="toast-text"></div>
    `;
    document.body.appendChild(toast);
    toastText = toast.querySelector('.toast-text');
    toastIcon = toast.querySelector('.toast-icon');
  }

  // Update icon based on type
  if (toastIcon) {
    toastIcon.className = 'toast-icon fas';
    switch (type) {
      case 'error':
        toastIcon.classList.add('fa-exclamation-circle');
        toastIcon.style.color = '#EF4444';
        break;
      case 'info':
        toastIcon.classList.add('fa-info-circle');
        toastIcon.style.color = '#3B82F6';
        break;
      default:
        toastIcon.classList.add('fa-check-circle');
        toastIcon.style.color = '';
        break;
    }
  }

  if (toastText) toastText.textContent = message;

  // Clear any existing timeout
  if (toastTimeout) clearTimeout(toastTimeout);

  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}
