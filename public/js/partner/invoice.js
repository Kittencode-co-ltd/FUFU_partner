import { formatBaht } from '../utils/formatters.js';
import { showToast }  from '../utils/toast.js';

const VAT_RATE = 0.07;

function _numberToThaiBaht(amount) {
  const units     = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  const intPart   = Math.floor(amount);
  const decPart   = Math.round((amount - intPart) * 100);
  if (intPart === 0 && decPart === 0) return 'ศูนย์บาทถ้วน';

  let result = '';
  const str = String(intPart);
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i]);
    const pos   = len - i - 1;
    if (digit === 0) continue;
    if (pos === 1 && digit === 1) { result += 'สิบ';    continue; }
    if (pos === 1 && digit === 2) { result += 'ยี่สิบ'; continue; }
    if (pos === 0 && digit === 1 && len > 1) { result += 'เอ็ด'; continue; }
    result += units[digit] + positions[pos];
  }
  result += 'บาท';
  if (decPart > 0) {
    const dec = _numberToThaiBaht(decPart / 100).replace('บาท', '').replace('ถ้วน', '');
    result += dec + 'สตางค์';
  } else {
    result += 'ถ้วน';
  }
  return result;
}

function _invoiceNo(prefix = 'INV') {
  const now = new Date();
  const y   = String(now.getFullYear()).slice(-2);
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `${prefix}-${y}${m}-${seq}`;
}

const PAYMENT_LABELS = {
  cash: 'เงินสด', promptpay: 'พร้อมเพย์',
  card: 'บัตรเครดิต/เดบิต', transfer: 'โอนเงิน', voucher: 'บัตรกำนัล',
};

export function generateInvoiceHTML(data) {
  const isReceipt  = data.type === 'receipt';
  const docTitle   = isReceipt ? 'ใบเสร็จรับเงิน / Receipt' : 'ใบกำกับภาษี / Tax Invoice';
  const invoiceNo  = _invoiceNo(isReceipt ? 'RCP' : 'INV');
  const thaiDate   = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  const subtotal   = data.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount   = data.discount || 0;
  const beforeVat  = subtotal - discount;
  const vatAmount  = Math.round(beforeVat * VAT_RATE * 100) / 100;
  const total      = beforeVat + vatAmount;

  return `
    <div style="max-width:800px;margin:0 auto;padding:30px;font-family:'Prompt','Noto Sans Thai',sans-serif;color:#1E293B;background:#fff">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #2A6374">
        <div>
          <div style="font-size:24px;font-weight:700;color:#2A6374;margin-bottom:4px">🐾 FUFU</div>
          <div style="font-size:18px;font-weight:600">${docTitle}</div>
          ${!isReceipt ? '<div style="font-size:11px;color:#64748B;margin-top:2px">ต้นฉบับ / Original</div>' : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:600">เลขที่: ${invoiceNo}</div>
          <div style="font-size:12px;color:#64748B">วันที่: ${thaiDate}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div style="padding:14px;border:1px solid #E2E8F0;border-radius:8px">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">ผู้ออกเอกสาร (Seller)</div>
          <div style="font-weight:600;margin-bottom:2px">${data.seller?.name || '-'}</div>
          <div style="font-size:12px;color:#64748B;line-height:1.6;font-family:'Noto Sans Thai',sans-serif">
            เลขประจำตัวผู้เสียภาษี: ${data.seller?.taxId || '-'}<br>
            สาขา: ${data.seller?.branchNo || 'สำนักงานใหญ่'}<br>
            ${data.seller?.address || ''}<br>
            โทร: ${data.seller?.phone || '-'}
          </div>
        </div>
        <div style="padding:14px;border:1px solid #E2E8F0;border-radius:8px">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">ผู้ซื้อ / ลูกค้า (Buyer)</div>
          <div style="font-weight:600;margin-bottom:2px">${data.buyer?.name || 'ลูกค้าทั่วไป'}</div>
          <div style="font-size:12px;color:#64748B;line-height:1.6;font-family:'Noto Sans Thai',sans-serif">
            ${data.buyer?.taxId ? `เลขประจำตัว: ${data.buyer.taxId}<br>` : ''}
            ${data.buyer?.address || ''}<br>
            ${data.buyer?.phone ? `โทร: ${data.buyer.phone}` : ''}
          </div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#ECF7F5">
            <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:2px solid #2A6374;color:#2A6374">ลำดับ</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:2px solid #2A6374;color:#2A6374">รายการ</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;border-bottom:2px solid #2A6374;color:#2A6374">จำนวน</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;border-bottom:2px solid #2A6374;color:#2A6374">หน่วย</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #2A6374;color:#2A6374">ราคา/หน่วย</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #2A6374;color:#2A6374">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, i) => `
            <tr style="border-bottom:1px solid #F1F5F9">
              <td style="padding:10px 12px;font-size:13px;font-family:'Noto Sans Thai',sans-serif">${i + 1}</td>
              <td style="padding:10px 12px;font-size:13px">${item.name}</td>
              <td style="padding:10px 12px;text-align:center;font-size:13px;font-family:'Noto Sans Thai',sans-serif">${item.qty}</td>
              <td style="padding:10px 12px;text-align:center;font-size:13px;font-family:'Noto Sans Thai',sans-serif">${item.unit || 'รายการ'}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;font-family:'Noto Sans Thai',sans-serif">${formatBaht(item.unitPrice)}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:500;font-family:'Noto Sans Thai',sans-serif">${formatBaht(item.qty * item.unitPrice)}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end">
        <div style="width:300px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-family:'Noto Sans Thai',sans-serif">
            <span>ราคารวม (Subtotal)</span><span>${formatBaht(subtotal)}</span>
          </div>
          ${discount > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#EF4444;font-family:'Noto Sans Thai',sans-serif">
            <span>ส่วนลด (Discount)</span><span>-${formatBaht(discount)}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-family:'Noto Sans Thai',sans-serif">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span><span>${formatBaht(vatAmount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:700;border-top:2px solid #2A6374;margin-top:4px;color:#2A6374">
            <span>รวมทั้งสิ้น (Total)</span><span>${formatBaht(total)}</span>
          </div>
        </div>
      </div>

      <div style="background:#F8FAFC;border-radius:8px;padding:12px;margin:16px 0;font-size:12px;font-family:'Noto Sans Thai',sans-serif">
        <strong>จำนวนเงิน (ตัวอักษร):</strong> ${_numberToThaiBaht(total)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="font-size:12px;font-family:'Noto Sans Thai',sans-serif;color:#64748B">
          <strong>ชำระโดย:</strong> ${PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod || '-'}
          ${data.notes ? `<br><strong>หมายเหตุ:</strong> ${data.notes}` : ''}
        </div>
        <div style="text-align:center">
          <div style="border-top:1px dashed #CBD5E1;margin:40px 40px 0;padding-top:8px;font-size:11px;color:#64748B;font-family:'Noto Sans Thai',sans-serif">
            ผู้มีอำนาจลงนาม / Authorized Signature
          </div>
        </div>
      </div>

      <div style="text-align:center;font-size:10px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:12px;font-family:'Noto Sans Thai',sans-serif">
        เอกสารฉบับนี้ออกโดยระบบ FUFU Partner Portal • Kitten Code Co., Ltd. • © 2026
      </div>
    </div>`;
}

export function printInvoice(data) {
  const html = generateInvoiceHTML(data);
  const w = window.open('', '_blank', 'width=820,height=1050');
  if (!w) { showToast('กรุณาอนุญาต Popup เพื่อพิมพ์', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head>
    <title>Invoice</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>@media print{@page{margin:15mm;size:A4}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}body{margin:0}</style>
    </head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 500);
}
