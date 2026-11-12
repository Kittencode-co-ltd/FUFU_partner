'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { AuthShell, CategoryPicker, useAuthLang } from '../components/auth-ui'
import styles from '../login/page.module.css'

const KEY = { token: 'fufu_token', refresh: 'fufu_refresh_token', user: 'fufu_user', stores: 'fufu_stores_list', remember: 'fufu_remember', storeId: 'fufu_store_id', storeName: 'fufu_store_name', storeCategory: 'fufu_store_category', role: 'fufu_role', active: 'fufu_store_active', staffId: 'fufu_staff_id', staffRole: 'fufu_staff_role', info: 'fufu_store_info' }

export default function OnboardingPage() {
  const { t } = useAuthLang()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('vet_clinic')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(KEY.token)) window.location.replace('/login')
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!name.trim()) { setError(t('errStoreName')); return }
    setBusy(true)
    setError('')
    try {
      const token = localStorage.getItem(KEY.token)
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), category }),
      })
      if (response.status === 401) { window.location.replace('/login'); return }
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) { setError(result.error || t('errGeneric')); return }
      Object.values(KEY).forEach(key => localStorage.removeItem(key))
      setDone(true)
    } catch { setError(t('errNetwork')) }
    finally { setBusy(false) }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>{t('firstStore')}</h1>
      <p className={styles.subtitle}>{t('firstStoreSub')}</p>
      {done ? (
        <div className={styles.success} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div><p>{t('onboardDone')}</p><Link className={styles.noticeLink} href="/"><ArrowLeft size={15} aria-hidden="true" />{t('home')}</Link></div>
        </div>
      ) : (
        <>
          <p className={styles.notice}><Info size={16} aria-hidden="true" /><span>{t('onboardNotice')}</span></p>
          {error && <p className={styles.error} role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></p>}
          <form className={styles.form} onSubmit={submit} noValidate>
            <label className={styles.field}><span>{t('storeName')} <i>*</i></span>
              <input required maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="Happy Paws Clinic" />
            </label>
            <CategoryPicker label={t('category')} value={category} onChange={setCategory} />
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy && <Loader2 size={17} className={styles.spin} aria-hidden="true" />}{busy ? t('creatingStore') : t('createStore')}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
