'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './page.module.css'

const KEYS = {
  token: 'fufu_token', refresh: 'fufu_refresh_token', user: 'fufu_user',
  stores: 'fufu_stores_list', remember: 'fufu_remember', storeId: 'fufu_store_id',
  storeName: 'fufu_store_name', storeCategory: 'fufu_store_category', role: 'fufu_role',
  storeActive: 'fufu_store_active', email: 'fufu_remember_email',
}
const CATEGORY = {
  vet_clinic: ['คลินิกสัตวแพทย์', '🏥', 'vet'],
  pet_shop: ['ร้านค้าสัตว์เลี้ยง', '🛒', 'shop'],
  pet_hotel: ['โรงแรมสัตว์เลี้ยง', '🏨', 'hotel'],
  pet_grooming: ['บริการอาบน้ำตัดขน', '✂️', 'grooming'],
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stores, setStores] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(KEYS.token) && localStorage.getItem(KEYS.storeId)) {
      window.location.replace('/dashboard.html')
    }
  }, [])

  function chooseStore(store) {
    const category = CATEGORY[store.category] || ['', '', 'vet']
    localStorage.setItem(KEYS.storeId, store.id)
    localStorage.setItem(KEYS.storeName, store.name)
    localStorage.setItem(KEYS.storeCategory, store.category || 'vet_clinic')
    localStorage.setItem(KEYS.role, category[2])
    localStorage.setItem(KEYS.storeActive, store.is_active === false ? 'false' : 'true')
    window.location.assign('/dashboard.html')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
        return
      }

      localStorage.setItem(KEYS.token, result.token)
      localStorage.setItem(KEYS.refresh, result.refresh_token || '')
      localStorage.setItem(KEYS.user, JSON.stringify(result.user || {}))
      localStorage.setItem(KEYS.stores, JSON.stringify(result.stores || []))
      if (remember) {
        localStorage.setItem(KEYS.remember, '1')
        localStorage.setItem(KEYS.email, email.trim())
      } else {
        localStorage.removeItem(KEYS.remember)
        localStorage.removeItem(KEYS.email)
      }

      if (!result.stores?.length || result.needs_onboarding) {
        window.location.assign('/onboarding.html')
      } else if (result.stores.length === 1) {
        chooseStore(result.stores[0])
      } else {
        setStores(result.stores)
      }
    } catch {
      setError('เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.back}>← <span>กลับหน้าหลัก</span></Link>
        <span className={styles.language}>◎ TH⌄</span>
      </header>
      <main className={styles.main}>
        <section className={styles.card}>
          <Link href="/" className={styles.brand} aria-label="FUFU Pet Care">
            <Image src="/img/brand/fufu-mark.webp" alt="" width={72} height={72} priority />
            <span><b>FUFU</b> <em>Pet Care</em></span>
            <small>PARTNER PORTAL</small>
          </Link>
          {stores ? (
            <>
              <button className={styles.backInline} onClick={() => setStores(null)}>← ย้อนกลับ</button>
              <h1 className={styles.title}>เลือกร้านค้า</h1>
              <p className={styles.subtitle}>เลือกสาขาที่ต้องการเข้าใช้งาน</p>
              <div className={styles.storeList}>
                {stores.map(store => {
                  const category = CATEGORY[store.category] || ['ร้านค้า', '🏪', 'vet']
                  return <button key={store.id} className={styles.store} onClick={() => chooseStore(store)}>
                    <span className={styles.storeIcon}>{category[1]}</span>
                    <span><strong>{store.name}</strong><small>{category[0]}{store.is_active === false ? ' · ปิดใช้งาน (ดูข้อมูลได้)' : ''}</small></span>
                    <span aria-hidden="true">›</span>
                  </button>
                })}
              </div>
            </>
          ) : (
            <>
              <nav className={styles.tabs} aria-label="บัญชี">
                <Link href="/login" className={styles.activeTab}>เข้าสู่ระบบ</Link>
                <Link href="/register.html">สมัครพาร์ทเนอร์</Link>
              </nav>
              <h1 className={styles.title}>ยินดีต้อนรับกลับ</h1>
              <p className={styles.subtitle}>เข้าสู่ระบบด้วยบัญชี FUFU Partner ของคุณ</p>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <form className={styles.form} onSubmit={submit}>
                <label className={styles.field}><span>อีเมล</span><input autoComplete="username" inputMode="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="clinic@example.com" /></label>
                <label className={styles.field}><span>รหัสผ่าน</span><span className={styles.password}><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>{showPassword ? 'ซ่อน' : 'แสดง'}</button></span></label>
                <label className={styles.remember}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> จดจำการเข้าสู่ระบบ</label>
                <button className={styles.submit} disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
              </form>
              <p className={styles.footer}>ยังไม่มีบัญชี? <Link href="/register.html">สมัครเป็นพาร์ทเนอร์</Link></p>
            </>
          )}
        </section>
        <p className={styles.secure}>♙ เชื่อมต่อแบบเข้ารหัส · ข้อมูลแยกตามสิทธิ์</p>
      </main>
      <footer className={styles.copyright}>© 2026 FUFU Pet Care · KITTEN CODE Co., Ltd.</footer>
    </div>
  )
}
