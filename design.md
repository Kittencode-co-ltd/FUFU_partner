# FUFU Design System

คู่มือการออกแบบของ **FUFU Pet Care (แอปลูกค้า)** และ **FUFU Partner Portal (ระบบร้าน/คลินิก)**
อ่านไฟล์นี้ก่อนเริ่มทำหน้าใหม่หรือแก้ UI เพื่อให้ทุกคนออกแบบไปทางเดียวกัน

- ไฟล์นี้มีสำเนาเหมือนกันทั้งใน `FUFU_partner/design.md` และ `FUFU-WEB-APP/design.md` แก้ที่หนึ่งต้องแก้อีกที่ด้วย
- ค่าทุกค่าในไฟล์นี้คัดมาจากโค้ดจริง ณ วันที่ 15 พ.ย. 2026 ถ้าโค้ดกับเอกสารไม่ตรงกัน ให้ถือโค้ดเป็นหลัก แล้วแก้เอกสารตาม

---

## สารบัญ

1. [หลักการออกแบบ](#1-หลักการออกแบบ)
2. [ติดตั้งและรันเครื่องตัวเอง](#2-ติดตั้งและรันเครื่องตัวเอง)
3. [ไฟล์ที่เกี่ยวกับดีไซน์อยู่ที่ไหน](#3-ไฟล์ที่เกี่ยวกับดีไซน์อยู่ที่ไหน)
4. [สี](#4-สี)
5. [ตัวอักษร](#5-ตัวอักษร)
6. [ขนาดจอและ Layout](#6-ขนาดจอและ-layout)
7. [ระยะ ขอบมน เงา](#7-ระยะ-ขอบมน-เงา)
8. [Motion](#8-motion)
9. [Components — App](#9-components--app)
10. [Components — Portal](#10-components--portal)
11. [ธีมมืด](#11-ธีมมืด)
12. [ภาษา](#12-ภาษา)
13. [ไอคอนและโลโก้](#13-ไอคอนและโลโก้)
14. [การเข้าถึง (Accessibility)](#14-การเข้าถึง-accessibility)
15. [Checklist ก่อนส่งงาน UI](#15-checklist-ก่อนส่งงาน-ui)
16. [ข้อห้าม](#16-ข้อห้าม)
17. [เรื่องที่ยังต้องตัดสินใจ](#17-เรื่องที่ยังต้องตัดสินใจ)
18. [การแจ้งเตือนแบบ Push (Web Push)](#18-การแจ้งเตือนแบบ-push-web-push)

---

## 1. หลักการออกแบบ

1. **มินิมอลก่อน** — หนึ่งหน้า หนึ่งงานหลัก
   - ไม่ใส่กรอบซ้อนกรอบ หรือเงาหนาๆ
   - ไม่ใส่ไอคอนในกล่องสีทุกจุด
   - ไม่ใช้ gradient ถ้าไม่จำเป็น
2. **ไม่ดู "AI ทำ"**
   - หลีกเลี่ยงการ์ดสีพาสเทลเรียงกันหลายใบ, emoji ในหัวข้อ, ป้าย "✨ AI" ทุกจุด
   - หลีกเลี่ยงข้อความยาวอธิบายสิ่งที่เห็นอยู่แล้ว
3. **ใช้งานตามลำดับงานจริง**
   - Portal เรียงเมนูตามขั้นตอน นัด/เคส → คิว → ตรวจ → ชำระเงิน
   - ไม่ให้ผู้ใช้ต้องกระโดดไปมาระหว่างหน้า
4. **มือถือและ iPad มาก่อน**
   - ลูกค้าใช้มือถือ ร้านใช้ iPad เป็นเครื่อง POS เจ้าของร้านติดตามงานผ่านมือถือ
   - PC ต้องใช้ได้ดี แต่ไม่ใช่จอหลัก
5. **ทางเข้าเดียวต่อหนึ่งงาน**
   - ห้ามมีสองปุ่มที่ทำงานเดียวกันบนจอเดียว
   - ตัวอย่าง: Portal บนจอเล็กกว่า 1024px เปิดเมนูได้จากปุ่ม "เมนู" ที่แถบล่างเท่านั้น ไม่มีปุ่ม ☰ ซ้ำด้านบน
6. **ต้องรองรับทุกธีมและทุกขนาดตัวอักษร** — ทุกหน้าต้องอ่านได้ทั้งธีมสว่างและมืด และกับขนาดตัวอักษรทุกระดับ (sm/md/lg/xl)
7. **App กับ Portal เป็นครอบครัวเดียวกัน**
   - ใช้พื้นหลัง เส้น ตัวอักษร ธีมมืด และแถบเมนูลอยรูปแคปซูลชุดเดียวกัน
   - สีหลักต่างกันเล็กน้อย ดู [ข้อ 4](#4-สี) และ [ข้อ 17](#17-เรื่องที่ยังต้องตัดสินใจ)

---

## 2. ติดตั้งและรันเครื่องตัวเอง

### ต้องมี

- Node.js 20 ขึ้นไป และ npm
- สิทธิ์เข้าโปรเจกต์ Supabase ขอค่าต่างๆ จากหัวหน้าทีม **ห้ามส่งคีย์ทางแชทสาธารณะ และห้าม commit ไฟล์ `.env*` ที่มีค่าจริง**

### Portal — `FUFU_partner` (port 3000)

ติดตั้ง:

```bash
cd FUFU_partner
npm install
```

สร้างไฟล์ `.env` จาก `.env.example` แล้วกรอกค่าให้ครบ:

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `PORT` | port ของ Express (ค่าเริ่มต้น `3000`) |
| `Project_URL` | URL ของโปรเจกต์ Supabase |
| `publishable_key` | Supabase anon key |
| `service_role_key` | Supabase service-role key ใช้เฉพาะฝั่ง server ห้ามหลุดไปฝั่ง browser ชื่อตัวแปรเป็นตัวเล็ก ต้องพิมพ์ให้ตรงทุกตัวอักษร |
| `CORS_ORIGINS`, `NEXT_PUBLIC_WEBAPP_URL`, `ERROR_MONITOR_URL`, `NODE_ENV` | ดูรายละเอียดใน `.env.example` |

รันระบบ (Express + Next.js อยู่ใน process เดียวกัน):

```bash
npm run dev
```

ถ้าแก้ไฟล์ `src/css/input.css` ให้เปิดอีก terminal แล้วรันคำสั่งนี้ค้างไว้:

```bash
npm run watch:css
```

ก่อนส่งงาน:

```bash
npm run lint
```

```bash
npm test
```

> **สำคัญ:** หน้า dashboard โหลด CSS จากไฟล์ที่ build แล้ว (`public/css/main.css`) ถ้าแก้ `input.css` แล้วไม่ได้รัน `watch:css` หรือ `npm run build:css` หน้าเว็บจะไม่เปลี่ยน

### App — `FUFU-WEB-APP` (port 3100)

ติดตั้ง:

```bash
cd FUFU-WEB-APP
npm install
```

สร้างไฟล์ `.env.local` แล้วกรอกค่าเหล่านี้:

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของโปรเจกต์ Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | URL ของแอปเอง |
| `GEMINI_API_KEY` | ใช้กับแชทสัตวแพทย์ AI (เก็บไว้ฝั่ง server เท่านั้น) |
| `AI_PREDICT_API_URL`, `YOLO_API_URL` | บริการวิเคราะห์ภาพสแกน |

รันแอป:

```bash
npm run dev -- -p 3100
```

ก่อนส่งงาน:

```bash
npm run lint
```

> **CSS ไม่อัปเดต:** dev server ของ Next 16 (Turbopack) บางครั้งเสิร์ฟ CSS เก่า ให้หยุด server ก่อน แล้วลบ `.next` แล้วรันใหม่ (ลบตอน server ยังทำงานอยู่ไม่ได้)
>
> ```bash
> rm -rf .next
> ```

> **Google login ใน localhost:** จะเด้งไปหน้า production ถ้า Supabase ยังไม่ได้เพิ่ม `http://localhost:3100/api/auth/callback` ใน Redirect URLs

### ตรวจหน้าจอโดยไม่ต้องล็อกอิน (Portal)

ใน `FUFU_partner/public/` มีไฟล์ทดสอบ `__demo-dashboard.html` และ `__demo-api.js` ที่ใช้ข้อมูลตัวอย่าง:

```
http://localhost:3000/__demo-dashboard.html?page=pos&cat=shop
```

- `page` เปลี่ยนหน้าได้ เช่น `home`, `queue`, `cashier`, `pos`, `income`
- `cat` เปลี่ยนประเภทร้านได้: `vet` (ค่าเริ่มต้น), `shop`, `hotel`, `grooming`

> ไฟล์ `__demo-*` ใช้ทดสอบในเครื่องเท่านั้น **ห้าม commit และห้าม deploy**

---

## 3. ไฟล์ที่เกี่ยวกับดีไซน์อยู่ที่ไหน

### App (`FUFU-WEB-APP`) — Next.js 16, React 19, Tailwind 4, TypeScript

| ไฟล์ | หน้าที่ |
|---|---|
| `src/app/globals.css` | **ไฟล์หลักของดีไซน์** ประกอบด้วย token สี ธีมมืด และ component ทุกตัว (`.fufu-*`) |
| `src/app/layout.tsx` | ฟอนต์ (Geist + Noto Sans Thai), `.app-shell`, viewport, boot script |
| `src/lib/boot-scripts.ts` | ตั้งธีมและขนาดตัวอักษรก่อนหน้าแสดงผล กันหน้ากระพริบ |
| `src/lib/font-scale.ts` | hook `useFontScale()` |
| `src/context/ThemeContext.tsx` | ธีม `light` / `dark` / `system` (ค่าเริ่มต้น `light`) |
| `src/context/LanguageContext.tsx` | ภาษา: `t(key)` และ `L({ th, en, zh, ja, ko })` |
| `src/lib/translations*.ts` | คำแปลทั้งหมด |
| `src/components/BottomNav.tsx` | แถบเมนูหลัก (dock) |
| `src/components/ShellFrame.tsx` | กรอบหน้าในกลุ่ม `(shell)` ใส่ dock และเว้นที่ด้านล่างให้ |
| `src/app/(shell)/…` | หน้าที่ต้องมีแถบเมนู ได้แก่ home, health, scan, chat, profile, vet, shop, service |

> **หน้าใหม่ที่ต้องมีแถบเมนู ต้องอยู่ใต้ `src/app/(shell)/`** ถ้าวางไว้นอกกลุ่มนี้ แถบเมนูจะหายไป (เคยเกิดกับหน้า `/service` มาแล้ว)

### Portal (`FUFU_partner`) — Express + Next.js 16 shell + vanilla JS modules, Tailwind 3

| ไฟล์ | หน้าที่ |
|---|---|
| `public/js/utils/design-tokens.js` | **แหล่งเดียวของสีแบรนด์และสีสถานะ** ใช้ทั้งใน Tailwind (`bg-brand`, `text-fg-muted`) และเป็นตัวแปร CSS `--color-*` |
| `src/css/input.css` | token หน้าจอ (`--pt-*`), ธีมมืด, motion, component ทั้งหมด → build เป็น `public/css/main.css` |
| `tailwind.config.js` | ผูก token เข้ากับ Tailwind, ฟอนต์, เงา, ขอบมน |
| `public/js/theme-init.js` | `window.FufuPrefs`: ธีม `light` / `dark` / `auto` และขนาดตัวอักษร โหลดก่อนหน้าแสดงผล |
| `app/dashboard/page.jsx` | โครงหน้า dashboard: sidebar, topbar, bottom nav (React) |
| `public/js/partner/dashboard.js` | เมนู, การเปลี่ยนหน้า, แถบขั้นตอน, bottom nav, สิทธิ์ |
| `public/js/partner/profile-menu.js` | เมนูโปรไฟล์ รวมทุกการตั้งค่าไว้ที่เดียว |
| `public/js/partner/sheet.js` | `openSheet()`: dialog กลางจอ และ bottom sheet บนมือถือ |
| `public/js/partner/portal-i18n.js` | ภาษาของ Portal |
| `public/js/utils/icons.js` | ไอคอน SVG: `icon(name, cls)` |
| `app/globals.css` | หน้า landing (`/`) |
| `public/css/receipt.css` | ใบเสร็จและใบกำกับภาษี (ขาวดำสำหรับพิมพ์) |

---

## 4. สี

### 4.1 พื้นผิวและตัวอักษร (ชุดเดียวกันทั้งสองระบบ)

App ใช้ตัวแปร `--c-*` ส่วน Portal ใช้ `--pt-*` ทั้งสองระบบใช้ค่าเดียวกัน (มีต่างกันเล็กน้อยบางค่า ตามตาราง)

| บทบาท | App | Portal | สว่าง | มืด |
|---|---|---|---|---|
| พื้นหลังหน้า | `--c-bg` | `--pt-bg` | `#F5F9F8` | `#0B1416` |
| พื้นการ์ด | `--c-surface` | `--pt-surface` | `#FFFFFF` | `#132126` |
| พื้นยุบ / แถวรอง | `--c-soft` | `--pt-sunken` | App `#F1F5F9` · Portal `#EEF4F3` | `#18272B` |
| ช่องกรอก | `--c-input` | — | `#EAF2F1` | `#1B2C31` |
| เส้นแบ่ง | `--c-line` | `--pt-line` | App `#E2E8F0` · Portal `#E3EBEA` | `#22353A` |
| เส้นเข้ม | — | `--pt-line-strong` | `#D0DCDA` | `#2E4449` |
| พื้นสีอ่อนของ active | `--c-tint` | `--pt-tint` | `#E3F2EF` | `rgba(94,196,182,.13)` |
| ตัวอักษรหลัก | `--c-text` | `--pt-text` | App `#1E293B` · Portal `#1D3640` | `#E6F1EF` |
| ตัวอักษรรอง | `--c-text-2` | `--pt-text-2` | App `#334155` · Portal `#34515B` | `#C7D6D4` |
| ตัวอักษรจาง | `--c-muted` | `--pt-muted` | App `#64748B` · Portal `#5E7379` | `#93A7A6` |
| ตัวอักษรจางมาก | `--c-subtle` | `--pt-subtle` | App `#94A3B8` · Portal `#8FA2A6` | `#71878A` |

> **กฎ:** ในโค้ดใหม่ ให้ใช้ตัวแปรเหล่านี้เสมอ ห้ามพิมพ์ hex ตรงๆ สำหรับพื้นหลัง ตัวอักษร หรือเส้น ธีมมืดจะได้เปลี่ยนตามอัตโนมัติ

### 4.2 สีหลัก (Accent)

**สีหลักของทั้งสองระบบคือ teal ของโลโก้ `#2A6374`** (ตัดสินใจ 15 พ.ย. 2026)

| บทบาท | App | Portal | สว่าง | มืด |
|---|---|---|---|---|
| สีหลัก: ปุ่ม, ไอคอน, เมนูที่เลือก, focus | `--c-accent` (หรือ class `bg-teal`, `text-teal`) | `--pt-accent`, `--pt-brand` | `#2A6374` | App `#3A8296` · Portal `#5EC4B6` |
| สีหลักแบบ RGB สำหรับใส่ความโปร่ง | `rgba(var(--c-accent-rgb), .1)` | — | `42, 99, 116` | `58, 130, 150` |
| hover ของปุ่มสีหลัก | `--c-accent-hover` | — | `#22535F` | `#2F7083` |
| ตัวอักษรสีหลักบนพื้น tint | `--c-accent-ink` | `--pt-brand-ink` | `#1B414B` | `#7DD3C6` |
| แถบ status bar ของเบราว์เซอร์ | `themeColor` / `manifest.json` = `#2A6374` | `#F5F9F8` | — | `#0B1416` |

- ธีมมืดของ App ใช้ `#3A8296` เพราะสว่างเท่ากับสีเดิม (`#00897B`) ตัวอักษรขาวบนปุ่มจึงยังอ่านได้ และไอคอนบนพื้นมืดยังเห็นชัด
- ธีมมืดของ Portal ใช้ `#5EC4B6` และปุ่มสีหลักใช้ตัวอักษรสีเข้ม `#0B1416`
- **ห้ามพิมพ์ hex สีหลักตรงๆ ในโค้ดใหม่** ให้ใช้ตัวแปรเสมอ ธีมมืดจะได้เปลี่ยนตาม
  - ใช้ตัวแปรใน attribute ของ SVG ได้ เช่น `color="var(--c-accent)"` ของ lucide
  - ยกเว้นค่าที่ไม่ใช่ CSS เช่น `themeColor` ซึ่งต้องเป็น hex
- **Tailwind (App):** class `teal-50`…`teal-950` ถูกตั้งใหม่ให้เป็นเฉดของสีโลโก้แล้ว ใช้ `teal-600` = `#2A6374`, `teal-800` = `#1B414B`, `teal-50` = `#ECF7F5`

### 4.3 สีแบรนด์จากโลโก้ (Portal: `design-tokens.js`, landing page)

| ชื่อ | Hex | ใช้กับ |
|---|---|---|
| brand (teal ของคำว่า "FUFU") | `#2A6374` | ปุ่มหลัก, ลิงก์, sidebar active |
| brand-strong | `#1B414B` | hover, ตัวอักษรบนพื้นอ่อน |
| brand-light | `#3A8296` | |
| brand-muted | `#A7D9D3` | |
| brand-subtle | `#D7EEEB` | badge, พื้นอ่อน |
| brand-faint | `#ECF7F5` | พื้นอ่อนมาก |
| mint | `#80C9C0` | ไฮไลต์, แสงพื้นหลังหน้า auth |
| accent / coral (คำว่า "Pet Care") | `#F0865E` | badge แจ้งเตือนในเมนู, คำว่า Pet Care |
| gold (ขนมาสคอต) | `#F3D6AA` | เหรียญรางวัล, progress bar รางวัล |
| cream | `#FAF7F2` | พื้นหลังหน้า landing และหน้า auth |

### 4.4 สีสถานะ

**Portal** (`design-tokens.js` · class Tailwind เช่น `bg-danger-subtle text-danger-strong`)

| สถานะ | DEFAULT | strong | subtle | faint |
|---|---|---|---|---|
| success | `#2F9E7A` | `#1E6B52` | `#D9F2E8` | `#EFF9F4` |
| warning | `#E3A43B` | `#8A5A12` | `#FBEBCB` | `#FEF7EA` |
| danger | `#E2554B` (hover `#C9433A`) | `#8F2A24` | `#FBDEDB` | `#FDF1F0` |
| info | `#3B82C4` | `#1F4F7E` | `#DCEAF7` | `#F0F6FC` |

ป้ายสถานะในหน้าใหม่ของ Portal (`.ph-tag`):

| class | ใช้เมื่อ | สีที่ได้ |
|---|---|---|
| `.is-ok` | ปกติ | สี tint |
| `.is-warn` | ต้องระวัง | `#FFF4E5` / `#B45309` |
| `.is-bad` | มีปัญหา | `#FDECEC` / `#B91C1C` |

**App** ใช้ระบบ tone: ใส่ attribute `data-tone` แล้ว component ที่อยู่ข้างในจะใช้ `var(--tone)` เอง

| `data-tone` | สี |
|---|---|
| `good` | `var(--c-accent)` (`#2A6374`) |
| `warn` | `#D97706` |
| `bad` | `#DC2626` |
| `none` | `#94A3B8` |

```html
<span data-tone="warn" class="fufu-tag">ควรพาไปหาหมอ</span>
```

### 4.5 กฎการใช้สี

- สีหลักใช้กับ**สิ่งที่กดได้ หรือสถานะที่เลือกอยู่**เท่านั้น ไม่ใช้ตกแต่ง
- พื้นสีอ่อนของสถานะ ให้ใช้ `color-mix(in srgb, <สี> 10–14%, transparent)` จะได้ใช้ได้ทั้งธีมสว่างและมืด
- ตัวเลขเงิน ใช้สีตัวอักษรปกติ ไม่ต้องเป็นสีเขียว ยกเว้นยอดติดลบหรือยอดค้างชำระ ให้ใช้สี danger
- ปุ่มสีหลักในธีมมืด ใช้ตัวอักษรสีเข้ม `#0B1416` แทนสีขาว (ดู `.ph-btn.is-primary`, `.pr-pay`)

---

## 5. ตัวอักษร

### 5.1 ฟอนต์

| | App | Portal |
|---|---|---|
| ตัวไทย | Noto Sans Thai (`next/font`, 400–800) | Noto Sans Thai (Google Fonts, 400–700) |
| ตัวละติน | Geist | DM Sans |
| ฟอนต์แบรนด์ ("FUFU Pet Care") | — | Fredoka 600/700 (`font-brand`) |
| จีน ญี่ปุ่น เกาหลี | ฟอนต์ของระบบ (PingFang SC, Hiragino Sans, Apple SD Gothic Neo) | เหมือน App |

### 5.2 ขนาดตัวอักษรพื้นฐานตามขนาดจอ (ทั้งสองระบบใช้เหมือนกัน)

```css
html { font-size: calc(100% * var(--fs-user, 1)); }                                         /* มือถือ 16px */
@media (min-width: 768px)  { html { font-size: calc(106.25% * var(--fs-user, 1)); } }      /* iPad 17px */
@media (min-width: 1100px) { html { font-size: calc(103.125% * var(--fs-user, 1)); } }     /* PC 16.5px */
```

`--fs-user` คือขนาดตัวอักษรที่ผู้ใช้เลือกเอง:

| ค่าที่บันทึก | ตัวคูณ |
|---|---|
| `sm` | 0.9375 |
| `md` (ค่าเริ่มต้น) | 1 |
| `lg` | 1.125 |
| `xl` | 1.25 |

- ค่านี้เก็บใน localStorage `fufu_font_scale` เป็นค่าของแต่ละเครื่อง และไม่ถูกล้างตอนออกจากระบบ
- ตั้งค่าได้ที่ App: โปรไฟล์ → ขนาดตัวอักษร และ Portal: เมนูโปรไฟล์ → ขนาดตัวอักษร

> **กฎ:** ข้อความทั้งหมดใช้หน่วย `rem` จะได้ขยายตามขนาดที่ผู้ใช้เลือก
> - ใช้ `px` ได้เฉพาะสิ่งที่ต้องคงขนาด เช่น ป้ายใต้ไอคอนใน bottom nav ของ Portal (10–11px)
> - ห้ามตั้ง `font-size` ให้ `html` ด้วย inline style เพราะจะทับระบบนี้

### 5.3 ขนาดที่ใช้บ่อย

| ใช้กับ | ขนาด | น้ำหนัก |
|---|---|---|
| หัวหน้า (Portal `.ph-title`) | 1.375rem | 700, letter-spacing −0.02em |
| หัว dialog (`.sh-title`) | 1.125rem | 700 |
| หัว section / การ์ด | 0.9375–0.9688rem | 700 |
| เนื้อหา | 0.875rem | 400–600 |
| ข้อความรอง / meta | 0.75–0.8125rem | 400–600 |
| ป้าย (tag / chip) | 0.6875–0.7188rem | 600–700 |
| ตัวเลขสถิติ (`.ph-stat dd`) | 1.625rem | 700, `tabular-nums` |

- ตัวเลขเงินและตัวเลขในตาราง ใส่ `font-variant-numeric: tabular-nums` ตัวเลขจะได้เรียงตรงกัน
- ภาษาจีน ญี่ปุ่น เกาหลี ใส่ `word-break: keep-all` ในหัวข้อ

---

## 6. ขนาดจอและ Layout

### 6.1 Breakpoints

| ช่วง | App | Portal |
|---|---|---|
| < 640px (มือถือ) | คอลัมน์เต็มจอ, dock แบบไอคอน | drawer + bottom nav (28rem), sheet ขึ้นจากด้านล่าง |
| 640–767px | คอลัมน์ 720px, dock มีป้ายชื่อ | bottom nav 34rem |
| 768–1023px (iPad แนวตั้ง) | ตัวอักษร 106.25% | ตัวอักษร 106.25%, bottom nav 34rem, ไม่มีปุ่ม ☰ |
| 1024–1099px (iPad แนวนอน) | dock ลอยแนวตั้งด้านซ้าย | sidebar ติดถาวร 256px (ย่อได้ด้วยปุ่ม ☰) |
| ≥ 1100px (PC) | คอลัมน์ 960px, ตัวอักษร 103.125% | ตัวอักษร 103.125% |
| ≥ 1280px | — | กระดานคิวเห็นครบ 5 คอลัมน์, ตะกร้า POS กว้าง 400px |

### 6.2 คอลัมน์เนื้อหาของ App

```css
:root { --app-col: 100%; --app-narrow: 100%; }
@media (min-width: 640px)  { :root { --app-col: 720px; --app-narrow: 600px; } }
@media (min-width: 1100px) { :root { --app-col: 960px; --app-narrow: 640px; } }
```

- ทุกหน้าอยู่ใน `.app-shell` ซึ่งอยู่กลางจอและกว้างไม่เกิน `--app-col`
- หน้าฟอร์มและหน้าอ่าน (บริจาค, ช่วยเหลือ, เพิ่มสัตว์) ใส่ class `.fufu-narrow`
- รายการการ์ดบนจอ iPad/PC ใช้ `.fufu-rows` จะได้ 2 คอลัมน์ ใส่ `.is-wide-3` ถ้าต้องการ 3 คอลัมน์บน PC
- Bottom sheet (`.fufu-sheet`) จะกลายเป็น dialog กลางจอเองเมื่อจอกว้างตั้งแต่ 640px

### 6.3 แถบเมนูหลัก

**App** (`BottomNav.tsx` + `.fufu-dock*`) มี 5 เมนู: หน้าแรก · สุขภาพ · สแกน · แชท · โปรไฟล์

| จอ | รูปแบบ |
|---|---|
| มือถือ | แคปซูลลอยด้านล่าง กว้างไม่เกิน 28rem สูง 66px ห่างขอบล่าง `max(safe-area, 14px)` มีแต่ไอคอน |
| 640–1023px | แคปซูลกว้างไม่เกิน 34rem สูง 74px มีป้ายชื่อใต้ไอคอน (0.6875rem) |
| ≥ 1024px | แคปซูลแนวตั้ง กว้าง 66px ลอยห่างขอบซ้าย 28px และอยู่กึ่งกลางแนวตั้ง ชี้แล้วขึ้นป้ายชื่อ เนื้อหาเว้นที่ให้ทั้งสองข้าง |

- แถบสีของเมนูที่เลือกอยู่ (`.fufu-dock-pill`) เลื่อนตามด้วย spring `cubic-bezier(.34,1.36,.5,1)` 0.5s
- dock ซ่อนเองในหน้า `/scan/camera` และ `/chat/[id]`
- อะไรที่ต้องอยู่เหนือ dock ให้ใช้ `var(--bottom-nav-h)` หรือ class `.above-nav` / `.pb-nav` **ห้ามเดาค่า เช่น `pb-24`**

**Portal** (`#bottom-nav` + `#sidebar`)

| จอ | รูปแบบ |
|---|---|
| < 1024px | sidebar เป็น drawer ซ่อนอยู่ เปิดได้จากปุ่ม "เมนู" ที่แถบล่างเท่านั้น แถบล่างมี 4 หน้าหลักของประเภทร้าน + "เมนู" ถ้าหน้าที่เปิดอยู่ไม่มีในแถบล่าง ปุ่ม "เมนู" จะขึ้นสีแทน |
| ≥ 1024px | sidebar ติดถาวร ไม่มีแถบล่าง ปุ่ม ☰ ใช้ย่อหรือขยาย sidebar |

4 หน้าหลักในแถบล่าง (`BOTTOM_TABS` ใน `dashboard.js`):

| ประเภทร้าน | หน้า |
|---|---|
| คลินิก (vet) | ภาพรวม · คิว · ห้องตรวจ · แคชเชียร์ |
| ร้านค้า (shop) | ภาพรวม · ขาย · ออเดอร์ · คลัง |
| โรงแรม (hotel) / อาบน้ำตัดขน (grooming) | ภาพรวม · นัดหมาย · คิว · แคชเชียร์ |

- ชื่อในแถบล่างต้องสั้น เพิ่มชื่อสั้นของหน้าใหม่ใน `SHORT_LABELS`
- เมนูใน sidebar แบ่งกลุ่มตามขั้นตอนงาน (`.nav-group`)
- ส่วนการตั้งค่า (ข้อมูลร้าน, ผู้ใช้, ตั้งค่า, พนักงาน) อยู่ในเมนูโปรไฟล์ ไม่ได้อยู่ใน sidebar

### 6.4 Safe area

- App ตั้ง `viewportFit: 'cover'` ทุกอย่างที่ชิดขอบจอต้องใช้ `env(safe-area-inset-*)`
- class ที่มีให้: `.safe-top` (เว้นอย่างน้อย 20px) และ `.safe-bottom`
- Portal ใช้ตัวแปร `--safe-bottom`

---

## 7. ระยะ ขอบมน เงา

### ขอบมน

| ใช้กับ | ขนาด |
|---|---|
| ปุ่ม, chip, แถบเมนู, tag, ช่องค้นหา | `999px` (แคปซูล) |
| การ์ดหลัก | 22px (App `.fufu-card`) · 18px (Portal `.ph-section`, `.ph-stats`) · 16px (Portal `.card`) |
| dialog / sheet | 22–24px (มือถือใช้ `24px 24px 0 0`) |
| ช่องกรอก | 14px |
| ไอคอนในกล่อง | 11–15px |

### ระยะห่าง

- ใช้ scale ของ Tailwind (4px)
- ระยะขอบหน้า: มือถือ 12–16px, iPad 20px, PC 24–32px
- ระยะระหว่าง section: 16px
- ปุ่มที่กดด้วยนิ้ว ต้องสูง**อย่างน้อย 40px** (ปุ่มหลัก 48–52px, แถวในลิสต์ 44px)

### เงา

ใช้น้อยที่สุด การ์ดส่วนใหญ่ใช้แค่เส้น 1px สีของ line

| ชื่อ | ค่า | ใช้กับ |
|---|---|---|
| App `--shadow-card` | `0 1px 2px rgba(15,23,42,.04), 0 6px 20px rgba(15,23,42,.06)` | การ์ดสีขาว (ใส่ให้อัตโนมัติ) |
| App `--shadow-raised` | `0 2px 4px …, 0 14px 32px rgba(15,23,42,.10)` | สิ่งที่ลอยอยู่ |
| dock / bottom nav | `0 1px 2px rgba(15,23,42,.04), 0 12px 32px rgba(15,23,42,.12)` | |
| dialog | `0 24px 60px rgba(15,23,42,.18)` | |

ในธีมมืดไม่ใช้เงาบนการ์ด (Portal ตั้งค่า `shadow-*` เป็น `none` ให้แล้ว)

---

## 8. Motion

| token | ค่า | ใช้กับ |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | การเคลื่อนไหวทั่วไป |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | ไอคอนเด้ง, badge |
| `--dur-fast` | 150ms | hover, เปลี่ยนสี |
| `--dur-base` | 240ms | เปิดเมนูหรือ dialog |
| `--dur-slow` | 420ms | เปลี่ยนหน้า, drawer |

- **กดแล้วยุบ:**
  - ปุ่มทั่วไป `scale(.97)`
  - ปุ่มไอคอน `scale(.9–.92)`
  - App ใส่ให้ทุกปุ่มใน `.app-shell` แล้ว
- **เปลี่ยนหน้า:**
  - App: เปลี่ยนแค่ opacity (`.fufu-page` 280ms) **ห้ามใช้ transform** เพราะจะทำให้ element `position: fixed` ข้างในเพี้ยน
  - Portal: `.page-enter` (fade-up)
- **ลดการเคลื่อนไหว:** ทั้งสองระบบปิดแอนิเมชันเมื่อเครื่องตั้ง `prefers-reduced-motion: reduce` แอนิเมชันใหม่ต้องรองรับด้วย
- **ห้ามใช้:**
  - แอนิเมชันวนตลอดที่ไม่มีความหมาย
  - parallax
  - ข้อความที่พิมพ์ทีละตัว

---

## 9. Components — App

ทุก class อยู่ใน `src/app/globals.css` ใช้ class ที่มีอยู่ก่อนจะสร้างใหม่

| Component | Class | หมายเหตุ |
|---|---|---|
| การ์ด | `.fufu-card` · `.is-flat` | ภายใน `.fufu-card-title`, `.fufu-card-sub` |
| ปุ่มหลักติดด้านล่าง | `.fufu-cta-dock` > `.fufu-cta.is-ready` | สูง 52px, สีเทาจนกว่าจะพร้อมกด, อยู่เหนือ dock |
| ปุ่มหลักในเนื้อหา | `.fufu-cta.is-flat.is-ready` | สูง 48px ไม่มีเงา |
| ปุ่มรองสีอ่อน | `.fufu-pill-btn` | สูง 34px, พื้นสีหลัก 10% |
| ปุ่มไอคอน / ปุ่มย้อนกลับ | `.fufu-icon-btn` | 42×42 วงกลม **ปุ่มย้อนกลับทุกหน้าต้องใช้ class นี้** |
| ช่องกรอก | `.fufu-input` · `.is-area` | สูง 50px, ขอบ 1.5px, focus มีวงแหวนสีหลัก 14% |
| ป้ายช่องกรอก | `.fufu-label` | |
| สลับสองตัวเลือก | `.fufu-segment` + `.fufu-segment-pill` | |
| ตัวเลือกแบบการ์ด | `.fufu-choice-card`, `.fufu-choice` | |
| ป้ายสถานะ | `.fufu-tag` + `data-tone` | |
| chip / ตัวกรอง | `.fufu-chip`, `.fufu-chips` > `.fufu-chip-btn` | |
| แถวรายการ | `.fufu-pet-row`, `.fufu-thread-row`, `.fufu-place` | |
| กล่องว่าง | `.fufu-empty-box` | |
| กล่องหมายเหตุ | `.fufu-note-box` | พื้น coral 9% |
| Skeleton | `<Skeleton />` (`src/components/Skeleton.tsx`) | |
| Toast | `.fufu-toast` | |
| หัวหน้าแบบโปร่ง | `.fufu-chat-head` | ไม่มีเส้นใต้, พื้นสีหน้าโปร่ง 86% + blur |

ตัวอย่างหัวหน้าย่อยมาตรฐาน (ปุ่มย้อนกลับ + ชื่อหน้า):

```tsx
<header className="flex items-center gap-2 px-3 safe-top">
  <button className="fufu-icon-btn" onClick={() => router.back()} aria-label={t('back')}>
    <ChevronLeft size={22} />
  </button>
  <h1 className="text-[1.0625rem] font-bold" style={{ color: 'var(--c-text)' }}>{L({ th: 'บริการสัตว์เลี้ยง', en: 'Pet services' })}</h1>
</header>
```

---

## 10. Components — Portal

### 10.1 Component ใหม่ (ใช้กับงานใหม่ทั้งหมด)

| Component | Class / API | หมายเหตุ |
|---|---|---|
| หัวหน้า | `.ph-head`, `.ph-title`, `.ph-sub` | |
| ปุ่ม | `.ph-btn` · `.is-primary` | แคปซูล สูง 36px |
| แถวตัวเลขสรุป | `<dl class="ph-stats">` > `.ph-stat` · `.is-alert` · `.is-urgent` | 2 คอลัมน์ ≥1024px เป็น 4 คอลัมน์ คั่นด้วยเส้นบาง ไม่มีกล่อง |
| section + ลิสต์ | `.ph-section`, `.ph-section__head`, `.ph-row`, `.ph-empty`, `.ph-link` | |
| ป้ายสถานะ | `.ph-tag` · `.is-ok` · `.is-warn` · `.is-bad` | |
| ปุ่มไอคอน | `.icon-btn` | 40×40 |
| Dialog / Sheet | `openSheet({ title, subtitle, wide, onClose })` → `{ root, body, foot, close }` | กลางจอ (กว้าง 480px, `wide` = 640px) มือถือขึ้นจากด้านล่าง ปิดได้ด้วย Esc และคืน focus ให้เอง |
| แถบขั้นตอน | `#flow-steps` (`_renderFlowSteps`) | แสดงเฉพาะหน้าที่อยู่ใน `FLOW_STEPS` |
| เมนูโปรไฟล์ | `profile-menu.js` | บัญชี, การตั้งค่าร้าน, ธีม, ขนาดตัวอักษร, ภาษา, ออกจากระบบ |
| แคชเชียร์ | `.cx-*` | |
| POS ขายหน้าร้าน | `.pr-*` (`pos-retail.js`) | ใช้ได้ทุกประเภทร้าน (คลินิก ร้านค้า โรงแรม อาบน้ำตัดขน) รายการมาจากคลังสินค้า, service items, ราคาห้องพัก และเมนู grooming แต่ละประเภทร้านเห็นหมวดของตัวเองก่อน มีปุ่ม "รายการอื่น" สำหรับขายรายการที่ไม่มีในระบบ iPad: สินค้าซ้าย ตะกร้าขวา มือถือ: ตะกร้าเป็นแถบลอย |
| กระดานคิว | `.qk-jump`, `.qk-board`, `.qk-col` | น้อยกว่า 1280px ปัดซ้ายขวาได้ |
| Toast | `showToast(msg, type, ms)` (`utils/toast.js`) | |

### 10.2 Component เดิม (ยังมีอยู่ในหลายหน้า ค่อยๆ เปลี่ยนเป็นแบบใหม่)

- `.btn-primary`, `.btn-outline`, `.btn-danger`, `.btn-ghost` เป็นปุ่มเหลี่ยมมน 12px แบบเก่า ใช้ได้ในฟอร์มเดิม แต่หน้าใหม่ให้ใช้ `.ph-btn`
- `.card`, `.badge-*`, `.input-field`, `.input-label`, `.skeleton`
- modal เดิมที่สร้างด้วย `fixed inset-0 bg-black/40` ใช้งานได้ แต่ของใหม่ให้ใช้ `openSheet()`

### 10.3 Utility

- `formatBaht()`, `formatThaiDate*()`, `escapeHtml()` อยู่ใน `utils/formatters.js`
- `thaiBahtText()` อยู่ใน `utils/thai-baht.js` (จำนวนเงินเป็นตัวอักษรบนใบเสร็จ)
- ใส่ข้อมูลจากผู้ใช้ลงใน HTML string ต้องผ่าน `escapeHtml()` ทุกครั้ง

### 10.4 ใบเสร็จ (`/receipt`, `public/css/receipt.css`)

- มีสองรูปแบบ: กระดาษความร้อน 80mm (`slip`) และ A4 (`a4`) ใช้ตัวอักษรดำบนพื้นขาว
- ชื่อเอกสารใช้ตามประมวลรัษฎากร มาตรา 86/4 (ใบกำกับภาษีเต็มรูป) และ 86/6 (แบบย่อ)
- ครั้งแรกพิมพ์เป็น "ต้นฉบับ" ครั้งถัดไปพิมพ์เป็น "สำเนา" โดยนับจาก `print_count`
- ห้ามใช้สีพื้นหรือภาพพื้นหลังบนกระดาษ

---

## 11. ธีมมืด

- ทั้งสองระบบเปิดธีมมืดด้วย class `dark` บน `<html>`
- ค่าเก็บใน localStorage `fufu_theme`:

| ระบบ | ค่าที่ใช้ได้ | ค่าเริ่มต้น |
|---|---|---|
| App | `light` / `dark` / `system` | `light` |
| Portal | `light` / `dark` / `auto` (ไม่มีค่า = `auto`) | `auto` |

- **Boot script:** ต้องตั้งธีมก่อนหน้าแสดงผล
  - App ใช้ `<Script strategy="beforeInteractive">` ใน `layout.tsx`
  - Portal ใช้ `theme-init.js`
  - **ห้ามย้าย boot script ไปไว้ในไฟล์ `'use client'`** ไม่อย่างนั้นสคริปต์จะไม่ทำงาน
- **Dark bridge:**
  - หน้าเก่ายังใช้ class สีสว่างของ Tailwind (`bg-white`, `text-slate-*`, `border-slate-*`) ทั้งสองระบบจึงมีกฎ CSS แปลง class เหล่านี้เป็นสีของธีมมืด
  - App อยู่ท้าย `globals.css`, Portal อยู่ท้าย `input.css`
  - **งานใหม่ให้ใช้ตัวแปร `--c-*` / `--pt-*` ตรงๆ อย่าพึ่ง bridge**
- **ตรวจธีมมืดทุกครั้ง:** ข้อความต้องอ่านได้ พื้นสถานะต้องโปร่ง และปุ่มสีหลักต้องใช้ตัวอักษรสีเข้ม
- **แผนที่ (Leaflet)** ในธีมมืดถูกหรี่ด้วย `filter: brightness(.82)`

---

## 12. ภาษา

ทั้งสองระบบรองรับ 5 ภาษา: ไทย (ค่าเริ่มต้น) · English · 中文 · 日本語 · 한국어

**App** (localStorage `fufu_lang`)

```tsx
const { t, L } = useLang()
t('nav_home')                                         // คำที่ใช้ซ้ำหลายที่ → เพิ่มใน src/lib/translations.ts
L({ th: 'บริการ', en: 'Services', zh: '服务', ja: 'サービス', ko: '서비스' })  // ข้อความที่ใช้ที่เดียว
```

**Portal**

- ใช้ `t(key)`, `pageLabel(id, thai)`, `groupLabel(key)` จาก `portal-i18n.js`
- เปลี่ยนภาษาแล้วหน้าจะโหลดใหม่
- ตอนนี้แปลแค่ส่วนโครงหน้า (เมนู, หัวหน้า, เมนูโปรไฟล์) **เนื้อหาในแต่ละหน้ายังเป็นภาษาไทย**

**กฎการเขียนข้อความ**

- ภาษาไทยสั้น สุภาพ ตรงไปตรงมา ไม่ใช้คำแปลแข็งๆ เช่น "ดำเนินการ" ถ้าใช้ "บันทึก" หรือ "ส่ง" ได้
- ป้ายปุ่มขึ้นต้นด้วยคำกริยา เช่น "ชำระเงิน ฿930", "ขายรายการต่อไป"
- ข้อความ error ต้องบอกว่าเกิดอะไรขึ้นและต้องทำอะไรต่อ เช่น "ยังไม่ได้เปิดกะเงินสด — เปิดกะก่อนรับเงิน"
- ใน dropdown ภาษา ให้แสดงชื่อภาษาเป็นภาษานั้นเอง ไม่ต้องแปล

---

## 13. ไอคอนและโลโก้

### ไอคอน

| | App | Portal |
|---|---|---|
| ชุดไอคอน | `lucide-react` | SVG ของเราเองใน `public/js/utils/icons.js`: `icon('receipt', 'w-5 h-5')` (ชื่อตามแบบ Font Awesome เช่น `paw`, `stethoscope`, `receipt`) |
| ขนาด | 18–26px, เส้น 1.75–2.1 | 16–24px, เส้น 1.75 |

- ไอคอนตกแต่งต้องใส่ `aria-hidden="true"`
- ปุ่มที่มีแต่ไอคอน ต้องมี `aria-label` และ `title`
- Portal: ถ้าต้องการไอคอนใหม่ ให้เพิ่ม path ใน `PATHS` ของ `icons.js` **ห้ามโหลด icon font เพิ่ม**

### โลโก้

| ระบบ | ไฟล์ |
|---|---|
| App | `public/icons/Icon-192.png`, `Icon-512.png`, `Icon-maskable-*.png`, `public/apple-touch-icon.png` (ไม่มีกรอบ พื้น `#FEFEFE`) |
| Portal | `public/img/brand/` → `fufu-mark.webp` (sidebar), `fufu-logo.webp`, `fufu-logo-320.png`, `favicon-64.png`, `apple-touch-icon.png` |

- **ห้ามใช้โลโก้รุ่นเก่าที่มีกรอบ**
- ชื่อแบรนด์เขียนเป็น "FUFU" ตามด้วย "Pet Care" ตัวเอียงสี coral (`<em>`) ใช้ฟอนต์ Fredoka ในจุดที่เป็นแบรนด์
- ไอคอน PWA: ถ้าเปลี่ยนรูป ต้องเปลี่ยน query `?v=` ใน `layout.tsx` และ `manifest.json` ด้วย ไม่อย่างนั้นเครื่องผู้ใช้จะยังแสดงรูปเก่า

---

## 14. การเข้าถึง (Accessibility)

- **Focus:** ทั้งสองระบบใช้ `:focus-visible` เป็นเส้นสีหลัก 2px ห้ามใส่ `outline: none` โดยไม่มีอะไรแทน
- **Contrast:** ตัวอักษรต้องผ่านเกณฑ์ AA (4.5:1) ทั้งธีมสว่างและมืด ข้อความสี `--*-subtle` ใช้กับข้อความประกอบเท่านั้น ห้ามใช้กับข้อมูลสำคัญ
- **Dialog / sheet:**
  - ใส่ `role="dialog"` และ `aria-modal`
  - ปิดได้ด้วย Esc
  - คืน focus ให้ปุ่มที่เปิด
  - `openSheet()` ทำให้ครบแล้ว
- **เมนูที่เลือกอยู่:** ใส่ `aria-current="page"`
- **ปุ่มเลือก (segment):** ใส่ `role="radio"` + `aria-checked`
- **ขนาดตัวอักษร:** ทดสอบที่ `xl` ด้วย ข้อความห้ามล้นหรือถูกตัด
- **ขนาดปุ่ม:** ปุ่มที่กดด้วยนิ้วต้องใหญ่อย่างน้อย 40×40px

---

## 15. Checklist ก่อนส่งงาน UI

- [ ] ใช้ตัวแปร `--c-*` / `--pt-*` ไม่มี hex ตรงๆ สำหรับพื้น ตัวอักษร หรือเส้น
- [ ] ตรวจที่ **375px, 768px, 1024px, 1280px** แล้วไม่มี scroll แนวนอน
  - ตรวจได้ด้วยโค้ดนี้ ต้องได้ `false`: `document.documentElement.scrollWidth > innerWidth`
- [ ] ตรวจทั้ง**ธีมสว่างและมืด**
- [ ] ตรวจขนาดตัวอักษร `xl` แล้วไม่มีข้อความล้นหรือซ้อนกัน
- [ ] ไม่มีอะไรโดนแถบเมนูหรือ safe area บัง
- [ ] หน้าใหม่ของ App ที่ต้องมีแถบเมนู อยู่ใต้ `src/app/(shell)/`
- [ ] ไม่มีปุ่มสองปุ่มที่ทำงานเดียวกันบนจอเดียว
- [ ] ข้อความใหม่แปลแล้ว (App ใช้ `L()` หรือ `t()`)
- [ ] ปุ่มที่มีแต่ไอคอนมี `aria-label`
- [ ] ผ่าน lint (และ Portal ต้องผ่าน `npm test`)
- [ ] Portal: แก้ CSS แล้ว build ใหม่ (`npm run build:css`) และถ้าแก้ไฟล์ที่ Service Worker cache ไว้ ให้เพิ่มเวอร์ชัน `CACHE` ใน `public/sw.js`
- [ ] ไม่มีไฟล์ `__demo-*`, `.env*` หรือคีย์ใดๆ ติดไปใน commit

---

## 16. ข้อห้าม

- ห้ามเรียก Supabase ตรงจาก frontend ของ Portal ต้องผ่าน API ของ Express (`apiFetch`)
- ห้ามใส่ service-role key หรือคีย์ลับในโค้ดฝั่ง browser, ในเอกสาร หรือในไฟล์ตัวอย่าง env
- ห้ามแก้หรือลบแถวในตาราง `audit_logs` (เพิ่มได้อย่างเดียว)
- ห้ามแก้กฎธุรกิจที่ทีมกำหนดไว้แล้ว:
  - ค่าคอมมิชชั่น 5%
  - FEFO (ตัดสต็อกล็อตที่หมดอายุก่อน)
  - เลขคิว A001 ที่เริ่มนับใหม่ทุกวัน
- ห้ามใช้ `transform` กับ element ที่ครอบหน้าทั้งหน้าใน App
- ห้ามใช้ inline style `font-size` บน `<html>`
- ห้ามใช้ font หรือ icon library ใหม่โดยไม่คุยกับทีมก่อน

---

## 17. เรื่องที่ยังต้องตัดสินใจ

1. **ค่าธีมอัตโนมัติชื่อไม่ตรงกัน** — App ใช้ `system` ส่วน Portal ใช้ `auto` คนละโดเมนจึงยังไม่ชนกัน แต่ควรใช้ชื่อเดียวกัน
2. **ตัวละตินคนละฟอนต์** — App ใช้ Geist ส่วน Portal ใช้ DM Sans
3. **Component เดิมของ Portal** — `.btn-*`, `.card`, modal แบบ `bg-black/40` ยังต้องย้ายมาใช้ `.ph-*` และ `openSheet()`
4. **การแปลเนื้อหาของ Portal** — แปลแล้วแค่ส่วนโครงหน้า

ตัดสินใจแล้ว:

- **15 พ.ย. 2026 — สีหลักของทั้งสองระบบคือ teal ของโลโก้ `#2A6374`** (เดิม App ใช้ `#00897B` และ Portal ใช้ `#0F9D8A`) ดู [ข้อ 4.2](#42-สีหลัก-accent)

---

## 18. การแจ้งเตือนแบบ Push (Web Push)

ระบบ App, Portal และ Admin แจ้งเตือนได้แม้ผู้ใช้ปิดหน้าเว็บไปแล้ว ใช้มาตรฐาน Web Push กับคีย์ VAPID ชุดเดียวกันทั้งสามระบบ

### เหตุการณ์ที่แจ้งเตือน

| ระบบ | ผู้รับ | เหตุการณ์ | กดแล้วไปที่ |
| --- | --- | --- | --- |
| App (`system = app`) | ลูกค้าเจ้าของการจอง | ร้านยืนยัน ปฏิเสธ เสนอเวลาใหม่ ยกเลิก หรือเปลี่ยนสถานะการจอง (แถวใหม่ใน `notifications` จาก `transition_appointment`) | `/appointments` |
| Portal (`system = portal`) | เจ้าของร้านและพนักงานที่ active | คำขอจองใหม่ (`create_service_booking`) และรีวิวใหม่ | `/dashboard?page=appointments` หรือ `?page=reviews` |
| Admin (`system = admin`) | บัญชีใน `ADMIN_EMAILS` | ร้านใหม่รอการอนุมัติ (`verification_status = 'pending'`) | `/partners` |

ลูกค้าที่ยกเลิกการจองเองจะไม่ได้รับ push ของการยกเลิกนั้น ข้อความ push แปลเป็น th/en/zh/ja/ko ตามภาษาที่ผู้ใช้เลือกตอนเปิดการแจ้งเตือน

### ส่วนประกอบ

- **ตาราง** `push_subscriptions` (migration `20261115130000_web_push_subscriptions.sql`) เก็บหนึ่งแถวต่อผู้ใช้ × endpoint ของเบราว์เซอร์ × ระบบ เปิด RLS ให้ผู้ใช้จัดการได้เฉพาะแถวของตัวเอง เบราว์เซอร์สร้างแถว `admin` ไม่ได้ ต้องผ่าน API ของ Admin ที่ตรวจ `ADMIN_EMAILS` ก่อน
- **Trigger** บน `notifications`, `appointments`, `store_reviews` และ `stores` เรียก edge function `send-web-push` ผ่าน `pg_net` แบบไม่รอผล ถ้าส่งไม่สำเร็จก็ไม่ทำให้การจองหรือรีวิวล้ม
- **Edge function** `supabase/functions/send-web-push` หาผู้รับ ส่ง push และลบ subscription ที่ push service ตอบ 404 หรือ 410
- **Service worker**: Portal ใช้ `public/sw.js` เดิม (มี push + notificationclick), App และ Admin มี `public/sw.js` ที่ทำแค่ push ไม่ cache ไฟล์
- **ปุ่มเปิด/ปิด**: App อยู่ในหน้า `/notifications` และใน popup กระดิ่ง, Portal อยู่ในเมนูโปรไฟล์, Admin อยู่ในเมนูบัญชี

### กติกา UX

- ห้ามขอสิทธิ์แจ้งเตือนตอนโหลดหน้า ต้องขอหลังผู้ใช้กดปุ่ม "เปิด" เท่านั้น
- ถ้าเบราว์เซอร์บล็อกไว้ ให้บอกวิธีเปิดในการตั้งค่าเบราว์เซอร์ ไม่ต้องแสดงปุ่ม
- ตอนออกจากระบบ ให้ยกเลิก subscription ของเบราว์เซอร์นั้นก่อน คนที่เข้าระบบต่อจะได้ไม่เห็นแจ้งเตือนของบัญชีเดิม
- **iOS / iPadOS:** push ใช้ได้เฉพาะ **iOS 16.4 ขึ้นไป** และต้อง **เพิ่มเว็บไปยังหน้าจอโฮม (PWA) แล้วเปิดจากไอคอน** เท่านั้น ใน Safari แบบปกติจะขึ้นคำแนะนำให้เพิ่มไปยังหน้าจอโฮมแทนปุ่ม

### ตัวแปรและ secret ที่ต้องตั้ง (ชื่อเท่านั้น ห้ามใส่ค่าในเอกสารหรือ commit)

| ที่ตั้ง | ชื่อ | หมายเหตุ |
| --- | --- | --- |
| Supabase Edge Function secrets | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `VAPID_SUBJECT` เป็น `mailto:` หรือ URL ของทีม; private key อยู่ที่นี่ที่เดียว |
| Supabase Edge Function secrets | `WEB_PUSH_WEBHOOK_SECRET` | ค่าเดียวกับ Vault `web_push_webhook_secret` |
| Supabase Edge Function secrets | `ADMIN_EMAILS` | รายชื่อเดียวกับ env ของ Admin ใช้ตรวจซ้ำก่อนส่งถึง Admin |
| Supabase Vault | `web_push_function_url`, `web_push_webhook_secret` | URL ของ function `send-web-push` และ secret ที่ trigger ส่งไปใน header `x-push-secret` |
| Portal (Express env) | `VAPID_PUBLIC_KEY` | public key ส่งให้หน้าเว็บผ่าน `GET /api/push/config` |
| App และ Admin (Next env) | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public key เท่านั้น ห้ามมี private key ฝั่งนี้ |

ลำดับการเปิดใช้: apply migration → ตั้ง secret ของ function → deploy `send-web-push` ด้วย `--no-verify-jwt` (function ตรวจ `x-push-secret` เอง) → ใส่ค่าใน Vault → ตั้ง public key ในทั้งสามระบบแล้ว restart ถ้ายังไม่ได้ใส่ Vault ระบบจะไม่ส่ง push แต่ทุกอย่างอื่นทำงานปกติ
