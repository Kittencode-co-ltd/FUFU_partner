import assert from 'node:assert/strict';

const base = process.env.PARTNER_BASE_URL || 'http://127.0.0.1:3000';
const storeId = '10000000-0000-4000-8000-000000000001';
const serviceId = '92000000-0000-4000-8000-000000000001';
const date = offsetDate(1);
const holiday = offsetDate(2);

async function api(path, { token, method='GET', body, headers={} }={}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...headers, ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) });
  return { status:response.status, headers:response.headers, data:response.status===304 ? null : await response.json() };
}
const login = await api('/api/auth/login',{method:'POST',body:{email:'review@fufu.local',password:'Fufu2026!'}});
assert.equal(login.status,200);
const token=login.data.token;

const profile=await api(`/api/public/clinics/${storeId}`);
assert.equal(profile.status,200);
assert.equal(profile.data.data.name,'[TEST] FUFU Clinic Bangkok');
assert.equal(profile.data.data.services.length,1);
assert.equal(profile.data.data.business_hours.length,7);
assert.ok(profile.headers.get('etag'));
const notModified=await api(`/api/public/clinics/${storeId}`,{headers:{'If-None-Match':profile.headers.get('etag')}});
assert.equal(notModified.status,304);

const slots=await api(`/api/public/clinics/${storeId}/available-slots?date=${date}&service_id=${serviceId}`);
assert.equal(slots.status,200);
assert.equal(slots.data.data[0].time,'09:00');
assert.equal(slots.data.data[0].remaining_capacity,1);
assert.match(slots.data.data[0].starts_at,/Z$/);

const closed=await api(`/api/public/clinics/${storeId}/available-slots?date=${holiday}&service_id=${serviceId}`);
assert.equal(closed.status,200);
assert.deepEqual(closed.data.data,[]);

const invalid=await api(`/api/clinic/${storeId}`,{token,method:'PATCH',body:{timezone:'Not/AZone'}});
assert.equal(invalid.status,400);
const off=await api(`/api/clinic/${storeId}`,{token,method:'PATCH',body:{accepting_appointments:false}});
assert.equal(off.status,200);
const unavailable=await api(`/api/public/clinics/${storeId}/available-slots?date=${date}&service_id=${serviceId}`);
assert.deepEqual(unavailable.data.data,[]);
const on=await api(`/api/clinic/${storeId}`,{token,method:'PATCH',body:{accepting_appointments:true}});
assert.equal(on.status,200);

console.log('P2 integration passed: public profile, ETag, hours, holiday, capacity, timezone, accepting toggle');

function offsetDate(days) { const value=new Date(); value.setUTCDate(value.getUTCDate()+days); return value.toISOString().slice(0,10); }
