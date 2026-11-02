'use client'

import { useEffect, useRef, useState } from 'react'

const items = [
  { label: 'หน้าแรก', href: '#top' },
  { label: 'FUFU App', href: '#app-story' },
  { label: 'AI Care', href: '#ai-care' },
  { label: 'Ecosystem', href: '#ecosystem' },
  { label: 'สำหรับพาร์ทเนอร์', href: '#partners' },
]

const sections = items.map((item, index) => ({ id: item.href.slice(1), index }))

export default function ActiveNavigation() {
  const navRef = useRef(null)
  const indicatorRef = useRef(null)
  const linksRef = useRef([])
  const gsapRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const visualIndexRef = useRef(0)
  const initializedRef = useRef(false)
  const [visualIndex, setVisualIndex] = useState(0)
  const [indicatorReady, setIndicatorReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let frame = 0
    let pendingAnimate = false
    let pendingRefresh = false

    const update = () => {
      frame = 0
      const animate = pendingAnimate
      const refresh = pendingRefresh
      pendingAnimate = false
      pendingRefresh = false
      const nav = navRef.current
      const indicator = indicatorRef.current
      if (!nav || !indicator) return

      const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0
      const activationLine = headerBottom + Math.min(180, window.innerHeight * 0.2)
      const anchors = sections.map(({ id, index }) => ({
        index,
        top: document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      })).filter(anchor => Number.isFinite(anchor.top))

      let active = anchors[0]?.index ?? 0
      for (const anchor of anchors) {
        if (activationLine >= anchor.top) active = anchor.index
      }
      const scrollingElement = document.scrollingElement
      const isAtPageEnd = scrollingElement
        && scrollingElement.scrollTop + window.innerHeight >= scrollingElement.scrollHeight - 2
      if (isAtPageEnd && anchors.length) {
        active = anchors.at(-1).index
      }

      const changed = activeIndexRef.current !== active
      if (changed) {
        activeIndexRef.current = active
        setActiveIndex(active)
      }
      if ((!changed && !refresh) || !gsapRef.current) return

      const targetLink = linksRef.current[active]
      if (!targetLink) return

      const navRect = nav.getBoundingClientRect()
      const box = targetLink.getBoundingClientRect()
      const target = {
        left: box.left - navRect.left - nav.clientLeft,
        top: box.top - navRect.top - nav.clientTop,
        width: box.width,
        height: box.height,
        borderRadius: 999,
        autoAlpha: 1,
      }

      const gsap = gsapRef.current
      const shouldSnap = !initializedRef.current || !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      gsap.killTweensOf(indicator)
      if (shouldSnap) {
        gsap.set(indicator, target)
        initializedRef.current = true
        visualIndexRef.current = active
        setVisualIndex(active)
      } else {
        gsap.to(indicator, {
          ...target,
          duration: 0.42,
          ease: 'power3.inOut',
          onComplete: () => {
            visualIndexRef.current = active
            setVisualIndex(active)
          },
        })
      }
      setIndicatorReady(true)
    }

    const schedule = (animate = true, refresh = false) => {
      pendingAnimate ||= animate
      pendingRefresh ||= refresh
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    const onScroll = () => schedule(true)
    const onResize = () => schedule(false, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    const setup = async () => {
      const { gsap } = await import('gsap')
      if (cancelled) return
      gsapRef.current = gsap
      schedule(false, true)
    }
    void setup()

    return () => {
      cancelled = true
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const renderLinks = (mobile = false) => items.map((item, index) => (
    <a
      key={item.href}
      href={item.href}
      ref={mobile ? undefined : element => { linksRef.current[index] = element }}
      aria-current={activeIndex === index ? 'location' : undefined}
      data-indicator-current={visualIndex === index ? 'true' : undefined}
      className={mobile && activeIndex === index ? 'is-current' : undefined}
    >
      {item.label}
    </a>
  ))

  return (
    <>
      <nav className={`desktop-nav${indicatorReady ? ' is-ready' : ''}`} aria-label="เมนูหลัก" ref={navRef}>
        <span className="nav-active-indicator" aria-hidden="true" ref={indicatorRef} />
        {renderLinks()}
      </nav>
      <details className="mobile-menu">
        <summary aria-label="เปิดเมนูหลัก"><span /><span /></summary>
        <nav aria-label="เมนูหลักบนมือถือ">
          {renderLinks(true)}
          <a href="/login.html">Partner Login ↗</a>
        </nav>
      </details>
    </>
  )
}
