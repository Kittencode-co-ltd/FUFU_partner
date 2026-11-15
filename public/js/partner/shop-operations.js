import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const LABELS = { pending_store_confirmation:'รอยืนยัน', preparing:'กำลังจัดเตรียม', ready_for_pickup:'พร้อมรับที่ร้าน', handed_to_courier:'กำลังจัดส่ง', delivered:'ส่งถึงแล้ว · รอลูกค้ายืนยัน', completed:'สำเร็จ', rejected:'ปฏิเสธ', cancelled:'ยกเลิก', delivery_failed:'จัดส่งไม่สำเร็จ', return_requested:'ลูกค้าขอคืนสินค้า', returned:'รับคืนแล้ว', refunded:'คืนเงินแล้ว' };

export async function renderShopOperations(container, view = 'orders') {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  container.innerHTML = `<div class="card p-8 text-center text-slate-500">กำลังโหลดคำสั่งซื้อ…</div>`;
  if (!storeId) { container.innerHTML = `<div class="card p-8 text-center text-slate-500">ไม่พบร้านที่เลือก กรุณาเลือกร้านค้าแล้วลองอีกครั้ง</div>`; return; }
  const response = await apiFetch(`/api/orders?store_id=${encodeURIComponent(storeId)}`);
  const storeResponse = await apiFetch('/api/stores');
  const ownStore = (storeResponse?.data || []).find(store => store.id === storeId);
  const orders = response?.data || [];
  if (!response?.success) { container.innerHTML = `<div class="card p-8 text-center text-red-600">โหลดคำสั่งซื้อไม่สำเร็จ: ${esc(response?.error || 'กรุณาลองใหม่')}</div>`; return; }
  const shown = view === 'delivery' ? orders.filter(o => ['handed_to_courier','delivered','delivery_failed','return_requested'].includes(o.status) || o.fulfillment_method === 'delivery') : orders;
  container.innerHTML = `<div class="space-y-4">
    <header class="rounded-2xl bg-navy p-6 text-white"><div class="text-xs font-bold tracking-widest text-white/60">${view === 'delivery' ? 'DELIVERY DESK' : 'ONLINE ORDERS'}</div><h1 class="mt-2 text-2xl font-bold">${view === 'delivery' ? 'จัดส่งสินค้า' : 'คำสั่งซื้อออนไลน์'}</h1><p class="mt-1 text-sm text-white/75">${orders.length} รายการ · อัปเดตสถานะแล้วลูกค้าจะเห็นในประวัติคำสั่งซื้อ</p></header>
    ${ownStore ? `<form id="commerce-settings" class="card space-y-4 p-4"><div><h2 class="font-semibold text-navy">ที่อยู่และตำแหน่งร้าน</h2><p class="mt-1 text-sm text-slate-500">ต้องกรอกที่อยู่และปักหมุดก่อนเปิดรับจัดส่ง</p></div><label class="block text-sm">ที่อยู่ร้าน<textarea name="address" maxlength="1000" rows="2" class="input-field mt-1 w-full" placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์">${esc(ownStore.address||'')}</textarea></label><div id="store-location-map" class="fufu-store-location-map rounded-2xl" role="application" aria-label="แผนที่ปักหมุดตำแหน่งร้าน"></div><div class="flex flex-wrap items-center justify-between gap-2"><p id="store-location-coordinates" aria-live="polite" class="text-xs text-slate-500">${hasStorePoint(ownStore)?`พิกัด ${Number(ownStore.location_lat).toFixed(6)}, ${Number(ownStore.location_lng).toFixed(6)}`:'ยังไม่ได้ปักหมุดตำแหน่งร้าน'}</p><button type="button" id="use-store-location" class="min-h-10 rounded-full border px-4 text-sm font-semibold text-primary">ใช้ตำแหน่งปัจจุบัน</button></div><div class="flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4"><label class="flex min-h-10 items-center gap-2 text-sm"><input name="can_sell_products" type="checkbox" ${ownStore.can_sell_products?'checked':''}> เปิดรับคำสั่งซื้อสินค้า</label><label class="flex min-h-10 items-center gap-2 text-sm"><input name="supports_pickup" type="checkbox" ${ownStore.supports_pickup?'checked':''}> รับสินค้าที่ร้าน</label><label class="flex min-h-10 items-center gap-2 text-sm"><input name="supports_delivery" type="checkbox" ${ownStore.supports_delivery?'checked':''}> จัดส่ง</label><label class="text-sm">ค่าจัดส่ง (฿)<input name="delivery_fee" type="number" min="0" step="0.01" value="${Number(ownStore.delivery_fee||0)}" class="input-field mt-1 w-32"></label><button class="btn-primary min-h-10 px-4 text-sm">บันทึกข้อมูลร้านและวิธีรับสินค้า</button></div></form>` : ''}
    ${shown.length ? shown.map(order => `<article class="card space-y-4 p-5" data-order="${esc(order.id)}">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-bold text-navy">คำสั่งซื้อ #${esc(order.id.slice(0,8).toUpperCase())}</h2><p class="mt-1 text-sm text-slate-500">${new Date(order.created_at).toLocaleString('th-TH')} · ${order.fulfillment_method === 'pickup' ? 'รับที่ร้าน' : 'จัดส่ง'}</p></div><span class="rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">${LABELS[order.status] || esc(order.status)}</span></div>
      <div class="grid gap-2 sm:grid-cols-2"><div class="rounded-xl bg-slate-50 p-3 text-sm"><b>ผู้รับ:</b> ${esc(order.customer_phone)}${order.delivery_address ? `<br><b>ที่อยู่:</b> ${esc(order.delivery_address.address)}<br><b>รายละเอียด:</b> ${esc(order.delivery_address.details)}${hasDeliveryPoint(order.delivery_address) ? `<br><a class="mt-2 inline-flex min-h-10 items-center font-semibold text-teal" href="https://www.google.com/maps/dir/?api=1&destination=${Number(order.delivery_address.latitude)},${Number(order.delivery_address.longitude)}" target="_blank" rel="noreferrer">เปิดแผนที่จุดส่ง</a>` : ''}` : ''}${order.customer_note ? `<br><b>หมายเหตุ:</b> ${esc(order.customer_note)}` : ''}</div><div class="rounded-xl bg-slate-50 p-3 text-sm">${(order.commerce_order_items || []).map(item => `<div class="flex justify-between gap-3"><span>${esc(item.product_name)} × ${item.quantity}</span><span>฿${Number(item.line_total).toLocaleString('th-TH')}</span></div>`).join('')}<div class="mt-2 border-t pt-2 text-right font-bold">รวม ฿${Number(order.total_amount).toLocaleString('th-TH')} · ชำระ: ${order.payment_status === 'pending' ? 'รอชำระเมื่อรับสินค้า' : esc(order.payment_status)}</div></div></div>
      ${order.order_deliveries?.[0] ? `<p class="text-sm text-slate-600">ขนส่ง: ${esc(order.order_deliveries[0].provider)} · เลขติดตาม ${esc(order.order_deliveries[0].tracking_number)}</p>` : ''}
      <div class="flex flex-wrap gap-2">${actionButtons(order)}</div>
    </article>`).join('') : `<section class="card p-10 text-center"><div class="mx-auto text-primary">${icon('receipt','h-8 w-8')}</div><h2 class="mt-3 font-semibold text-navy">ยังไม่มีคำสั่งซื้อ</h2><p class="mt-1 text-sm text-slate-500">คำสั่งซื้อใหม่จะแสดงที่นี่</p></section>`}
  </div>`;
  if (ownStore) void mountStoreLocationPicker(container, ownStore);
  container.onclick = async event => {
    const button = event.target.closest('[data-status]'); if (!button) return;
    const card = button.closest('[data-order]'); button.disabled = true;
    const reasonRequired = ['rejected','delivery_failed'].includes(button.dataset.status);
    const reason = reasonRequired ? (window.prompt(button.dataset.status === 'rejected' ? 'ระบุเหตุผลที่ปฏิเสธคำสั่งซื้อ' : 'ระบุเหตุผลที่จัดส่งไม่สำเร็จ') || '') : '';
    if (reasonRequired && reason.trim().length < 3) { button.disabled = false; return; }
    let provider = ''; let tracking_number = '';
    if (button.dataset.status === 'handed_to_courier') { provider = window.prompt('ชื่อผู้ให้บริการขนส่ง (เช่น Grab)') || ''; tracking_number = window.prompt('เลขติดตาม (ถ้ามี)') || ''; }
    const result = await apiFetch(`/api/orders/${encodeURIComponent(card.dataset.order)}/transition`, { method:'POST', body:JSON.stringify({ store_id:storeId, status:button.dataset.status, reason, provider, tracking_number }) });
    if (!result?.success) { window.alert(result?.error || 'เปลี่ยนสถานะไม่สำเร็จ'); button.disabled = false; return; }
    await renderShopOperations(container, view);
  };
  container.querySelector('#commerce-settings')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]');
    const map = form._storeLocationMap;
    const point = map?.getCenterPoint?.() || (hasStorePoint(ownStore) ? { latitude:Number(ownStore.location_lat), longitude:Number(ownStore.location_lng) } : null);
    const address = form.elements.address.value.trim();
    if (form.elements.supports_delivery.checked && (!address || !point)) { window.alert('กรุณากรอกที่อยู่ร้านและปักหมุดตำแหน่งบนแผนที่ก่อนเปิดรับจัดส่ง'); return; }
    button.disabled = true;
    const result = await apiFetch(`/api/stores/${encodeURIComponent(storeId)}`, { method:'PATCH', body:JSON.stringify({ address, latitude:point?.latitude ?? null, longitude:point?.longitude ?? null, can_sell_products:form.elements.can_sell_products.checked, supports_pickup:form.elements.supports_pickup.checked, supports_delivery:form.elements.supports_delivery.checked, delivery_fee:Number(form.elements.delivery_fee.value) }) });
    if (!result?.success) { window.alert(result?.error || 'บันทึกไม่สำเร็จ'); button.disabled = false; }
    else { window.alert('บันทึกที่อยู่และวิธีรับสินค้าแล้ว'); await renderShopOperations(container, view); }
  });
}

async function mountStoreLocationPicker(container, store) {
  const root = container.querySelector('#store-location-map'); if (!root) return;
  if (!document.querySelector('link[data-fufu-leaflet]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/js/vendor/leaflet/leaflet.css'; link.dataset.fufuLeaflet = 'true'; document.head.append(link);
  }
  if (!window.L) await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-fufu-leaflet]');
    if (existing) { existing.addEventListener('load', resolve, { once:true }); if (window.L) resolve(); return; }
    const script = document.createElement('script'); script.src = '/js/vendor/leaflet/leaflet.js'; script.dataset.fufuLeaflet = 'true'; script.onload = resolve; script.onerror = reject; document.head.append(script);
  }).catch(() => { root.innerHTML = '<p class="p-6 text-sm text-red-700">โหลดแผนที่ไม่สำเร็จ กรุณาโหลดหน้าใหม่</p>'; });
  if (!window.L || !root.isConnected) return;
  const L = window.L;
  const hasPoint = hasStorePoint(store);
  const initial = hasPoint ? [Number(store.location_lat), Number(store.location_lng)] : [16.82,100.27];
  const map = L.map(root, { scrollWheelZoom:false }).setView(initial, hasPoint ? 16 : 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map);
  let marker = null;
  const form = root.closest('form');
  const output = form.querySelector('#store-location-coordinates');
  const savePoint = (latlng) => {
    if (marker) marker.setLatLng(latlng); else marker = L.marker(latlng, { draggable:true }).addTo(map);
    form._storeLocationMap = { getCenterPoint:() => ({ latitude:marker.getLatLng().lat, longitude:marker.getLatLng().lng }) };
    const point = form._storeLocationMap.getCenterPoint();
    output.textContent = `พิกัด ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
    marker.off('dragend').on('dragend', () => savePoint(marker.getLatLng()));
  };
  map.on('click', event => savePoint(event.latlng));
  if (hasPoint) savePoint(initial);
  form.querySelector('#use-store-location').addEventListener('click', () => {
    if (!navigator.geolocation) return window.alert('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
    navigator.geolocation.getCurrentPosition(position => { const point = [position.coords.latitude,position.coords.longitude]; map.setView(point,17); savePoint({ lat:point[0], lng:point[1] }); }, () => window.alert('ระบุตำแหน่งไม่สำเร็จ กรุณาเลื่อนแผนที่แล้วแตะจุดที่ตั้งร้าน'), { enableHighAccuracy:true, timeout:10000, maximumAge:30000 });
  });
  setTimeout(() => map.invalidateSize(), 0);
}

function actionButtons(order) {
  const actions = {
    pending_store_confirmation: [['preparing','ยืนยันและเริ่มเตรียม'],['rejected','ปฏิเสธ']],
    preparing: order.fulfillment_method === 'pickup' ? [['ready_for_pickup','พร้อมให้รับ']] : [['handed_to_courier','ส่งให้ขนส่ง']],
    handed_to_courier: [['delivered','ยืนยันส่งถึงลูกค้า'],['delivery_failed','แจ้งจัดส่งไม่สำเร็จ']],
    return_requested: [['returned','ยืนยันรับสินค้าคืน']],
    delivery_failed: [['handed_to_courier','จัดส่งอีกครั้ง']],
  }[order.status] || [];
  return actions.map(([status,label]) => `<button data-status="${status}" class="min-h-10 rounded-lg ${status==='rejected'?'border border-red-200 text-red-700':'bg-primary px-4 text-white'} px-4 text-sm font-semibold">${label}</button>`).join('');
}

function hasDeliveryPoint(address) {
  return address?.latitude != null && address?.longitude != null
    && Number.isFinite(Number(address.latitude)) && Number(address.latitude) >= -90 && Number(address.latitude) <= 90
    && Number.isFinite(Number(address.longitude)) && Number(address.longitude) >= -180 && Number(address.longitude) <= 180;
}

function hasStorePoint(store) {
  return store?.location_lat != null && store?.location_lng != null
    && Number.isFinite(Number(store.location_lat)) && Number.isFinite(Number(store.location_lng));
}
