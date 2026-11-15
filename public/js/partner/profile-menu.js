// Profile menu — one place for the account, store settings, display preferences and logout.
// Opens from the avatar button in the top bar (#profile-btn). On phones it shows as a bottom sheet.
import { icon } from '../utils/icons.js';
import { t, LANGS, getLang, setLang, pageLabel } from './portal-i18n.js';
import { showToast } from '../utils/toast.js';
import { getPushState, enablePush, disablePush, pushText } from './push-notifications.js';
import { guideText } from './welcome-guide.js';
import { installText, isStandalone, openInstallSheet } from './install-app.js';

const ROLES = ['owner', 'vet', 'reception', 'staff', 'accountant', 'counter', 'admin'];
const THEMES = ['light', 'dark', 'auto'];
const SCALES = ['sm', 'md', 'lg', 'xl'];

let _state = { email: '', role: '', storeName: '', items: [], onNavigate: () => {}, onLogout: () => {}, onGuide: null };
let _open = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
const prefs = () => window.FufuPrefs || { getTheme: () => 'auto', setTheme: () => {}, getFontScale: () => 'md', setFontScale: () => {} };

function _initial(email) {
  return (String(email || '?').trim()[0] || '?').toUpperCase();
}

export function roleLabel(role) {
  return String(role || '').split(',').map(r => r.trim()).map(r => (ROLES.includes(r) ? t(r) : r)).filter(Boolean).join(' · ');
}

/** Set up once from initDashboard. Later calls (e.g. after a store switch) just update the data. */
export function initProfileMenu(options) {
  _state = { ..._state, ...options };
  const btn = document.getElementById('profile-btn');
  if (!btn) return;
  btn.querySelector('[data-profile-initial]').textContent = _initial(_state.email);
  btn.setAttribute('aria-label', `${t('account')} · ${_state.email}`);
  if (btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', event => { event.stopPropagation(); _toggle(); });
  document.addEventListener('click', event => {
    // composedPath is captured at dispatch, so clicks on buttons that re-render the menu still count as inside
    if (_open && !event.composedPath().some(el => el.id === 'profile-menu')) _toggle(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && _open) { _toggle(false); btn.focus(); }
  });
}

/** Settings pages that live in the menu instead of the sidebar (role-filtered by the caller). */
export function setProfileMenuItems(items) {
  _state.items = items;
  if (_open) _render();
}

export function setProfileRole(role) {
  _state.role = role;
  if (_open) _render();
}

function _toggle(force) {
  _open = typeof force === 'boolean' ? force : !_open;
  const btn = document.getElementById('profile-btn');
  btn?.setAttribute('aria-expanded', String(_open));
  let menu = document.getElementById('profile-menu');
  if (!_open) {
    menu?.classList.remove('is-open');
    document.body.classList.remove('pm-open');
    return;
  }
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'profile-menu';
    menu.className = 'pm';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', t('account'));
    document.body.appendChild(menu);
    menu.addEventListener('click', _onClick);
  }
  _render();
  document.body.classList.add('pm-open');
  // Only if still open: a close in the same frame must not leave a stuck, invisible-but-open menu behind
  requestAnimationFrame(() => { if (_open) menu.classList.add('is-open'); });
}

function _segmented(name, options, current) {
  return `<div class="pm-seg" role="radiogroup" aria-label="${name === 'theme' ? t('theme') : t('textSize')}">${options.map(value => { const label = t(value); return `
    <button type="button" role="radio" aria-checked="${value === current}" data-pref="${name}" data-value="${value}" class="${value === current ? 'is-on' : ''}">
      ${name === 'scale' ? `<span class="pm-aa pm-aa--${value}" aria-hidden="true">${getLang() === 'th' ? 'ก' : 'A'}</span>` : ''}${label}
    </button>`; }).join('')}</div>`;
}

function _render() {
  const menu = document.getElementById('profile-menu');
  if (!menu) return;
  const p = prefs();
  menu.innerHTML = `
    <div class="pm-panel">
      <div class="pm-grab" aria-hidden="true"></div>
      <div class="pm-head">
        <span class="pm-avatar" aria-hidden="true">${esc(_initial(_state.email))}</span>
        <div class="min-w-0">
          <div class="pm-email">${esc(_state.email)}</div>
          <div class="pm-sub">${esc(roleLabel(_state.role) || t('user'))}${_state.storeName ? ` · ${esc(_state.storeName)}` : ''}</div>
        </div>
      </div>

      ${_state.items.length ? `<div class="pm-group">${_state.items.map(item => `
        <button type="button" class="pm-row" data-pm-nav="${esc(item.id)}">
          <span class="pm-row__icon">${icon(item.icon, 'w-[18px] h-[18px]')}</span>
          <span class="pm-row__label">${esc(pageLabel(item.id, item.label))}</span>
          ${icon('chevron-right', 'w-4 h-4 pm-row__chev')}
        </button>`).join('')}</div>` : ''}

      <div class="pm-group">
        <div class="pm-label">${t('theme')}</div>
        ${_segmented('theme', THEMES, p.getTheme())}
        <div class="pm-label">${t('textSize')}</div>
        ${_segmented('scale', SCALES, p.getFontScale())}
        <div class="pm-label">${t('language')}</div>
        <div class="pm-langs" role="radiogroup" aria-label="${t('language')}">
          ${LANGS.map(l => `<button type="button" role="radio" lang="${l.html}" aria-checked="${l.code === getLang()}" class="${l.code === getLang() ? 'is-on' : ''}" data-pm-lang="${l.code}">${l.label}</button>`).join('')}
        </div>
        ${getLang() !== 'th' ? `<p class="pm-note">${t('partialNote')}</p>` : ''}
      </div>

      <div class="pm-group">
        <div class="pm-push">
          <span class="pm-row__icon">${icon('bell', 'w-[18px] h-[18px]')}</span>
          <div class="pm-push__text">
            <div class="pm-push__title" id="pm-push-title">${esc(pushText('title'))}</div>
            <div class="pm-push__desc" data-pm-push-desc>${esc(pushText('desc'))}</div>
          </div>
          <button type="button" class="pm-switch" role="switch" aria-checked="false" aria-labelledby="pm-push-title" data-pm-push hidden><span aria-hidden="true"></span></button>
        </div>
      </div>

      <div class="pm-group">
        <button type="button" class="pm-row" data-pm-install>
          <span class="pm-row__icon">${icon('download', 'w-[18px] h-[18px]')}</span>
          <span class="pm-row__label">${esc(installText('menu'))}</span>
          ${isStandalone() ? `<span class="pm-row__trail">${esc(installText('installed'))}</span>` : icon('chevron-right', 'w-4 h-4 pm-row__chev')}
        </button>
      ${_state.onGuide ? `
        <button type="button" class="pm-row" data-pm-guide>
          <span class="pm-row__icon">${icon('list-ul', 'w-[18px] h-[18px]')}</span>
          <span class="pm-row__label">${esc(guideText('menuEntry'))}</span>
          ${icon('chevron-right', 'w-4 h-4 pm-row__chev')}
        </button>` : ''}
      </div>

      <div class="pm-group">
        <button type="button" class="pm-row is-danger" data-pm-logout>
          <span class="pm-row__icon">${icon('right-from-bracket', 'w-[18px] h-[18px]')}</span>
          <span class="pm-row__label">${t('logout')}</span>
        </button>
      </div>
    </div>`;
  _refreshPush();
}

let _pushBusy = false;
async function _refreshPush() {
  const btn = document.querySelector('#profile-menu [data-pm-push]');
  const desc = document.querySelector('#profile-menu [data-pm-push-desc]');
  if (!btn || !desc) return;
  const state = await getPushState();
  const note = { 'in-app': 'inApp', 'ios-install': 'ios', unsupported: 'unsupported', 'not-configured': 'notReady', denied: 'blocked' }[state];
  desc.textContent = pushText(note || 'desc');
  desc.classList.toggle('is-warn', Boolean(note));
  btn.hidden = Boolean(note);
  btn.setAttribute('aria-checked', String(state === 'on'));
}

async function _togglePush(btn) {
  if (_pushBusy) return;
  _pushBusy = true;
  btn.disabled = true;
  const turnOn = btn.getAttribute('aria-checked') !== 'true';
  try {
    const ok = turnOn ? await enablePush() : await disablePush();
    if (ok) showToast(pushText(turnOn ? 'enabled' : 'disabled'));
    else if (!turnOn || Notification.permission !== 'denied') showToast(pushText('failed'), 'error');
  } catch {
    showToast(pushText('failed'), 'error');
  } finally {
    _pushBusy = false;
    btn.disabled = false;
    _refreshPush();
  }
}

function _onClick(event) {
  if (event.target === event.currentTarget) return _toggle(false); // backdrop (mobile sheet)
  const pref = event.target.closest('[data-pref]');
  if (pref) {
    const p = prefs();
    if (pref.dataset.pref === 'theme') p.setTheme(pref.dataset.value);
    else p.setFontScale(pref.dataset.value);
    _render();
    return;
  }
  // data-pm-lang, not data-lang: <html data-lang> would match closest() for every row in the menu
  const langBtn = event.target.closest('[data-pm-lang]');
  if (langBtn) { if (langBtn.dataset.pmLang !== getLang()) setLang(langBtn.dataset.pmLang); return; }
  const nav = event.target.closest('[data-pm-nav]');
  if (nav) { _toggle(false); _state.onNavigate(nav.dataset.pmNav); return; }
  const pushBtn = event.target.closest('[data-pm-push]');
  if (pushBtn) { _togglePush(pushBtn); return; }
  if (event.target.closest('[data-pm-install]')) { _toggle(false); openInstallSheet(); return; }
  if (event.target.closest('[data-pm-guide]')) { _toggle(false); _state.onGuide?.(); return; }
  if (event.target.closest('[data-pm-logout]')) { _toggle(false); _state.onLogout(); }
}
