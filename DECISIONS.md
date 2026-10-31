# FUFU Partner Decisions

ไฟล์นี้บันทึกเฉพาะการตัดสินใจที่ได้รับอนุมัติแล้ว หัวข้อที่ยังต้องให้เจ้าของผลิตภัณฑ์
ตัดสินใจจะไม่ถูกแปลงเป็น business rule ในโค้ด

## Approved

| วันที่ | การตัดสินใจ | ที่มา |
|---|---|---|
| 2026-09-21 | Partner MVP เป็น Clinic Booking & Follow-up Portal | `PARTNER-MVP-DEVELOPMENT-PLAN.md` |
| 2026-09-21 | Production UI แสดงเฉพาะ MVP navigation และเก็บ legacy modules ไว้หลัง feature flag | Phase P0 |
| 2026-09-21 | MVP roles คือ `owner`, `reception`, `vet` | Core User Roles |
| 2026-09-21 | Dashboard เน้นงานนัดหมายจริงที่ต้องทำวันนี้ และไม่แสดง revenue/demo data | UI Rules / Phase P0 |

## Owner decisions still required

- รูปแบบยืนยันนัด manual หรือ automatic
- lead time, cancellation และ no-show policy
- ขอบเขตข้อมูลสุขภาพที่คลินิกเห็นได้
- consent wording และ retention period
- เจ้าของข้อมูล Visit Summary และสิทธิ์แก้ไขย้อนหลัง
- จำนวนครั้งที่เสนอเวลาใหม่ได้ และ SLA การตอบรับนัด
- PDPA/legal wording, notification channel และคลินิกนำร่อง

เมื่อได้รับคำตอบ ให้เพิ่มแถวใน Approved พร้อมวันที่และผู้อนุมัติ ห้ามแก้ย้อนหลังโดยไม่บันทึกเหตุผล
