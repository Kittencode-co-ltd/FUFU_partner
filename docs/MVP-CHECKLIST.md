# Partner MVP checklist

- [x] สร้าง branch `mvp/phase-0-baseline`
- [x] เปิด MVP feature flag และจำกัด sidebar เหลือ appointments/settings
- [x] รักษา source ของโมดูลนอก scope ไว้
- [x] `.env.example` ไม่มี credential จริง
- [x] `npm run build:css` ผ่าน
- [ ] เพิ่ม lint/test scripts สำหรับ server และ browser modules
- [ ] appointment state machine และ audit log ผ่าน integration tests
- [ ] cross-clinic authorization tests ผ่านบน staging

## Phase 1

- [x] Canonical ordered migrations และ staging seed
- [x] Owner/clinic RLS และเขียน pgTAP security suite
- [x] Storage inventory/policies
- [x] Environment templates แยก development/staging/production
- [x] Appointment API ใช้ user-scoped Supabase client
- [x] Request ID, rate limit, validation และ sanitized logging
- [x] Account deletion request Edge Function scaffold
- [ ] Apply/verify บน Supabase staging (รอ project access)
