// Web Push opt-in for Partner Portal staff (new booking requests and new reviews).
// Permission is only ever requested from a click on the profile-menu toggle, never on load.
import { apiFetch } from '../utils/api-client.js';
import { getLang } from './portal-i18n.js';
import { isInAppBrowser } from '../utils/in-app-browser.js';

const TEXT = {
  th: { readyTitle: 'การแจ้งเตือนพร้อมแล้ว', readyBody: 'คุณจะได้รับแจ้งเตือนคำขอจองใหม่และรีวิวใหม่ที่เครื่องนี้', title: 'แจ้งเตือนบนอุปกรณ์นี้', desc: 'รับแจ้งเตือนคำขอจองใหม่และรีวิวใหม่ แม้ปิดหน้าเว็บอยู่ · การแจ้งเตือนในระบบยังทำงานตามปกติ', on: 'เปิดอยู่', enable: 'เปิด', disable: 'ปิด', blocked: 'ถูกบล็อกในการตั้งค่าเบราว์เซอร์ — กดไอคอนข้างช่อง URL แล้วอนุญาตการแจ้งเตือน', ios: 'บน iPhone/iPad ให้กด แชร์ → เพิ่มไปยังหน้าจอโฮม แล้วเปิด FUFU Partner จากไอคอนก่อน (iOS 16.4 ขึ้นไป)', inApp: 'เปิดอยู่ในแอป เช่น LINE หรือ Facebook — กดเมนู ⋯ แล้วเลือก “เปิดในเบราว์เซอร์” (Chrome หรือ Safari) เพื่อเปิดการแจ้งเตือน', unsupported: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน', notReady: 'ระบบแจ้งเตือนยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์', enabled: 'เปิดการแจ้งเตือนแล้ว', disabled: 'ปิดการแจ้งเตือนแล้ว', failed: 'ตั้งค่าการแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง' },
  en: { readyTitle: 'Notifications are on', readyBody: 'New booking requests and reviews will now appear on this device.', title: 'Notifications on this device', desc: 'Get new booking requests and reviews, even when this page is closed · In-app alerts keep working either way', on: 'On', enable: 'Turn on', disable: 'Turn off', blocked: 'Notifications are blocked. Allow them in your browser’s site settings.', ios: 'On iPhone/iPad, tap Share → Add to Home Screen, then open FUFU Partner from the icon (iOS 16.4 or later).', inApp: 'You’re inside an app like LINE or Facebook. Tap ⋯ → “Open in browser” (Chrome or Safari) to turn on notifications.', unsupported: 'This browser does not support notifications', notReady: 'Notifications are not set up on the server yet', enabled: 'Notifications turned on', disabled: 'Notifications turned off', failed: 'Could not update notifications. Please try again.' },
  zh: { readyTitle: '通知已开启', readyBody: '新的预约请求和评价将推送到此设备。', title: '此设备上的通知', desc: '即使关闭页面，也能收到新预约请求和新评价 · 系统内通知不受影响', on: '已开启', enable: '开启', disable: '关闭', blocked: '浏览器已阻止通知，请在浏览器的网站设置中允许。', ios: '在 iPhone/iPad 上，点按“分享”→“添加到主屏幕”，然后从图标打开 FUFU Partner（需 iOS 16.4 或更高版本）。', inApp: '当前在 LINE、Facebook 等应用内打开。点按 ⋯ →“在浏览器中打开”（Chrome 或 Safari）即可开启通知。', unsupported: '此浏览器不支持通知', notReady: '服务器尚未设置通知', enabled: '通知已开启', disabled: '通知已关闭', failed: '无法更新通知设置，请重试。' },
  ja: { readyTitle: '通知がオンになりました', readyBody: '新しい予約リクエストとレビューがこの端末に届きます。', title: 'この端末への通知', desc: 'ページを閉じていても、新しい予約リクエストとレビューをお知らせします · 画面内の通知はそのまま届きます', on: 'オン', enable: 'オンにする', disable: 'オフにする', blocked: '通知がブロックされています。ブラウザのサイト設定で許可してください。', ios: 'iPhone/iPad では「共有」→「ホーム画面に追加」を選び、アイコンから FUFU Partner を開いてください（iOS 16.4 以降）。', inApp: 'LINE や Facebook などのアプリ内で開いています。⋯ →「ブラウザで開く」（Chrome または Safari）を選ぶと通知をオンにできます。', unsupported: 'このブラウザは通知に対応していません', notReady: 'サーバーで通知がまだ設定されていません', enabled: '通知をオンにしました', disabled: '通知をオフにしました', failed: '通知の設定を変更できませんでした。もう一度お試しください。' },
  ko: { readyTitle: '알림이 켜졌어요', readyBody: '새 예약 요청과 리뷰를 이 기기에서 받아요.', title: '이 기기 알림', desc: '페이지를 닫아도 새 예약 요청과 새 리뷰를 알려 드려요 · 화면 안 알림은 그대로 받아요', on: '켜짐', enable: '켜기', disable: '끄기', blocked: '알림이 차단되어 있어요. 브라우저의 사이트 설정에서 허용해 주세요.', ios: 'iPhone/iPad에서는 공유 → 홈 화면에 추가를 누른 뒤 아이콘으로 FUFU Partner를 열어 주세요(iOS 16.4 이상).', inApp: 'LINE·Facebook 같은 앱 안에서 열려 있어요. ⋯ → ‘브라우저에서 열기’(Chrome 또는 Safari)를 누르면 알림을 켤 수 있어요.', unsupported: '이 브라우저는 알림을 지원하지 않아요', notReady: '서버에 알림이 아직 설정되지 않았어요', enabled: '알림을 켰어요', disabled: '알림을 껐어요', failed: '알림 설정을 바꾸지 못했어요. 다시 시도해 주세요.' },
};
export const pushText = key => (TEXT[getLang()] || TEXT.th)[key] ?? TEXT.th[key];

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), ch => ch.charCodeAt(0));
}

let _config = null;
async function _getConfig() {
  if (_config) return _config;
  try {
    const res = await fetch('/api/push/config', { cache: 'no-store' });
    const data = await res.json();
    _config = data?.enabled && data.publicKey ? data : { enabled: false };
  } catch { _config = { enabled: false }; }
  return _config;
}

async function _currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * 'unsupported' | 'in-app' | 'ios-install' | 'not-configured' | 'denied' | 'on' | 'off'
 */
export async function getPushState() {
  if (isInAppBrowser()) return 'in-app';
  if (!supported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  const config = await _getConfig();
  if (!config.enabled) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await _currentSubscription().catch(() => null);
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Must be called from a click handler (browsers require a user gesture for the prompt). */
export async function enablePush() {
  const config = await _getConfig();
  if (!supported() || !config.enabled) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) });
  }
  const json = sub.toJSON();
  const res = await apiFetch('/api/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, locale: getLang() }),
  });
  if (!res?.success) { await sub.unsubscribe().catch(() => {}); return false; }
  // A first notification straight away, so people see it works on this device
  reg.showNotification(pushText('readyTitle'), { body: pushText('readyBody'), icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'fufu-push-ready' }).catch(() => {});
  return true;
}

export async function disablePush() {
  if (!supported()) return true;
  const sub = await _currentSubscription().catch(() => null);
  if (!sub) return true;
  const res = await apiFetch('/api/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe().catch(() => {});
  return Boolean(res?.success);
}

/** On logout, stop this browser receiving the old account's alerts (bounded so logout never hangs). */
export function disablePushQuietly(timeoutMs = 2500) {
  return Promise.race([disablePush().catch(() => false), new Promise(resolve => setTimeout(resolve, timeoutMs))]);
}

/** A notification click while the dashboard is open asks this tab to switch page. */
export function listenForPushNavigation(onPage) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'fufu-push-open') return;
    try {
      const page = new URL(event.data.url, location.origin).searchParams.get('page');
      if (page) onPage(page);
    } catch { /* ignore malformed message */ }
  });
}
