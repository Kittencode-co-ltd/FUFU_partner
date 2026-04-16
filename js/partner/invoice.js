/**
 * FUFU Partner – Thai Tax Invoice Generator
 * Generates print-ready invoices compliant with Thai Revenue Department format.
 * @module partner/invoice
 */

import { formatBaht } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';

/** Thai VAT rate */
const VAT_RATE = 0.07;

/**
 * Convert number to Thai baht text (simplified).
 * @param {number} amount
 * @returns {string}
 */
function numberToThaiBaht(amount) {
  const units = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  if (intPart === 0) return 'ศูนย์บาทถ้วน';

  let result = '';
  const str = String(intPart);
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i]);
    const pos = len - i - 1;

    if (digit === 0) continue;
    if (pos === 1 && digit === 1) { result += 'สิบ'; continue; }
    if (pos === 1 && digit === 2) { result += 'ยี่สิบ'; continue; }
    if (pos === 0 && digit === 1 && len > 1) { result += 'เอ็ด'; continue; }

    result += units[digit] + positions[pos];
  }

  result += 'บาท';
  if (decPart > 0) {
    result += numberToThaiBaht(decPart).replace('บาทถ้วน', '').replace('บาท', '') + 'สตางค์';
  } else {
    result += 'ถ้วน';
  }

  return result;
}

/**
 * Generate a sequential invoice number.
 * @param {string} prefix - 'INV' or 'RCP'
 * @returns {string}
 */
function generateInvoiceNumber(prefix = 'INV') {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `${prefix}-${y}${m}-${seq}`;
}

/**
 * Generate invoice HTML for printing.
 * @param {Object} data
 * @param {string} data.type - 'invoice' or 'receipt'
 * @param {Object} data.seller - { name, taxId, address, phone, branchNo }
 * @param {Object} data.buyer - { name, taxId, address, phone }
 * @param {Array} data.items - [{ name, qty, unit, unitPrice }]
 * @param {string} data.paymentMethod - 'cash','promptpay','card','transfer','voucher'
 * @param {number} [data.discount] - Discount amount
 * @param {string} [data.notes]
 * @returns {string} HTML string
 */
export function generateInvoiceHTML(data) {
  const isReceipt = data.type === 'receipt';
  const docTitle = isReceipt ? 'ใบเสร็จรับเงิน / Receipt' : 'ใบกำกับภาษี / Tax Invoice';
  const invoiceNo = generateInvoiceNumber(isReceipt ? 'RCP' : 'INV');
  const now = new Date();
  const thaiDate = now.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const subtotal = data.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  const discount = data.discount || 0;
  const beforeVat = subtotal - discount;
  const vatAmount = Math.round(beforeVat * VAT_RATE * 100) / 100;
  const total = beforeVat + vatAmount;

  const paymentLabels = {
    cash: 'เงินสด', promptpay: 'พร้อมเพย์', card: 'บัตรเครดิต/เดบิต',
    transfer: 'โอนเงิน', voucher: 'บัตรกำนัล',
  };

  return `
    <div style="max-width:800px;margin:0 auto;padding:30px;font-family:'Prompt','Sarabun',sans-serif;color:#1E293B;background:#fff">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0D9488">
        <div>
          <div style="font-size:24px;font-weight:700;color:#0D9488;margin-bottom:4px">🐾 FUFU</div>
          <div style="font-size:18px;font-weight:600">${docTitle}</div>
          ${!isReceipt ? '<div style="font-size:11px;color:#64748B;margin-top:2px">ต้นฉบับ / Original</div>' : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:600">เลขที่: ${invoiceNo}</div>
          <div style="font-size:12px;color:#64748B">วันที่: ${thaiDate}</div>
        </div>
      </div>

      <!-- Seller / Buyer -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div style="padding:14px;border:1px solid #E2E8F0;border-radius:8px">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">ผู้ออกเอกสาร (Seller)</div>
          <div style="font-weight:600;margin-bottom:2px">${data.seller.name}</div>
          <div style="font-size:12px;color:#64748B;line-height:1.6;font-family:'Sarabun',sans-serif">
            เลขประจำตัวผู้เสียภาษี: ${data.seller.taxId || '-'}<br>
            สาขา: ${data.seller.branchNo || 'สำนักงานใหญ่'}<br>
            ${data.seller.address || ''}<br>
            โทร: ${data.seller.phone || '-'}
          </div>
        </div>
        <div style="padding:14px;border:1px solid #E2E8F0;border-radius:8px">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">ผู้ซื้อ / ลูกค้า (Buyer)</div>
          <div style="font-weight:600;margin-bottom:2px">${data.buyer.name || 'ลูกค้าทั่วไป'}</div>
          <div style="font-size:12px;color:#64748B;line-height:1.6;font-family:'Sarabun',sans-serif">
            ${data.buyer.taxId ? `เลขประจำตัวผู้เสียภาษี: ${data.buyer.taxId}<br>` : ''}
            ${data.buyer.address || ''}<br>
            ${data.buyer.phone ? `โทร: ${data.buyer.phone}` : ''}
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#F0FDFA">
            <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:2px solid #0D9488;color:#0D9488">ลำดับ</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:2px solid #0D9488;color:#0D9488">รายการ</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;border-bottom:2px solid #0D9488;color:#0D9488">จำนวน</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;border-bottom:2px solid #0D9488;color:#0D9488">หน่วย</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #0D9488;color:#0D9488">ราคา/หน่วย</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #0D9488;color:#0D9488">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, i) => `
            <tr style="border-bottom:1px solid #F1F5F9">
              <td style="padding:10px 12px;font-size:13px;font-family:'Sarabun',sans-serif">${i + 1}</td>
              <td style="padding:10px 12px;font-size:13px">${item.name}</td>
              <td style="padding:10px 12px;text-align:center;font-size:13px;font-family:'Sarabun',sans-serif">${item.qty}</td>
              <td style="padding:10px 12px;text-align:center;font-size:13px;font-family:'Sarabun',sans-serif">${item.unit || 'รายการ'}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;font-family:'Sarabun',sans-serif">${formatBaht(item.unitPrice)}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:500;font-family:'Sarabun',sans-serif">${formatBaht(item.qty * item.unitPrice)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end">
        <div style="width:300px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-family:'Sarabun',sans-serif">
            <span>ราคารวม (Subtotal)</span><span>${formatBaht(subtotal)}</span>
          </div>
          ${discount > 0 ? `
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#EF4444;font-family:'Sarabun',sans-serif">
              <span>ส่วนลด (Discount)</span><span>-${formatBaht(discount)}</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-family:'Sarabun',sans-serif">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span><span>${formatBaht(vatAmount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:700;border-top:2px solid #0D9488;margin-top:4px;color:#0D9488">
            <span>รวมทั้งสิ้น (Total)</span><span>${formatBaht(total)}</span>
          </div>
        </div>
      </div>

      <!-- Amount in words -->
      <div style="background:#F8FAFC;border-radius:8px;padding:12px;margin:16px 0;font-size:12px;font-family:'Sarabun',sans-serif">
        <strong>จำนวนเงิน (ตัวอักษร):</strong> ${numberToThaiBaht(total)}
      </div>

      <!-- Payment / Notes -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="font-size:12px;font-family:'Sarabun',sans-serif;color:#64748B">
          <strong>ชำระโดย:</strong> ${paymentLabels[data.paymentMethod] || data.paymentMethod || '-'}
          ${data.notes ? `<br><strong>หมายเหตุ:</strong> ${data.notes}` : ''}
        </div>
        <div style="text-align:center">
          <div style="border-top:1px dashed #CBD5E1;margin:40px 40px 0;padding-top:8px;font-size:11px;color:#64748B;font-family:'Sarabun',sans-serif">
            ผู้มีอำนาจลงนาม / Authorized Signature
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;font-size:10px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:12px;font-family:'Sarabun',sans-serif">
        เอกสารฉบับนี้ออกโดยระบบ FUFU Partner Portal • Kitten Code Co., Ltd. • © 2026
      </div>
    </div>
  `;
}

/**
 * Open invoice in a new print window.
 * @param {Object} data - Invoice data
 */
export function printInvoice(data) {
  const html = generateInvoiceHTML(data);
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) {
    showToast('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต Popup', 'error');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice</title>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600&display=swap" rel="stylesheet">
      <style>
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { margin: 0; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  printWindow.document.close();

  // Auto-print after fonts load
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 500);
  };
}

/**
 * Generate sample invoice data for demo/testing.
 * @returns {Object}
 */
export function getSampleInvoiceData() {
  return {
    type: 'invoice',
    seller: {
      name: 'Happy Paws Clinic',
      taxId: '0-1055-XXXXX-XX-X',
      branchNo: 'สำนักงานใหญ่',
      address: '123/45 ซอยสุขุมวิท 31 แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร 10110',
      phone: '02-123-4567',
    },
    buyer: {
      name: 'คุณสมชาย วิชัยดิษฐ',
      taxId: '',
      address: '89/12 ซอยลาดพร้าว 71 กรุงเทพฯ 10230',
      phone: '089-123-4567',
    },
    items: [
      { name: 'ตรวจสุขภาพประจำปี', qty: 1, unit: 'ครั้ง', unitPrice: 500 },
      { name: 'วัคซีน 5 โรค (Canine)', qty: 1, unit: 'เข็ม', unitPrice: 800 },
      { name: 'ยาถ่ายพยาธิ Heartgard', qty: 2, unit: 'เม็ด', unitPrice: 120 },
    ],
    paymentMethod: 'promptpay',
    discount: 0,
    notes: 'นัดตรวจสุขภาพครั้งถัดไป 6 เดือน',
  };
}
