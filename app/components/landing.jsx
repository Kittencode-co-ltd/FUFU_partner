'use client'

import Image from 'next/image'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BellRing, BookHeart, CalendarDays, Check, ChevronDown,
  ArrowLeft, Activity, Bell, Bot, Cloud, Database, Eye, Images, KeyRound, Network, Smartphone, Workflow,
  ClipboardCheck, Copy, Globe, HeartHandshake, Mail, QrCode, LayoutDashboard, MapPin, Menu, MessageCircleHeart,
  ScanLine, Stethoscope, Store, Users, Volume2, VolumeX, X,
} from 'lucide-react'
import { APP_URL, DONATION, LANGS, messages, REGISTRY, REQUESTS } from '../i18n/messages'

const LANG_KEY = 'fufu_lang'
const MUSIC_KEY = 'fufu_music'
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Language ─────────────────────────────────────────────────────────────── */

const LangContext = createContext({ lang: 'th', t: messages.th, setLang: () => {} })
const useLang = () => useContext(LangContext)

function LangProvider({ children }) {
  const [lang, setLangState] = useState('th')

  useEffect(() => {
    let initial = 'th'
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('lang')
      const saved = localStorage.getItem(LANG_KEY)
      initial = [fromUrl, saved].find(code => code && messages[code]) || 'th'
    } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from storage after hydration
    setLangState(initial)
  }, [])

  useEffect(() => {
    document.documentElement.lang = LANGS.find(l => l.code === lang)?.html || 'th'
    document.documentElement.dataset.lang = lang
  }, [lang])

  const setLang = useCallback((code) => {
    setLangState(code)
    try { localStorage.setItem(LANG_KEY, code) } catch { /* ignore */ }
  }, [])

  return <LangContext.Provider value={{ lang, t: messages[lang], setLang }}>{children}</LangContext.Provider>
}

function LanguageSwitcher() {
  const { lang, setLang, t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGS.find(l => l.code === lang)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className="lang" ref={ref}>
      <button type="button" className="lang-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={t.lang} onClick={() => setOpen(o => !o)}>
        <Globe size={16} aria-hidden="true" /><span>{current?.short}</span><ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <ul className="lang-menu" role="listbox" aria-label={t.lang}>
          {LANGS.map(l => (
            <li key={l.code}>
              <button type="button" role="option" aria-selected={l.code === lang} lang={l.html}
                onClick={() => { setLang(l.code); setOpen(false) }}>
                <span>{l.label}</span><small>{l.short}</small>{l.code === lang && <Check size={15} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Background music ─────────────────────────────────────────────────────── */

const PLAYLISTS = {
  th: ['/audio/fufu-theme-th.m4a'],
  intl: ['/audio/fufu-theme-intl.m4a', '/audio/fufu-theme-intl-2.m4a'],
}

function MusicPlayer() {
  const { lang, t } = useLang()
  const audioRef = useRef(null)
  const indexRef = useRef(0)
  // Off by default: music only starts when the visitor presses the button
  const [enabled, setEnabled] = useState(false)
  const [playing, setPlaying] = useState(false)
  const playlist = lang === 'th' ? PLAYLISTS.th : PLAYLISTS.intl

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    indexRef.current = 0
    const wasPlaying = !audio.paused
    audio.src = playlist[0]
    if (wasPlaying) audio.play().catch(() => {})
  }, [playlist])

  // Browsers only allow sound after a user gesture: try now, otherwise start on
  // the first tap / click / key press anywhere on the page.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !enabled) return
    let started = false
    const events = ['pointerdown', 'keydown', 'touchstart']
    const cleanup = () => events.forEach(ev => window.removeEventListener(ev, start, true))
    function start() {
      if (started) return
      audio.play().then(() => { started = true; cleanup() }).catch(() => {})
    }
    events.forEach(ev => window.addEventListener(ev, start, { capture: true, passive: true }))
    start()
    return cleanup
  }, [enabled])

  const onEnded = () => {
    const audio = audioRef.current
    indexRef.current = (indexRef.current + 1) % playlist.length
    audio.src = playlist[indexRef.current]
    audio.play().catch(() => {})
  }

  const toggle = (e) => {
    e.stopPropagation()
    const audio = audioRef.current
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem(MUSIC_KEY, next ? 'on' : 'off') } catch { /* ignore */ }
    if (next) audio.play().catch(() => {})
    else audio.pause()
  }

  return (
    <>
      <audio ref={(el) => { audioRef.current = el; if (el) el.volume = 0.35 }} src={playlist[0]} preload="none" onEnded={onEnded}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button type="button" className={`music${playing ? ' is-playing' : ''}`} onClick={toggle}
        aria-pressed={playing} aria-label={playing ? t.music.pause : t.music.play} title={playing ? t.music.pause : t.music.play}>
        {playing ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
        <span className="music-eq" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="music-label">{t.music.title}</span>
      </button>
    </>
  )
}

/* ── Motion helpers ───────────────────────────────────────────────────────── */

// Reveal [data-reveal] elements once they enter the viewport. Re-scans after every
// language change, because switching language re-creates many elements.
function useReveal(dep) {
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-reveal]:not(.is-in)')]
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-in')); return }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target) } })
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [dep])
}

// Thin progress bar along the top edge
function ScrollProgress() {
  const ref = useRef(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])
  return <div className="progress" aria-hidden="true"><i ref={ref} /></div>
}

// Writes pointer position (−1…1) into CSS variables for parallax / spotlight effects
function usePointerVars(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || window.matchMedia('(hover: none)').matches) return
    let frame = 0, x = 0, y = 0, px = 0, py = 0
    const apply = () => {
      frame = 0
      el.style.setProperty('--mx', x.toFixed(3)); el.style.setProperty('--my', y.toFixed(3))
      el.style.setProperty('--px', `${px}px`); el.style.setProperty('--py', `${py}px`)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      px = e.clientX - r.left; py = e.clientY - r.top
      x = (px / r.width) * 2 - 1; y = (py / r.height) * 2 - 1
      if (!frame) frame = requestAnimationFrame(apply)
    }
    el.addEventListener('pointermove', move)
    return () => el.removeEventListener('pointermove', move)
  }, [ref])
}

// Small 3D tilt on hover
function Tilt({ as: Tag = 'div', className = '', children, max = 8, ...rest }) {
  const ref = useRef(null)
  const onMove = (e) => {
    if (prefersReducedMotion()) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    ref.current.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`)
    ref.current.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`)
    ref.current.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
    ref.current.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
  }
  const onLeave = () => { ref.current.style.setProperty('--rx', '0deg'); ref.current.style.setProperty('--ry', '0deg') }
  return <Tag ref={ref} className={`tilt ${className}`} onPointerMove={onMove} onPointerLeave={onLeave} {...rest}>{children}</Tag>
}

// Counts up to `to` the first time it becomes visible
function CountUp({ to, duration = 1400 }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) { setValue(to); return } // eslint-disable-line react-hooks/set-state-in-effect
    let raf = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration)
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [to, duration])
  return <span ref={ref}>{value.toLocaleString()}</span>
}

/* ── Shared pieces ────────────────────────────────────────────────────────── */

function Wordmark() {
  return (
    <a className="wordmark" href="#top" aria-label="FUFU Pet Care">
      <Image src="/img/brand/fufu-mark.webp" alt="" width={44} height={44} priority />
      <span><b>FUFU</b><em>Pet Care</em></span>
    </a>
  )
}

function Heading({ title, em, id, center = false, light = false }) {
  return (
    <div className={`heading${center ? ' heading-center' : ''}${light ? ' heading-light' : ''}`} data-reveal="up">
      <h2 id={id}>{title} <em>{em}</em></h2>
    </div>
  )
}

/* ── Header ───────────────────────────────────────────────────────────────── */

const NAV_IDS = ['features', 'flow', 'partners', 'trust']

// Which section is in the middle of the viewport right now
function useActiveSection(ids) {
  const [active, setActive] = useState(null)
  useEffect(() => {
    const els = ids.map(id => document.getElementById(id)).filter(Boolean)
    const seen = new Map()
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => seen.set(en.target.id, en.isIntersecting))
      setActive(ids.find(id => seen.get(id)) || null)
    }, { rootMargin: '-45% 0px -50% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [ids])
  return active
}

function Header() {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const active = useActiveSection(NAV_IDS)
  const navRef = useRef(null)
  const [pill, setPill] = useState(null)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Slide the highlight pill under the active link
  useIsoLayoutEffect(() => {
    const nav = navRef.current
    const a = active && nav?.querySelector(`a[href="#${active}"]`)
    setPill(a ? { left: a.offsetLeft, width: a.offsetWidth } : null)
  }, [active, lang])
  const links = [['#features', t.nav.features], ['#flow', t.nav.flow], ['#partners', t.nav.partners], ['#trust', t.nav.trust]]
  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="header-inner">
        <Wordmark />
        <nav className="nav" aria-label="FUFU" ref={navRef}>
          <span className={`nav-pill${pill ? ' is-on' : ''}`} style={pill ? { transform: `translateX(${pill.left}px)`, width: pill.width } : undefined} aria-hidden="true" />
          {links.map(([href, label]) => (
            <a key={href} href={href} className={active === href.slice(1) ? 'is-active' : ''} aria-current={active === href.slice(1) ? 'location' : undefined}>{label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <a className="btn btn-ghost header-login" href="/login.html">{t.nav.login} <ArrowUpRight size={15} aria-hidden="true" /></a>
          <a className="btn btn-primary header-app" href={APP_URL} target="_blank" rel="noopener noreferrer">{t.app.short} <ArrowUpRight size={15} aria-hidden="true" /></a>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? t.nav.close : t.nav.menu} onClick={() => setOpen(o => !o)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <div id="mobile-menu" className={`mobile-menu${open ? ' is-open' : ''}`} hidden={!open}>
        {links.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)} className={active === href.slice(1) ? 'is-active' : ''}>{label}</a>
        ))}
        <a href={APP_URL} className="btn btn-primary" target="_blank" rel="noopener noreferrer">{t.app.open} <ArrowUpRight size={16} aria-hidden="true" /></a>
        <a href="/login.html" className="btn btn-ghost">{t.nav.login}</a>
      </div>
    </header>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

const PARTICLES = [
  { x: 6, d: 0, s: 18, k: 'paw' }, { x: 18, d: 3.2, s: 12, k: 'heart' }, { x: 31, d: 6.5, s: 15, k: 'paw' },
  { x: 47, d: 1.4, s: 11, k: 'heart' }, { x: 58, d: 4.8, s: 17, k: 'paw' }, { x: 71, d: 2.3, s: 13, k: 'heart' },
  { x: 83, d: 5.6, s: 16, k: 'paw' }, { x: 93, d: 0.8, s: 12, k: 'heart' },
]

function Particle({ k, s }) {
  return k === 'paw'
    ? <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><circle cx="6" cy="9" r="2.4" /><circle cx="10" cy="5.2" r="2.4" /><circle cx="14.6" cy="5.2" r="2.4" /><circle cx="18.6" cy="9" r="2.4" /><path d="M12.3 11c-3.4 0-6.3 3.4-6.3 6 0 2.1 1.6 2.9 3.2 2.5 1.2-.3 2-.9 3.1-.9s1.9.6 3.1.9c1.6.4 3.2-.4 3.2-2.5 0-2.6-2.9-6-6.3-6z" /></svg>
    : <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.9 4.5c2.2 0 3.6 1.2 5.1 3 1.5-1.8 2.9-3 5.1-3 3.9 0 6 4 4.5 7.3C19.5 16.4 12 21 12 21z" /></svg>
}

function Hero() {
  const { t } = useLang()
  const ref = useRef(null)
  usePointerVars(ref)
  return (
    <section className="hero" id="top" aria-labelledby="hero-title" ref={ref}>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <h1 id="hero-title">
            <span className="line"><span>{t.hero.title}</span></span>
            <span className="line"><em>{t.hero.titleEm}</em></span>
          </h1>
          <p className="lede" data-reveal="up">{t.hero.lede}</p>
          <div className="hero-actions" data-reveal="up">
            <a className="btn btn-primary btn-shine" href={APP_URL} target="_blank" rel="noopener noreferrer">{t.app.open} <ArrowUpRight size={17} aria-hidden="true" /></a>
            <a className="btn btn-ghost" href="#flow">{t.hero.cta} <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <p className="hero-note" data-reveal="up">{t.app.note}</p>
        </div>
        <figure className="hero-photo">
          <div className="hero-photo-frame">
            <Image src="/img/hero/pets-meadow.webp" alt={t.hero.photoAlt} fill priority sizes="(max-width: 900px) 90vw, 44vw" />
          </div>
          <figcaption className="hero-photo-caption">Happy Pet, Healthy Life</figcaption>
          <div className="hero-stamp" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs><path id="stamp-circle" d="M 60 60 m -46 0 a 46 46 0 1 1 92 0 a 46 46 0 1 1 -92 0" /></defs>
              <text><textPath href="#stamp-circle">FUFU PET CARE · HAPPY PETS · HEALTHY LIFE ·</textPath></text>
            </svg>
            <Image src="/img/brand/fufu-mark.webp" alt="" width={56} height={56} />
          </div>
        </figure>
      </div>
    </section>
  )
}

function Marquee() {
  const words = ['FROM HOME', 'TO THE CLINIC', 'CONNECTED CARE', 'HAPPY PET', 'HEALTHY LIFE']
  const row = [...words, ...words]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...row, ...row].map((w, i) => <span key={i}>{w}<i>✳</i></span>)}
      </div>
    </div>
  )
}


/* ── Animated section transitions: layered waves + a walking paw trail ─────── */

function wavePath(w, h, amp, period, phase = 0) {
  let d = `M 0 ${h} L 0 ${h / 2}`
  for (let x = 0; x <= w; x += 24) {
    const y = h / 2 + Math.sin((x / period) * Math.PI * 2 + phase) * amp
    d += ` L ${x} ${y.toFixed(1)}`
  }
  return d + ` L ${w} ${h} Z`
}
const WAVES = [
  { d: wavePath(2880, 100, 16, 720, 0), cls: 'w1' },
  { d: wavePath(2880, 100, 12, 480, 1.4), cls: 'w2' },
  { d: wavePath(2880, 100, 9, 960, 2.6), cls: 'w3' },
]

function Divider({ from, to, flip = false, paws = true }) {
  return (
    <div className={`divider${flip ? ' divider-flip' : ''}`} style={{ '--from': from, '--to': to }} aria-hidden="true">
      <svg viewBox="0 0 2880 100" preserveAspectRatio="none">
        {WAVES.map(w => <path key={w.cls} className={w.cls} d={w.d} />)}
      </svg>
      {paws && (
        <div className="paw-trail">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ '--i': i, left: `${8 + i * 10.5}%`, top: i % 2 ? '18%' : '42%' }}>
              <Particle k="paw" s={14} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Features ─────────────────────────────────────────────────────────────── */

const FEATURE_ICONS = [ScanLine, MessageCircleHeart, BookHeart, MapPin]

function Features() {
  const { t } = useLang()
  return (
    <section className="section features" id="features" aria-labelledby="features-title">
      <div className="wrap features-inner">
        <div>
          <Heading title={t.features.title} em={t.features.titleEm} id="features-title" />
          <div className="feature-grid">
            {t.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i]
              return (
                <Tilt key={i} className="feature" data-reveal="up" style={{ '--d': `${i * 90}ms` }}>
                  <span className="feature-icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Tilt>
              )
            })}
          </div>
          <a className="btn btn-primary feature-cta" href={APP_URL} target="_blank" rel="noopener noreferrer" data-reveal="up">{t.app.try} <ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        <div className="phones" aria-hidden="true" data-reveal="scale">
          <div className="phone-glow" />
          <div className="phone phone-back"><Image src="/img/app-screens/ai-vet.webp" alt="" width={324} height={698} /></div>
          <div className="phone phone-front"><Image src="/img/app-screens/home.webp" alt="" width={324} height={714} /></div>
        </div>
      </div>
    </section>
  )
}

/* ── Flow (swimlanes) ─────────────────────────────────────────────────────── */

const LANE_ORDER = ['owner', 'ai', 'clinic']
function House({ size = 16 }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg> }
const LANE_ICON = { owner: House, ai: ScanLine, clinic: Stethoscope }

function Flow() {
  const { t } = useLang()
  const steps = t.flow.steps
  const gridRef = useRef(null)
  const cardRefs = useRef([])
  const [active, setActive] = useState(0)
  const [path, setPath] = useState({ d: '', w: 0, h: 0 })
  const [paused, setPaused] = useState(false)

  // Slider between the care journey (0) and the system map (1)
  const [slide, setSlide] = useState(0)
  const [slideH, setSlideH] = useState(0)
  const viewportRef = useRef(null)
  const slideRefs = useRef([])
  const swipeRef = useRef(null)
  useEffect(() => {
    const el = slideRefs.current[slide]
    if (!el) return
    const update = () => setSlideH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slide])

  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const g = grid.getBoundingClientRect()
    const pts = cardRefs.current.filter(Boolean).map(el => {
      const r = el.getBoundingClientRect()
      return { l: r.left - g.left, r: r.right - g.left, cy: r.top - g.top + r.height / 2, cx: r.left - g.left + r.width / 2, top: r.top - g.top, bottom: r.bottom - g.top }
    })
    if (pts.length < 2) return
    const vertical = pts[1].top > pts[0].bottom - 2 && Math.abs(pts[1].cx - pts[0].cx) < 4
    let d = ''
    if (vertical) {
      d = `M -22 ${pts[0].top + 26} L -22 ${pts[pts.length - 1].top + 26}`
    } else {
      d = `M ${pts[0].r} ${pts[0].cy}`
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]
        const mx = (a.r + b.l) / 2
        if (Math.abs(a.cy - b.cy) < 1) d += ` L ${b.l} ${b.cy}`
        else {
          const dir = b.cy > a.cy ? 1 : -1, rr = 12
          d += ` L ${mx - rr} ${a.cy} Q ${mx} ${a.cy} ${mx} ${a.cy + dir * rr} L ${mx} ${b.cy - dir * rr} Q ${mx} ${b.cy} ${mx + rr} ${b.cy} L ${b.l} ${b.cy}`
        }
      }
    }
    setPath({ d, w: g.width, h: g.height })
  }, [])

  useIsoLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (gridRef.current) ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [measure, t])

  useEffect(() => {
    if (prefersReducedMotion() || paused) return
    let visible = false
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.25 })
    if (gridRef.current) io.observe(gridRef.current)
    const id = setInterval(() => { if (visible) setActive(a => (a + 1) % steps.length) }, 2600)
    return () => { clearInterval(id); io.disconnect() }
  }, [paused, steps.length])

  return (
    <section className="section flow" id="flow" aria-labelledby="flow-title">
      <div className="wrap">
        <div className="flow-head">
          <Heading title={t.flow.title} em={t.flow.titleEm} id="flow-title" />
          <p className="lede" key={slide}>{slide === 0 ? t.flow.lede : t.eco.lede}</p>
        </div>

        <div className="slider-bar" data-reveal="up">
          <div className="slider-tabs" role="tablist" aria-label={t.flow.title}>
            {[t.eco.tabs.journey, t.eco.tabs.system].map((label, i) => (
              <button key={i} type="button" role="tab" id={`flow-tab-${i}`} aria-controls={`flow-slide-${i}`} aria-selected={slide === i}
                className={slide === i ? 'is-active' : ''} onClick={() => setSlide(i)}
                onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setSlide(s => (s + 1) % 2) }}>
                {i === 0 ? <Workflow size={16} aria-hidden="true" /> : <Network size={16} aria-hidden="true" />}{label}
              </button>
            ))}
            <span className="slider-pill" style={{ '--x': slide }} aria-hidden="true" />
          </div>
          <div className="slider-arrows">
            <button type="button" aria-label={t.eco.prev} onClick={() => setSlide(s => (s + 1) % 2)}><ArrowLeft size={18} /></button>
            <button type="button" aria-label={t.eco.next} onClick={() => setSlide(s => (s + 1) % 2)}><ArrowRight size={18} /></button>
          </div>
        </div>

        <div className="slider-viewport" ref={viewportRef} style={{ height: slideH || undefined }}
          onPointerDown={(e) => { swipeRef.current = e.clientX }}
          onPointerUp={(e) => { const dx = e.clientX - (swipeRef.current ?? e.clientX); swipeRef.current = null; if (Math.abs(dx) > 70) setSlide(dx < 0 ? 1 : 0) }}>
        <div className="slider-track" style={{ '--slide': slide }}>
        <div className="slide" id="flow-slide-0" role="tabpanel" aria-labelledby="flow-tab-0" aria-hidden={slide !== 0} ref={el => { slideRefs.current[0] = el }}>
        <div className="flow-board" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} data-reveal="up">
          <ol className="flow-grid" ref={gridRef}>
            {LANE_ORDER.map((lane, k) => {
              const Icon = LANE_ICON[lane]
              return (
                <li key={lane} className={`flow-band flow-band-${lane}`} style={{ '--row': k + 1 }} aria-hidden="true">
                  <Icon size={16} /><span>{t.flow.lanes[lane]}</span>
                </li>
              )
            })}
            <svg className="flow-path" width={path.w} height={path.h} viewBox={`0 0 ${path.w || 1} ${path.h || 1}`} aria-hidden="true">
              <path d={path.d} className="flow-path-base" />
              <path d={path.d} className="flow-path-run" />
              {path.d && (
                <>
                  <circle r="9" className="flow-comet-glow"><animateMotion dur="9s" repeatCount="indefinite" path={path.d} /></circle>
                  <circle r="4.5" className="flow-comet"><animateMotion dur="9s" repeatCount="indefinite" path={path.d} /></circle>
                </>
              )}
            </svg>
            {steps.map((s, i) => {
              const Icon = LANE_ICON[s.lane]
              return (
                <li key={i} ref={el => { cardRefs.current[i] = el }}
                  className={`flow-step flow-step-${s.lane}${i === active ? ' is-active' : ''}${i < active ? ' is-done' : ''}`}
                  style={{ '--col': i + 1, '--row': LANE_ORDER.indexOf(s.lane) + 1 }}
                  onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} tabIndex={0}>
                  <span className="flow-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flow-tag"><Icon size={13} />{t.flow.lanes[s.lane]}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  {s.lane === 'ai' && (
                    <ul className="urgency" aria-label="urgency">
                      {t.flow.urgency.map((u, k) => <li key={u} className={`u${k}`}><i />{u}</li>)}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
        </div>
        <div className="slide" id="flow-slide-1" role="tabpanel" aria-labelledby="flow-tab-1" aria-hidden={slide !== 1} ref={el => { slideRefs.current[1] = el }}>
          <Ecosystem active={slide === 1} />
        </div>
        </div>
        </div>
      </div>
    </section>
  )
}


/* ── Ecosystem map: FUFU App ⇄ FUFU Cloud (+AI) ⇄ FUFU Partner ─────────────── */

// Two layouts share the same node / link ids. Coordinates are in each layout's own
// design space; nodes are placed with % so HTML boxes and SVG links scale together.
const ECO_LAYOUTS = {
  desktop: {
    W: 1200, H: 560,
    nodes: {
      app:     { x: 30,  y: 170, w: 300, h: 360 },
      api:     { x: 470, y: 270, w: 260, h: 250 },
      vision:  { x: 300, y: 40,  w: 190, h: 92 },
      vet:     { x: 505, y: 40,  w: 190, h: 92 },
      insight: { x: 710, y: 40,  w: 190, h: 92 },
      partner: { x: 870, y: 170, w: 300, h: 360 },
    },
    links: {
      'app-api':     'M 330 320 C 400 320 400 320 470 320',
      'api-app':     'M 470 450 C 400 450 400 450 330 450',
      'api-partner': 'M 730 320 C 800 320 800 320 870 320',
      'partner-api': 'M 870 450 C 800 450 800 450 730 450',
      'api-vision':  'M 560 270 C 560 200 395 210 395 132',
      'api-vet':     'M 600 270 C 600 210 600 190 600 132',
      'api-insight': 'M 640 270 C 640 200 805 210 805 132',
    },
  },
  mobile: {
    W: 360, H: 300,
    nodes: {
      vision:  { x: 4,   y: 0,   w: 110, h: 58 },
      vet:     { x: 125, y: 0,   w: 110, h: 58 },
      insight: { x: 246, y: 0,   w: 110, h: 58 },
      app:     { x: 0,   y: 120, w: 100, h: 150 },
      api:     { x: 130, y: 132, w: 100, h: 126 },
      partner: { x: 260, y: 120, w: 100, h: 150 },
    },
    links: {
      'app-api':     'M 100 170 C 115 170 115 170 130 170',
      'api-app':     'M 130 222 C 115 222 115 222 100 222',
      'api-partner': 'M 230 170 C 245 170 245 170 260 170',
      'partner-api': 'M 260 222 C 245 222 245 222 230 222',
      'api-vision':  'M 160 132 C 160 96 59 100 59 58',
      'api-vet':     'M 180 132 C 180 100 180 90 180 58',
      'api-insight': 'M 200 132 C 200 96 301 100 301 58',
    },
  },
}
const ECO_ENDS = {
  'app-api': ['app', 'api'], 'api-app': ['api', 'app'], 'api-partner': ['api', 'partner'], 'partner-api': ['partner', 'api'],
  'api-vision': ['api', 'vision'], 'api-vet': ['api', 'vet'], 'api-insight': ['api', 'insight'],
}
// Each journey: links that carry data (1 = forward, -1 = back along the link)
const ECO_JOURNEYS = [
  [['app-api', 1], ['api-vision', 1], ['api-vision', -1], ['api-app', 1]],
  [['app-api', 1], ['api-vet', 1], ['api-vet', -1], ['api-app', 1]],
  [['app-api', 1], ['api-partner', 1]],
  [['partner-api', 1], ['api-app', 1]],
  [['partner-api', 1], ['api-insight', 1], ['api-insight', -1], ['api-app', 1]],
]
const pct = (v, total) => `${(v / total) * 100}%`

function useMedia(query) {
  const [match, setMatch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

function Ecosystem({ active }) {
  const { t } = useLang()
  const e = t.eco
  const ref = useRef(null)
  const [step, setStep] = useState(0)
  const [hover, setHover] = useState(null)
  const [visible, setVisible] = useState(false)
  const compact = useMedia('(max-width: 900px)')
  const stepsRef = useRef(null)
  // Keep the active step visible in the horizontally scrolling step row (mobile)
  useEffect(() => {
    const row = stepsRef.current
    const btn = row?.children[step]
    if (row && btn && row.scrollWidth > row.clientWidth) row.scrollTo({ left: btn.offsetLeft - 12, behavior: 'smooth' })
  }, [step])
  const L = compact ? ECO_LAYOUTS.mobile : ECO_LAYOUTS.desktop

  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { threshold: 0.2 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!active || !visible || hover || prefersReducedMotion()) return
    const id = setTimeout(() => setStep(s => (s + 1) % ECO_JOURNEYS.length), 4600)
    return () => clearTimeout(id)
  }, [active, visible, hover, step])

  const journey = ECO_JOURNEYS[step]
  const hot = hover
    ? new Set(Object.keys(ECO_ENDS).filter(id => ECO_ENDS[id].includes(hover)))
    : new Set(journey.map(([id]) => id))
  const hotNodes = new Set([...hot].flatMap(id => ECO_ENDS[id]))
  const nodeProps = (id) => {
    const n = L.nodes[id]
    return {
      className: `eco-node eco-${id}${hotNodes.has(id) ? ' is-hot' : ''}`,
      style: { left: pct(n.x, L.W), top: pct(n.y, L.H), width: pct(n.w, L.W), height: pct(n.h, L.H) },
      onMouseEnter: () => setHover(id), onMouseLeave: () => setHover(null),
    }
  }
  const aiIcons = [Eye, Bot, Activity]
  const apiIcons = [KeyRound, Database, Images, Bell]
  const names = { app: e.app.title, api: e.api.title, vision: e.ai[0].title, vet: e.ai[1].title, insight: e.ai[2].title, partner: e.partner.title }
  const route = [...new Set(journey.flatMap(([id, dir]) => (dir > 0 ? ECO_ENDS[id] : [...ECO_ENDS[id]].reverse())))]

  return (
    <div className={`eco${active ? ' is-active' : ''}${compact ? ' is-compact' : ''}`} ref={ref}>
      <div className="eco-panel">
        <div className="eco-cols" aria-hidden="true">
          {[['app', e.cols.owner], ['api', e.cols.cloud], ['partner', e.cols.partner]].map(([id, label]) => (
            <span key={id} style={{ left: pct(L.nodes[id].x, L.W), width: pct(L.nodes[id].w, L.W) }}>{label}</span>
          ))}
        </div>

        <div className="eco-map" style={{ aspectRatio: `${L.W} / ${L.H}` }}>
          <svg className="eco-links" viewBox={`0 0 ${L.W} ${L.H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="eco-grad" x1="0" x2="1"><stop offset="0" stopColor="#80c9c0" /><stop offset="1" stopColor="#f0865e" /></linearGradient>
            </defs>
            {Object.entries(L.links).map(([id, d]) => (
              <g key={id} className={`eco-link${hot.has(id) ? ' is-hot' : ''}`}>
                <path d={d} className="eco-link-base" vectorEffect="non-scaling-stroke" />
                <path d={d} className="eco-link-flow" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
            {!hover && journey.map(([id, dir], i) => (
              [0, 1].map(k => (
                <circle key={`${compact}-${step}-${id}-${dir}-${k}`} r={k ? (compact ? 3 : 4.5) : (compact ? 6 : 9)} className={k ? 'eco-packet' : 'eco-packet-glow'}>
                  <animateMotion dur="1.8s" begin={`${i * 0.45}s`} repeatCount="indefinite" path={L.links[id]}
                    keyPoints={dir > 0 ? '0;1' : '1;0'} keyTimes="0;1" calcMode="linear" />
                </circle>
              ))
            ))}
          </svg>

          <div {...nodeProps('app')}>
            <div className="eco-head"><span className="eco-icon"><Smartphone size={18} /></span><div><b>{e.app.title}</b><small>{e.app.sub}</small></div></div>
            <div className="eco-phone">
              <Image src="/img/brand/fufu-mark.webp" alt="" width={34} height={34} />
              <ul>{e.app.items.map((it, i) => <li key={it} style={{ '--i': i }}>{it}</li>)}</ul>
            </div>
          </div>

          {['vision', 'vet', 'insight'].map((id, i) => {
            const Icon = aiIcons[i]
            return (
              <div key={id} {...nodeProps(id)}>
                <span className="eco-icon eco-icon-ai"><Icon size={17} /></span>
                <div><b>{e.ai[i].title}</b><small>{e.ai[i].sub}</small></div>
              </div>
            )
          })}

          <div {...nodeProps('api')}>
            <div className="eco-head"><span className="eco-icon eco-icon-cloud"><Cloud size={18} /></span><div><b>{e.api.title}</b><small>{e.api.sub}</small></div></div>
            <ul className="eco-services">
              {e.api.items.map((it, i) => { const Icon = apiIcons[i]; return <li key={it}><Icon size={14} />{it}</li> })}
            </ul>
          </div>

          <div {...nodeProps('partner')}>
            <div className="eco-head"><span className="eco-icon eco-icon-partner"><LayoutDashboard size={18} /></span><div><b>{e.partner.title}</b><small>{e.partner.sub}</small></div></div>
            <div className="eco-kinds">{e.partner.kinds.map(k => <span key={k}>{k}</span>)}</div>
            <ul className="eco-features">{e.partner.items.map((it, i) => <li key={it} style={{ '--i': i }}><Check size={13} />{it}</li>)}</ul>
          </div>
        </div>

        <div className="eco-story" key={step}>
          <p>{e.journeys[step].body}</p>
          <div className="eco-route">
            {route.map((id, i) => <span key={id} style={{ '--i': i }}>{names[id]}</span>)}
          </div>
        </div>
      </div>

      <div className="eco-steps" role="tablist" aria-label={e.tabs.system} ref={stepsRef}>
        {e.journeys.map((j, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === step} className={i === step ? 'is-active' : ''} onClick={() => { setHover(null); setStep(i) }}>
            <span className="eco-step-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="eco-step-title">{j.title}</span>
            {i === step && active && <span className="eco-step-bar" key={step} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Free launch ──────────────────────────────────────────────────────────── */

function FreeLaunch() {
  const { t } = useLang()
  const f = t.free
  const d = t.donate
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(DONATION.accountNumber.replace(/-/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch { /* the number stays selectable */ }
  }
  return (
    <section className="free" aria-labelledby="free-title">
      <div className="wrap">
        <Tilt className="free-card" max={4} data-reveal="scale">
          <div className="free-badge"><span>{f.badge}</span></div>
          <div className="free-copy">
            <h2 id="free-title">{f.title} <em>{f.titleEm}</em></h2>
            <p>{f.body}</p>
          </div>
          <button type="button" className="free-donate" aria-expanded={open} aria-controls="donate-panel" onClick={() => setOpen(o => !o)}>
            <HeartHandshake size={22} aria-hidden="true" /><span>{open ? d.close : d.open}</span>
            <ChevronDown size={18} aria-hidden="true" className={open ? 'free-chev is-open' : 'free-chev'} />
          </button>
          <Image className="free-mascot" src="/img/mascot/cat-cheer.webp" alt="" width={340} height={424} aria-hidden="true" />
        </Tilt>

        <div id="donate-panel" className={open ? 'donate-panel is-open' : 'donate-panel'} hidden={!open}>
          <div className="donate-bank">
            <div className="donate-bank-head">
              <Image src={DONATION.bankLogo} alt="" width={44} height={44} />
              <div><small>{d.title}</small><b>{d.bank}</b></div>
            </div>
            <dl>
              <div><dt>{d.name}</dt><dd>{DONATION.accountName}</dd></div>
              <div><dt>{d.number}</dt><dd className="donate-number">{DONATION.accountNumber}</dd></div>
            </dl>
            <button type="button" className="btn btn-primary donate-copy" onClick={copy}>
              {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />} {copied ? d.copied : d.copy}
            </button>
            <p className="donate-note" role="status">{d.note}</p>
          </div>
          <div className="donate-paypal">
            <p className="donate-pp-title"><QrCode size={18} aria-hidden="true" /> {d.ppTitle}</p>
            <Image src={DONATION.paypalQr} alt={d.ppTitle} width={438} height={438} className="donate-qr" />
            <p className="donate-note">{d.ppNote}</p>
            <a className="btn btn-ghost donate-save" href={DONATION.paypalQr} download>{d.ppSave}</a>
          </div>
          <div className="donate-side">
            <ul className="donate-uses">
              {d.uses.map((u, i) => <li key={u}><span>{i + 1}</span>{u}</li>)}
            </ul>
            <a className="donate-link" href={`mailto:${DONATION.email}`}><Mail size={18} aria-hidden="true" /> {d.ask}<small>{DONATION.email}</small></a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Mascots ──────────────────────────────────────────────────────────────── */

function Pal({ kind, src, w, h, says, info }) {
  const [i, setI] = useState(0)
  const [boing, setBoing] = useState(0)
  const [hearts, setHearts] = useState([])
  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setI(n => (n + 1) % says.length), 3400 + (kind === 'cat' ? 900 : 0))
    return () => clearInterval(id)
  }, [says.length, kind])
  const poke = () => {
    setI(n => (n + 1) % says.length)
    setBoing(b => b + 1)
    const id = Date.now()
    setHearts(hs => [...hs.slice(-6), ...[0, 1, 2].map(k => ({ id: `${id}-${k}`, x: (k - 1) * 34 + Math.round(Math.random() * 16 - 8) }))])
    setTimeout(() => setHearts(hs => hs.filter(hh => !hh.id.startsWith(String(id)))), 1300)
  }
  return (
    <article className={`pal pal-${kind}`} data-reveal="up">
      <button type="button" className="pal-stage" onClick={poke} aria-label={`${info.name} — ${says[i]}`}>
        <span className="pal-bubble" key={`${i}-${says[i]}`}>{says[i]}</span>
        <span className="pal-shadow" />
        <Image key={boing} className={`pal-img${boing ? ' is-boing' : ''}`} src={src} alt={info.name} width={w} height={h} />
        {hearts.map(hh => <span key={hh.id} className="pal-heart" style={{ '--hx': `${hh.x}px` }}>♥</span>)}
      </button>
      <h3>{info.name}</h3>
      <b>{info.tag}</b>
      <p>{info.body}</p>
    </article>
  )
}

const STICKERS = ['dog-run', 'cat-roll', 'dog-reading', 'cat-box', 'dog-toy', 'cat-lounge', 'dog-wink', 'cat-sleep', 'duo-sleep']

function Mascots() {
  const { t } = useLang()
  const m = t.mascots
  return (
    <section className="section mascots" id="mascots" aria-labelledby="mascots-title">
      <div className="mascot-bg" aria-hidden="true">
        {STICKERS.map((s, i) => (
          <span key={s} className="mascot-float" style={{ '--i': i }}>
            <Image src={`/img/mascot/${s}.webp`} alt="" width={180} height={160} />
          </span>
        ))}
      </div>
      <div className="wrap">
        <Heading title={m.title} em={m.titleEm} id="mascots-title" center />
        <p className="hint" data-reveal="up">👆 {m.hint}</p>
        <div className="pal-grid">
          <Pal kind="dog" src="/img/mascot/dog-sit.webp" w={311} h={416} says={m.dogSays} info={m.dog} />
          <Pal kind="cat" src="/img/mascot/cat-sit.webp" w={328} h={408} says={m.catSays} info={m.cat} />
        </div>
      </div>
    </section>
  )
}

/* ── Partners: animated back-office preview ───────────────────────────────── */

const BENEFIT_ICONS = [Users, ClipboardCheck, CalendarDays, BellRing]

function DashboardMock({ mk }) {
  const rows = [
    { time: '09:30', pet: 'Mochi', who: 'Golden · 2y', ok: true },
    { time: '11:00', pet: 'Latte', who: 'Scottish Fold · 3y', ok: false },
    { time: '14:15', pet: 'Kuma', who: 'Shih Tzu · 5y', ok: true },
  ]
  const bars = [38, 56, 44, 72, 64, 88, 76]
  return (
    <div className="dash" aria-hidden="true">
      <div className="dash-chrome"><i /><i /><i /><span>partner.fufu.app</span></div>
      <div className="dash-body">
        <aside className="dash-side">
          <Image src="/img/brand/fufu-mark.webp" alt="" width={28} height={28} />
          <span className="is-on"><LayoutDashboard size={15} /></span>
          <span><CalendarDays size={15} /></span>
          <span><ScanLine size={15} /></span>
          <span><Users size={15} /></span>
          <span><Store size={15} /></span>
        </aside>
        <div className="dash-main">
          <div className="dash-kpis">
            <div><small>{mk.today}</small><b><CountUp to={18} /></b></div>
            <div><small>{mk.pending}</small><b className="is-warn"><CountUp to={4} /></b></div>
            <div><small>{mk.referrals}</small><b className="is-accent"><CountUp to={3} /></b></div>
          </div>

          <div className="dash-referral">
            <div className="dash-ref-photo"><Image src="/img/mascot/cat-curious.webp" alt="" width={120} height={150} /><span className="dash-scan" /></div>
            <div className="dash-ref-info">
              <small>{mk.referralTitle}</small>
              <b>{mk.pet}</b>
              <span>{mk.concern}</span>
              <em><i />{mk.urgency}</em>
            </div>
            <span className="dash-accept">{mk.accept}</span>
          </div>

          <div className="dash-cols">
            <div className="dash-list">
              <small>{mk.schedule}</small>
              {rows.map((r, i) => (
                <div key={r.pet} className="dash-row" style={{ '--d': `${0.5 + i * 0.18}s` }}>
                  <time>{r.time}</time><div><b>{r.pet}</b><span>{r.who}</span></div>
                  <em className={r.ok ? 'is-ok' : 'is-wait'}>{r.ok ? mk.confirmed : mk.waiting}</em>
                </div>
              ))}
            </div>
            <div className="dash-chart">
              <small>{mk.week}</small>
              <div className="dash-bars">{bars.map((b, i) => <i key={i} style={{ '--h': `${b}%`, '--d': `${0.4 + i * 0.07}s` }} />)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="dash-toast"><BellRing size={15} /><span>{mk.referrals} +1</span></div>
    </div>
  )
}

function Partners() {
  const { t } = useLang()
  const p = t.partners
  const ref = useRef(null)
  usePointerVars(ref)
  return (
    <section className="section partners" id="partners" aria-labelledby="partners-title" ref={ref}>
      <div className="spotlight" aria-hidden="true" />
      <div className="wrap partners-inner">
        <div className="partners-copy">
          <span className="chip-free" data-reveal="up"><Check size={14} aria-hidden="true" />{p.freeChip}</span>
          <Heading title={p.title} em={p.titleEm} id="partners-title" light />
          <p className="lede" data-reveal="up">{p.lede}</p>
          <ul className="benefits">
            {p.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i]
              return (
                <li key={i} data-reveal="up" style={{ '--d': `${i * 90}ms` }}>
                  <span className="benefit-icon"><Icon size={18} aria-hidden="true" /></span>
                  <div><h3>{b.title}</h3><p>{b.body}</p></div>
                </li>
              )
            })}
          </ul>
          <div className="partner-actions" data-reveal="up">
            <a className="btn btn-light btn-shine" href="/register.html">{p.join} <ArrowRight size={16} aria-hidden="true" /></a>
            <a className="btn btn-outline-light" href="/login.html">{p.login} <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="partners-visual" data-reveal="scale">
          <DashboardMock mk={p.mock} />
        </div>
      </div>
    </section>
  )
}

/* ── Copyright ────────────────────────────────────────────────────────────── */

function Trust() {
  const { t } = useLang()
  const tr = t.trust
  return (
    <section className="section trust" id="trust" aria-labelledby="trust-title">
      <div className="wrap">
        <div className="trust-head">
          <Heading title={tr.title} em={tr.titleEm} id="trust-title" />
          <div className="trust-side" data-reveal="up">
            <p className="lede">{tr.lede}</p>
            <div className="tech"><span>{tr.tech}</span><b>YOLO</b><b>LSTM</b><b>NLP</b></div>
          </div>
        </div>
        <ol className="cert-grid">
          {tr.works.map((w, i) => (
            <Tilt as="li" key={REGISTRY[i]} className="cert" max={6} data-reveal="up" style={{ '--d': `${i * 110}ms` }}>
              <div className="cert-inner">
                <div className="cert-top">
                  <span className="cert-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="cert-stamp"><BadgeCheck size={15} aria-hidden="true" />{tr.badge}</span>
                </div>
                <h3>{w.title}</h3>
                <p>{tr.kinds[i]}</p>
                <dl>
                  <div><dt>{tr.registry}</dt><dd>{REGISTRY[i]}</dd></div>
                  <div><dt>{tr.request}</dt><dd>{REQUESTS[i]}</dd></div>
                  <div className="cert-wide"><dt>{tr.filed}</dt><dd>{w.filed}</dd></div>
                </dl>
              </div>
            </Tilt>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ── Footer ───────────────────────────────────────────────────────────────── */

function Footer() {
  const { t } = useLang()
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <Image src="/img/brand/fufu-logo.webp" alt="FUFU Pet Care — Happy Pets · Healthy Life" width={120} height={126} />
          <p>{t.footer.tagline}</p>
        </div>
        <nav aria-label="footer">
          <a href="#features">{t.nav.features}</a>
          <a href="#flow">{t.nav.flow}</a>
          <a href="#partners">{t.nav.partners}</a>
          <a href="#trust">{t.nav.trust}</a>
          <a href="https://youtu.be/jqXMGu-MSQA" target="_blank" rel="noopener noreferrer">{t.footer.songs} ↗</a>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer">{t.app.open} ↗</a>
          <a href="/login.html">{t.nav.login} ↗</a>
        </nav>
      </div>
      <div className="wrap footer-bottom">© 2026 FUFU Pet Care · KITTEN CODE Co., Ltd. · {t.footer.rights}</div>
    </footer>
  )
}

function Page() {
  const { lang } = useLang()
  useReveal(lang)
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ScrollProgress />
      <Header />
      <main id="main">
        <Hero />
        <Marquee />
        <Features />
        <Divider from="var(--cream)" to="var(--paper)" />
        <Flow />
        <Divider from="var(--paper)" to="var(--cream)" paws={false} />
        <FreeLaunch />
        <Divider from="var(--cream)" to="var(--brand-900)" />
        <Partners />
        <Divider from="var(--brand-900)" to="var(--cream)" flip paws={false} />
        <Trust />
        <Divider from="#f3efe7" to="var(--cream)" />
        <Mascots />
        <Divider from="var(--cream)" to="var(--paper)" paws={false} />
      </main>
      <Footer />
      <MusicPlayer />
    </>
  )
}

export default function Landing() {
  return <LangProvider><Page /></LangProvider>
}
