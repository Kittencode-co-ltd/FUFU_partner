export function formatBaht(amount) {
  const n = Number(amount || 0);
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

export function formatThaiDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

// Omits year — for compact timestamps where date context is implicit
export function formatThaiDateTimeShort(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('th-TH', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

// ── HN (Hospital Number) ────────────────────────────────────────────────────
// Format: HN-{year}-{6-digit sequence}, e.g. HN-2025-000042
// The year prefix is derived from when the pet record was created (`createdAt`);
// it falls back to the current year when no timestamp is available. The numeric
// `hn` stored in the DB is the per-store running sequence — the year is purely
// presentational, so search/lookup still works off the sequence alone.
export function formatHN(hn, createdAt) {
  if (!hn) return '';
  let year = new Date().getFullYear();
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) year = d.getFullYear();
  }
  return `HN-${year}-${String(hn).padStart(6, '0')}`;
}

// Escape user-supplied text before interpolating it into an innerHTML template.
// Pet names, owner names, notes, etc. are operator-entered and otherwise flow
// straight into `innerHTML`, so an entry like `<img src=x onerror=...>` would
// execute in every staff member's browser. Use this on any such value.
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
