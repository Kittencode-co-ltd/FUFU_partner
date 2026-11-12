'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../login/page.module.css'

const KEY = { token: 'fufu_token', refresh: 'fufu_refresh_token', user: 'fufu_user', stores: 'fufu_stores_list', remember: 'fufu_remember', storeId: 'fufu_store_id', storeName: 'fufu_store_name', storeCategory: 'fufu_store_category', role: 'fufu_role', active: 'fufu_store_active', staffId: 'fufu_staff_id', staffRole: 'fufu_staff_role', info: 'fufu_store_info' }

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('vet_clinic')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!localStorage.getItem(KEY.token)) { window.location.replace('/login'); return }
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const token = localStorage.getItem(KEY.token)
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), category }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) { setMessage(result.error || 'สร้างร้านไม่สำเร็จ กรุณาลองใหม่'); return }
      Object.values(KEY).forEach(key => localStorage.removeItem(key))
      setMessage('สร้างร้านเรียบร้อยแล้ว บัญชีกำลังรอผู้ดูแลตรวจสอบและอนุมัติก่อนเข้าใช้งาน Partner')
    } catch { setMessage('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง') }
    finally { setBusy(false) }
  }

  return <div className={styles.shell}>
    <header className={styles.topbar}><Link href="/" className={styles.back}>← <span>กลับหน้าหลัก</span></Link></header>
    <main className={styles.main}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="FUFU Pet Care"><Image src="/img/brand/fufu-mark.webp" alt="" width={72} height={72} priority/><span><b>FUFU</b> <em>Pet Care</em></span><small>PARTNER PORTAL</small></Link>
        <h1 className={styles.title}>สร้างร้านค้าแรก</h1>
        <p className={styles.subtitle}>เพิ่มข้อมูลร้านค้าเพื่อส่งให้ FUFU ตรวจสอบ</p>
        <p className={styles.notice}>หากคุณเคยใช้ FUFU App บัญชีนี้จะเชื่อมกันโดยอัตโนมัติ ข้อมูลสัตว์เลี้ยงและการจองจะแสดงตามสิทธิ์ที่ได้รับ</p>
        {!message && <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}><span>ชื่อร้าน / คลินิก *</span><input required maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="Happy Paws Clinic"/></label>
          <label className={styles.field}><span>ประเภทธุรกิจ *</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="vet_clinic">🏥 คลินิกสัตวแพทย์</option><option value="pet_shop">🛒 ร้านค้าสัตว์เลี้ยง</option><option value="pet_hotel">🏨 โรงแรมสัตว์เลี้ยง</option><option value="pet_grooming">✂️ อาบน้ำตัดขน</option></select></label>
          <button className={styles.submit} disabled={busy}>{busy ? 'กำลังสร้าง…' : 'สร้างร้านค้า'}</button>
        </form>}
        {message && <div className={styles.notice} role="status"><p>{message}</p><Link className={styles.noticeLink} href="/">กลับหน้าหลัก</Link></div>}
      </section>
      <p className={styles.secure}>♙ เชื่อมต่อแบบเข้ารหัส · ข้อมูลแยกตามสิทธิ์</p>
    </main>
    <footer className={styles.copyright}>© 2026 FUFU Pet Care · KITTEN CODE Co., Ltd.</footer>
  </div>
}
