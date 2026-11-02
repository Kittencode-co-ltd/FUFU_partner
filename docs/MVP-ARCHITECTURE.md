# FUFU Partner MVP architecture

Partner เป็น clinic-facing client ของ MVP และใช้เฉพาะการรับ ตรวจสอบ ยืนยัน ปฏิเสธ
และเปลี่ยนสถานะนัดหมาย โดยยืนยัน Supabase JWT ฝั่ง server และบังคับ clinic scope
ทั้งใน API และ RLS โมดูล POS, inventory, finance, grooming และ hotel ยังอยู่ใน source
แต่ถูกซ่อนจาก navigation เมื่อ `FEATURE_FLAGS.MVP_MODE` เป็น `true`.

```text
Partner browser -> Express API -> Supabase with user/clinic authorization
Mobile customer ----------------> shared appointments schema through RLS/API
```

ห้ามส่ง service-role key ให้ browser และทุก privileged operation ต้อง validate input,
clinic membership และ transition ของ appointment ก่อนเขียนข้อมูล
