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
