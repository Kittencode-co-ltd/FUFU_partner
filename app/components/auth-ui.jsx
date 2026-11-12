'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Check, ChevronDown, Globe, Hospital, Hotel, Lock, Scissors, Stethoscope, Store } from 'lucide-react'
import { AUTH_LANGS, AUTH_MESSAGES } from '../i18n/auth'
import styles from '../login/page.module.css'

const LANG_KEY = 'fufu_lang'
const listeners = new Set()
const readLang = () => {
  try { const v = localStorage.getItem(LANG_KEY); return AUTH_LANGS.some(l => l.code === v) ? v : 'th' } catch { return 'th' }
}
const subscribe = cb => { listeners.add(cb); return () => listeners.delete(cb) }

/** Extra copy used by the Next.js auth pages (not in the original static dictionary). */
const EXTRA = {
  th: { catHospital: 'โรงพยาบาลสัตว์', storeFallback: 'ร้านค้า', 
    show: 'แสดง', hide: 'ซ่อน', chooseStoreSub: 'เลือกสาขาที่ต้องการเข้าใช้งาน', inactive: 'ปิดใช้งาน (ดูข้อมูลได้)', regPending: 'ส่งข้อมูลสมัครเรียบร้อย ร้านกำลังรอผู้ดูแลอนุมัติก่อนเข้าใช้งาน Partner', regReview: 'สร้างบัญชีและข้อมูลร้านค้าเพื่อส่งให้ FUFU ตรวจสอบ', submitApply: 'สร้างบัญชีและส่งสมัคร', sending: 'กำลังส่งข้อมูล…', onboardNotice: 'หากคุณเคยใช้ FUFU App บัญชีนี้จะเชื่อมกันโดยอัตโนมัติ ข้อมูลสัตว์เลี้ยงและการจองจะแสดงตามสิทธิ์ที่ได้รับ', onboardDone: 'สร้างร้านเรียบร้อยแล้ว บัญชีกำลังรอผู้ดูแลตรวจสอบและอนุมัติก่อนเข้าใช้งาน Partner', home: 'กลับหน้าหลัก', required: 'จำเป็น' },
  en: { catHospital: 'Animal hospital', storeFallback: 'Store', show: 'Show', hide: 'Hide', chooseStoreSub: 'Choose the branch you want to manage', inactive: 'Inactive (view only)', regPending: 'Application sent. Your store is waiting for FUFU approval before you can use the Partner portal.', regReview: 'Create your account and store details for FUFU to review', submitApply: 'Create account and apply', sending: 'Sending…', onboardNotice: 'If you already use FUFU App, this account is linked automatically. Pet and booking data appear according to your permissions.', onboardDone: 'Store created. Your account is waiting for FUFU review and approval before you can use the Partner portal.', home: 'Back to home', required: 'required' },
  zh: { catHospital: '动物医院', storeFallback: '门店', show: '显示', hide: '隐藏', chooseStoreSub: '选择要管理的门店', inactive: '已停用（仅可查看）', regPending: '申请已提交，门店需等待 FUFU 审核通过后才能使用合作伙伴后台。', regReview: '创建账户和门店信息，提交 FUFU 审核', submitApply: '创建账户并提交申请', sending: '提交中…', onboardNotice: '如果您已使用 FUFU App，此账户会自动关联，宠物和预约数据将按权限显示。', onboardDone: '门店已创建，账户正在等待 FUFU 审核通过后才能使用合作伙伴后台。', home: '返回首页', required: '必填' },
  ja: { catHospital: '動物病院', storeFallback: '店舗', show: '表示', hide: '隠す', chooseStoreSub: '管理する店舗を選択してください', inactive: '無効（閲覧のみ）', regPending: '申請を送信しました。FUFU の承認後に Partner ポータルをご利用いただけます。', regReview: 'アカウントと店舗情報を作成して FUFU の審査に送信します', submitApply: 'アカウントを作成して申請', sending: '送信中…', onboardNotice: 'FUFU App をご利用中の場合、このアカウントは自動で連携されます。ペットや予約の情報は権限に応じて表示されます。', onboardDone: '店舗を作成しました。FUFU の審査・承認後に Partner ポータルをご利用いただけます。', home: 'ホームに戻る', required: '必須' },
  ko: { catHospital: '동물병원', storeFallback: '매장', show: '보기', hide: '숨기기', chooseStoreSub: '관리할 지점을 선택하세요', inactive: '비활성 (보기만 가능)', regPending: '신청을 보냈어요. FUFU 승인 후 파트너 포털을 이용할 수 있어요.', regReview: '계정과 매장 정보를 만들어 FUFU 검토를 요청하세요', submitApply: '계정 만들고 신청하기', sending: '보내는 중…', onboardNotice: 'FUFU App을 사용 중이라면 이 계정이 자동으로 연결돼요. 반려동물과 예약 정보는 권한에 따라 표시돼요.', onboardDone: '매장을 만들었어요. FUFU 검토와 승인 후 파트너 포털을 이용할 수 있어요.', home: '홈으로', required: '필수' },
}

/** Store categories: label key, icon, and the legacy portal role it maps to. */
export const CATEGORIES = {
  vet_clinic: { key: 'catVet', icon: Stethoscope, role: 'vet' },
  vet_hospital: { key: 'catHospital', icon: Hospital, role: 'vet' },
  pet_shop: { key: 'catShop', icon: Store, role: 'shop' },
  pet_hotel: { key: 'catHotel', icon: Hotel, role: 'hotel' },
  pet_grooming: { key: 'catGroom', icon: Scissors, role: 'grooming' },
}
/** Categories a partner can pick when applying (hospital is set by FUFU staff). */
export const SIGNUP_CATEGORIES = ['vet_clinic', 'pet_shop', 'pet_hotel', 'pet_grooming']

/** Radio-style category picker with icons. */
export function CategoryPicker({ value, onChange, label }) {
  const { t } = useAuthLang()
  return (
    <div className={styles.field} role="radiogroup" aria-label={label}>
      <span>{label} <i>*</i></span>
      <div className={styles.catGrid}>
        {SIGNUP_CATEGORIES.map(code => {
          const { key, icon: Icon } = CATEGORIES[code]
          return (
            <button key={code} type="button" role="radio" aria-checked={value === code} className={styles.cat} onClick={() => onChange(code)}>
              <Icon size={17} aria-hidden="true" /><span>{t(key)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function useAuthLang() {
  const lang = useSyncExternalStore(subscribe, readLang, () => 'th')
  useEffect(() => {
    const l = AUTH_LANGS.find(x => x.code === lang)
    document.documentElement.lang = l?.html ?? 'th'
    document.documentElement.dataset.lang = lang
  }, [lang])
  const setLang = useCallback(code => {
    try { localStorage.setItem(LANG_KEY, code) } catch { /* private mode */ }
    listeners.forEach(fn => fn())
  }, [])
  const t = useCallback(key => EXTRA[lang]?.[key] ?? AUTH_MESSAGES[lang]?.[key] ?? EXTRA.th[key] ?? AUTH_MESSAGES.th[key] ?? key, [lang])
  return { lang, setLang, t }
}

function LanguageMenu() {
  const { lang, setLang, t } = useAuthLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = AUTH_LANGS.find(l => l.code === lang) ?? AUTH_LANGS[0]
  useEffect(() => {
    if (!open) return
    const down = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const key = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={ref} className={styles.langWrap}>
      <button type="button" className={styles.language} aria-haspopup="listbox" aria-expanded={open} aria-label={t('lang')} onClick={() => setOpen(o => !o)}>
        <Globe size={15} aria-hidden="true" /> {current.short} <ChevronDown size={14} aria-hidden="true" className={open ? styles.chevOpen : undefined} />
      </button>
      {open && (
        <ul role="listbox" className={styles.langMenu}>
          {AUTH_LANGS.map(l => (
            <li key={l.code}>
              <button type="button" role="option" aria-selected={l.code === lang} lang={l.html} onClick={() => { setLang(l.code); setOpen(false) }}>
                <span>{l.label}</span><small>{l.short}</small>{l.code === lang && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Shared frame for /login, /register and /onboarding. */
export function AuthShell({ children, showLanguage = true }) {
  const { t } = useAuthLang()
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /><span>{t('back')}</span></Link>
        {showLanguage && <LanguageMenu />}
      </header>
      <main className={styles.main}>
        <section className={styles.card}>
          <Link href="/" className={styles.brand} aria-label="FUFU Pet Care">
            <Image src="/img/brand/fufu-logo-320.png" alt="FUFU Pet Care" width={88} height={92} priority />
            <small>{t('portal')}</small>
          </Link>
          {children}
        </section>
        <p className={styles.secure}><Lock size={13} aria-hidden="true" /> {t('secure')}</p>
      </main>
      <footer className={styles.copyright}>© 2026 FUFU Pet Care · KITTEN CODE Co., Ltd.</footer>
    </div>
  )
}

/** Password input with a show/hide toggle. */
export function PasswordInput({ value, onChange, autoComplete, minLength, name, id }) {
  const { t } = useAuthLang()
  const [show, setShow] = useState(false)
  return (
    <span className={styles.password}>
      <input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} maxLength={128} required value={value} onChange={onChange} placeholder="••••••••" />
      <button type="button" onClick={() => setShow(v => !v)} aria-label={t('showPw')} aria-pressed={show}>{show ? t('hide') : t('show')}</button>
    </span>
  )
}
