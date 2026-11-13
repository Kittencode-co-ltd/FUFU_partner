// Amount in Thai words for receipts and tax invoices, e.g. 1,251.50 → "หนึ่งพันสองร้อยห้าสิบเอ็ดบาทห้าสิบสตางค์".
// Handles any size (groups of six digits joined with "ล้าน"), "เอ็ด" / "ยี่" rules, and satang rounding.
const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

// 0 < n < 1,000,000; `hasHigher` = there are digits in front of this group (for "เอ็ด")
function sixDigits(n, hasHigher) {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const place = s.length - i - 1;
    if (d === 0) continue;
    if (place === 1 && d === 1) out += 'สิบ';
    else if (place === 1 && d === 2) out += 'ยี่สิบ';
    else if (place === 0 && d === 1 && (s.length > 1 || hasHigher)) out += 'เอ็ด';
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
}

function integerWords(n) {
  if (n === 0) return 'ศูนย์';
  const groups = [];
  let rest = n;
  while (rest > 0) { groups.unshift(rest % 1000000); rest = Math.floor(rest / 1000000); }
  let out = '';
  groups.forEach((g, i) => {
    if (g) out += sixDigits(g, i > 0 && out !== '');
    if (i < groups.length - 1) out += 'ล้าน';
  });
  return out;
}

export function thaiBahtText(amount) {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  const baht = Math.floor(value / 100);
  const satang = value % 100;
  const sign = Number(amount) < 0 ? 'ลบ' : '';
  if (baht === 0 && satang === 0) return 'ศูนย์บาทถ้วน';
  const bahtPart = baht ? `${integerWords(baht)}บาท` : '';
  const satangPart = satang ? `${sixDigits(satang, false)}สตางค์` : 'ถ้วน';
  return sign + bahtPart + satangPart;
}
