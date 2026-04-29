# ADR-001: Architecture สำหรับ FUFU Customer Demo (30 เม.ย. 2026)

**Status:** Proposed
**Date:** 28 เม.ย. 2026
**Decider:** Supawit (solo)

## Context

- Demo กับลูกค้าจริงในวันที่ 30 เม.ย. 2026 (T-2 days จากวัน proposal)
- ทีม 1 คน, งบ Free Tier เท่านั้น
- ต้องรองรับ 3–5 partner ใน demo
- สถานะปัจจุบัน:
  - Mobile (Flutter) คุย Supabase ตรง
  - Partner web (Node/Express + Supabase + Tailwind + vanilla HTML) มี 16 routes ตามฟีเจอร์
  - Multi-role: vet / shop / grooming / hotel

## Decision

**ไม่เปลี่ยน architecture ใด ๆ ก่อน demo** — ใช้สถาปัตยกรรมที่มีอยู่ตามเดิม
ใช้ 2 วันที่เหลือไปกับ "happy path hardening" และ "demo data prep" เท่านั้น

## Options Considered

### Option A: คงสถาปัตยกรรมปัจจุบัน + hardening (เลือก)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — ไม่มีของใหม่ |
| Cost | $0 (Free Tier) |
| Time to demo | พอดี 2 วัน |
| Risk to demo | ต่ำ |

**Pros:**
- ไม่เสี่ยงพัง
- ใช้เวลากับสิ่งที่มีผลตรง demo
- เก็บงาน refactor ไปทำหลัง demo เมื่อมีข้อมูลจริงจากลูกค้า

**Cons:**
- ค้าง tech debt ที่ต้องตามแก้ (RLS, payment, realtime จริง, multi-tenant isolation)

### Option B: ย้าย Express → Supabase Edge Functions

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Free Tier OK |
| Time to demo | เกิน 2 วัน |
| Risk to demo | สูง |

**Pros:** ลด infra, ใช้ Supabase deploy ตรง
**Cons:** ต้อง rewrite 16 routes, ทดสอบใหม่หมด, เสี่ยงพังก่อน demo

### Option C: เพิ่ม Realtime + Push notification ก่อน demo

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Free Tier OK (Supabase Realtime ฟรีในขั้นต้น) |
| Time to demo | เกิน 2 วัน |
| Risk to demo | กลาง–สูง |

**Pros:** Wow factor ตอน demo
**Cons:** จุดพังเยอะกว่าจุดได้ — polling ทุก 5 วินาทีก็ดูเหมือน realtime พอสำหรับ demo

### Option D: แยก service ตาม role (microservices)

ตัดออกทันที — over-engineering สำหรับ 5 partner

## Trade-off Analysis

หัวใจคือ: **ในห้อง demo อะไรเสียหายมากกว่ากัน — feature น้อย หรือ ระบบพัง?**

ลูกค้าที่เห็น "ระบบใช้งานได้จริง 1 รอบจบ" เชื่อใจมากกว่าลูกค้าที่เห็น "ระบบมี realtime + push แต่หน้าจอค้างกลาง flow"

ดังนั้นเลือก Option A — คงของเดิม + ทำให้ของเดิมไม่พัง

## Consequences

**ง่ายขึ้น:**
- ไม่มีของใหม่ที่ต้อง debug
- ส่งมอบ demo ตามวันได้แน่
- เก็บฟีเจอร์ที่ตัดออกเป็นข้อขายต่อในการคุย ("เฟสถัดไปเรามี realtime, payment integration ฯลฯ")

**ยากขึ้น (ตามแก้หลัง demo):**
- Realtime จริงผ่าน Supabase Realtime
- Payment gateway จริง (mock ใน demo ก่อน)
- Multi-tenant isolation + RLS policies เต็มรูป
- Notification (push/email/SMS)
- README / docs ต้องเพิ่ม "post-demo roadmap"

## Action Items

### Day 1 — 29 เม.ย.
1. [ ] สร้าง `scripts/seed-demo.js` + seed 5 partner ครอบ 4 type
2. [ ] Manual test happy path ทุก role + จดบั๊ก
3. [ ] เพิ่ม toast/error UI ขั้นต่ำ
4. [ ] สร้าง `.env.demo` แยกจาก dev

### Day 2 — 30 เม.ย. (ก่อน demo)
5. [ ] Deploy Partner web ไป Render free tier
6. [ ] Build Mobile APK release ติดเครื่อง
7. [ ] เตรียม screenshot backup ทุก flow
8. [ ] ซ้อม end-to-end อย่างน้อย 2 รอบ

### หลัง demo (เปิด ADR ใหม่ทีละเรื่อง)
- ADR-002: Mobile ↔ Server boundary (เรียก Supabase ตรง vs ผ่าน Express)
- ADR-003: Realtime strategy (Supabase Realtime vs polling vs WebSocket)
- ADR-004: Payment + commission flow
- ADR-005: Multi-role auth & RLS policies
- ADR-006: Notification channels

## Demo-day fallback rule

> ถ้า live demo มีปัญหา **อย่าเปลี่ยนไป fix สด**
> เปลี่ยนไปเล่า walkthrough จาก screenshot แทน
