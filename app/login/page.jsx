'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Plus, Store } from 'lucide-react'
import { AuthShell, CATEGORIES, PasswordInput, useAuthLang } from '../components/auth-ui'
import styles from './page.module.css'

const KEYS = {
  token: 'fufu_token', refresh: 'fufu_refresh_token', user: 'fufu_user',
  stores: 'fufu_stores_list', remember: 'fufu_remember', storeId: 'fufu_store_id',
  storeName: 'fufu_store_name', storeCategory: 'fufu_store_category', role: 'fufu_role',
  storeActive: 'fufu_store_active', email: 'fufu_remember_email',
}

export default function LoginPage() {
  const { t } = useAuthLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stores, setStores] = useState(null)

  useEffect(() => {
    const cachedStores = localStorage.getItem(KEYS.stores)
    if (localStorage.getItem(KEYS.token) && cachedStores) {
      try {
        const availableStores = JSON.parse(cachedStores)
        if (Array.isArray(availableStores) && availableStores.length) {
          setStores(availableStores) // eslint-disable-line react-hooks/set-state-in-effect
          return
        }
      } catch { localStorage.removeItem(KEYS.stores) }
    }
    // Restore the remembered email (the static login page did this too)
    if (localStorage.getItem(KEYS.remember) === '1') {
      const saved = localStorage.getItem(KEYS.email)
      if (saved) { setEmail(saved); setRemember(true) }
    }
  }, [])

  function chooseStore(store) {
    const category = CATEGORIES[store.category] ?? CATEGORIES.vet_clinic
    localStorage.setItem(KEYS.storeId, store.id)
    localStorage.setItem(KEYS.storeName, store.name)
    localStorage.setItem(KEYS.storeCategory, store.category || 'vet_clinic')
    localStorage.setItem(KEYS.role, category.role)
    localStorage.setItem(KEYS.storeActive, store.is_active === false ? 'false' : 'true')
    window.location.assign('/dashboard.html')
  }

  async function submit(event) {
    event.preventDefault()
    if (!email.trim() || !password) { setError(t('errEmpty')); return }
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        setError(result.error || t('errGeneric'))
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
        window.location.assign('/onboarding')
      } else {
        setStores(result.stores)
      }
    } catch {
      setError(t('errNetwork'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {stores ? (
        <>
          <button type="button" className={styles.backInline} onClick={() => setStores(null)}><ArrowLeft size={16} aria-hidden="true" />{t('backBtn')}</button>
          <h1 className={styles.title}>{t('storeTitle')}</h1>
          <p className={styles.subtitle}>เลือกร้านค้าที่ต้องการเข้าดู</p>
          <div className={styles.storeList}>
            {stores.map(store => {
              const cat = CATEGORIES[store.category]
              const Icon = cat?.icon ?? Store
              const verification = store.verification_status || (store.is_verified ? 'accept' : 'pending')
              const status = store.is_active === false
                ? { label: 'ถูกระงับ', className: styles.statusSuspended }
                : verification === 'accept'
                  ? { label: 'ใช้งานได้', className: styles.statusActive }
                  : { label: 'รอตรวจสอบ', className: styles.statusPending }
              return (
                <button type="button" key={store.id} className={styles.store} onClick={() => chooseStore(store)}>
                  <span className={styles.storeIcon}><Icon size={20} aria-hidden="true" /></span>
                  <span className={styles.storeText}>
                    <strong>{store.name}</strong>
                    <small>{t(cat?.key ?? 'storeFallback')}</small>
                  </span>
                  <span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span>
                  <ChevronRight size={18} className={styles.storeArrow} aria-hidden="true" />
                </button>
              )
            })}
          </div>
          <Link className={styles.createStore} href="/onboarding"><Plus size={17} aria-hidden="true" />สร้างร้านค้าใหม่</Link>
        </>
      ) : (
        <>
          <nav className={styles.tabs} aria-label={t('portal')}>
            <Link href="/login" className={styles.activeTab} aria-current="page">{t('tabLogin')}</Link>
            <Link href="/register">{t('tabRegister')}</Link>
          </nav>
          <h1 className={styles.title}>{t('loginTitle')}</h1>
          <p className={styles.subtitle}>{t('loginSub')}</p>
          {error && <p className={styles.error} role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></p>}
          <form className={styles.form} onSubmit={submit} noValidate>
            <label className={styles.field}><span>{t('email')}</span>
              <input autoComplete="username" inputMode="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="clinic@example.com" />
            </label>
            <label className={styles.field}><span>{t('password')}</span>
              <PasswordInput autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <label className={styles.remember}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> {t('remember')}</label>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy && <Loader2 size={17} className={styles.spin} aria-hidden="true" />}{busy ? t('signingIn') : t('submitLogin')}
            </button>
          </form>
          <p className={styles.footer}>{t('noAccount')} <Link href="/register">{t('joinLink')}</Link></p>
        </>
      )}
    </AuthShell>
  )
}
