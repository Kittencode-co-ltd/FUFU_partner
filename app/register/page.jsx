'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { AuthShell, CategoryPicker, PasswordInput, useAuthLang } from '../components/auth-ui'
import styles from '../login/page.module.css'

export default function RegisterPage() {
  const { t } = useAuthLang()
  const [form, setForm] = useState({ name: '', email: '', phone: '', store_category: 'vet_clinic', store_name: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  function update(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })) }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) { setMessage({ kind: 'error', text: t('errFill') }); return }
    if (!form.store_name.trim()) { setMessage({ kind: 'error', text: t('errStoreName') }); return }
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        setMessage(result.already_exists
          ? { kind: 'error', text: `${t('exists')} ${t('existsSub')}`, login: true }
          : { kind: 'error', text: result.error || t('errRegister') })
        return
      }
      setMessage({ kind: 'success', text: result.needs_email_verification ? t('okVerify') : t('regPending'), done: true })
    } catch {
      setMessage({ kind: 'error', text: t('errNetwork') })
    } finally { setBusy(false) }
  }

  const Icon = message?.kind === 'success' ? CheckCircle2 : AlertCircle
  return (
    <AuthShell>
      <nav className={styles.tabs} aria-label={t('portal')}>
        <Link href="/login">{t('tabLogin')}</Link>
        <Link href="/register" className={styles.activeTab} aria-current="page">{t('tabRegister')}</Link>
      </nav>
      <h1 className={styles.title}>{t('regTitle')}</h1>
      <p className={styles.subtitle}>{t('regReview')}</p>
      {message && (
        <p className={message.kind === 'success' ? styles.success : styles.error} role={message.kind === 'success' ? 'status' : 'alert'}>
          <Icon size={16} aria-hidden="true" />
          <span>{message.text}{message.login && <> <Link href="/login">{t('loginLink')}</Link></>}</span>
        </p>
      )}
      {!message?.done && (
        <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.field}><span>{t('ownerName')} <i>*</i></span>
            <input name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={update} placeholder={t('namePh')} />
          </label>
          <label className={styles.field}><span>{t('email')} <i>*</i></span>
            <input name="email" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={update} placeholder="clinic@example.com" />
            <small>{t('emailHint')}</small>
          </label>
          <label className={styles.field}><span>{t('phone')}</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update} placeholder="081-234-5678" />
          </label>
          <CategoryPicker label={t('category')} value={form.store_category} onChange={v => setForm(f => ({ ...f, store_category: v }))} />
          <label className={styles.field}><span>{t('storeName')} <i>*</i></span>
            <input name="store_name" required maxLength={160} value={form.store_name} onChange={update} placeholder="Happy Paws Clinic" />
          </label>
          <label className={styles.field}><span>{t('pwMin')} <i>*</i></span>
            <PasswordInput name="password" autoComplete="new-password" minLength={8} value={form.password} onChange={update} />
          </label>
          <button type="submit" className={styles.submit} disabled={busy}>
            {busy && <Loader2 size={17} className={styles.spin} aria-hidden="true" />}{busy ? t('sending') : t('submitApply')}
          </button>
        </form>
      )}
      <p className={styles.footer}>{t('haveAccount')} <Link href="/login">{t('loginLink')}</Link></p>
    </AuthShell>
  )
}
