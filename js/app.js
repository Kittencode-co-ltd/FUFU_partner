/**
 * FUFU Partner – Application Entry Point
 * Auto-detects the current page and initializes the correct module.
 * @module app
 */

import { initGlobalErrorHandlers } from './utils/error-boundary.js';

// Initialize global error handlers first
initGlobalErrorHandlers();

/**
 * Detect the current page from the URL pathname.
 * @returns {'landing'|'login'|'dashboard'|'register'}
 */
function detectPage() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('login'))     return 'login';
  if (path.includes('dashboard')) return 'dashboard';
  if (path.includes('register'))  return 'register';
  return 'landing';
}

/**
 * Initialize the application based on the detected page.
 */
async function init() {
  const page = detectPage();

  switch (page) {
    case 'landing': {
      const { initHero } = await import('./landing/hero.js');
      const { initBooking } = await import('./landing/booking.js');
      const { initTestimonials } = await import('./landing/testimonials.js');
      const { initBusinessFeatures } = await import('./landing/business-features.js');
      
      initHero();
      initBusinessFeatures();
      initBooking();
      initTestimonials();
      break;
    }

    case 'login': {
      const { isAuthenticated, doLogin, renderStoreSelection, getRedirectUrl } = await import('./auth.js');
      const { showToast } = await import('./utils/notifications.js');

      // If already authenticated, redirect to dashboard
      if (isAuthenticated()) {
        window.location.href = getRedirectUrl();
        return;
      }

      // Set up login form handler
      const loginForm = document.getElementById('loginForm');
      const loginBtn = document.getElementById('loginBtn');
      const spinner = document.getElementById('loginSpinner');
      const btnText = document.getElementById('loginBtnText');

      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const email = document.getElementById('email')?.value?.trim();
          const password = document.getElementById('password')?.value;

          if (!email || !password) {
            showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
            return;
          }

          // Show loading state
          if (loginBtn) loginBtn.disabled = true;
          if (spinner) spinner.style.display = 'inline-block';
          if (btnText) btnText.textContent = 'กำลังเข้าสู่ระบบ...';

          const result = await doLogin(email, password);

          // Reset loading state
          if (loginBtn) loginBtn.disabled = false;
          if (spinner) spinner.style.display = 'none';
          if (btnText) btnText.textContent = 'เข้าสู่ระบบ';

          if (result.success) {
            showToast('เข้าสู่ระบบสำเร็จ!');
            renderStoreSelection(result.stores, result.token, result.user);
          } else {
            showToast(result.error, 'error');
          }
        });
      }

      break;
    }

    case 'dashboard': {
      const { requireAuth } = await import('./auth.js');

      // Auth guard — redirects to login if not authenticated
      if (!requireAuth('dashboard.html')) return;

      const { initDashboard } = await import('./partner/dashboard.js');
      initDashboard();
      break;
    }

    case 'register': {
      const { initRegister } = await import('./register.js');
      initRegister();
      break;
    }
  }
}

// Boot the application
init().catch(err => {
  console.error('[App] Failed to initialize:', err);
});
