// Customer chat (business model phase 6): customers start chats from the FUFU App; staff reply here with text
// or a photo and can call the customer back (the customer started the chat, so their profile phone is shown).
// API: server/routes/chat.js. New messages are fetched every few seconds while the page is open; the menu
// badge refreshes every 30 s. Styles: .ch-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';
import { getLang, locale } from './portal-i18n.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// [th, en, zh, ja, ko]
const S = {
  title: ['แชทลูกค้า', 'Customer chat', '顾客聊天', 'お客様チャット', '고객 채팅'],
  sub: ['ลูกค้าทักมาจากแอป FUFU ตอบกลับและโทรหาลูกค้าได้จากที่นี่', 'Customers message you from the FUFU app. Reply or call them back here.', '顾客通过 FUFU 应用发来消息，可在此回复或回电', 'お客様がFUFUアプリから送ったメッセージに返信・折り返し電話できます', '고객이 FUFU 앱에서 보낸 메시지에 답하거나 전화할 수 있어요'],
  empty: ['ยังไม่มีข้อความจากลูกค้า ลูกค้ากด "แชทกับร้าน" ได้จากหน้าร้านในแอป FUFU', 'No messages yet. Customers tap “Chat” on your store page in the FUFU app.', '还没有消息。顾客可在 FUFU 应用的门店页点击“聊天”', 'まだメッセージはありません。お客様はアプリの店舗ページから「チャット」できます', '아직 메시지가 없어요. 고객은 FUFU 앱 매장 페이지에서 "채팅"을 눌러요'],
  pick: ['เลือกแชทจากรายการ', 'Choose a chat', '选择一个对话', 'チャットを選択', '대화를 선택하세요'],
  call: ['โทรหาลูกค้า', 'Call customer', '致电顾客', 'お客様に電話', '고객에게 전화'],
  noPhone: ['ลูกค้ายังไม่ได้ใส่เบอร์โทรในโปรไฟล์ ตอบทางแชทได้เลย', 'The customer has no phone in their profile. Reply in the chat.', '顾客资料中没有电话，请在聊天中回复', 'お客様のプロフィールに電話番号がありません。チャットで返信してください', '고객 프로필에 전화번호가 없어요. 채팅으로 답하세요'],
  onApp: ['เชื่อมคลินิกแล้ว', 'Linked to you', '已连接', '連携済み', '연결됨'],
  you: ['คุณ: ', 'You: ', '你：', 'あなた: ', '나: '],
  placeholder: ['พิมพ์ข้อความถึงลูกค้า…', 'Message the customer…', '给顾客发消息…', 'お客様へのメッセージ…', '고객에게 메시지…'],
  photo: ['แนบรูป', 'Attach photo', '附加图片', '写真を添付', '사진 첨부'],
  send: ['ส่ง', 'Send', '发送', '送信', '보내기'],
  back: ['กลับ', 'Back', '返回', '戻る', '뒤로'],
  older: ['ดูข้อความก่อนหน้า', 'Show earlier messages', '查看更早消息', '以前のメッセージ', '이전 메시지 보기'],
  today: ['วันนี้', 'Today', '今天', '今日', '오늘'],
  failed: ['ส่งไม่สำเร็จ ลองอีกครั้ง', 'Couldn’t send. Try again', '发送失败，请重试', '送信できませんでした', '보내지 못했어요'],
  tooBig: ['รูปใหญ่เกินไป', 'Photo too large', '图片过大', '写真が大きすぎます', '사진이 너무 커요'],
  newMsg: ['มีข้อความใหม่จากลูกค้า', 'New message from a customer', '有新的顾客消息', 'お客様から新着メッセージ', '고객의 새 메시지'],
};
const T = k => { const i = ['th', 'en', 'zh', 'ja', 'ko'].indexOf(getLang()); return (S[k] || [k])[i] ?? S[k]?.[1] ?? k; };
const storeId = () => storage.get(STORAGE_KEYS.STORE_ID);
const isToday = d => d.toDateString() === new Date().toDateString();
const shortWhen = iso => { const d = new Date(iso); return isToday(d) ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }); };
const dayLabel = iso => { const d = new Date(iso); return isToday(d) ? T('today') : d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }); };
const timeOf = iso => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const tel = p => String(p || '').replace(/[^\d+]/g, '');

// ── Menu badge ──────────────────────────────────────────────────────────────
let badgeTimer = null;
let lastUnread = null;
export async function startChatBadge() {
  if (!badgeTimer) {
    badgeTimer = setInterval(() => { if (!document.hidden) refreshBadge(); }, 30_000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBadge(); });
  }
  await refreshBadge();
}
async function refreshBadge(count) {
  let n = count;
  if (n === undefined) {
    if (!storeId()) return;
    const r = await apiFetch(`/api/chat/unread?store_id=${storeId()}`).catch(() => null);
    if (!r?.success) return;
    n = r.unread || 0;
  }
  if (lastUnread !== null && n > lastUnread && !state.open) showToast(T('newMsg'));
  lastUnread = n;
  const badge = document.getElementById('chat-nav-badge');
  if (badge) { badge.textContent = n > 99 ? '99+' : n; badge.hidden = n <= 0; }
}

// ── Page ────────────────────────────────────────────────────────────────────
const state = { el: null, threads: [], current: null, messages: [], hasMore: false, open: false, timer: null, listTimer: null, photo: null };

export async function renderChat(el, detail = null) {
  state.el = el; state.open = true;
  el.innerHTML = `
    <div class="ch-page">
      <aside class="ch-side">
        <header class="ch-side__head"><h2>${esc(T('title'))}</h2><p>${esc(T('sub'))}</p></header>
        <div class="ch-threads" data-threads><div class="cl-skel"></div></div>
      </aside>
      <section class="ch-room" data-room><div class="ch-pick">${icon('chat', 'w-8 h-8')}<p>${esc(T('pick'))}</p></div></section>
    </div>`;
  clearInterval(state.listTimer);
  state.listTimer = setInterval(() => { if (!document.hidden && state.el?.isConnected) loadThreads(); else if (!state.el?.isConnected) stop(); }, 15_000);
  await loadThreads();
  const wanted = detail?.threadId || state.current?.id;
  if (wanted && state.threads.some(t => t.id === wanted)) openThread(wanted);
  else if (window.innerWidth >= 1024 && state.threads[0]) openThread(state.threads[0].id);
}

function stop() { clearInterval(state.timer); clearInterval(state.listTimer); state.open = false; }

async function loadThreads() {
  const r = await apiFetch(`/api/chat/threads?store_id=${storeId()}`).catch(() => null);
  if (!r?.success) return;
  state.threads = r.data || [];
  refreshBadge(r.unread || 0);
  const box = state.el?.querySelector('[data-threads]');
  if (!box) return;
  if (!state.threads.length) { box.innerHTML = `<p class="ch-empty">${icon('chat', 'w-6 h-6')}<span>${esc(T('empty'))}</span></p>`; return; }
  box.innerHTML = state.threads.map(t => `
    <button type="button" class="ch-thread ${state.current?.id === t.id ? 'is-active' : ''}" data-thread="${esc(t.id)}">
      <span class="cl-avatar">${esc((t.customer_name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="min-w-0 flex-1">
        <span class="ch-thread__top"><b>${esc(t.customer_name || '—')}</b><time>${esc(shortWhen(t.last_message_at))}</time></span>
        <span class="ch-thread__preview ${t.unread ? 'is-unread' : ''}">${t.last_sender === 'store' ? esc(T('you')) : ''}${esc(t.last_preview || '')}</span>
      </span>
      ${t.unread ? `<span class="ch-unread">${t.unread > 99 ? '99+' : t.unread}</span>` : ''}
    </button>`).join('');
  box.querySelectorAll('[data-thread]').forEach(b => { b.onclick = () => openThread(b.dataset.thread); });
}

async function openThread(id) {
  const t = state.threads.find(x => x.id === id);
  if (!t) return;
  state.current = t; state.messages = []; state.photo = null;
  state.el.querySelector('.ch-page')?.classList.add('is-room');
  state.el.querySelectorAll('[data-thread]').forEach(b => b.classList.toggle('is-active', b.dataset.thread === id));
  const room = state.el.querySelector('[data-room]');
  room.innerHTML = `
    <header class="ch-room__head">
      <button type="button" class="ch-back" data-back aria-label="${esc(T('back'))}">${icon('arrow-left', 'w-5 h-5')}</button>
      <span class="cl-avatar">${esc((t.customer_name || '?').trim().charAt(0).toUpperCase())}</span>
      <div class="min-w-0 flex-1"><b>${esc(t.customer_name || '—')}</b>${t.linked ? `<small class="cl-onapp">${esc(T('onApp'))}</small>` : ''}</div>
      ${t.customer_phone
        ? `<a class="ph-btn is-primary ch-call" href="tel:${esc(tel(t.customer_phone))}">${icon('phone-call', 'w-4 h-4')}<span>${esc(T('call'))}</span></a>`
        : `<span class="ch-nophone" title="${esc(T('noPhone'))}">${icon('phone-call', 'w-4 h-4')}</span>`}
    </header>
    ${t.customer_phone ? '' : `<p class="ch-hint">${esc(T('noPhone'))}</p>`}
    <div class="ch-list" data-list><div class="cl-skel"></div></div>
    <form class="ch-compose" data-compose>
      <div class="ch-attach" data-attach hidden></div>
      <div class="ch-compose__row">
        <button type="button" class="ch-icon" data-photo aria-label="${esc(T('photo'))}">${icon('photo', 'w-5 h-5')}</button>
        <input type="file" accept="image/*" hidden data-file>
        <textarea rows="1" maxlength="2000" placeholder="${esc(T('placeholder'))}" aria-label="${esc(T('placeholder'))}" data-text></textarea>
        <button type="submit" class="ch-send" aria-label="${esc(T('send'))}">${icon('send', 'w-5 h-5')}</button>
      </div>
    </form>`;
  room.querySelector('[data-back]').onclick = () => { state.el.querySelector('.ch-page')?.classList.remove('is-room'); clearInterval(state.timer); state.current = null; loadThreads(); };
  const text = room.querySelector('[data-text]');
  const fileInput = room.querySelector('[data-file]');
  room.querySelector('[data-photo]').onclick = () => fileInput.click();
  fileInput.onchange = async () => { const f = fileInput.files?.[0]; fileInput.value = ''; if (f) await attach(f); };
  text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); } });
  room.querySelector('[data-compose]').onsubmit = e => { e.preventDefault(); send(); };
  await loadMessages();
  if (matchMedia('(pointer: fine)').matches) text.focus();
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (!state.el?.isConnected) return stop();
    if (!document.hidden && state.current?.id === id) loadMessages(true);
  }, 4000);
}

async function loadMessages(poll = false) {
  const t = state.current;
  if (!t) return;
  const r = await apiFetch(`/api/chat/threads/${t.id}/messages?store_id=${storeId()}`).catch(() => null);
  if (!r?.success || state.current?.id !== t.id) return;
  const latest = r.data || [];
  const known = new Set(state.messages.map(m => m.id));
  // Keep earlier pages the user loaded and messages still being sent
  const firstAt = latest[0] ? new Date(latest[0].created_at) : null;
  const older = poll && firstAt ? state.messages.filter(m => !m.pending && new Date(m.created_at) < firstAt) : [];
  const pending = poll ? state.messages.filter(m => m.pending) : [];
  const changed = !poll || latest.some(m => !known.has(m.id));
  if (!poll) state.hasMore = r.has_more;
  state.messages = [...older, ...latest, ...pending];
  if (changed) { drawMessages(true); if (t.unread) { t.unread = 0; loadThreads(); } }
}

async function loadOlder() {
  const t = state.current, first = state.messages[0];
  if (!t || !first) return;
  const r = await apiFetch(`/api/chat/threads/${t.id}/messages?store_id=${storeId()}&before=${encodeURIComponent(first.created_at)}`).catch(() => null);
  if (!r?.success) return;
  state.messages = [...(r.data || []), ...state.messages]; state.hasMore = r.has_more;
  drawMessages(false);
}

function drawMessages(toBottom) {
  const list = state.el?.querySelector('[data-list]');
  if (!list) return;
  let prevDay = '';
  list.innerHTML = (state.hasMore ? `<button type="button" class="ch-older" data-older>${esc(T('older'))}</button>` : '') + state.messages.map(m => {
    const d = new Date(m.created_at).toDateString();
    const head = d !== prevDay ? `<p class="ch-day">${esc(dayLabel(m.created_at))}</p>` : '';
    prevDay = d;
    const img = m.image_url || m.preview;
    return `${head}<div class="ch-row ${m.sender === 'store' ? 'is-me' : ''}"><div class="ch-bubble ${img ? 'has-image' : ''} ${m.pending ? 'is-pending' : ''}">
      ${img ? `<a href="${esc(img)}" target="_blank" rel="noopener noreferrer" class="ch-photo"><img src="${esc(img)}" alt="" loading="lazy"></a>` : ''}
      ${m.body ? `<p>${esc(m.body)}</p>` : ''}<time>${m.pending ? '…' : esc(timeOf(m.created_at))}</time></div></div>`;
  }).join('');
  list.querySelector('[data-older]')?.addEventListener('click', loadOlder);
  if (toBottom) list.scrollTop = list.scrollHeight;
}

/** Downscale to 1600 px JPEG (keeps uploads small and under the API body limit). */
async function attach(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.85);
    if (url.length > 2.9 * 1024 * 1024) { showToast(T('tooBig'), 'error'); return; }
    state.photo = url;
    const box = state.el.querySelector('[data-attach]');
    box.hidden = false;
    box.innerHTML = `<img src="${url}" alt=""><button type="button" aria-label="remove">×</button>`;
    box.querySelector('button').onclick = () => { state.photo = null; box.hidden = true; box.innerHTML = ''; };
  } catch { showToast(T('failed'), 'error'); }
}

async function send() {
  const t = state.current;
  const text = state.el.querySelector('[data-text]');
  const body = text.value.trim();
  if (!t || (!body && !state.photo)) return;
  const photo = state.photo;
  const temp = { id: `p-${Date.now()}`, sender: 'store', body: body || null, preview: photo, created_at: new Date().toISOString(), pending: true };
  state.messages.push(temp); drawMessages(true);
  text.value = ''; state.photo = null;
  const box = state.el.querySelector('[data-attach]'); box.hidden = true; box.innerHTML = '';
  const r = await apiFetch(`/api/chat/threads/${t.id}/messages`, { method: 'POST', body: JSON.stringify({ store_id: storeId(), body, image: photo || undefined }) }).catch(() => null);
  state.messages = state.messages.filter(m => m.id !== temp.id);
  if (!r?.success) { showToast(T(r?.code === 'image_too_big' ? 'tooBig' : 'failed'), 'error'); text.value = body; drawMessages(true); return; }
  await loadMessages();
  loadThreads();
}
