// Business reports for the store owner: sales, visits, top services, returning customers for a date range,
// compared with the period just before. Reads with the signed-in user's Supabase client (RLS applies).
// Sales come from paid invoices (cashier and POS both settle through invoices); online shop orders are added
// for shops. Client: public/js/partner/reports.js.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
const ORDER_DONE = ['delivered', 'completed'];
const addDays = (key, n) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5) + 1;
// Bangkok calendar day of a timestamp
const bkkDay = ts => new Date(new Date(ts).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const startOf = key => `${key}T00:00:00+07:00`;
const endOf = key => `${key}T23:59:59.999+07:00`;
const num = v => Number(v) || 0;

async function salesBetween(sb, storeId, from, to, withDetail) {
  const cols = withDetail ? 'id, total, payment_method, line_items, created_at' : 'total';
  const { data, error } = await sb.from('invoices').select(cols).eq('store_id', storeId).eq('status', 'paid')
    .gte('created_at', startOf(from)).lte('created_at', endOf(to)).limit(20000);
  if (error) throw error;
  return data || [];
}

async function ordersBetween(sb, storeId, from, to) {
  const { data, error } = await sb.from('commerce_orders').select('total_amount, created_at, status').eq('store_id', storeId)
    .in('status', ORDER_DONE).gte('created_at', startOf(from)).lte('created_at', endOf(to)).limit(20000);
  if (error) return []; // stores without online orders
  return data || [];
}

// GET /api/reports/summary?store_id&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', requireRole('owner', 'accountant'), async (req, res) => {
  const { store_id: storeId, from, to } = req.query;
  if (!DAY.test(from || '') || !DAY.test(to || '') || from > to) return res.status(400).json({ success: false, error: 'invalid range' });
  const days = daysBetween(from, to);
  if (days > MAX_DAYS) return res.status(400).json({ success: false, error: 'range too long' });
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const sb = req.supabase;

  try {
    const { data: store } = await sb.from('stores').select('category').eq('id', storeId).maybeSingle();
    const isShop = store?.category === 'shop';
    const [sales, prevSales, orders, prevOrders, visitsRes, apptRes] = await Promise.all([
      salesBetween(sb, storeId, from, to, true),
      salesBetween(sb, storeId, prevFrom, prevTo, false),
      isShop ? ordersBetween(sb, storeId, from, to) : [],
      isShop ? ordersBetween(sb, storeId, prevFrom, prevTo) : [],
      sb.from('queue_entries').select('status, service_type, pet_id, customer_id, created_at, called_at, completed_at')
        .eq('store_id', storeId).gte('queue_date', from).lte('queue_date', to).limit(20000),
      sb.from('appointments').select('status, user_id').eq('store_id', storeId).gte('appt_date', from).lte('appt_date', to).limit(20000),
    ]);
    if (visitsRes.error) throw visitsRes.error;

    // Sales by day, by payment method, top items
    const byDay = Object.fromEntries(Array.from({ length: days }, (_, i) => [addDays(from, i), 0]));
    const byMethod = {};
    const items = {};
    let payments = [];
    if (sales.length) {
      const ids = sales.map(s => s.id);
      for (let i = 0; i < ids.length && i < 6000; i += 300) {
        const { data } = await sb.from('invoice_payments').select('invoice_id, method, amount').in('invoice_id', ids.slice(i, i + 300));
        payments = payments.concat(data || []);
      }
    }
    const paidBy = payments.reduce((m, p) => { (m[p.invoice_id] ||= []).push(p); return m; }, {});
    for (const s of sales) {
      const day = bkkDay(s.created_at);
      if (day in byDay) byDay[day] += num(s.total);
      const split = paidBy[s.id];
      if (split?.length) for (const p of split) byMethod[p.method || 'other'] = (byMethod[p.method || 'other'] || 0) + num(p.amount);
      else byMethod[s.payment_method || 'other'] = (byMethod[s.payment_method || 'other'] || 0) + num(s.total);
      for (const li of Array.isArray(s.line_items) ? s.line_items : []) {
        const name = String(li?.name || '').trim().slice(0, 80);
        if (!name) continue;
        const it = (items[name] ||= { name, qty: 0, amount: 0 });
        it.qty += num(li.qty) || 1;
        it.amount += num(li.total) || num(li.qty || 1) * num(li.unit_price);
      }
    }
    for (const o of orders) {
      const day = bkkDay(o.created_at);
      if (day in byDay) byDay[day] += num(o.total_amount);
      byMethod.online = (byMethod.online || 0) + num(o.total_amount);
    }
    const revenue = Object.values(byDay).reduce((a, b) => a + b, 0);
    const prevRevenue = prevSales.reduce((a, s) => a + num(s.total), 0) + prevOrders.reduce((a, o) => a + num(o.total_amount), 0);
    const bills = sales.length + orders.length;

    // Visits (queue), services, waiting time
    const visits = (visitsRes.data || []).filter(v => !['cancelled'].includes(v.status));
    const services = {};
    let waitSum = 0, waitN = 0;
    for (const v of visits) {
      const k = (v.service_type || 'อื่นๆ').trim();
      services[k] = (services[k] || 0) + 1;
      if (v.called_at && v.created_at) {
        const m = (new Date(v.called_at) - new Date(v.created_at)) / 60000;
        if (m >= 0 && m < 600) { waitSum += m; waitN += 1; }
      }
    }

    // New vs returning pets: seen here before this range?
    const petIds = [...new Set(visits.map(v => v.pet_id).filter(Boolean))];
    let returning = 0;
    if (petIds.length) {
      const seen = new Set();
      for (let i = 0; i < petIds.length; i += 300) {
        const { data } = await sb.from('queue_entries').select('pet_id').eq('store_id', storeId).lt('queue_date', from).in('pet_id', petIds.slice(i, i + 300)).limit(20000);
        for (const r of data || []) seen.add(r.pet_id);
      }
      returning = seen.size;
    }

    const appts = apptRes.data || [];
    const apptCount = s => appts.filter(a => s.includes(a.status)).length;

    res.set('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      data: {
        range: { from, to, days, prev_from: prevFrom, prev_to: prevTo },
        sales: {
          revenue, prev_revenue: prevRevenue, bills, avg_bill: bills ? Math.round(revenue / bills) : 0,
          avg_per_day: Math.round(revenue / days),
          by_day: Object.entries(byDay).map(([date, total]) => ({ date, total })),
          by_method: byMethod,
          top_items: Object.values(items).sort((a, b) => b.amount - a.amount).slice(0, 8),
          online_orders: orders.length,
        },
        visits: {
          total: visits.length,
          completed: visits.filter(v => v.status === 'completed').length,
          no_show: visits.filter(v => v.status === 'no_show').length,
          avg_wait_min: waitN ? Math.round(waitSum / waitN) : null,
          services: Object.entries(services).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        },
        customers: { pets: petIds.length, returning, new: petIds.length - returning },
        appointments: {
          total: appts.length,
          from_app: appts.filter(a => a.user_id).length,
          done: apptCount(['completed', 'checked_in', 'confirmed']),
          cancelled: apptCount(['cancelled', 'rejected']),
          no_show: apptCount(['no_show']),
        },
      },
    });
  } catch (error) {
    console.error('[reports] summary failed:', error?.message);
    res.status(500).json({ success: false, error: 'Unable to load report' });
  }
});

export default router;
