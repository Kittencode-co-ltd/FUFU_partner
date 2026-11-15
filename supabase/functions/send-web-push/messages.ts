// Pure helpers for the send-web-push edge function: localized push text, target URLs and
// the recipient rules. No imports, so Node's test runner can load this file directly.

export type Lang = 'th' | 'en' | 'zh' | 'ja' | 'ko';
export type PushSystem = 'app' | 'portal' | 'admin';
export interface PushPayload { title: string; body: string; url: string; tag: string; system: PushSystem }

type Text = Record<Lang, string>;
export const LANGS: Lang[] = ['th', 'en', 'zh', 'ja', 'ko'];
const LOCALES: Record<Lang, string> = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' };

export function toLang(value: unknown): Lang {
  return LANGS.includes(value as Lang) ? (value as Lang) : 'th';
}

const T: Record<string, Text> = {
  appointment_confirmed: { th: 'ยืนยันการจองแล้ว', en: 'Booking confirmed', zh: '预约已确认', ja: '予約が確定しました', ko: '예약이 확정되었어요' },
  appointment_rejected: { th: 'ร้านปฏิเสธการจอง', en: 'Booking declined', zh: '预约未被接受', ja: '予約をお受けできませんでした', ko: '예약이 거절되었어요' },
  appointment_reschedule_proposed: { th: 'ร้านเสนอเวลานัดใหม่', en: 'A new time was proposed', zh: '店家提议了新时间', ja: '新しい日時が提案されました', ko: '새 예약 시간이 제안되었어요' },
  appointment_cancelled: { th: 'การจองถูกยกเลิก', en: 'Booking cancelled', zh: '预约已取消', ja: '予約がキャンセルされました', ko: '예약이 취소되었어요' },
  appointment_updated: { th: 'อัปเดตสถานะการจอง', en: 'Booking updated', zh: '预约状态已更新', ja: '予約が更新されました', ko: '예약 상태가 바뀌었어요' },
  reason: { th: 'เหตุผล', en: 'Reason', zh: '原因', ja: '理由', ko: '사유' },
  booking_requested: { th: 'มีคำขอจองใหม่', en: 'New booking request', zh: '新的预约请求', ja: '新しい予約リクエスト', ko: '새 예약 요청' },
  review_created: { th: 'รีวิวใหม่', en: 'New review', zh: '新评价', ja: '新しいレビュー', ko: '새 리뷰' },
  no_comment: { th: 'ไม่มีความคิดเห็น', en: 'No comment', zh: '无文字评价', ja: 'コメントなし', ko: '코멘트 없음' },
  store_pending: { th: 'ร้านใหม่รอการอนุมัติ', en: 'New store awaiting approval', zh: '新店铺待审核', ja: '承認待ちの新しい店舗', ko: '승인 대기 중인 새 매장' },
};

export function formatWhen(iso: string | null | undefined, lang: Lang, timeZone = 'Asia/Bangkok'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(LOCALES[lang], { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const clip = (value: unknown, max = 140) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const join = (...parts: unknown[]) => parts.map(part => clip(part, 80)).filter(Boolean).join(' · ');

export interface NotificationRow { id: string; user_id: string | null; event_type: string; title: string; body: string | null; appointment_id: string | null }
export interface AppointmentRow {
  id: string; user_id?: string | null; store_id?: string | null; status?: string | null; pet_name?: string | null; services?: string[] | null;
  starts_at?: string | null; proposed_starts_at?: string | null; rejection_reason?: string | null; cancelled_by?: string | null;
}
export interface StoreRow { id: string; name?: string | null; owner_id?: string | null; timezone?: string | null }
export interface ReviewRow { id: string; store_id: string; rating: number | string; comment?: string | null }

/** A customer does not need a push for a cancellation they made themselves. */
export function shouldPushNotification(row: NotificationRow, appointment?: AppointmentRow | null): boolean {
  if (!row.user_id) return false;
  if (row.event_type === 'appointment_cancelled' && appointment?.cancelled_by && appointment.cancelled_by === row.user_id) return false;
  return true;
}

export function customerMessage(row: NotificationRow, lang: Lang, appointment?: AppointmentRow | null, store?: StoreRow | null): PushPayload {
  const tz = store?.timezone || 'Asia/Bangkok';
  const isBooking = row.event_type.startsWith('appointment_');
  const url = isBooking ? '/appointments' : '/notifications';
  const tag = row.appointment_id ? `appt-${row.appointment_id}` : `notif-${row.id}`;
  if (!isBooking) return { title: clip(row.title, 80), body: clip(row.body), url, tag, system: 'app' };
  const key = T[row.event_type] ? row.event_type : 'appointment_updated';
  let body: string;
  if (row.event_type === 'appointment_rejected') {
    const reason = appointment?.rejection_reason || '';
    body = reason ? `${T.reason[lang]}: ${clip(reason, 120)}` : join(store?.name, appointment?.pet_name);
  } else if (row.event_type === 'appointment_reschedule_proposed') {
    body = join(store?.name, formatWhen(appointment?.proposed_starts_at, lang, tz));
  } else {
    body = join(store?.name, appointment?.pet_name, formatWhen(appointment?.starts_at, lang, tz));
  }
  if (!body) body = clip(row.body);
  return { title: T[key][lang], body, url, tag, system: 'app' };
}

export function bookingRequestMessage(appointment: AppointmentRow, lang: Lang, store?: StoreRow | null): PushPayload {
  const service = Array.isArray(appointment.services) ? appointment.services[0] : '';
  return {
    title: T.booking_requested[lang],
    body: join(appointment.pet_name, service, formatWhen(appointment.starts_at, lang, store?.timezone || 'Asia/Bangkok')),
    url: '/dashboard?page=appointments',
    tag: `booking-${appointment.id}`,
    system: 'portal',
  };
}

export function reviewMessage(review: ReviewRow, lang: Lang): PushPayload {
  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
  return {
    title: `${T.review_created[lang]} ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
    body: clip(review.comment) || T.no_comment[lang],
    url: '/dashboard?page=reviews',
    tag: `review-${review.id}`,
    system: 'portal',
  };
}

export function storePendingMessage(store: StoreRow, lang: Lang): PushPayload {
  return { title: T.store_pending[lang], body: clip(store.name, 80), url: '/partners', tag: `store-${store.id}`, system: 'admin' };
}

/** Owner plus active staff accounts of a store, without duplicates. */
export function storeRecipients(store: StoreRow | null | undefined, staff: { user_id: string | null }[]): string[] {
  const ids = new Set<string>();
  if (store?.owner_id) ids.add(store.owner_id);
  for (const member of staff) if (member.user_id) ids.add(member.user_id);
  return [...ids];
}

/** Comma-separated ADMIN_EMAILS, compared case-insensitively. An empty list allows nobody. */
export function parseAdminEmails(value: string | null | undefined): Set<string> {
  return new Set(String(value || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
}

/** The push service says this subscription is gone for good. */
export const isExpiredStatus = (status: unknown) => status === 404 || status === 410;

/** Constant-time comparison for the shared webhook secret. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
