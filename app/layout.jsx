import './globals.css'

export const metadata = {
  title: 'FUFU Pet Care — ดูแลน้องได้อย่างเข้าใจ',
  description: 'FUFU Pet Care เชื่อมการดูแลสุขภาพสัตว์เลี้ยง ตั้งแต่โปรไฟล์ สุขภาพและวัคซีน AI ช่วยคัดกรอง ค้นหาคลินิก ไปจนถึงระบบนัดหมายสำหรับคลินิก',
  openGraph: {
    title: 'FUFU Pet Care — ดูแลน้องได้อย่างเข้าใจ',
    description: 'เรื่องสุขภาพของน้อง เริ่มจากการใส่ใจเล็ก ๆ FUFU ช่วยเชื่อมการดูแลจากบ้านถึงคลินิก',
    type: 'website',
    locale: 'th_TH',
    siteName: 'FUFU Pet Care',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/img/brand/favicon-64.png', type: 'image/png' }],
    apple: '/img/brand/apple-touch-icon.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf7f2',
}

export default function RootLayout({ children }) {
  return <html lang="th"><body>{children}</body></html>
}
