import assert from 'node:assert/strict';
const base=process.env.PARTNER_BASE_URL||'http://127.0.0.1:3001',store='10000000-0000-4000-8000-000000000001',service='92000000-0000-4000-8000-000000000001',pet='93000000-0000-4000-8000-000000000001',seed='94000000-0000-4000-8000-000000000001';
async function api(path,{token,method='GET',body,headers={}}={}){const r=await fetch(base+path,{method,headers:{...headers,...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{ })},...(body?{body:JSON.stringify(body)}:{ })});return{status:r.status,data:await r.json()};}
async function login(email){const r=await api('/api/auth/login',{method:'POST',body:{email,password:'Fufu2026!'}});assert.equal(r.status,200);return r.data.token;}
const owner=await login('review@fufu.local'),vet=await login('vet@fufu.local'),reception=await login('reception@fufu.local');
const tomorrow=new Date();tomorrow.setUTCDate(tomorrow.getUTCDate()+1);tomorrow.setUTCHours(3,0,0,0);const starts=tomorrow.toISOString();
const payload={store_id:store,service_id:service,pet_id:pet,pet_name:'Mochi',starts_at:starts};
const first=await api('/api/appointments',{token:owner,method:'POST',headers:{'Idempotency-Key':'p3-create-a'},body:payload});assert.equal(first.status,201);
const replay=await api('/api/appointments',{token:owner,method:'POST',headers:{'Idempotency-Key':'p3-create-a'},body:payload});assert.equal(replay.status,201);assert.equal(replay.data.data.id,first.data.data.id);
const concurrent=await Promise.all(['p3-create-b','p3-create-c'].map(k=>api('/api/appointments',{token:owner,method:'POST',headers:{'Idempotency-Key':k},body:payload})));
assert.deepEqual(concurrent.map(x=>x.status).sort(),[201,409]);
const confirm=await api(`/api/appointments/${first.data.data.id}/transition`,{token:reception,method:'PATCH',headers:{'Idempotency-Key':'p3-confirm'},body:{status:'confirmed'}});assert.equal(confirm.status,200);
const confirmReplay=await api(`/api/appointments/${first.data.data.id}/transition`,{token:reception,method:'PATCH',headers:{'Idempotency-Key':'p3-confirm'},body:{status:'confirmed'}});assert.equal(confirmReplay.status,200);
const invalid=await api(`/api/appointments/${first.data.data.id}/transition`,{token:vet,method:'PATCH',headers:{'Idempotency-Key':'p3-invalid'},body:{status:'completed'}});assert.equal(invalid.status,409);
const context=await api(`/api/visits/${seed}/context`,{token:vet});assert.equal(context.status,200);assert.equal(context.data.data.pet.name,'Mochi');assert.match(context.data.data.notice,/คัดกรองเบื้องต้น/);
const draft=await api(`/api/visits/${seed}/summary`,{token:vet,method:'PUT',body:{findings:'สุขภาพทั่วไปปกติ',care_instructions:'พักผ่อนและดื่มน้ำ'}});assert.equal(draft.status,200);
const blocked=await api(`/api/visits/summaries/${draft.data.data.id}/finalize`,{token:reception,method:'POST',headers:{'Idempotency-Key':'p4-final'},body:{}});assert.equal(blocked.status,403);
const final=await api(`/api/visits/summaries/${draft.data.data.id}/finalize`,{token:vet,method:'POST',headers:{'Idempotency-Key':'p4-final'},body:{vaccinations:[{name:'Rabies Test'}]}});assert.equal(final.status,200);assert.equal(final.data.data.status,'finalized');
const finalReplay=await api(`/api/visits/summaries/${draft.data.data.id}/finalize`,{token:vet,method:'POST',headers:{'Idempotency-Key':'p4-final'},body:{vaccinations:[{name:'Rabies Test'}]}});assert.equal(finalReplay.status,200);
console.log('P3/P4 integration passed: capacity, idempotency, transitions, consent, vet finalize and sync');
