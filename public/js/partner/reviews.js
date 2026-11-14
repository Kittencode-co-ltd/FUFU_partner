import { apiFetch } from '../utils/api-client.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { storage } from '../utils/storage.js';
import { escapeHtml } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

const ratingStars = value => {
  const filled = Math.max(0, Math.min(5, Math.round(Number(value))));
  return `${'★'.repeat(filled)}${'☆'.repeat(5-filled)}`;
};

export async function renderStoreReviews(container) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) { container.innerHTML = '<div class="card p-6">กรุณาเลือกร้านก่อน</div>'; return; }
  container.innerHTML = '<div class="card p-6 text-slate-400">กำลังโหลดรีวิว…</div>';
  const result = await apiFetch(`/api/reviews?store_id=${encodeURIComponent(storeId)}`);
  if (!result?.success) { container.innerHTML = `<div class="card p-6">${escapeHtml(result?.error || 'โหลดรีวิวไม่สำเร็จ')}</div>`; return; }
  const rows = result.data || [];
  container.innerHTML = `<div class="space-y-4">
    <section class="card flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 class="text-lg font-bold text-navy">รีวิวจากลูกค้า</h2><p class="mt-1 text-sm text-slate-500">ความคิดเห็นจากผู้ใช้ FUFU</p></div><div class="text-right"><div class="text-2xl font-bold text-navy">${Number(result.summary?.review_average||0).toFixed(1)} <span class="text-amber-500">★</span></div><div class="text-xs text-slate-500">${result.summary?.review_count||0} รีวิวที่เผยแพร่</div></div></section>
    <section class="space-y-3">${rows.length ? rows.map(review => `<article class="card p-4 sm:p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><div class="font-semibold text-navy">ผู้ใช้ FUFU</div><div class="mt-1 text-sm text-amber-600">${ratingStars(review.rating)} <span class="font-semibold">${Number(review.rating).toFixed(1)}</span></div></div><div class="text-right"><time class="text-xs text-slate-400">${new Date(review.created_at).toLocaleDateString('th-TH')}</time><div class="mt-1 text-xs ${review.status==='published'?'text-emerald-700':'text-amber-700'}">${review.status==='published'?'เผยแพร่':'ซ่อนโดยผู้ดูแล'}</div></div></div>${review.comment?`<p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">${escapeHtml(review.comment)}</p>`:'<p class="mt-3 text-sm italic text-slate-400">ไม่มีข้อความเพิ่มเติม</p>'}<form data-reply-form="${review.id}" class="mt-4 border-t border-slate-100 pt-3"><label class="text-xs font-semibold text-slate-600">ตอบกลับในนามร้าน</label><textarea maxlength="1200" rows="2" class="input-field mt-1 w-full" placeholder="พิมพ์คำตอบอย่างสุภาพ…">${escapeHtml(review.partner_reply||'')}</textarea><div class="mt-2 flex items-center justify-between gap-2"><span class="text-xs text-slate-400">คำตอบจะแสดงบนหน้ารีวิวของร้าน</span><button class="btn-primary min-h-10 px-4" type="submit">บันทึกคำตอบ</button></div></form></article>`).join('') : '<div class="card p-8 text-center text-sm text-slate-500">ร้านยังไม่มีรีวิว</div>'}</section></div>`;
  container.querySelectorAll('[data-reply-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault(); const textarea = form.querySelector('textarea'); const button = form.querySelector('button'); button.disabled = true;
    const saved = await apiFetch(`/api/reviews/${form.dataset.replyForm}/reply`, {method:'PATCH',body:JSON.stringify({reply:textarea.value})});
    button.disabled = false;
    if (!saved?.success) return showToast(saved?.error || 'บันทึกคำตอบไม่สำเร็จ','error');
    showToast('บันทึกคำตอบแล้ว'); await renderStoreReviews(container);
  }));
}
