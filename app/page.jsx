import Image from 'next/image'
import { connection } from 'next/server'
import {
  ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Camera, HeartPulse,
  Stethoscope, UsersRound,
} from 'lucide-react'
import { AppStory, EcosystemMap, HeroMotion } from './components/product-experience'
import ActiveNavigation from './components/ActiveNavigation'

function Eyebrow({ children, light = false }) {
  return <span className={`eyebrow${light ? ' eyebrow-light' : ''}`}><i aria-hidden="true" />{children}</span>
}

function Brand({ footer = false }) {
  return (
    <a className={`brand${footer ? ' brand-footer' : ''}`} href="#top" aria-label="FUFU Pet Care — กลับไปด้านบน">
      <Image src="/img/fufu-mark.webp" alt="" width={footer ? 34 : 42} height={footer ? 34 : 42} priority />
      <span>FUFU<small>PET CARE</small></span>
    </a>
  )
}

export default async function HomePage() {
  await connection()
  return (
    <>
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <header className="site-header">
        <Brand />
        <ActiveNavigation />
        <div className="header-actions">
          <a className="header-login" href="/login.html">Partner Login <ArrowUpRight size={15} aria-hidden="true" /></a>
          <a className="header-cta" href="https://fufu-web-app.vercel.app/">ทดลองใช้ FUFU Pet Care <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </header>

      <main id="main-content">
        <HeroMotion />
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">สำหรับเรา<br />สัตว์เลี้ยง... คือ<br /><em>สมาชิกในครอบครัว</em></h1>
            <p className="hero-lede">FUFU เชื่อมเรื่องสุขภาพของสัตว์เลี้ยง ตั้งแต่การสังเกตที่บ้าน การคัดกรองเบื้องต้น ไปจนถึงคลินิกและผู้ดูแลรอบตัว</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#app-story">ชมการทำงานของ FUFU <ArrowRight size={18} aria-hidden="true" /></a>
              <a className="button-text" href="#ecosystem">รู้จักระบบที่เชื่อมถึงกัน <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
            <div className="hero-signals" aria-label="สิ่งที่ FUFU เชื่อมต่อ">
              <span><HeartPulse size={18} aria-hidden="true" /> สุขภาพทุกวัน</span>
              <span><Camera size={18} aria-hidden="true" /> AI คัดกรองเบื้องต้น</span>
              <span><Stethoscope size={18} aria-hidden="true" /> คลินิกพันธมิตร</span>
            </div>
          </div>

          <div className="hero-stage" data-hero-stage>
            <div className="hero-photo-main">
              <Image src="/img/pets/golden.jpg" alt="สุนัขโกลเด้นรีทรีฟเวอร์ในภาพถ่ายจากชุดภาพของ FUFU App" fill priority sizes="(max-width: 760px) 92vw, 48vw" />
            </div>
          </div>
        </section>

        <section className="promise-band" aria-label="แนวคิดการดูแลของ FUFU">
          <span>FROM HOME</span><span className="promise-mark">✳</span><span>TO THE CLINIC</span><span className="promise-mark">✳</span><span>CONNECTED CARE, WITH FUFU</span>
        </section>

        <section className="app-story-section" id="app-story" aria-labelledby="app-story-title">
          <div className="story-intro section-wrap">
            <div><h2 id="app-story-title">แอปที่พาเรื่องเล็ก ๆ<br />ไปสู่ <em>การดูแลต่อ</em></h2></div>
          </div>
          <AppStory />
        </section>

        <section className="ai-section" id="ai-care" aria-labelledby="ai-title">
          <div className="ai-copy">
            <h2 id="ai-title">AI ที่ช่วย<br /><em>เริ่มต้นสังเกต</em></h2>
            <p>เจ้าของถ่ายภาพบริเวณที่กังวลและตอบคำถามอาการ ระบบนำข้อมูลมาประกอบเป็นแนวทางความเร่งด่วน เพื่อช่วยตัดสินใจว่าควรทำอะไรต่อ</p>
            <div className="ai-steps" aria-label="ขั้นตอนคัดกรอง">
              <div><span>01</span><b>ภาพถ่าย</b></div><i aria-hidden="true" />
              <div><span>02</span><b>อาการ</b></div><i aria-hidden="true" />
              <div><span>03</span><b>แนวทาง</b></div>
            </div>
            <a className="ai-link" href="#partners">เมื่อควรพบสัตวแพทย์ FUFU ช่วยเชื่อมต่อคลินิก <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <div className="ai-visual" aria-label="ภาพประกอบแนวคิด AI คัดกรองจากภาพและอาการ">
            <div className="ai-orbital" aria-hidden="true"><span /><span /><span /></div>
            <div className="ai-scan-frame">
              <div className="ai-pet-photo"><Image src="/img/pets/shitzu.jpg" alt="สุนัขในภาพตัวอย่างสำหรับอธิบายกระบวนการคัดกรอง" fill sizes="(max-width: 760px) 78vw, 35vw" /></div>
              <div className="scan-corners" aria-hidden="true"><i /><i /><i /><i /></div>
              <div className="scan-line" aria-hidden="true" />
            </div>
          </div>
          <div className="urgency-panel">
            <span className="urgency-label">แนวทางความเร่งด่วน 4 ระดับ</span>
            <div className="urgency-levels">
              <span><i className="urgency-dot urgency-critical" /> ฉุกเฉิน</span>
              <span><i className="urgency-dot urgency-soon" /> พบสัตวแพทย์ใน 24–48 ชม.</span>
              <span><i className="urgency-dot urgency-watch" /> เฝ้าดูอาการที่บ้าน</span>
              <span><i className="urgency-dot urgency-clear" /> ไม่พบความผิดปกติชัดเจน</span>
            </div>
          </div>
        </section>

        <section className="ecosystem-section" id="ecosystem" aria-labelledby="ecosystem-title">
          <div className="ecosystem-heading section-wrap">
            <h2 id="ecosystem-title">การดูแลดีขึ้น<br />เมื่อ <em>ทุกคนเชื่อมถึงกัน</em></h2>
            <p>เลือกดูบทบาทในระบบ FUFU ตั้งแต่เจ้าของสัตว์เลี้ยง ไปจนถึงคลินิกและผู้ให้บริการ</p>
          </div>
          <EcosystemMap />
        </section>

        <section className="partner-section" id="partners" aria-labelledby="partner-title">
          <div className="partner-top section-wrap">
            <div className="partner-intro">
              <h2 id="partner-title">อีกด้านของการดูแล<br /><em>ที่ทีมคลินิกใช้ได้จริง</em></h2>
              <p>แพลตฟอร์มสำหรับคลินิกจัดการการนัดหมาย รับเคสที่เจ้าของยินยอมส่งต่อ และเก็บข้อมูลการเข้ารับบริการในระบบเดิมของ FUFU</p>
              <a className="button button-light" href="/login.html">เข้าสู่ระบบพาร์ทเนอร์ <ArrowUpRight size={17} aria-hidden="true" /></a>
            </div>
            <div className="partner-platform" aria-label="ภาพรวมความสามารถของ FUFU Partner">
              <div className="partner-platform-head"><Image src="/img/fufu-mark.webp" alt="" width={31} height={31} /><span>FUFU Partner</span></div>
              <div className="partner-platform-body">
                <div className="partner-workflows">
                  <div className="partner-workflow"><div><b>นัดหมายและปฏิทิน</b></div><CalendarDays size={22} aria-hidden="true" /></div>
                  <div className="partner-workflow"><div><b>เคสคัดกรองที่ส่งต่อ</b></div><HeartPulse size={22} aria-hidden="true" /></div>
                  <div className="partner-workflow"><div><b>ข้อมูลผู้เข้ารับบริการ</b></div><UsersRound size={22} aria-hidden="true" /></div>
                  <div className="partner-workflow"><div><b>โปรไฟล์คลินิก</b></div><Stethoscope size={22} aria-hidden="true" /></div>
                </div>
              </div>
            </div>
          </div>
          <div className="partner-network section-wrap">
            <span>PARTNER NETWORK</span><p>คลินิก&nbsp; · &nbsp;ร้านค้า&nbsp; · &nbsp;ร้านตัดแต่งขน&nbsp; · &nbsp;โรงแรมสัตว์เลี้ยง</p>
            <a href="/login.html">เข้าสู่ระบบสำหรับทีมของคุณ <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </section>

        <section className="closing-cta">
          <Image src="/img/pets/ragdoll.jpg" alt="แมวสีขาวในภาพถ่ายจากชุดภาพของ FUFU App" fill sizes="(max-width: 760px) 100vw, 50vw" />
          <div className="closing-copy"><h2>เพื่อทุกวัน<br />ที่อยากดูแล <em>ให้ดีขึ้น</em></h2><a className="button button-primary" href="#app-story">เริ่มจากรู้จัก FUFU App <ArrowRight size={18} aria-hidden="true" /></a></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main"><Brand footer /><p>แพลตฟอร์มดูแลสัตว์เลี้ยง<br />ที่เชื่อมบ้าน คลินิก และบริการเข้าด้วยกัน</p><nav aria-label="ลิงก์ท้ายหน้า"><a href="#app-story">FUFU App</a><a href="#ecosystem">Ecosystem</a><a href="#partners">FUFU Partner</a><a href="/login.html">Partner Login ↗</a></nav></div>
        <div className="footer-bottom"><span>© 2026 FUFU PET CARE Powered By KITTEN CODE Co., Ltd. </span></div>
      </footer>
    </>
  )
}
