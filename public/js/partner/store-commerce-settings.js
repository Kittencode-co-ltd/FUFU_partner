import { apiFetch } from '../utils/api-client.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const hasPoint = store => store?.location_lat != null && store?.location_lng != null
  && Number.isFinite(Number(store.location_lat)) && Number.isFinite(Number(store.location_lng));

export function commerceSettingsMarkup(store) {
  const point = hasPoint(store);
  return `<form id="commerce-settings" class="card space-y-4 p-5">
    <div><h3 class="text-lg font-bold text-navy">ที่อยู่และการจัดส่ง</h3><p class="mt-1 text-sm text-slate-500">ตั้งค่าที่อยู่ร้าน จุดบนแผนที่ และวิธีรับสินค้าของลูกค้า</p></div>
    <label class="block text-sm">ที่อยู่ร้าน<textarea name="address" maxlength="1000" rows="2" class="input-field mt-1 w-full" placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์">${esc(store.address)}</textarea></label>
    <div id="store-location-map" class="fufu-store-location-map rounded-2xl" role="application" aria-label="แผนที่ปักหมุดตำแหน่งร้าน"></div>
    <div class="flex flex-wrap items-center justify-between gap-2"><p id="store-location-coordinates" aria-live="polite" class="text-xs text-slate-500">${point ? `พิกัด ${Number(store.location_lat).toFixed(6)}, ${Number(store.location_lng).toFixed(6)}` : 'ยังไม่ได้ปักหมุดตำแหน่งร้าน'}</p><button type="button" id="use-store-location" class="min-h-10 rounded-full border px-4 text-sm font-semibold text-primary">ใช้ตำแหน่งปัจจุบัน</button></div>
    <div class="flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4">
      <label class="flex min-h-10 items-center gap-2 text-sm"><input name="can_sell_products" type="checkbox" ${store.can_sell_products?'checked':''}> เปิดรับคำสั่งซื้อสินค้า</label>
      <label class="flex min-h-10 items-center gap-2 text-sm"><input name="supports_pickup" type="checkbox" ${store.supports_pickup?'checked':''}> รับสินค้าที่ร้าน</label>
      <label class="flex min-h-10 items-center gap-2 text-sm"><input name="supports_delivery" type="checkbox" ${store.supports_delivery?'checked':''}> จัดส่ง</label>
      <label class="text-sm">ค่าจัดส่ง (฿)<input name="delivery_fee" type="number" min="0" step="0.01" value="${Number(store.delivery_fee||0)}" class="input-field mt-1 w-32"></label>
      <button type="submit" class="btn-primary min-h-10 px-4 text-sm">บันทึกที่อยู่และวิธีรับสินค้า</button>
    </div>
  </form>`;
}

export function mountCommerceSettings(container, store, storeId) {
  const form = container.querySelector('#commerce-settings');
  const root = form?.querySelector('#store-location-map');
  if (!form || !root) return;
  (async () => {
    if (!document.querySelector('link[data-fufu-leaflet]')) {
      const link = document.createElement('link'); link.rel='stylesheet'; link.href='/js/vendor/leaflet/leaflet.css'; link.dataset.fufuLeaflet='true'; document.head.append(link);
    }
    if (!window.L) await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-fufu-leaflet]');
      if (existing) { existing.addEventListener('load',resolve,{once:true}); if(window.L) resolve(); return; }
      const script=document.createElement('script'); script.src='/js/vendor/leaflet/leaflet.js'; script.dataset.fufuLeaflet='true'; script.onload=resolve; script.onerror=reject; document.head.append(script);
    }).catch(() => { if(root.isConnected) root.innerHTML='<p class="p-6 text-sm text-red-700">โหลดแผนที่ไม่สำเร็จ กรุณาโหลดหน้าใหม่</p>'; });
    if (!window.L || !root.isConnected) return;
    const L=window.L, valid=hasPoint(store), initial=valid?[Number(store.location_lat),Number(store.location_lng)]:[16.82,100.27];
    const map=L.map(root,{scrollWheelZoom:false}).setView(initial,valid?16:6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    let marker=null;
    const savePoint=latlng=>{
      if(marker) marker.setLatLng(latlng); else marker=L.marker(latlng,{draggable:true}).addTo(map);
      form._storeLocationMap={getCenterPoint:()=>({latitude:marker.getLatLng().lat,longitude:marker.getLatLng().lng})};
      const p=form._storeLocationMap.getCenterPoint(); form.querySelector('#store-location-coordinates').textContent=`พิกัด ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
      marker.off('dragend').on('dragend',()=>savePoint(marker.getLatLng()));
    };
    map.on('click',event=>savePoint(event.latlng)); if(valid) savePoint(initial);
    form.querySelector('#use-store-location').addEventListener('click',()=>{
      if(!navigator.geolocation) return showToast('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง','error');
      navigator.geolocation.getCurrentPosition(position=>{const p=[position.coords.latitude,position.coords.longitude];map.setView(p,17);savePoint({lat:p[0],lng:p[1]});},()=>showToast('ระบุตำแหน่งไม่สำเร็จ กรุณาเลื่อนแผนที่แล้วแตะจุดที่ตั้งร้าน','error'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000});
    });
    setTimeout(()=>map.invalidateSize(),0);
  })();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('[type="submit"]'), point=form._storeLocationMap?.getCenterPoint()||(hasPoint(store)?{latitude:Number(store.location_lat),longitude:Number(store.location_lng)}:null), address=form.elements.address.value.trim();
    if(form.elements.supports_delivery.checked&&(!address||!point)){showToast('กรุณากรอกที่อยู่ร้านและปักหมุดก่อนเปิดรับจัดส่ง','error');return;}
    button.disabled=true;
    const result=await apiFetch(`/api/stores/${encodeURIComponent(storeId)}`,{method:'PATCH',body:JSON.stringify({address,latitude:point?.latitude??null,longitude:point?.longitude??null,can_sell_products:form.elements.can_sell_products.checked,supports_pickup:form.elements.supports_pickup.checked,supports_delivery:form.elements.supports_delivery.checked,delivery_fee:Number(form.elements.delivery_fee.value)})});
    button.disabled=false;
    if(!result?.success){showToast(result?.error||'บันทึกไม่สำเร็จ','error');return;}
    Object.assign(store,{address,location_lat:point?.latitude??null,location_lng:point?.longitude??null,can_sell_products:form.elements.can_sell_products.checked,supports_pickup:form.elements.supports_pickup.checked,supports_delivery:form.elements.supports_delivery.checked,delivery_fee:Number(form.elements.delivery_fee.value)});
    localStorage.setItem(STORAGE_KEYS.STORE_INFO,JSON.stringify(store)); showToast('บันทึกที่อยู่และวิธีรับสินค้าแล้ว ✓');
  });
}
