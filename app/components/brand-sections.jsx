'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, FileBadge2, HeartPulse,
  MessageCircleHeart, Music2, Pill, Play,
} from 'lucide-react'

/* ── Mascots ──────────────────────────────────────────────────────────────── */

const mascots = [
  {
    id: 'dog', name: 'FUFU Dog', tagline: 'น้องหมาน่ารัก ใจดี ร่าเริง',
    body: 'คอยชวนเจ้าของดูแลสุขภาพประจำวัน เตือนเวลาให้ยา และพาไปพบคุณหมอตามนัด',
    image: '/img/mascot/dog-wave.webp',
  },
  {
    id: 'cat', name: 'FUFU Cat', tagline: 'น้องแมวฉลาด อ่อนโยน ขี้อ้อน',
    body: 'ผู้ช่วยช่างสังเกต ช่วยอ่านอาการเบื้องต้น และตอบคำถามสุขภาพผ่าน AI Assistant',
    image: '/img/mascot/cat-curious.webp',
  },
]

const mascotRoles = [
  { label: 'Health Tracking', Icon: HeartPulse },
  { label: 'Medication Reminder', Icon: Pill },
  { label: 'Appointment', Icon: CalendarDays },
  { label: 'AI Assistant', Icon: MessageCircleHeart },
]

const stickerStrip = [
  { src: '/img/mascot/dog-sit.webp', label: 'ยิ้ม / ดีใจ' },
  { src: '/img/mascot/cat-cheer.webp', label: 'เย้!' },
  { src: '/img/mascot/dog-run.webp', label: 'วิ่งเล่น' },
  { src: '/img/mascot/cat-peek.webp', label: 'แอบมอง' },
  { src: '/img/mascot/dog-reading.webp', label: 'ตั้งใจเรียนรู้' },
  { src: '/img/mascot/cat-box.webp', label: 'ในกล่อง' },
  { src: '/img/mascot/dog-toy.webp', label: 'ของเล่นชิ้นโปรด' },
  { src: '/img/mascot/cat-roll.webp', label: 'อ้อนสุด ๆ' },
  { src: '/img/mascot/dog-wink.webp', label: 'ขยิบตา' },
  { src: '/img/mascot/cat-lounge.webp', label: 'ชิล ๆ' },
  { src: '/img/mascot/duo-sleep.webp', label: 'นอนหลับ' },
  { src: '/img/mascot/cat-sleep.webp', label: 'ง่วงนอน' },
]

export function MascotSection() {
  return (
    <section className="mascot-section" id="mascots" aria-labelledby="mascot-title">
      <div className="mascot-top section-wrap">
        <div className="mascot-copy">
          <span className="eyebrow"><i aria-hidden="true" />MEET THE CHARACTERS</span>
          <h2 id="mascot-title">พบกับ <em>FUFU Dog &amp; Cat</em><br />เพื่อนซี้ที่คอยดูแลน้อง{"\u00a0"}ๆ</h2>
          <p>สองคาแรกเตอร์ประจำแบรนด์ที่อยู่ในทุกจุดของ FUFU App ตั้งแต่การแจ้งเตือน ไปจนถึงผู้ช่วย AI เพื่อให้เรื่องสุขภาพเป็นเรื่องที่เข้าใจง่ายและอบอุ่น</p>

          <div className="mascot-cards">
            {mascots.map(m => (
              <article className={`mascot-card mascot-card-${m.id}`} key={m.id}>
                <div className="mascot-card-art"><Image src={m.image} alt={`${m.name} คาแรกเตอร์ประจำ FUFU Pet Care`} width={240} height={280} /></div>
                <div>
                  <h3>{m.name}</h3>
                  <b>{m.tagline}</b>
                  <p>{m.body}</p>
                </div>
              </article>
            ))}
          </div>

          <ul className="mascot-roles" aria-label="บทบาทของคาแรกเตอร์ในแอป">
            {mascotRoles.map(({ label, Icon }) => <li key={label}><Icon size={17} aria-hidden="true" />{label}</li>)}
          </ul>
        </div>

        <div className="mascot-stage" aria-hidden="true">
          <div className="mascot-halo" />
          <Image className="mascot-hero" src="/img/mascot/duo-hug.webp" alt="" width={407} height={442} />
          <Image className="mascot-float mascot-float-a" src="/img/mascot/cat-sit.webp" alt="" width={328} height={408} />
          <Image className="mascot-float mascot-float-b" src="/img/mascot/dog-happy.webp" alt="" width={327} height={437} />
          <span className="mascot-heart mascot-heart-a">♥</span>
          <span className="mascot-heart mascot-heart-b">♥</span>
          <span className="mascot-heart mascot-heart-c">♥</span>
          <p className="mascot-script">Better care for<br />their happier days</p>
        </div>
      </div>

      <div className="sticker-rail" aria-label="ท่าทางและอารมณ์ของคาแรกเตอร์">
        <div className="sticker-track">
          {[...stickerStrip, ...stickerStrip].map((s, i) => (
            <figure className="sticker" key={`${s.src}-${i}`} aria-hidden={i >= stickerStrip.length}>
              <Image src={s.src} alt={i < stickerStrip.length ? `คาแรกเตอร์ FUFU ท่า${s.label}` : ''} width={180} height={180} />
              <figcaption>{s.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="mascot-sheet-link section-wrap">
        <a href="/img/mascot/fufu-character-sheet.webp" target="_blank" rel="noopener">
          ดู Character Sheet ฉบับเต็ม <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

/* ── App screens ──────────────────────────────────────────────────────────── */

const screens = [
  { src: '/img/app-screens/sign-in.webp', title: 'เข้าสู่ระบบ', note: 'อีเมลหรือ Google' },
  { src: '/img/app-screens/home.webp', title: 'หน้าแรก', note: 'สัตว์เลี้ยงและทางลัด' },
  { src: '/img/app-screens/add-pet.webp', title: 'เพิ่มสัตว์เลี้ยง', note: 'โปรไฟล์ของน้อง' },
  { src: '/img/app-screens/select-pet.webp', title: 'เริ่มสแกน', note: 'เลือกน้องที่ต้องการตรวจ' },
  { src: '/img/app-screens/health.webp', title: 'สรุปสุขภาพ', note: 'คะแนนและประวัติ' },
  { src: '/img/app-screens/ai-vet.webp', title: 'FUFU AI Vet', note: 'ถามเรื่องสุขภาพได้ทุกเวลา' },
  { src: '/img/app-screens/nearby-vets.webp', title: 'คลินิกใกล้ฉัน', note: 'แผนที่และเส้นทาง' },
  { src: '/img/app-screens/pet-shops.webp', title: 'ร้านสัตว์เลี้ยง', note: 'อาหารและอุปกรณ์' },
  { src: '/img/app-screens/pet-services.webp', title: 'บริการดูแล', note: 'อาบน้ำ ตัดขน รับฝาก' },
  { src: '/img/app-screens/rewards.webp', title: 'Rewards', note: 'เช็กอินสะสมเหรียญ' },
  { src: '/img/app-screens/plans.webp', title: 'แพ็กเกจ', note: 'VET VIP และการบริจาค' },
]

export function AppScreens() {
  const railRef = useRef(null)
  const scrollByCard = (dir) => {
    const rail = railRef.current
    if (!rail) return
    const card = rail.querySelector('.screen-card')
    const step = card ? card.getBoundingClientRect().width + 24 : 300
    rail.scrollBy({ left: dir * step * 2, behavior: 'smooth' })
  }

  return (
    <section className="screens-section" id="app-screens" aria-labelledby="screens-title">
      <div className="screens-head section-wrap">
        <div>
          <span className="eyebrow"><i aria-hidden="true" />INSIDE FUFU APP</span>
          <h2 id="screens-title">ทุกหน้าจอ<br />ที่ <em>ใช้งานได้จริง</em></h2>
        </div>
        <div className="screens-head-side">
          <p>ภาพหน้าจอจากแอปเวอร์ชันปัจจุบัน ตั้งแต่การเพิ่มน้อง สแกนอาการ ถาม AI Vet ไปจนถึงค้นหาคลินิกและบริการใกล้ตัว</p>
          <div className="screens-controls">
            <button type="button" onClick={() => scrollByCard(-1)} aria-label="เลื่อนไปทางซ้าย"><ArrowLeft size={18} /></button>
            <button type="button" onClick={() => scrollByCard(1)} aria-label="เลื่อนไปทางขวา"><ArrowRight size={18} /></button>
          </div>
        </div>
      </div>

      <div className="screens-rail" ref={railRef} tabIndex={0} aria-label="ภาพหน้าจอ FUFU App เลื่อนดูได้">
        {screens.map((s, i) => (
          <figure className="screen-card" key={s.src}>
            <div className="screen-phone">
              <Image src={s.src} alt={`หน้าจอ${s.title}ของ FUFU App`} width={328} height={714} sizes="(max-width: 760px) 62vw, 260px" />
            </div>
            <figcaption><span>{String(i + 1).padStart(2, '0')}</span><b>{s.title}</b><small>{s.note}</small></figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/* ── Brand songs ──────────────────────────────────────────────────────────── */

const songs = [
  { id: 'jqXMGu-MSQA', title: 'ฟูฟู เพ็ทแคร์', tag: 'Theme Song' },
  { id: 'mDEPVoxSt3M', title: 'FUFU Pet Care – Part 1', tag: 'Lyric Video' },
  { id: '6ZrXMmbA_xg', title: 'FUFU Pet Care – Part 2', tag: 'Lyric Video' },
]

function SongCard({ song, index }) {
  const [playing, setPlaying] = useState(false)
  return (
    <article className="song-card">
      <div className="song-media">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${song.id}?autoplay=1&rel=0`}
            title={`${song.title} — เพลงประจำแบรนด์ FUFU Pet Care`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="song-poster" onClick={() => setPlaying(true)} aria-label={`เล่นเพลง ${song.title}`}>
            <Image src={`https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`} alt="" fill unoptimized sizes="(max-width: 760px) 90vw, 30vw" />
            <span className="song-play"><Play size={22} fill="currentColor" aria-hidden="true" /></span>
          </button>
        )}
      </div>
      <div className="song-meta">
        <span>{String(index + 1).padStart(2, '0')} · {song.tag}</span>
        <h3>{song.title}</h3>
        <a href={`https://youtu.be/${song.id}`} target="_blank" rel="noopener noreferrer">ฟังบน YouTube <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </article>
  )
}

export function BrandSongs() {
  return (
    <section className="songs-section" id="brand-songs" aria-labelledby="songs-title">
      <div className="songs-head section-wrap">
        <div>
          <span className="eyebrow"><i aria-hidden="true" />FUFU THEME SONGS</span>
          <h2 id="songs-title">เพลงประจำแบรนด์<br /><em>เพราะเขาคือครอบครัว</em></h2>
        </div>
        <p><Music2 size={18} aria-hidden="true" /> เพลงที่เล่าเรื่องการดูแลน้อง ๆ ในแบบของ FUFU ผลิตโดย Kitten Code</p>
        <Image className="songs-mascot" src="/img/mascot/cat-cheer.webp" alt="" width={340} height={424} aria-hidden="true" />
      </div>
      <div className="songs-grid section-wrap">
        {songs.map((song, i) => <SongCard song={song} index={i} key={song.id} />)}
      </div>
    </section>
  )
}

/* ── Copyright / trust ────────────────────────────────────────────────────── */

const works = [
  { title: 'FUFU Pet Care : ฟูฟู เพ็ทแคร์', kind: 'แอปพลิเคชันดูแลสุขภาพสัตว์เลี้ยง', registry: 'ว1.000520', request: '469572', filed: '20 มี.ค. 2569', issued: '29 เม.ย. 2569' },
  { title: 'โมเดลอัจฉริยะตรวจจับและวิเคราะห์โรคผิวหนังในสุนัขและแมวจากการถ่ายภาพ', kind: 'AI คัดกรองโรคผิวหนังจากภาพถ่าย', registry: 'ว1.000636', request: '471127', filed: '27 เม.ย. 2569', issued: '20 พ.ค. 2569' },
  { title: 'Smart AI Veterinary Assistant Chatbot', kind: 'ผู้ช่วยสัตวแพทย์ AI แบบสนทนา', registry: 'ว1.001745', request: '485009', filed: '31 ต.ค. 2569', issued: '3 พ.ย. 2569' },
  { title: 'FUFU Partner Portal: Pet Business Management System', kind: 'ระบบบริหารคลินิกและธุรกิจสัตว์เลี้ยง', registry: 'ว1.001746', request: '485016', filed: '1 พ.ย. 2569', issued: '3 พ.ย. 2569' },
]

export function CopyrightSection() {
  return (
    <section className="trust-section" id="trust" aria-labelledby="trust-title">
      <div className="trust-head section-wrap">
        <div>
          <span className="eyebrow"><i aria-hidden="true" />INTELLECTUAL PROPERTY</span>
          <h2 id="trust-title">ผลงานที่แจ้งข้อมูล<br /><em>ลิขสิทธิ์</em> แล้ว 4 รายการ</h2>
        </div>
        <div className="trust-stat">
          <FileBadge2 size={28} aria-hidden="true" />
          <div><b>กรมทรัพย์สินทางปัญญา</b><span>หนังสือแสดงการแจ้งข้อมูลลิขสิทธิ์ · ประเภทงานวรรณกรรม (โปรแกรมคอมพิวเตอร์)</span></div>
        </div>
      </div>

      <ol className="trust-grid section-wrap">
        {works.map((w, i) => (
          <li className="trust-card" key={w.request}>
            <div className="trust-card-top">
              <span className="trust-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="trust-badge"><BadgeCheck size={15} aria-hidden="true" /> แจ้งข้อมูลแล้ว</span>
            </div>
            <h3>{w.title}</h3>
            <p>{w.kind}</p>
            <dl>
              <div><dt>ทะเบียนข้อมูลเลขที่</dt><dd>{w.registry}</dd></div>
              <div><dt>คำขอเลขที่</dt><dd>{w.request}</dd></div>
              <div><dt>วันที่แจ้ง</dt><dd>{w.filed}</dd></div>
              <div><dt>วันที่ออกหนังสือ</dt><dd>{w.issued}</dd></div>
            </dl>
          </li>
        ))}
      </ol>

      <p className="trust-note section-wrap">
        ข้อมูลอ้างอิงจากหนังสือแสดงการแจ้งข้อมูลลิขสิทธิ์ที่ออกโดยกองลิขสิทธิ์ กรมทรัพย์สินทางปัญญา กระทรวงพาณิชย์ ·
        ผลงานพัฒนาโดยทีม KITTEN CODE Co., Ltd.
      </p>
    </section>
  )
}
