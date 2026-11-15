// "Install on home screen" for every partner type, opened from the profile menu.
// Chrome / Edge / Samsung Internet (Android + desktop): uses the browser's own install prompt
// (beforeinstallprompt). Everywhere else (iPhone/iPad Safari, macOS Safari, browsers that hid the
// prompt, in-app browsers) it shows short step-by-step instructions for that device.
import { openSheet } from './sheet.js';
import { getLang } from './portal-i18n.js';
import { isInAppBrowser } from '../utils/in-app-browser.js';
import { showToast } from '../utils/toast.js';

const TEXT = {
  th: {
    bannerTitle: 'ติดตั้ง FUFU Partner บนหน้าจอโฮม', bannerSub: 'เปิดได้ในแตะเดียว เต็มจอ และรับแจ้งเตือนการจอง', later: 'ไว้ทีหลัง',
    menu: 'ติดตั้งบนหน้าจอโฮม', installed: 'ติดตั้งแล้ว', title: 'ติดตั้ง FUFU Partner',
    why: 'เปิดจากไอคอนบนหน้าจอได้ทันที แสดงเต็มจอเหมือนแอป และบน iPhone/iPad ต้องติดตั้งก่อนจึงจะรับแจ้งเตือนได้',
    install: 'ติดตั้งเลย', done: 'ติดตั้ง FUFU Partner แล้ว', alreadyTitle: 'ติดตั้งไว้แล้ว', already: 'คุณกำลังใช้ FUFU Partner จากไอคอนบนหน้าจอ',
    ios: ['แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ในแถบของ Safari หรือ Chrome', 'เลื่อนลงแล้วเลือก “เพิ่มไปยังหน้าจอโฮม”', 'แตะ “เพิ่ม” แล้วเปิด FUFU Partner จากไอคอน'],
    android: ['แตะเมนู ⋮ มุมขวาบนของ Chrome', 'เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”', 'แตะ “ติดตั้ง”'],
    desktop: ['คลิกไอคอนติดตั้ง ⊕ ท้ายช่อง URL ของ Chrome หรือ Edge', 'หรือเปิดเมนู ⋮ แล้วเลือก “ติดตั้ง FUFU Partner”', 'กด “ติดตั้ง”'],
    mac: ['เปิดเมนู “ไฟล์” ของ Safari', 'เลือก “เพิ่มไปที่ Dock”', 'กด “เพิ่ม”'],
    firefox: 'Firefox บนคอมพิวเตอร์ยังติดตั้งเว็บแอปไม่ได้ — เปิดลิงก์นี้ใน Chrome, Edge หรือ Safari',
    inApp: 'กำลังเปิดในแอปอื่น เช่น LINE หรือ Facebook — กดเมนู ⋯ แล้วเลือก “เปิดในเบราว์เซอร์” ก่อนติดตั้ง',
  },
  en: {
    bannerTitle: 'Install FUFU Partner on your home screen', bannerSub: 'One tap to open, full screen, with booking alerts', later: 'Not now',
    menu: 'Install on home screen', installed: 'Installed', title: 'Install FUFU Partner',
    why: 'Open it straight from an icon, full screen like an app. On iPhone/iPad it must be installed to receive notifications.',
    install: 'Install', done: 'FUFU Partner installed', alreadyTitle: 'Already installed', already: 'You are using FUFU Partner from its home screen icon.',
    ios: ['Tap the Share button (square with an up arrow) in Safari or Chrome', 'Scroll down and choose “Add to Home Screen”', 'Tap “Add”, then open FUFU Partner from the icon'],
    android: ['Tap the ⋮ menu at the top right of Chrome', 'Choose “Install app” or “Add to Home screen”', 'Tap “Install”'],
    desktop: ['Click the install icon ⊕ at the end of the Chrome or Edge address bar', 'Or open the ⋮ menu and choose “Install FUFU Partner”', 'Click “Install”'],
    mac: ['Open Safari’s File menu', 'Choose “Add to Dock”', 'Click “Add”'],
    firefox: 'Firefox on desktop cannot install web apps — open this link in Chrome, Edge or Safari.',
    inApp: 'You’re inside another app like LINE or Facebook. Tap ⋯ → “Open in browser” first.',
  },
  zh: {
    bannerTitle: '将 FUFU Partner 添加到主屏幕', bannerSub: '一键打开、全屏显示，并接收预约提醒', later: '以后再说',
    menu: '添加到主屏幕', installed: '已安装', title: '安装 FUFU Partner',
    why: '从图标直接打开，像应用一样全屏显示。在 iPhone/iPad 上需先安装才能收到通知。',
    install: '安装', done: '已安装 FUFU Partner', alreadyTitle: '已安装', already: '您正在通过主屏幕图标使用 FUFU Partner。',
    ios: ['点按 Safari 或 Chrome 中的“分享”按钮（带向上箭头的方框）', '向下滚动，选择“添加到主屏幕”', '点按“添加”，然后从图标打开 FUFU Partner'],
    android: ['点按 Chrome 右上角的 ⋮ 菜单', '选择“安装应用”或“添加到主屏幕”', '点按“安装”'],
    desktop: ['点击 Chrome 或 Edge 地址栏末尾的安装图标 ⊕', '或打开 ⋮ 菜单，选择“安装 FUFU Partner”', '点击“安装”'],
    mac: ['打开 Safari 的“文件”菜单', '选择“添加到程序坞”', '点击“添加”'],
    firefox: '电脑版 Firefox 无法安装网页应用——请在 Chrome、Edge 或 Safari 中打开此链接。',
    inApp: '当前在 LINE、Facebook 等应用内打开。请先点按 ⋯ →“在浏览器中打开”。',
  },
  ja: {
    bannerTitle: 'FUFU Partner をホーム画面に追加', bannerSub: 'ワンタップで開けて全画面表示、予約の通知も届きます', later: 'あとで',
    menu: 'ホーム画面に追加', installed: 'インストール済み', title: 'FUFU Partner をインストール',
    why: 'アイコンからすぐに開け、アプリのように全画面で使えます。iPhone/iPad で通知を受け取るにはインストールが必要です。',
    install: 'インストール', done: 'FUFU Partner をインストールしました', alreadyTitle: 'インストール済み', already: 'ホーム画面のアイコンから FUFU Partner を使用しています。',
    ios: ['Safari または Chrome の共有ボタン（上向き矢印の四角）をタップ', '下にスクロールして「ホーム画面に追加」を選択', '「追加」をタップし、アイコンから FUFU Partner を開く'],
    android: ['Chrome 右上の ⋮ メニューをタップ', '「アプリをインストール」または「ホーム画面に追加」を選択', '「インストール」をタップ'],
    desktop: ['Chrome または Edge のアドレスバー右端のインストールアイコン ⊕ をクリック', 'または ⋮ メニューから「FUFU Partner をインストール」を選択', '「インストール」をクリック'],
    mac: ['Safari の「ファイル」メニューを開く', '「Dock に追加」を選択', '「追加」をクリック'],
    firefox: 'パソコン版 Firefox は Web アプリをインストールできません。Chrome、Edge、Safari で開いてください。',
    inApp: 'LINE や Facebook などのアプリ内で開いています。先に ⋯ →「ブラウザで開く」を選んでください。',
  },
  ko: {
    bannerTitle: 'FUFU Partner를 홈 화면에 설치하세요', bannerSub: '한 번에 열고 전체 화면으로, 예약 알림도 받아요', later: '나중에',
    menu: '홈 화면에 설치', installed: '설치됨', title: 'FUFU Partner 설치',
    why: '아이콘으로 바로 열고 앱처럼 전체 화면으로 사용해요. iPhone/iPad에서는 설치해야 알림을 받을 수 있어요.',
    install: '설치하기', done: 'FUFU Partner를 설치했어요', alreadyTitle: '이미 설치됨', already: '홈 화면 아이콘으로 FUFU Partner를 사용하고 있어요.',
    ios: ['Safari 또는 Chrome의 공유 버튼(위쪽 화살표가 있는 사각형)을 누르세요', '아래로 스크롤해 ‘홈 화면에 추가’를 선택하세요', '‘추가’를 누른 뒤 아이콘으로 FUFU Partner를 여세요'],
    android: ['Chrome 오른쪽 위의 ⋮ 메뉴를 누르세요', '‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요', '‘설치’를 누르세요'],
    desktop: ['Chrome 또는 Edge 주소창 끝의 설치 아이콘 ⊕을 클릭하세요', '또는 ⋮ 메뉴에서 ‘FUFU Partner 설치’를 선택하세요', '‘설치’를 클릭하세요'],
    mac: ['Safari의 ‘파일’ 메뉴를 여세요', '‘Dock에 추가’를 선택하세요', '‘추가’를 클릭하세요'],
    firefox: '데스크톱 Firefox는 웹 앱을 설치할 수 없어요. Chrome, Edge 또는 Safari에서 열어 주세요.',
    inApp: 'LINE·Facebook 같은 앱 안에서 열려 있어요. 먼저 ⋯ → ‘브라우저에서 열기’를 눌러 주세요.',
  },
};
export const installText = key => (TEXT[getLang()] || TEXT.th)[key] ?? TEXT.th[key];

// The browser fires this once, early; keep it for when the user taps "Install".
let _deferred = null;
if (typeof window !== 'undefined') {
  _deferred = window.__fufuInstallPrompt || null;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); _deferred = event; });
  window.addEventListener('appinstalled', () => { _deferred = null; showToast(installText('done')); });
}

const ua = () => navigator.userAgent || '';
// iPadOS reports itself as a Mac; a touch screen gives it away (never true for Android)
const isIOS = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/Android/i.test(ua()));
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/** Which instructions fit this device. Exported for tests. */
export function installMode({ userAgent = ua(), ios = isIOS(), standalone = isStandalone(), canPrompt = Boolean(_deferred), inApp = isInAppBrowser() } = {}) {
  if (standalone) return 'installed';
  if (inApp) return 'inApp';
  if (canPrompt) return 'prompt';
  if (ios) return 'ios'; // Safari, and Chrome/Edge on iOS 16.4+, all add to the home screen from the Share sheet
  if (/Android/i.test(userAgent)) return 'android';
  if (/Firefox\//.test(userAgent)) return 'firefox';
  if (/Macintosh/.test(userAgent) && /Version\/\d+.*Safari/.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent)) return 'mac';
  return 'desktop';
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

export function openInstallSheet() {
  const mode = installMode();
  const sheet = openSheet({ title: installText(mode === 'installed' ? 'alreadyTitle' : 'title') });
  if (mode === 'installed') {
    sheet.body.innerHTML = `<p class="ia-note">${esc(installText('already'))}</p>`;
    return sheet;
  }
  const steps = TEXT.th[mode] && Array.isArray(TEXT.th[mode]) ? installText(mode) : null;
  sheet.body.innerHTML = `
    <div class="ia-hero">
      <img src="/img/brand/apple-touch-icon.png" alt="" width="56" height="56" class="ia-icon">
      <p class="ia-why">${esc(installText('why'))}</p>
    </div>
    ${steps ? `<ol class="ia-steps">${steps.map((s, i) => `<li style="--i:${i}"><span class="ia-n">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>` : ''}
    ${mode === 'prompt' ? '' : !steps ? `<p class="ia-note is-warn">${esc(installText(mode))}</p>` : ''}`;
  if (mode === 'prompt') {
    sheet.foot.innerHTML = `<button type="button" class="ph-btn is-primary ia-go" data-ia-go>${esc(installText('install'))}</button>`;
    sheet.foot.querySelector('[data-ia-go]').onclick = async () => {
      const prompt = _deferred;
      if (!prompt) { sheet.close(); return openInstallSheet(); }
      _deferred = null;
      prompt.prompt();
      await prompt.userChoice.catch(() => null);
      sheet.close();
    };
  }
  return sheet;
}

// ─── Overview banner ─────────────────────────────────────────────────────────
// A small card at the top of the Overview page until the user installs or taps "Not now" (per user).
const bannerKey = userId => 'fufu_install_banner_v1:' + (userId || 'anon');

export function initInstallBanner(userId) {
  try { if (localStorage.getItem(bannerKey(userId)) === 'dismissed') return; } catch { return; }
  if (installMode() === 'installed' || document.getElementById('install-banner')) return;
  const main = document.getElementById('app-main');
  if (!main) return;
  const card = document.createElement('div');
  card.id = 'install-banner';
  card.className = 'ia-banner';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', installText('menu'));
  card.innerHTML = `
    <img src="/img/brand/apple-touch-icon.png" alt="" width="40" height="40" class="ia-banner__icon">
    <div class="ia-banner__text"><b>${esc(installText('bannerTitle'))}</b><span>${esc(installText('bannerSub'))}</span></div>
    <div class="ia-banner__actions">
      <button type="button" class="ia-banner__later" data-ia-later>${esc(installText('later'))}</button>
      <button type="button" class="ia-banner__go" data-ia-open>${esc(installText('install'))}</button>
    </div>`;
  main.prepend(card);
  const remove = () => { card.classList.add('is-leaving'); setTimeout(() => card.remove(), 240); };
  card.addEventListener('click', e => {
    if (e.target.closest('[data-ia-open]')) openInstallSheet();
    if (e.target.closest('[data-ia-later]')) { try { localStorage.setItem(bannerKey(userId), 'dismissed'); } catch { /* ignore */ } remove(); }
  });
  const sync = page => { card.hidden = page !== 'home'; };
  sync(sessionStorage.getItem('fufu_current_page') || 'home');
  document.addEventListener('fufu:navigate', e => sync(e.detail));
  window.addEventListener('appinstalled', remove);
}
