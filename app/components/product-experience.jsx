'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ChevronDown, ChevronUp, HeartPulse, ScanLine, Stethoscope, Store, UsersRound } from 'lucide-react'

const storySteps = [
  { id: 'home', label: '01 · ดูแลทุกวัน', title: 'รู้จักน้องและดูแลทุกวัน', body: 'โปรไฟล์ ประวัติสุขภาพ และวัคซีนของน้อง พร้อมทางลัดไปยังสัตวแพทย์และบริการดูแล', image: '/img/fufu-app-home.webp', imageAlt: 'หน้าจอ Home ของ FUFU App แสดงเมนูและโปรไฟล์สัตว์เลี้ยง', details: ['โปรไฟล์และประวัติสุขภาพ', 'วัคซีนและบริการใกล้ตัว'] },
  { id: 'scan', label: '02 · คัดกรองอาการ', title: 'สังเกตอาการอย่างเป็นขั้นตอน', body: 'ถ่ายภาพบริเวณที่กังวลและตอบคำถามอาการ เพื่อรับแนวทางความเร่งด่วนเบื้องต้น', image: '/img/fufu-app-scan.webp', imageAlt: 'หน้าจอเลือกสัตว์เลี้ยงเพื่อเริ่มขั้นตอนคัดกรองใน FUFU App', details: ['ผิวหนัง · ดวงตา · หู · ฟัน', 'แนวทางความเร่งด่วน 4 ระดับ'] },
  { id: 'questions', label: '03 · เพิ่มบริบท', title: 'ภาพเดียวไม่ใช่เรื่องราวทั้งหมด', body: 'ตอบคำถามเพิ่มเติมประกอบภาพ และเลือกส่งข้อมูลให้คลินิกได้เมื่อเจ้าของยินยอม', image: '/img/fufu-app-questions.webp', imageAlt: 'หน้าจอคำถามอาการ 5 ข้อในกระบวนการคัดกรองของ FUFU App', details: ['คำถามอาการตามบริเวณ', 'ส่งต่อข้อมูลให้คลินิกได้'] },
]

const ecosystemItems = [
  { id: 'owner', title: 'เจ้าของสัตว์เลี้ยง', eyebrow: 'AT HOME', copy: 'เก็บเรื่องราวสุขภาพ สังเกตอาการ และเลือกบริการที่เหมาะกับน้อง', Icon: UsersRound },
  { id: 'fufu', title: 'FUFU App + AI', eyebrow: 'SCREEN & CONNECT', copy: 'รวมโปรไฟล์สุขภาพ การคัดกรองเบื้องต้น และเส้นทางส่งต่อที่เจ้าของควบคุมได้', Icon: ScanLine },
  { id: 'clinic', title: 'คลินิกพันธมิตร', eyebrow: 'CARE TEAMS', copy: 'ทบทวนเคสที่ได้รับความยินยอม จัดการนัดหมาย และสรุปการเข้ารับบริการ', Icon: Stethoscope },
  { id: 'services', title: 'บริการสัตว์เลี้ยง', eyebrow: 'LOCAL NETWORK', copy: 'ค้นพบร้านค้า ร้านตัดแต่งขน และโรงแรมสัตว์เลี้ยงในเครือข่าย', Icon: Store },
]

export function HeroMotion() {
  const rootRef = useRef(null)

  useEffect(() => {
    let context
    let cancelled = false
    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      const stageElement = document.querySelector('.hero-stage')
      if (cancelled || !stageElement) return
      rootRef.current = stageElement
      gsap.registerPlugin(ScrollTrigger)
      context = gsap.context(() => {
        const media = gsap.matchMedia()
        media.add('(prefers-reduced-motion: no-preference)', () => {
          const heroCopy = rootRef.current.closest('.hero')?.querySelector('.hero-copy')
          if (heroCopy) {
            gsap.fromTo([...heroCopy.children], { autoAlpha: 0, y: 18 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.72,
              stagger: 0.1,
              ease: 'power3.out',
              delay: 0.08,
            })
          }

          const revealTargets = gsap.utils.toArray([
            '.app-story-section .story-intro',
            '.ai-section .ai-copy',
            '.ai-section .ai-visual',
            '.ai-section .urgency-panel',
            '.ecosystem-heading',
            '.partner-intro',
            '.partner-network',
            '.closing-copy',
            '.footer-main',
          ])
          revealTargets.forEach(target => {
            gsap.fromTo(target, { autoAlpha: 0, y: 22 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.62,
              ease: 'power2.out',
              immediateRender: false,
              scrollTrigger: { trigger: target, start: 'top 88%', once: true },
            })
          })

          const workflowRows = gsap.utils.toArray('.partner-workflow')
          if (workflowRows.length) {
            gsap.fromTo(workflowRows, { autoAlpha: 0, x: 16 }, {
              autoAlpha: 1,
              x: 0,
              duration: 0.48,
              stagger: 0.08,
              ease: 'power2.out',
              immediateRender: false,
              scrollTrigger: { trigger: '.partner-platform', start: 'top 86%', once: true },
            })
          }

          const closingImage = document.querySelector('.closing-cta > img')
          if (closingImage && window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)').matches) {
            gsap.to(closingImage, {
              yPercent: -6,
              ease: 'none',
              scrollTrigger: { trigger: '.closing-cta', start: 'top bottom', end: 'bottom top', scrub: 0.6 },
            })
          }

          const stage = rootRef.current
          const photo = stage.querySelector('.hero-photo-main')
          if (!photo) return
          gsap.fromTo(photo, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 1, ease: 'power3.out', delay: 0.12 })
          gsap.to(photo, { y: -18, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 0.5 } })

          if (window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 981px)').matches) {
            const rotateX = gsap.quickTo(photo, 'rotateX', { duration: 0.6, ease: 'power3.out' })
            const rotateY = gsap.quickTo(photo, 'rotateY', { duration: 0.6, ease: 'power3.out' })
            const onMove = event => {
              const bounds = stage.getBoundingClientRect()
              const x = (event.clientX - bounds.left) / bounds.width - 0.5
              const y = (event.clientY - bounds.top) / bounds.height - 0.5
              rotateX(2 - y * 3)
              rotateY(x * 4)
            }
            const onLeave = () => { rotateX(0); rotateY(0) }
            stage.addEventListener('pointermove', onMove)
            stage.addEventListener('pointerleave', onLeave)
            return () => {
              stage.removeEventListener('pointermove', onMove)
              stage.removeEventListener('pointerleave', onLeave)
            }
          }
        })
        return () => media.revert()
      }, rootRef)
    }
    setup()
    return () => { cancelled = true; context?.revert() }
  }, [])

  return null
}

export function AppStory() {
  const carouselRef = useRef(null)
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
      if (entry.isIntersecting && !reducedMotion.matches) setIsPlaying(true)
    }, { threshold: 0.25 })
    observer.observe(carousel)
    const updatePageVisibility = () => setIsPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', updatePageVisibility)
    const stopForReducedMotion = event => { if (event.matches) setIsPlaying(false) }
    reducedMotion.addEventListener('change', stopForReducedMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', updatePageVisibility)
      reducedMotion.removeEventListener('change', stopForReducedMotion)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || !isVisible || !isPageVisible || isHovered || isFocused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setTimeout(() => {
      setDirection(1)
      setActive(index => (index + 1) % storySteps.length)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [active, isFocused, isHovered, isPageVisible, isPlaying, isVisible])

  const selectStep = (index, motionDirection = index >= active ? 1 : -1) => {
    setDirection(motionDirection)
    setActive(index)
    setAnnouncement(`หน้าจอที่ ${index + 1} จาก ${storySteps.length}: ${storySteps[index].title}`)
  }
  const move = amount => selectStep((active + amount + storySteps.length) % storySteps.length, amount)
  const step = storySteps[active]

  return (
    <div
      className="app-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="แนะนำฟังก์ชัน FUFU App"
      ref={carouselRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false) }}
    >
      <div className="app-carousel-visual">
        <div className="story-stage-label">FUFU APP</div>
        <div className="story-device" role="img" aria-label={`หน้าจอ FUFU App: ${step.imageAlt}`}>
          <div className="story-device-bezel">
            <div key={step.id} className={`story-phone-screen ${direction > 0 ? 'story-screen-enter-from-right' : 'story-screen-enter-from-left'}`}>
              <Image src={step.image} alt="" fill sizes="(max-width: 760px) 62vw, 25vw" />
            </div>
          </div>
          <span className="story-device-side" aria-hidden="true" />
        </div>
      </div>

      <div className="app-carousel-content">
        <div className="story-copy-window" role="group" aria-label="ฟังก์ชัน FUFU App">
          <article key={step.id} className={`story-copy-slide ${direction > 0 ? 'story-enter-up' : 'story-enter-down'}`}>
            <span className="story-chapter-index">{step.label}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <ul>{step.details.map(detail => <li key={detail}><i aria-hidden="true" />{detail}</li>)}</ul>
          </article>
        </div>
        <div className="story-carousel-controls" role="group" aria-label="ควบคุมภาพแนะนำ FUFU App">
          <div className="story-carousel-arrows">
            <button className="story-control-arrow" type="button" aria-label="ย้อนกลับหนึ่งขั้น" onClick={() => move(-1)}><ChevronUp size={20} aria-hidden="true" /></button>
            <div className="story-carousel-dots" role="group" aria-label="เลือกหน้าจอแอป">
            {storySteps.map((item, index) => <button key={item.id} type="button" className={index === active ? 'is-active' : ''} aria-label={`แสดง ${item.label}`} aria-current={index === active ? 'step' : undefined} onClick={() => selectStep(index)} />)}
          </div>
            <button className="story-control-arrow" type="button" aria-label="ไปข้างหน้าหนึ่งขั้น" onClick={() => move(1)}><ChevronDown size={20} aria-hidden="true" /></button>
          </div>
          
        </div>
        <span className="visually-hidden" role="status" aria-live="polite">{announcement}</span>
      </div>
    </div>
  )
}

export function EcosystemMap() {
  const ref = useRef(null)
  const [active, setActive] = useState('fufu')
  const selected = ecosystemItems.find(item => item.id === active) ?? ecosystemItems[1]

  useEffect(() => {
    let context
    let cancelled = false
    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)
      context = gsap.context(() => {
        const media = gsap.matchMedia()
        media.add('(prefers-reduced-motion: no-preference)', () => {
          gsap.from('[data-ecosystem-node]', { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out', scrollTrigger: { trigger: ref.current, start: 'top 72%' } })
          const visiblePaths = [...ref.current.querySelectorAll('[data-ecosystem-path]')].filter(path => getComputedStyle(path).display !== 'none')
          gsap.fromTo(visiblePaths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.85, stagger: 0.12, ease: 'power2.out', scrollTrigger: { trigger: ref.current, start: 'top 70%' } })
        })
        return () => media.revert()
      }, ref)
    }
    setup()
    return () => { cancelled = true; context?.revert() }
  }, [])

  return (
    <div className="ecosystem-map section-wrap" ref={ref}>
      <div className="ecosystem-canvas">
        <svg className="ecosystem-lines ecosystem-lines-desktop" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" data-ecosystem-path d="M290 205 H355" /><path pathLength="1" data-ecosystem-path d="M645 205 H710" />
          <path pathLength="1" data-ecosystem-path d="M500 81 V156" /><path pathLength="1" data-ecosystem-path d="M500 258 V340 C500 390 440 439 330 439" />
          <circle className="ecosystem-signal" cx="322" cy="205" r="5" /><circle className="ecosystem-signal signal-two" cx="677" cy="205" r="5" />
        </svg>
        <svg className="ecosystem-lines ecosystem-lines-mobile" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" data-ecosystem-path d="M500 73 V140" /><path pathLength="1" data-ecosystem-path d="M500 213 V280" /><path pathLength="1" data-ecosystem-path d="M500 353 V427" />
          <circle className="ecosystem-signal" cx="500" cy="124" r="5" /><circle className="ecosystem-signal signal-two" cx="500" cy="244" r="5" />
        </svg>
        <button className={`ecosystem-node node-owner${active === 'owner' ? ' is-selected' : ''}`} type="button" data-ecosystem-node aria-pressed={active === 'owner'} onClick={() => setActive('owner')} onFocus={() => setActive('owner')} onMouseEnter={() => setActive('owner')}><UsersRound size={23} aria-hidden="true" /><span><small>AT HOME</small><b>เจ้าของและสัตว์เลี้ยง</b></span></button>
        <button className={`ecosystem-node node-fufu${active === 'fufu' ? ' is-selected' : ''}`} type="button" data-ecosystem-node aria-pressed={active === 'fufu'} onClick={() => setActive('fufu')} onFocus={() => setActive('fufu')} onMouseEnter={() => setActive('fufu')}><ScanLine size={25} aria-hidden="true" /><span><small>SCREEN &amp; CONNECT</small><b>FUFU App + AI</b></span></button>
        <button className={`ecosystem-node node-clinic${active === 'clinic' ? ' is-selected' : ''}`} type="button" data-ecosystem-node aria-pressed={active === 'clinic'} onClick={() => setActive('clinic')} onFocus={() => setActive('clinic')} onMouseEnter={() => setActive('clinic')}><Stethoscope size={23} aria-hidden="true" /><span><small>CARE TEAMS</small><b>คลินิกพันธมิตร</b></span></button>
        <button className={`ecosystem-node node-services${active === 'services' ? ' is-selected' : ''}`} type="button" data-ecosystem-node aria-pressed={active === 'services'} onClick={() => setActive('services')} onFocus={() => setActive('services')} onMouseEnter={() => setActive('services')}><Store size={23} aria-hidden="true" /><span><small>LOCAL NETWORK</small><b>ร้านค้าและบริการ</b></span></button>
        <div className="ecosystem-center-mark" aria-hidden="true"><Image src="/img/fufu-mark.webp" alt="" width={54} height={54} /></div>
      </div>
      <div className="ecosystem-readout" aria-live="polite"><span>{selected.eyebrow}</span><h3>{selected.title}</h3><p>{selected.copy}</p><ArrowDownRight size={20} aria-hidden="true" /></div>
      <div className="ecosystem-legend"><span><i className="legend-owner" />เจ้าของ</span><span><i className="legend-ai" />FUFU + AI</span><span><i className="legend-partner" />พาร์ทเนอร์</span></div>
    </div>
  )
}
