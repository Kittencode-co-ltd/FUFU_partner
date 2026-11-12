'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../login/page.module.css'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', store_category: 'vet_clinic', store_name: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  function update(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })) }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setMessage({ kind: 'error', text: result.already_exists ? 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ' : (result.error || 'สมัครไม่สำเร็จ กรุณาลองใหม่') })
        return
      }
      setMessage({ kind: 'success', text: result.needs_email_verification
        ? 'สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
        : 'ส่งข้อมูลสมัครเรียบร้อย ร้านกำลังรอผู้ดูแลอนุมัติก่อนเข้าใช้งาน Partner' })
    } catch {
      setMessage({ kind: 'error', text: 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง' })
    } finally { setBusy(false) }
  }

  return <div className={styles.shell}>
    <header className={styles.topbar}><Link href="/" className={styles.back}>← <span>กลับหน้าหลัก</span></Link><span className={styles.language}>◎ TH⌄</span></header>
    <main className={styles.main}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="FUFU Pet Care"><Image src="/img/brand/fufu-mark.webp" alt="" width={72} height={72} priority/><span><b>FUFU</b> <em>Pet Care</em></span><small>PARTNER PORTAL</small></Link>
        <nav className={styles.tabs} aria-label="บัญชี"><Link href="/login">เข้าสู่ระบบ</Link><Link href="/register" className={styles.activeTab}>สมัครพาร์ทเนอร์</Link></nav>
        <h1 className={styles.title}>สมัครเป็นพาร์ทเนอร์</h1>
        <p className={styles.subtitle}>สร้างบัญชีและข้อมูลร้านค้าเพื่อส่งให้ FUFU ตรวจสอบ</p>
        {message && <p className={message.kind === 'success' ? styles.success : styles.error} role="status">{message.text}{message.kind === 'error' && message.text.includes('มีบัญชี') && <> · <Link href="/login">เข้าสู่ระบบ</Link></>}</p>}
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}><span>ชื่อ-นามสกุล (เจ้าของ) *</span><input name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={update} placeholder="สมชาย ใจดี"/></label>
          <label className={styles.field}><span>อีเมล *</span><input name="email" type="email" autoComplete="email" required value={form.email} onChange={update} placeholder="clinic@example.com"/><small>ใช้อีเมลเดียวกับ FUFU App ได้</small></label>
          <div className={styles.row}>
            <label className={styles.field}><span>เบอร์โทรศัพท์</span><input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} placeholder="081-234-5678"/></label>
            <label className={styles.field}><span>ประเภทธุรกิจ *</span><select name="store_category" value={form.store_category} onChange={update}><option value="vet_clinic">คลินิกสัตวแพทย์</option><option value="pet_shop">ร้านค้าสัตว์เลี้ยง</option><option value="pet_hotel">โรงแรมสัตว์เลี้ยง</option><option value="pet_grooming">อาบน้ำตัดขน</option></select></label>
          </div>
          <label className={styles.field}><span>ชื่อร้าน / คลินิก *</span><input name="store_name" required maxLength={160} value={form.store_name} onChange={update} placeholder="Happy Paws Clinic"/></label>
          <label className={styles.field}><span>รหัสผ่าน (อย่างน้อย 8 ตัว) *</span><span className={styles.password}><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={form.password} onChange={update} placeholder="••••••••"/><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'ซ่อน' : 'แสดง'}</button></span></label>
          <button className={styles.submit} disabled={busy}>{busy ? 'กำลังส่งข้อมูล…' : 'สร้างบัญชีและส่งสมัคร'}</button>
        </form>
        <p className={styles.footer}>มีบัญชีอยู่แล้ว? <Link href="/login">เข้าสู่ระบบ</Link></p>
      </section>
      <p className={styles.secure}>♙ เชื่อมต่อแบบเข้ารหัส · ข้อมูลแยกตามสิทธิ์</p>
    </main>
    <footer className={styles.copyright}>© 2026 FUFU Pet Care · KITTEN CODE Co., Ltd.</footer>
  </div>
}
