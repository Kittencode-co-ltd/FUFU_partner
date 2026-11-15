import { apiFetch } from '../utils/api-client.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { storage } from '../utils/storage.js';
import { escapeHtml } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { getLang, locale } from './portal-i18n.js';

// Page text in the 5 portal languages (the portal reloads on language change)
const STR = {
  th: { title: 'รีวิวจากลูกค้า', sub: 'ความคิดเห็นจากผู้ใช้ FUFU ตอบกลับเพื่อสร้างความประทับใจ', pickStore: 'กรุณาเลือกร้านก่อน', loadFail: 'โหลดรีวิวไม่สำเร็จ', saveFail: 'บันทึกคำตอบไม่สำเร็จ', saved: 'บันทึกคำตอบแล้ว', removed: 'ลบคำตอบแล้ว', of5: n => `${n} จาก 5 ดาว`, justNow: 'เมื่อสักครู่', all: 'ทั้งหมด', pending: 'รอตอบกลับ', replied: 'ตอบแล้ว', published: n => `${n} รีวิวที่เผยแพร่`, dist: 'สัดส่วนคะแนน', rate: 'อัตราการตอบ', hidden: 'ซ่อนโดยผู้ดูแล', filter: 'กรองรีวิว', none: 'ร้านยังไม่มีรีวิว เมื่อลูกค้ารีวิวผ่านแอป FUFU จะแสดงที่นี่', allDone: 'ตอบกลับครบทุกรีวิวแล้ว', noneHere: 'ไม่มีรีวิวในหมวดนี้', replyAs: 'ตอบกลับในนามร้าน', placeholder: 'ขอบคุณลูกค้า หรือชี้แจงอย่างสุภาพ…', shown: 'แสดงบนหน้าร้านในแอป', cancel: 'ยกเลิก', save: 'บันทึก', storeReply: 'คำตอบจากร้าน', edit: 'แก้ไข', reply: 'ตอบกลับ', user: 'ผู้ใช้ FUFU', newTag: 'รอตอบ', noText: 'ให้คะแนนโดยไม่มีข้อความ' },
  en: { title: 'Customer reviews', sub: 'Feedback from FUFU users. Reply to make a good impression.', pickStore: 'Please choose a store first', loadFail: 'Could not load reviews', saveFail: 'Could not save the reply', saved: 'Reply saved', removed: 'Reply removed', of5: n => `${n} out of 5 stars`, justNow: 'just now', all: 'All', pending: 'Awaiting reply', replied: 'Replied', published: n => `${n} published reviews`, dist: 'Rating breakdown', rate: 'Reply rate', hidden: 'Hidden by admin', filter: 'Filter reviews', none: 'No reviews yet. Reviews customers leave in the FUFU app will appear here.', allDone: 'Every review has a reply', noneHere: 'No reviews in this view', replyAs: 'Reply as the store', placeholder: 'Thank the customer or explain politely…', shown: 'Shown on your store page in the app', cancel: 'Cancel', save: 'Save', storeReply: 'Store reply', edit: 'Edit', reply: 'Reply', user: 'FUFU user', newTag: 'New', noText: 'Rated without a comment' },
  zh: { title: '顾客评价', sub: '来自 FUFU 用户的评价，及时回复留下好印象', pickStore: '请先选择店铺', loadFail: '无法加载评价', saveFail: '无法保存回复', saved: '回复已保存', removed: '回复已删除', of5: n => `5 星中 ${n} 星`, justNow: '刚刚', all: '全部', pending: '待回复', replied: '已回复', published: n => `${n} 条已发布评价`, dist: '评分分布', rate: '回复率', hidden: '被管理员隐藏', filter: '筛选评价', none: '暂无评价。顾客在 FUFU 应用中的评价会显示在这里。', allDone: '所有评价都已回复', noneHere: '此分类暂无评价', replyAs: '以店铺名义回复', placeholder: '感谢顾客或礼貌说明…', shown: '将显示在应用的店铺页面', cancel: '取消', save: '保存', storeReply: '商家回复', edit: '编辑', reply: '回复', user: 'FUFU 用户', newTag: '待回复', noText: '仅评分，无文字' },
  ja: { title: 'お客様のレビュー', sub: 'FUFU ユーザーからの声。返信で好印象を残しましょう。', pickStore: '先に店舗を選択してください', loadFail: 'レビューを読み込めませんでした', saveFail: '返信を保存できませんでした', saved: '返信を保存しました', removed: '返信を削除しました', of5: n => `5つ星中 ${n}`, justNow: 'たった今', all: 'すべて', pending: '未返信', replied: '返信済み', published: n => `公開中のレビュー ${n} 件`, dist: '評価の内訳', rate: '返信率', hidden: '管理者が非表示', filter: 'レビューを絞り込む', none: 'まだレビューはありません。FUFU アプリで投稿されたレビューがここに表示されます。', allDone: 'すべてのレビューに返信済みです', noneHere: 'この条件のレビューはありません', replyAs: '店舗として返信', placeholder: 'お礼や丁寧な説明を入力…', shown: 'アプリの店舗ページに表示されます', cancel: 'キャンセル', save: '保存', storeReply: '店舗からの返信', edit: '編集', reply: '返信', user: 'FUFU ユーザー', newTag: '未返信', noText: 'コメントなしの評価' },
  ko: { title: '고객 리뷰', sub: 'FUFU 사용자의 의견입니다. 답글로 좋은 인상을 남겨 보세요.', pickStore: '먼저 매장을 선택하세요', loadFail: '리뷰를 불러오지 못했습니다', saveFail: '답글을 저장하지 못했습니다', saved: '답글을 저장했습니다', removed: '답글을 삭제했습니다', of5: n => `별점 5점 중 ${n}점`, justNow: '방금', all: '전체', pending: '답글 대기', replied: '답글 완료', published: n => `게시된 리뷰 ${n}개`, dist: '별점 분포', rate: '답글률', hidden: '관리자가 숨김', filter: '리뷰 필터', none: '아직 리뷰가 없습니다. FUFU 앱에서 남긴 리뷰가 여기에 표시됩니다.', allDone: '모든 리뷰에 답글을 달았습니다', noneHere: '이 보기에 리뷰가 없습니다', replyAs: '매장 이름으로 답글', placeholder: '감사 인사나 정중한 설명을 남겨 주세요…', shown: '앱의 매장 페이지에 표시됩니다', cancel: '취소', save: '저장', storeReply: '매장 답글', edit: '수정', reply: '답글', user: 'FUFU 사용자', newTag: '새 리뷰', noText: '코멘트 없이 별점만 남김' },
};
const S = STR[getLang()] || STR.th;
// Server errors are written in Thai, so only show them as-is in Thai
const errText = (msg, fallback) => (getLang() === 'th' && msg) || fallback;

// Customer reviews: score summary, star breakdown, filter by reply state, inline reply.
// Styles: .rv-* in src/css/input.css (theme tokens only, so dark mode follows automatically).

const STAR_PATH = 'M12 2.8l2.76 5.6 6.18.9-4.47 4.36 1.05 6.15L12 16.9l-5.52 2.91 1.05-6.15L3.06 9.3l6.18-.9z';
const star = (on, size) => `<svg class="rv-star${on ? ' is-on' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
const stars = (value, size = 14) => {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return `<span class="rv-stars" role="img" aria-label="${S.of5(n)}">${[1, 2, 3, 4, 5].map(i => star(i <= n, size)).join('')}</span>`;
};

const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
function when(iso) {
  const d = new Date(iso); const days = Math.round((d - Date.now()) / 86400000);
  if (Math.abs(days) < 1) {
    const hours = Math.round((d - Date.now()) / 3600000);
    return Math.abs(hours) < 1 ? S.justNow : rtf.format(hours, 'hour');
  }
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

const FILTERS = [
  { id: 'all', get label() { return S.all; }, test: () => true },
  { id: 'pending', get label() { return S.pending; }, test: r => !r.partner_reply },
  { id: 'replied', get label() { return S.replied; }, test: r => Boolean(r.partner_reply) },
];

const shell = inner => `<div class="rv">
  <header class="rv-head"><h2 class="rv-title">${S.title}</h2><p class="rv-sub">${S.sub}</p></header>${inner}</div>`;

export async function renderStoreReviews(container) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) { container.innerHTML = shell('<div class="rv-empty card">${S.pickStore}</div>'); return; }
  container.innerHTML = shell(`<div class="rv-summary card rv-skel" aria-busy="true"></div>
    <div class="rv-list">${'<div class="rv-item card rv-skel"></div>'.repeat(3)}</div>`);
  const result = await apiFetch(`/api/reviews?store_id=${encodeURIComponent(storeId)}`);
  if (!result?.success) { container.innerHTML = shell(`<div class="rv-empty card">${escapeHtml(errText(result?.error, S.loadFail))}</div>`); return; }

  const state = { rows: result.data || [], summary: result.summary || {}, filter: 'all', editing: null };
  const draw = () => { container.innerHTML = shell(summaryHtml(state) + filtersHtml(state) + listHtml(state)); bind(); };

  function bind() {
    container.querySelectorAll('[data-rv-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.rvFilter; state.editing = null; draw(); }));
    container.querySelectorAll('[data-rv-edit]').forEach(b => b.addEventListener('click', () => {
      state.editing = b.dataset.rvEdit; draw();
      container.querySelector(`[data-reply-form="${CSS.escape(state.editing)}"] textarea`)?.focus();
    }));
    container.querySelectorAll('[data-rv-cancel]').forEach(b => b.addEventListener('click', () => { state.editing = null; draw(); }));
    container.querySelectorAll('[data-reply-form]').forEach(form => {
      const textarea = form.querySelector('textarea'); const counter = form.querySelector('[data-rv-count]');
      textarea.addEventListener('input', () => { counter.textContent = `${textarea.value.length}/1200`; });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        const saved = await apiFetch(`/api/reviews/${form.dataset.replyForm}/reply`, { method: 'PATCH', body: JSON.stringify({ reply: textarea.value }) });
        button.disabled = false;
        if (!saved?.success) return showToast(errText(saved?.error, S.saveFail), 'error');
        const row = state.rows.find(r => r.id === form.dataset.replyForm);
        if (row) Object.assign(row, { partner_reply: saved.data?.partner_reply ?? (textarea.value.trim() || null), partner_replied_at: saved.data?.partner_replied_at ?? new Date().toISOString() });
        state.editing = null; draw();
        showToast(textarea.value.trim() ? S.saved : S.removed);
      });
    });
  }
  draw();
}

function summaryHtml({ rows, summary }) {
  const published = rows.filter(r => r.status === 'published');
  const avg = Number(summary.review_average || 0);
  const count = Number(summary.review_count || published.length);
  const buckets = [5, 4, 3, 2, 1].map(s => ({ s, n: published.filter(r => Math.max(1, Math.round(Number(r.rating))) === s).length }));
  const max = Math.max(1, published.length);
  const pending = rows.filter(r => !r.partner_reply).length;
  const replyRate = rows.length ? Math.round(((rows.length - pending) / rows.length) * 100) : 0;
  const hidden = rows.filter(r => r.status !== 'published').length;
  return `<section class="rv-summary card">
    <div class="rv-score">
      <div class="rv-score__num">${avg.toFixed(1)}</div>
      ${stars(avg, 16)}
      <div class="rv-score__count">${S.published(count.toLocaleString(locale()))}</div>
    </div>
    <div class="rv-dist" aria-label="${S.dist}">
      ${buckets.map(b => `<div class="rv-dist__row"><span class="rv-dist__label">${b.s}</span>${star(true, 11)}<div class="rv-bar"><i style="width:${(b.n / max) * 100}%"></i></div><span class="rv-dist__n">${b.n}</span></div>`).join('')}
    </div>
    <dl class="rv-stats">
      <div><dt>${S.pending}</dt><dd${pending ? ' class="is-warn"' : ''}>${pending}</dd></div>
      <div><dt>${S.rate}</dt><dd>${replyRate}%</dd></div>
      <div><dt>${S.hidden}</dt><dd>${hidden}</dd></div>
    </dl>
  </section>`;
}

function filtersHtml({ rows, filter }) {
  return `<div class="rv-filters" role="group" aria-label="${S.filter}">${FILTERS.map(f =>
    `<button type="button" class="rv-chip" data-rv-filter="${f.id}" aria-pressed="${filter === f.id}">${f.label}<span>${rows.filter(f.test).length}</span></button>`).join('')}</div>`;
}

function listHtml({ rows, filter, editing }) {
  const list = rows.filter(FILTERS.find(f => f.id === filter).test);
  if (!list.length) {
    const msg = !rows.length ? S.none : filter === 'pending' ? S.allDone : S.noneHere;
    return `<div class="rv-empty card"><span class="rv-empty__icon">${star(true, 22)}</span><p>${msg}</p></div>`;
  }
  return `<section class="rv-list">${list.map(r => itemHtml(r, editing === r.id)).join('')}</section>`;
}

function itemHtml(r, isEditing) {
  const hidden = r.status !== 'published';
  const reply = r.partner_reply;
  const replyBlock = isEditing
    ? `<form class="rv-form" data-reply-form="${escapeHtml(r.id)}">
        <label class="rv-form__label" for="rv-${escapeHtml(r.id)}">${S.replyAs}</label>
        <textarea id="rv-${escapeHtml(r.id)}" maxlength="1200" rows="3" class="rv-textarea" placeholder="${S.placeholder}">${escapeHtml(reply || '')}</textarea>
        <div class="rv-form__foot"><span class="rv-form__hint"><span data-rv-count>${(reply || '').length}/1200</span> · ${S.shown}</span>
          <span class="rv-form__actions"><button type="button" class="btn-ghost rv-btn" data-rv-cancel>${S.cancel}</button><button type="submit" class="btn-primary rv-btn">${S.save}</button></span></div>
      </form>`
    : reply
      ? `<div class="rv-reply"><div class="rv-reply__head"><span>${S.storeReply}${r.partner_replied_at ? ` · ${when(r.partner_replied_at)}` : ''}</span><button type="button" class="rv-link" data-rv-edit="${escapeHtml(r.id)}">${S.edit}</button></div><p>${escapeHtml(reply)}</p></div>`
      : `<button type="button" class="rv-reply-btn" data-rv-edit="${escapeHtml(r.id)}">${S.reply}</button>`;
  return `<article class="rv-item card${hidden ? ' is-hidden' : ''}">
    <div class="rv-item__top">
      <span class="rv-avatar" aria-hidden="true">F</span>
      <div class="rv-item__who"><div class="rv-name">${S.user}</div><div class="rv-meta">${stars(r.rating, 13)}<time datetime="${escapeHtml(r.created_at)}">${when(r.created_at)}</time></div></div>
      ${hidden ? `<span class="rv-tag">${S.hidden}</span>` : !reply ? `<span class="rv-tag is-new">${S.newTag}</span>` : ''}
    </div>
    ${r.comment ? `<p class="rv-comment">${escapeHtml(r.comment)}</p>` : `<p class="rv-comment is-empty">${S.noText}</p>`}
    ${replyBlock}
  </article>`;
}
