# FUFU Partner Backend 🐾

### ระบบหลังบ้านสำหรับพาร์ทเนอร์ FUFU Pet Care

---

## 📁 ไฟล์ในระบบ

```
fufu-partner/
├── login.html       → หน้า Login (รองรับทุก role)
├── dashboard.html   → แดชบอร์ดหลัก (รองรับทุก role)
├── api.php          → PHP Backend + Supabase Connector
└── README.md        → คู่มือนี้
```

---

## 🚀 วิธีติดตั้งและใช้งาน

### Step 1: แก้ไข Supabase Config

ใน `api.php` แก้ไขบรรทัดเหล่านี้:

```php
define('SUPABASE_URL', 'https://YOUR_PROJECT.supabase.co');
define('SUPABASE_ANON_KEY', 'YOUR_ANON_KEY');
define('SUPABASE_SERVICE_KEY', 'YOUR_SERVICE_KEY');
```

### Step 2: วางไฟล์บน Server

- Upload ไฟล์ทั้งหมดไปที่ web server (Apache/Nginx + PHP 8.0+)
- หรือใช้ `php -S localhost:8000` สำหรับ local dev

### Step 3: เปิด login.html

```
http://localhost:8000/login.html
```

---

## 🗄️ Supabase SQL Schema

รัน SQL นี้ใน Supabase SQL Editor:

```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Partners table
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('vet', 'shop', 'hotel', 'grooming')),
  description TEXT,
  address TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  phone TEXT,
  rating DECIMAL(3,2) DEFAULT 5.0,
  owner_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vet profiles
CREATE TABLE IF NOT EXISTS vet_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  license_no TEXT,
  specialization TEXT,
  consultation_price DECIMAL(10,2)
);

-- Products & Services
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT -1, -- -1 = unlimited
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments / Queue
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  pet_id UUID,
  partner_id UUID REFERENCES partners(id),
  product_id UUID REFERENCES products(id),
  type TEXT,
  date_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  note TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions / Revenue
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  partner_id UUID REFERENCES partners(id),
  appointment_id UUID REFERENCES appointments(id),
  amount DECIMAL(10,2) NOT NULL,
  commission DECIMAL(10,2), -- 5% to FUFU
  net_amount DECIMAL(10,2), -- 95% to partner
  type TEXT DEFAULT 'appointment',
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotel Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id),
  room_number TEXT NOT NULL,
  type TEXT DEFAULT 'standard',
  price_per_night DECIMAL(10,2),
  status TEXT DEFAULT 'available'
    CHECK (status IN ('available','occupied','maintenance')),
  current_pet_id UUID,
  checkin_date DATE,
  checkout_date DATE
);

-- Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Partner can see their own data
CREATE POLICY "Partners see own data" ON partners
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Partners see own appointments" ON appointments
  FOR ALL USING (
    partner_id IN (SELECT id FROM partners WHERE owner_id = auth.uid())
  );

CREATE POLICY "Partners see own transactions" ON transactions
  FOR ALL USING (
    partner_id IN (SELECT id FROM partners WHERE owner_id = auth.uid())
  );

CREATE POLICY "Partners manage own products" ON products
  FOR ALL USING (
    partner_id IN (SELECT id FROM partners WHERE owner_id = auth.uid())
  );
```

---

## 🔌 API Endpoints (PHP)

| Method | Path                            | คำอธิบาย          |
| ------ | ------------------------------- | ----------------- |
| POST   | `/api/auth`                     | Login             |
| GET    | `/api/partners`                 | ดูร้านค้าทั้งหมด  |
| GET    | `/api/partners/{id}`            | ดูร้านค้าเดียว    |
| PUT    | `/api/partners/{id}`            | แก้ไขข้อมูลร้าน   |
| GET    | `/api/appointments?partner_id=` | ดูคิว / นัดหมาย   |
| POST   | `/api/appointments`             | เพิ่มนัดหมาย      |
| PUT    | `/api/appointments/{id}`        | อัปเดตสถานะ       |
| DELETE | `/api/appointments/{id}`        | ยกเลิกนัด         |
| GET    | `/api/products?partner_id=`     | ดูสินค้า / บริการ |
| POST   | `/api/products`                 | เพิ่มสินค้า       |
| PUT    | `/api/products/{id}`            | แก้ไขสินค้า       |
| DELETE | `/api/products/{id}`            | ลบสินค้า          |
| GET    | `/api/transactions?partner_id=` | ดูรายรับ          |
| POST   | `/api/transactions`             | บันทึกรายรับ      |
| GET    | `/api/dashboard?partner_id=`    | ดึง stats รวม     |
| PUT    | `/api/queue/{id}`               | อัปเดต status คิว |

---

## 📱 เชื่อมต่อกับ Flutter (FUFU App)

เพิ่มใน Flutter ของคุณ:

```dart
// lib/services/partner_service.dart

class PartnerService {
  static const String baseUrl = 'https://YOUR_SERVER.com/api';
  static const String supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
  static const String anonKey = 'YOUR_ANON_KEY';

  // ดึงคิววันนี้
  static Future<List<Map>> getTodayQueue(String partnerId) async {
    final today = DateTime.now().toIso8601String().split('T')[0];
    final res = await Supabase.instance.client
      .from('appointments')
      .select('*, pets(name, avatar_url), profiles(name, phone)')
      .eq('partner_id', partnerId)
      .gte('date_time', '${today}T00:00:00')
      .lte('date_time', '${today}T23:59:59')
      .order('date_time');
    return List<Map>.from(res);
  }

  // อัปเดตสถานะคิว
  static Future<void> updateQueueStatus(String apptId, String status) async {
    await Supabase.instance.client
      .from('appointments')
      .update({'status': status})
      .eq('id', apptId);
  }

  // ดึงรายรับเดือนนี้
  static Future<Map> getMonthlyRevenue(String partnerId) async {
    final monthStart = DateTime(DateTime.now().year, DateTime.now().month, 1).toIso8601String();
    final data = await Supabase.instance.client
      .from('transactions')
      .select('amount, commission, net_amount')
      .eq('partner_id', partnerId)
      .gte('created_at', monthStart);

    double total = 0, net = 0;
    for (var tx in data) {
      total += (tx['amount'] ?? 0).toDouble();
      net += (tx['net_amount'] ?? 0).toDouble();
    }
    return {'total': total, 'net': net, 'count': data.length};
  }
}
```

---

## 🎨 Role ที่รองรับ

| Role        | หน้าจอ            | ฟีเจอร์                                |
| ----------- | ----------------- | -------------------------------------- |
| **admin**   | ภาพรวมทุก partner | รายรับรวม, Top partners, สถิติทั้งระบบ |
| **vet**     | คลินิกสัตว์แพทย์  | คิวนัด, ประวัติรักษา, บริการ/ยา        |
| **shop**    | Pet Shop          | คำสั่งซื้อ, สต็อกสินค้า, ยอดขาย        |
| **service** | Hotel + Grooming  | จองห้อง, check-in/out, คิว grooming    |

---

## 🔐 Security

- ใช้ Supabase Row Level Security (RLS) ทุก table
- JWT token จาก Supabase Auth
- PHP เป็น middleware ตรวจสอบ token ก่อนทุก request
- CORS headers ป้องกัน unauthorized origins

---

**FUFU Partner v2.0** • Built with ❤️ for FUFU Pet Care Platform
