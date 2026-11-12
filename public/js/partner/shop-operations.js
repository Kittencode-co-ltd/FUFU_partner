import { icon } from '../utils/icons.js';

const VIEWS = {
  orders: {
    eyebrow: 'ONLINE ORDERS',
    title: 'คำสั่งซื้อออนไลน์',
    description: 'รับออเดอร์จาก FUFU App แล้วส่งต่อเข้าคลังและการจัดส่ง',
    icon: 'receipt',
    primary: ['รอรับออเดอร์', 'กำลังจัดสินค้า', 'พร้อมส่ง', 'สำเร็จ'],
    emptyTitle: 'ยังไม่มีออเดอร์ที่ผูกกับร้านนี้',
    emptyText: 'แอป FUFU ยังไม่ได้ส่งรหัสร้านมากับคำสั่งซื้อ จึงยังแยกออเดอร์ของร้านนี้ไม่ได้',
  },
  delivery: {
    eyebrow: 'DELIVERY DESK',
    title: 'จัดส่งสินค้า',
    description: 'เตรียมสินค้า แพ็กออเดอร์ และติดตามสถานะการส่ง',
    icon: 'exchange-alt',
    primary: ['รอจัดสินค้า', 'กำลังแพ็ก', 'รอขนส่ง', 'จัดส่งแล้ว'],
    emptyTitle: 'ยังไม่มีรายการรอจัดส่ง',
    emptyText: 'เมื่อออเดอร์ออนไลน์เชื่อมกับร้านแล้ว รายการที่ต้องแพ็กและจัดส่งจะแสดงตรงนี้',
  },
};

export function renderShopOperations(container, view = 'orders') {
  const config = VIEWS[view] || VIEWS.orders;
  container.innerHTML = `
    <div class="space-y-5">
      <section class="rounded-2xl bg-navy p-6 text-white shadow-card sm:p-8">
        <div class="text-[11px] font-bold tracking-[0.16em] text-white/65">${config.eyebrow} · SHOP WORKSPACE</div>
        <div class="mt-2 flex items-start gap-4">
          <span class="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">${icon(config.icon, 'w-6 h-6')}</span>
          <div><h1 class="text-2xl font-bold sm:text-3xl">${config.title}</h1><p class="mt-2 max-w-2xl text-sm text-white/75">${config.description}</p></div>
        </div>
        <div class="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          ${config.primary.map((step, index) => `<div class="flex min-h-12 items-center gap-2 rounded-xl ${index === 0 ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'} px-3 py-2 text-xs font-semibold sm:text-sm"><span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/15">${index + 1}</span>${step}</div>`).join('')}
        </div>
      </section>

      <section class="card border border-amber-200 bg-amber-50/70 p-4 sm:p-5" role="status">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">${icon('exclamation-triangle', 'w-4 h-4')}</span>
          <div><h2 class="text-sm font-semibold text-amber-950">กำลังเตรียมการเชื่อมคำสั่งซื้อจาก FUFU App</h2><p class="mt-1 text-sm leading-6 text-amber-900/80">ตอนนี้คำสั่งซื้อจากแอปยังไม่มีรหัสร้านกำกับ จึงยังแสดงออเดอร์และเปลี่ยนสถานะจัดส่งจากพอร์ทัลไม่ได้</p></div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="border-b border-slate-100 px-5 py-4"><h2 class="font-semibold text-navy">${config.emptyTitle}</h2><p class="mt-1 text-sm text-slate-500">${config.emptyText}</p></div>
        <div class="flex flex-col items-center px-5 py-10 text-center sm:py-14">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">${icon(config.icon, 'w-6 h-6')}</span>
          <p class="mt-4 max-w-lg text-sm text-slate-500">หน้านี้พร้อมสำหรับขั้นตอนรับออเดอร์และส่งต่อคลัง เมื่อเชื่อมข้อมูลร้านกับระบบสั่งซื้อแล้ว</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" data-shop-nav="inventory" class="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-navy transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">${icon('box', 'mr-2 inline h-4 w-4')}ไปที่คลังสินค้า</button>
            <button type="button" data-shop-nav="pos" class="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">${icon('credit-card', 'mr-2 inline h-4 w-4')}ขายหน้าร้าน · POS</button>
          </div>
        </div>
      </section>
    </div>`;

  container.onclick = event => {
    const button = event.target.closest('[data-shop-nav]');
    if (button) import('./dashboard.js').then(({ navigate }) => navigate(button.dataset.shopNav));
  };
}
