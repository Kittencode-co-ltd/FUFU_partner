// Show / hide password toggles for login.html and register.html.
// Kept as an external file because the portal CSP (script-src 'self') blocks inline scripts.

const EYE_OPEN = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
     -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`;

const EYE_CLOSED = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7
     a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878
     l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59
     m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0
     01-4.132 5.411m0 0L21 21"/>`;

// login.html
document.getElementById('toggle-pw')?.addEventListener('click', () => {
  const pw  = document.getElementById('password');
  const ico = document.getElementById('eye-icon');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  if (ico) ico.innerHTML = show ? EYE_CLOSED : EYE_OPEN;
});

// register.html
document.getElementById('toggle-reg-pw')?.addEventListener('click', () => {
  const pw = document.getElementById('reg-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});
