# FUFU Integration Blueprints

## 1. SMS Gateway (ThaiBulkSMS / Twilio)

### Purpose
Send appointment reminders, vaccination alerts, and queue notifications to pet owners.

### Recommended Provider
- **Primary:** [ThaiBulkSMS](https://www.thaibulksms.com/) — Thai number support, competitive pricing (~฿0.30/msg)
- **Alternative:** [Twilio](https://www.twilio.com/) — International, API-friendly, more expensive

### Integration Pattern
```
[Supabase Edge Function] → [SMS API] → [Pet Owner Phone]

Trigger: Database webhook on appointment.status change or vaccination.next_due_date
```

### Key API Endpoints
```http
POST https://api.thaibulksms.com/v2/sms
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "sender": "FUFU",
  "msisdn": "66812345678",
  "message": "สัตว์เลี้ยง 'บัดดี้' มีนัดหมายกับ Happy Paws Clinic วันพรุ่งนี้ เวลา 09:00 น.",
  "force": "standard"
}
```

### Template Messages
1. **Appointment Reminder:** `สัตว์เลี้ยง '{pet_name}' มีนัดหมายที่ {store_name} วัน{date} เวลา {time} น.`
2. **Vaccine Due:** `แจ้งเตือน: {pet_name} ถึงกำหนดฉีดวัคซีน {vaccine_name} ภายใน {due_date}`
3. **Queue Called:** `คิว {queue_number} ของคุณ — ถึงคิวแล้ว กรุณาเตรียมตัวเข้ารับบริการ`

---

## 2. PromptPay QR Code Generation

### Purpose
Generate dynamic PromptPay QR codes for instant payment at partner stores.

### Standard
- Follow **Bank of Thailand** PromptPay QR specification (EMVCo format)
- Static QR: fixed amount, reusable
- Dynamic QR: one-time use with specific amount

### Integration Options

#### Option A: Direct Generation (No API needed)
Use `promptpay-qr` npm library:
```bash
npm install promptpay-qr
```
```js
import generatePayload from 'promptpay-qr';

const payload = generatePayload('0812345678', { amount: 500.00 });
// Use any QR library to render the payload string
```

#### Option B: Bank API (SCB, KBank, BBL)
- SCB Open Banking API: [developer.scb](https://developer.scb/)
- KBank API: [apiportal.kasikornbank.com](https://apiportal.kasikornbank.com/)

### Display Flow
```
Partner Settings → Enable PromptPay → Enter Phone/Tax ID →
Customer pays → Confirm in dashboard → Auto-update transaction
```

---

## 3. Thermal Printer / Receipt Printer (ESC/POS)

### Purpose
Print receipts, queue tickets, and vaccination certificates at the point of service.

### Supported Printers
- Epson TM-T82/T88
- Star TSP100
- Any ESC/POS compatible USB/Bluetooth printer

### Integration Pattern
```
Browser → Web Serial API / WebUSB → ESC/POS Printer
```

### Library
Use `escpos-buffer` or `receipt-printer-encoder`:
```bash
npm install receipt-printer-encoder
```
```js
import ReceiptPrinterEncoder from 'receipt-printer-encoder';

const encoder = new ReceiptPrinterEncoder();
const result = encoder
  .initialize()
  .align('center')
  .bold(true).text('FUFU Partner').bold(false)
  .newline()
  .text('Queue: A001')
  .text('Pet: บัดดี้')
  .text('Service: ตรวจสุขภาพ')
  .barcode('A001', 'code128')
  .cut()
  .encode();
```

### Notes
- Web Serial API requires Chrome/Edge 89+
- User must grant serial port permission
- Fallback: generate browser-printable HTML (current implementation)

---

## 4. Map & Geolocation API

### Purpose
"Find a Partner" search with distance sorting, map display, and directions.

### Recommended Provider
- **Primary:** [Longdo Map API](https://map.longdo.com/docs/) — Thai maps, Thai address autocomplete, free tier
- **Alternative:** [Google Maps Platform](https://developers.google.com/maps) — More features, usage-based pricing

### Longdo Map Setup
```html
<script src="https://api.longdo.com/map/?key=YOUR_KEY"></script>
<div id="map" style="width:100%;height:400px"></div>
<script>
  var map = new longdo.Map({ placeholder: document.getElementById('map') });
  map.location({ lon: 100.5018, lat: 13.7563 });
</script>
```

### Distance Calculation (Haversine)
```js
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

---

## 5. Line Notify Integration

### Purpose
Send push notifications to partners via Line Notify when new bookings arrive.

### Setup
1. Register at [notify-bot.line.me](https://notify-bot.line.me/)
2. Get Personal Access Token or set up OAuth for group notifications

### API
```http
POST https://notify-api.line.me/api/notify
Authorization: Bearer LINE_NOTIFY_TOKEN
Content-Type: application/x-www-form-urlencoded

message=📋 นัดหมายใหม่! คุณสมชาย จองตรวจสุขภาพ วันที่ 17 เม.ย. 2026 เวลา 09:00
```

### Supabase Edge Function Example
```ts
Deno.serve(async (req) => {
  const { message, token } = await req.json();
  
  const res = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `message=${encodeURIComponent(message)}`,
  });

  return new Response(JSON.stringify({ ok: res.ok }));
});
```
