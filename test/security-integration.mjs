import assert from 'node:assert/strict';

const base = process.env.PARTNER_BASE_URL || 'http://127.0.0.1:3000';
const password = 'Fufu2026!';
const clinicA = '10000000-0000-4000-8000-000000000001';
const clinicB = '10000000-0000-4000-8000-000000000002';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function login(email) {
  const result = await request('/api/auth/login', {
    method: 'POST', body: { email, password },
  });
  assert.equal(result.status, 200, `${email} login failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload.success, true);
  return result.payload;
}

const unauthenticated = await request(`/api/appointments?store_id=${clinicA}&bucket=requested`);
assert.equal(unauthenticated.status, 401);

const [owner, vet, reception] = await Promise.all([
  login('review@fufu.local'),
  login('vet@fufu.local'),
  login('reception@fufu.local'),
]);

const validInbox = await request(`/api/appointments?store_id=${clinicA}&bucket=requested`, { token: owner.token });
assert.equal(validInbox.status, 200);

const wrongStore = await request(`/api/appointments?store_id=${clinicB}&bucket=requested`, { token: owner.token });
assert.equal(wrongStore.status, 403);

const vetStoreMutation = await request(`/api/stores/${clinicA}`, {
  token: vet.token, method: 'PATCH', body: { phone: '020000099' },
});
assert.equal(vetStoreMutation.status, 403);

const receptionMedicalWrite = await request('/api/medical-records', {
  token: reception.token, method: 'POST', body: { store_id: clinicA, pet_name: 'Denied' },
});
assert.equal(receptionMedicalWrite.status, 403);

const tamperedId = await request('/api/appointments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/transition', {
  token: owner.token, method: 'PATCH', body: { status: 'cancelled', idempotency_key: 'tampered-test' },
});
assert.equal(tamperedId.status, 403);

const refreshed = await request('/api/auth/refresh', {
  method: 'POST', body: { refresh_token: owner.refresh_token },
});
assert.equal(refreshed.status, 200);
assert.equal(refreshed.payload.success, true);
assert.ok(refreshed.payload.token);

console.log('Security integration passed: unauthenticated, wrong-store, wrong-role, tampered ID, refresh');
