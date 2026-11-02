# Phase P0 Baseline Report

วันที่ตรวจ: 2026-09-21

## Scope and UI

- Partner ใช้ Express + Supabase + Vanilla ES modules
- production-safe default เปิด `PARTNER_MVP_MODE`
- MVP navigation มี 7 หน้าหลักและปุ่มออกจากระบบ
- navigation guard ตรวจ allowlist ก่อน `_renderPage` จึงไม่ import POS, inventory,
  finance, hotel, grooming, IPD, documents หรือ kanban ใน MVP path
- source ของ legacy modules ยังอยู่ครบและเปิดใน development ได้ด้วย runtime flag
- Overview อ่านข้อมูลจริงจาก `/api/appointments/inbox`; ไม่ใช้ revenue หรือ demo fallback

## Routes

`server/index.js` mount route groups สำหรับ auth, appointments, stores, staff, pets,
queue, medical, finance, inventory, POS, hotel, grooming, IPD, documents, tasks,
audit, roles, service items, expenses, SOAP templates และ rewards

ทุก route module ที่ตรวจมี `router.use(requireAuth)` หรือ endpoint-level auth ยกเว้น auth
login/register/refresh/logout ซึ่งเป็น session lifecycle โดยธรรมชาติ การตรวจ role/store access
เชิงลึกเป็นขอบเขต P1 และยังต้องเพิ่ม integration tests แบบ authenticated database จริง

## Database baseline

Forward migrations ปัจจุบันประกาศตารางหลัก: `profiles`, `stores`, `staff`, `roles`,
`pets`, `health_records`, `vaccinations`, `appointments`, `scan_results`,
`account_deletion_requests`, `appointment_status_audit` และ `screening_feedback`

ช่องว่างจาก target model ที่ต้องตรวจ/เพิ่มใน P2–P4 ได้แก่ business hours, holidays,
store services, canonical `store_staff`, appointment consent, visit summaries,
notifications และ canonical append-only audit log โดยต้องตรวจ schema จริงก่อน migration ทุกครั้ง

## Mock and fallback baseline

- ไม่พบ token `mock`, `demo`, `sample`, `fake` หรือ `Coming Soon` ใน `public/js/partner`
  และ `server/routes` จากการค้นหาแบบ case-insensitive
- legacy UI ยังอยู่นอก MVP path และยังไม่ถือว่าพร้อม production
- MVP Overview แสดง error/retry เมื่อ API ล้มเหลว แทนการแทนค่าด้วยข้อมูลจำลอง

## Security gaps carried into P1

- ต้องทดสอบ wrong-store, wrong-role และ tampered ID กับ Supabase test project
- ต้องจำกัด CORS และเพิ่ม security headers/rate limiting
- ต้องยืนยัน refresh/expired-session behavior แบบ end-to-end
- ต้อง audit ทุก service-role usage และเพิ่ม secret scan CI
- frontend visibility ไม่ใช่ authorization; API และ RLS ต้องเป็นผู้บังคับสิทธิ์

## Test baseline

- baseline ก่อนแก้: `npm test` ผ่าน 10 tests
- หลังเพิ่ม P0 regression: `npm test` ผ่าน 14 tests
- tests เดิมเป็น static/security foundation เป็นหลัก ยังไม่มี browser smoke test
- `npm run build:css` และ syntax checks ต้องผ่านก่อนปิด Phase P0
