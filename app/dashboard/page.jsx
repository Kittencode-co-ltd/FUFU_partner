'use client'

import { useEffect } from 'react'
import Image from 'next/image'

const pages = [
  'home', 'screenings', 'appointments', 'calendar', 'patients', 'summaries',
  'clinic', 'users', 'queue', 'cashier', 'opd', 'pets', 'pet-profile', 'medical',
  'income', 'orders', 'delivery', 'inventory', 'pos', 'hotel', 'grooming', 'ipd',
  'documents', 'kanban', 'staff', 'settings',
]

export default function DashboardPage() {
  useEffect(() => {
    const bodyClasses = ['h-full', 'app-bg', 'font-sans']
    document.body.classList.add(...bodyClasses)

    const appScript = document.createElement('script')
    appScript.type = 'module'
    appScript.src = `/js/app.js?dashboard=${Date.now()}`
    const startPortal = () => document.body.appendChild(appScript)
    const themeScript = document.createElement('script')
    themeScript.src = '/js/theme-init.js'
    themeScript.onload = startPortal
    themeScript.onerror = startPortal
    document.head.appendChild(themeScript)

    return () => {
      themeScript.remove()
      appScript.remove()
      document.body.classList.remove(...bodyClasses, 'sb-open', 'sb-collapsed', 'is-scrolled')
    }
  }, [])

  return <div id="portal-root" className="h-full app-bg font-sans">
    <link rel="icon" href="/img/brand/favicon-64.png" />
    <link rel="apple-touch-icon" href="/img/brand/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />

    <div id="portal-alerts" />
    <div id="portal-access-notice" className="hidden" />
    <div id="portal-shell">
      <div id="sb-overlay" className="fixed inset-0 z-30 lg:hidden" aria-hidden="true" />

      <aside id="sidebar" className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col lg:w-64" aria-label="เมนูหลัก">
        <div className="sb-brand">
          <Image src="/img/brand/fufu-mark.webp" alt="" width={36} height={36} priority />
          <div className="min-w-0">
            <div className="sb-brand__name">FUFU <em>Pet Care</em></div>
            <div className="sb-brand__sub">Partner Portal</div>
          </div>
        </div>

        <div className="relative px-3 pb-2">
          <button id="sb-store-switcher" type="button" className="sb-store">
            <div className="min-w-0 flex-1">
              <div id="sb-store-name" className="sb-store__name truncate">—</div>
              <div id="sb-store-type" className="sb-store__type" />
            </div>
            <svg id="sb-store-chevron" className="h-4 w-4 flex-shrink-0 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div id="sb-store-dropdown" className="sb-dropdown hidden" />
        </div>

        <nav id="sidebar-nav" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-thin" />
      </aside>

      <div id="main-wrap" className="flex min-h-screen min-w-0 flex-col lg:ml-64">
        <header id="topbar" className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 px-3 sm:h-16 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button id="sidebar-toggle" type="button" title="ซ่อน/แสดง Sidebar" aria-label="เปิด/ปิดเมนู" aria-controls="sidebar" aria-expanded="false" className="icon-btn">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>
            <div id="topbar-title" className="topbar-title truncate" />
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <div id="offline-badge" className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856a9.75 9.75 0 014.893-2.914m5.803-1.396A14.944 14.944 0 0122.076 8.674M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
              <span>ออฟไลน์</span>
              <span id="sync-count" className="hidden h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-xs leading-none text-white" />
            </div>
            <div id="save-indicator" className="hidden text-xs text-slate-400 font-body" />
            <div id="topbar-date" className="topbar-date hidden lg:block" />
            <button id="profile-btn" type="button" className="profile-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="บัญชีของฉัน">
              <span data-profile-initial>?</span>
            </button>
          </div>
        </header>

        <main id="app-main" className="mx-auto min-w-0 w-full max-w-[1600px] flex-1 p-3 pb-24 sm:p-5 md:pb-6 lg:p-6 xl:p-8">
          <nav id="flow-steps" className="flow-steps" aria-label="ขั้นตอนการให้บริการ" hidden />
          {pages.map(page => <section key={page} id={`page-${page}`} className="hidden" style={page === 'opd' ? { margin: '-12px', overflow: 'hidden' } : undefined}>
            {page === 'opd' && <div id="doctor-workroom-root" />}
          </section>)}
        </main>
      </div>

      <nav id="bottom-nav" className="lg:hidden" aria-label="เมนูลัด" />
    </div>
  </div>
}
