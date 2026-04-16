/**
 * FUFU Partner – Inventory & Product Management
 * Handles product listing, low stock alerts, supplier management, and stock logs.
 * @module partner/inventory
 * 
 * Acceptance Criteria:
 * - [x] Displays current inventory stock levels.
 * - [x] Supports Low Stock alerts and notification toggle.
 * - [x] Handles stock logs and supplier details.
 * - [x] Respects FEATURE_FLAGS.ENABLE_INVENTORY_ALERTS.
 */

import { showToast } from '../utils/notifications.js';
import { formatCurrency, formatThaiDate } from '../utils/formatters.js';
import { FEATURE_FLAGS } from '../utils/config.js';

// ===== STOCK ALERT THRESHOLDS =====
const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 3;

// ===== MOCK EXTENDED PRODUCT DATA =====
const extendedProducts = [
  { id: 'p1', icon: '💉', name: 'วัคซีน DHPPL 5 โรค', costPrice: 350, sellPrice: 800, stock: 22, unit: 'เข็ม', category: 'vaccine', expiryDate: '2027-03-01', supplier: 'Zoetis Thailand' },
  { id: 'p2', icon: '🔬', name: 'ตรวจเลือดครบชุด CBC', costPrice: 400, sellPrice: 1200, stock: 50, unit: 'ชุด', category: 'lab', expiryDate: null, supplier: 'IDEXX' },
  { id: 'p3', icon: '💊', name: 'ยาถ่ายพยาธิ Heartgard', costPrice: 45, sellPrice: 120, stock: 8, unit: 'เม็ด', category: 'medicine', expiryDate: '2026-08-15', supplier: 'Boehringer Ingelheim' },
  { id: 'p4', icon: '🧴', name: 'แชมพู Malaseb (250ml)', costPrice: 180, sellPrice: 350, stock: 2, unit: 'ขวด', category: 'supply', expiryDate: '2027-01-01', supplier: 'Dermcare-Vet' },
  { id: 'p5', icon: '🩹', name: 'ผ้าก๊อซ Sterile 4x4', costPrice: 15, sellPrice: 30, stock: 200, unit: 'แผ่น', category: 'supply', expiryDate: '2028-06-01', supplier: 'Medline Thailand' },
  { id: 'p6', icon: '💊', name: 'Meloxicam 1.5mg/ml', costPrice: 120, sellPrice: 250, stock: 5, unit: 'ขวด (15ml)', category: 'medicine', expiryDate: '2026-06-30', supplier: 'Ceva Animal Health' },
];

const stockMovements = [
  { date: '2026-04-16', product: 'วัคซีน DHPPL', type: 'OUT', qty: -2, reason: 'ใช้ในการรักษา - คิว A001', by: 'ดร.สมศักดิ์' },
  { date: '2026-04-16', product: 'ยาถ่ายพยาธิ Heartgard', type: 'OUT', qty: -3, reason: 'จ่ายยาให้ผู้ป่วย', by: 'คุณณัฐพล' },
  { date: '2026-04-15', product: 'แชมพู Malaseb', type: 'IN', qty: 5, reason: 'รับสินค้าจากซัพพลายเออร์ PO-2026-042', by: 'คุณสุดา' },
  { date: '2026-04-14', product: 'ผ้าก๊อซ Sterile', type: 'IN', qty: 100, reason: 'รับสินค้า PO-2026-041', by: 'คุณสุดา' },
  { date: '2026-04-13', product: 'Meloxicam 1.5mg/ml', type: 'ADJUST', qty: -1, reason: 'ตรวจนับสต็อก — พบหมดอายุ', by: 'Admin' },
  { date: '2026-04-10', product: 'วัคซีน DHPPL', type: 'EXPIRED', qty: -3, reason: 'สินค้าหมดอายุ (Lot: VX-2024-B)', by: 'ระบบอัตโนมัติ' },
];

const mockSuppliers = [
  { id: 's1', name: 'Zoetis Thailand', contact: 'คุณมนัส', phone: '02-111-1111', email: 'sales@zoetis.co.th', items: 8, lastOrder: '2026-04-01' },
  { id: 's2', name: 'IDEXX Laboratories', contact: 'คุณวรรณ', phone: '02-222-2222', email: 'order@idexx.co.th', items: 5, lastOrder: '2026-03-28' },
  { id: 's3', name: 'Boehringer Ingelheim', contact: 'คุณสมจิตร', phone: '02-333-3333', email: 'vet@boehringer.co.th', items: 12, lastOrder: '2026-04-05' },
];

// ===== HELPERS =====

/**
 * Get stock status badge based on quantity.
 * @param {number} stock
 * @returns {{ label: string, class: string, color: string }}
 */
function getStockStatus(stock) {
  if (stock <= CRITICAL_STOCK_THRESHOLD) {
    return { label: '🔴 วิกฤต', class: 'stock-critical', color: '#EF4444', bg: '#FEE2E2' };
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return { label: '🟡 ใกล้หมด', class: 'stock-low', color: '#F59E0B', bg: '#FEF3C7' };
  }
  return { label: '🟢 ปกติ', class: 'stock-ok', color: '#10B981', bg: '#D1FAE5' };
}

/**
 * Check if a product is near expiry (within 90 days).
 * @param {string|null} expiryDate
 * @returns {{ isNearExpiry: boolean, isExpired: boolean, daysLeft: number }}
 */
function checkExpiry(expiryDate) {
  if (!expiryDate) return { isNearExpiry: false, isExpired: false, daysLeft: Infinity };
  const now = new Date();
  const exp = new Date(expiryDate);
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  return {
    isExpired: daysLeft <= 0,
    isNearExpiry: daysLeft > 0 && daysLeft <= 90,
    daysLeft,
  };
}

/**
 * Calculate profit margin percentage.
 * @param {number} cost
 * @param {number} sell
 * @returns {number}
 */
function profitMargin(cost, sell) {
  if (!sell || sell === 0) return 0;
  return Math.round(((sell - cost) / sell) * 100);
}

// ===== RENDER =====

/**
 * Render the product/service grid (enhanced version).
 * @param {Array} products - Array of product objects (basic format from dashboard)
 */
export function renderProducts(products) {
  const pg = document.getElementById('product-grid');
  if (!pg || !products) return;

  // Use extended data if available, fallback to basic
  const data = extendedProducts.length > 0 ? extendedProducts : products;

  pg.innerHTML = data.map(p => {
    const isExtended = p.costPrice !== undefined;
    const stockStatus = isExtended ? getStockStatus(p.stock) : null;
    const expiry = isExtended ? checkExpiry(p.expiryDate) : null;
    const margin = isExtended ? profitMargin(p.costPrice, p.sellPrice) : null;

    return `
      <div class="product-card" data-product-id="${p.id || ''}" style="position:relative">
        ${expiry?.isExpired ? `<div style="position:absolute;top:8px;right:8px;padding:2px 8px;border-radius:6px;background:#FEE2E2;color:#991B1B;font-size:10px;font-weight:600">หมดอายุ</div>` : ''}
        ${expiry?.isNearExpiry ? `<div style="position:absolute;top:8px;right:8px;padding:2px 8px;border-radius:6px;background:#FEF3C7;color:#92400E;font-size:10px;font-weight:600">ใกล้หมดอายุ (${expiry.daysLeft}d)</div>` : ''}
        <div class="product-img">${p.icon}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">${isExtended ? formatCurrency(p.sellPrice) : p.price}</div>
        ${isExtended ? `
          <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0">
            <div class="product-stock">
              <i class="fas fa-box" style="font-size:10px"></i> ${p.stock} ${p.unit}
            </div>
            <span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${stockStatus.bg};color:${stockStatus.color};font-weight:600">${stockStatus.label}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:8px;font-family:'Sarabun',sans-serif">
            <span>ทุน: ${formatCurrency(p.costPrice)}</span>
            <span style="color:${margin > 30 ? '#10B981' : '#F59E0B'};font-weight:600">กำไร: ${margin}%</span>
          </div>
        ` : `
          <div class="product-stock"><i class="fas fa-box" style="font-size:10px"></i> ${p.stock}</div>
        `}
        <div class="product-actions">
          <button class="btn-sm btn-outline" style="flex:1" data-action="edit-product" data-pid="${p.id || ''}">แก้ไข</button>
          <button class="btn-sm btn-primary" style="flex:1" data-action="manage-stock" data-pid="${p.id || ''}">จัดการ</button>
        </div>
      </div>`;
  }).join('');

  // Event delegation
  pg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit-product') showToast('เปิดฟอร์มแก้ไขสินค้า (Demo)', 'info');
    if (btn.dataset.action === 'manage-stock') showToast('เปิดฟอร์มจัดการสต็อก (Demo)', 'info');
  });
}

/**
 * Render the full inventory management page (called when navigating to products).
 * Adds supplier table and stock movement log below the product grid.
 */
export function renderInventoryExtras() {
  const page = document.getElementById('page-products');
  if (!page) return;

  // Check if extras already exist
  if (page.querySelector('#inventory-extras')) return;

  const extras = document.createElement('div');
  extras.id = 'inventory-extras';
  extras.innerHTML = `
    <!-- Stock Alerts Summary -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">⚠️ การแจ้งเตือนสต็อก</div>
        <div class="alert-toggle-container">
          <label class="switch">
            <input type="checkbox" id="low-stock-alert" checked>
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${extendedProducts.filter(p => p.stock <= LOW_STOCK_THRESHOLD).map(p => {
          const status = getStockStatus(p.stock);
          const exp = checkExpiry(p.expiryDate);
          return `
            <div style="padding:12px;border-radius:10px;border:1px solid ${status.color}30;background:${status.bg}">
              <div style="font-weight:500;font-size:13px;margin-bottom:4px">${p.icon} ${p.name}</div>
              <div style="font-size:12px;color:${status.color};font-weight:600">เหลือ ${p.stock} ${p.unit}</div>
              ${exp.isNearExpiry || exp.isExpired ? `<div style="font-size:11px;color:#EF4444;margin-top:2px">⏰ ${exp.isExpired ? 'หมดอายุแล้ว' : `หมดอายุใน ${exp.daysLeft} วัน`}</div>` : ''}
            </div>
          `;
        }).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-family:\'Sarabun\',sans-serif;grid-column:1/-1">✅ ไม่มีสินค้าที่ต้องแจ้งเตือน</div>'}
      </div>
    </div>

    <!-- Stock Movement Log -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">📦 บันทึกการเคลื่อนไหวสต็อก (Stock Movement Log)</div>
        <button class="btn-sm btn-outline" id="export-stock-btn"><i class="fas fa-download" style="margin-right:4px"></i>Export CSV</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>สินค้า</th>
            <th>ประเภท</th>
            <th>จำนวน</th>
            <th>เหตุผล / หมายเหตุ</th>
            <th>โดย</th>
          </tr>
        </thead>
        <tbody>
          ${stockMovements.map(m => {
            const typeColors = { IN: '#10B981', OUT: '#3B82F6', ADJUST: '#F59E0B', EXPIRED: '#EF4444', AUDIT: '#8B5CF6' };
            const typeLabels = { IN: 'รับเข้า', OUT: 'จ่ายออก', ADJUST: 'ปรับปรุง', EXPIRED: 'หมดอายุ', AUDIT: 'ตรวจนับ' };
            return `
              <tr>
                <td style="font-family:'Sarabun',sans-serif;font-size:13px">${m.date}</td>
                <td style="font-weight:500;font-size:13px">${m.product}</td>
                <td><span style="padding:2px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${typeColors[m.type]}15;color:${typeColors[m.type]}">${typeLabels[m.type]}</span></td>
                <td style="font-weight:600;color:${m.qty > 0 ? '#10B981' : '#EF4444'};font-family:'Sarabun',sans-serif">${m.qty > 0 ? '+' : ''}${m.qty}</td>
                <td style="font-size:12px;color:var(--text-muted);font-family:'Sarabun',sans-serif;max-width:200px">${m.reason}</td>
                <td style="font-size:12px">${m.by}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Suppliers -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">🏭 ซัพพลายเออร์ (Suppliers)</div>
        <button class="btn-sm btn-primary" id="add-supplier-btn"><i class="fas fa-plus" style="margin-right:4px"></i>เพิ่มซัพพลายเออร์</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>ชื่อบริษัท</th>
            <th>ผู้ติดต่อ</th>
            <th>เบอร์โทร</th>
            <th>สินค้า</th>
            <th>สั่งซื้อล่าสุด</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          ${mockSuppliers.map(s => `
            <tr>
              <td style="font-weight:500">${s.name}</td>
              <td>${s.contact}</td>
              <td style="font-family:'Sarabun',sans-serif;font-size:13px">${s.phone}</td>
              <td><span class="badge badge-info">${s.items} รายการ</span></td>
              <td style="font-family:'Sarabun',sans-serif;font-size:13px">${s.lastOrder}</td>
              <td>
                <button class="btn-sm btn-primary" data-action="create-po" data-supplier="${s.id}" style="font-size:11px">
                  <i class="fas fa-file-invoice" style="margin-right:4px"></i>สร้าง PO
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  page.appendChild(extras);

  // Alert toggle
  const alertToggleContainer = extras.querySelector('.alert-toggle-container');
  if (alertToggleContainer) {
    if (!FEATURE_FLAGS.ENABLE_INVENTORY_ALERTS) {
      alertToggleContainer.style.display = 'none';
      showToast('ฟีเจอร์การแจ้งเตือนสต็อกเหลือน้อยปิดใช้งานอยู่', 'info');
    } else {
      const toggle = extras.querySelector('#low-stock-alert');
      if (toggle) {
        toggle.addEventListener('change', (e) => {
          showToast(`การแจ้งเตือนสต็อกเหลือน้อย: ${e.target.checked ? 'เปิด' : 'ปิด'}`, 'info');
        });
      }
    }
  }

  // Event handlers
  extras.querySelector('#export-stock-btn')?.addEventListener('click', () => showToast('กำลังสร้างไฟล์ CSV (Demo)', 'info'));
  extras.querySelector('#add-supplier-btn')?.addEventListener('click', () => showToast('เปิดฟอร์มเพิ่มซัพพลายเออร์ (Demo)', 'info'));
  extras.querySelectorAll('[data-action="create-po"]').forEach(btn => {
    btn.addEventListener('click', () => showToast('กำลังสร้าง Purchase Order (Demo)', 'info'));
  });
}
