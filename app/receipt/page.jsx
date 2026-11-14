'use client'

import { useEffect } from 'react'

export default function ReceiptPage() {
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = `/js/partner/receipt-page.js?receipt=${Date.now()}`
    document.body.appendChild(script)
    return () => script.remove()
  }, [])

  return <>
    <link rel="icon" href="/img/brand/favicon-64.png" />
    <header className="rc-bar" id="rc-bar">
      <div className="rc-bar__group" role="group" aria-label="รูปแบบเอกสาร">
        <button type="button" data-format="slip" aria-pressed="false">ใบเสร็จ 80 มม.</button>
        <button type="button" data-format="a4" aria-pressed="false">A4</button>
      </div>
      <label className="rc-check" id="rc-full-wrap" hidden>
        <input type="checkbox" id="rc-full" /> ใบกำกับภาษีเต็มรูป
      </label>
      <div className="rc-bar__spacer" />
      <button type="button" className="rc-btn" data-action="pdf">บันทึก PDF</button>
      <button type="button" className="rc-btn is-primary" data-action="print">พิมพ์</button>
    </header>

    <form className="rc-buyer" id="rc-buyer" hidden>
      <p className="rc-buyer__title">ข้อมูลผู้ซื้อ (สำหรับใบกำกับภาษีเต็มรูป)</p>
      <label>ชื่อผู้ซื้อ / บริษัท<input name="name" maxLength="200" required /></label>
      <label>ที่อยู่<input name="address" maxLength="400" /></label>
      <div className="rc-buyer__row">
        <label>เลขประจำตัวผู้เสียภาษี<input name="tax_id" inputMode="numeric" maxLength="13" pattern="[0-9]{13}" placeholder="13 หลัก" /></label>
        <label>สำนักงานใหญ่ / สาขา<input name="branch" maxLength="60" placeholder="สำนักงานใหญ่" /></label>
      </div>
      <button type="submit" className="rc-btn">บันทึกข้อมูลผู้ซื้อ</button>
      <p className="rc-buyer__note">เมื่อออกใบกำกับภาษีเต็มรูปแล้ว จะแก้ข้อมูลผู้ซื้อไม่ได้</p>
    </form>

    <p className="rc-msg" id="rc-msg" role="status" hidden />
    <main id="rc-doc" className="rc-doc" aria-live="polite"><p className="rc-loading">กำลังโหลดเอกสาร…</p></main>
  </>
}
