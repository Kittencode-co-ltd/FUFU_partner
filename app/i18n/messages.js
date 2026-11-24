// Landing-page copy in five languages. Thai is the source; other languages are
// translations to be reviewed by native speakers before an official launch.
// The partner login/register pages use public/js/i18n.js and share the same
// `fufu_lang` localStorage key, so the chosen language follows the user.

export const LANGS = [
  { code: 'th', label: 'ไทย', short: 'TH', html: 'th' },
  { code: 'en', label: 'English', short: 'EN', html: 'en' },
  { code: 'zh', label: '中文', short: 'CN', html: 'zh-CN' },
  { code: 'ja', label: '日本語', short: 'JP', html: 'ja' },
  { code: 'ko', label: '한국어', short: 'KR', html: 'ko' },
]

export const messages = {
  th: {
    nav: { features: 'ฟีเจอร์', flow: 'วิธีการทำงาน', plans: 'แพ็กเกจ', partners: 'สำหรับคลินิก', login: 'Partner Login', menu: 'เมนู', close: 'ปิด' },
    hero: {
      eyebrow: 'Happy Pet, Healthy Life',
      title: 'สำหรับเรา สัตว์เลี้ยง', titleEm: 'คือสมาชิกในครอบครัว',
      lede: 'FUFU ช่วยคัดกรองสุขภาพเบื้องต้นด้วย AI เก็บประวัติสุขภาพของน้อง และเชื่อมคุณกับคลินิกใกล้บ้าน ในแอปเดียว',
      cta: 'ดูวิธีการทำงาน', cta2: 'สำหรับคลินิก',
    },
    features: {
      eyebrow: 'FUFU App', title: 'ทุกอย่างที่น้องต้องการ', titleEm: 'ในแอปเดียว',
      items: [
        { title: 'AI Health Scan', body: 'ถ่ายภาพผิวหนัง ตา หรือหู แล้วให้ AI ช่วยประเมินความเร่งด่วนเบื้องต้น' },
        { title: 'AI Vet Chat', body: 'ถามเรื่องสุขภาพของน้องได้ทุกเวลา ผ่านผู้ช่วยสัตวแพทย์ AI' },
        { title: 'สมุดสุขภาพ', body: 'ประวัติสุขภาพ วัคซีน และการเตือนให้ยา ครบในที่เดียวสำหรับน้องทุกตัว' },
        { title: 'บริการใกล้คุณ', body: 'ค้นหาคลินิก ร้านสัตว์เลี้ยง และบริการอาบน้ำตัดขนใกล้บ้านพร้อมเส้นทาง' },
      ],
    },
    flow: {
      eyebrow: 'Connected care', title: 'จากบ้านถึงคลินิก', titleEm: 'ทุกขั้นตอนเชื่อมถึงกัน',
      lede: 'ข้อมูลเดินทางไปพร้อมกับน้อง เจ้าของเป็นผู้ตัดสินใจว่าจะส่งข้อมูลให้คลินิกหรือไม่',
      lanes: { owner: 'เจ้าของสัตว์ · FUFU App', ai: 'FUFU AI', clinic: 'คลินิก · FUFU Partner' },
      steps: [
        { lane: 'owner', title: 'สังเกตอาการ', body: 'ถ่ายภาพจุดที่กังวล และตอบคำถามอาการสั้น ๆ' },
        { lane: 'ai', title: 'AI ประเมินเบื้องต้น', body: 'จัดระดับความเร่งด่วน 4 ระดับภายในไม่กี่วินาที' },
        { lane: 'owner', title: 'เลือกทางต่อ', body: 'ดูแลที่บ้าน ปรึกษา AI Vet หรือจองคลินิก' },
        { lane: 'clinic', title: 'รับเคสส่งต่อ', body: 'คลินิกเห็นภาพและอาการ เมื่อเจ้าของยินยอมส่งข้อมูล' },
        { lane: 'clinic', title: 'ตรวจและบันทึก', body: 'นัดหมาย ตรวจรักษา และบันทึกผลในระบบเดียว' },
        { lane: 'owner', title: 'รับสรุปและติดตาม', body: 'สรุปการรักษาและการเตือนนัดถัดไปกลับเข้าแอป' },
      ],
      urgency: ['ฉุกเฉิน', 'พบสัตวแพทย์ใน 24–48 ชม.', 'เฝ้าดูอาการที่บ้าน', 'ไม่พบความผิดปกติชัดเจน'],
    },
    mascots: {
      eyebrow: 'Meet the characters', title: 'พบกับ', titleEm: 'FUFU Dog & Cat',
      dog: { name: 'FUFU Dog', tag: 'ใจดี ร่าเริง', body: 'ชวนเจ้าของดูแลสุขภาพประจำวัน และเตือนเมื่อถึงเวลาให้ยาหรือพบคุณหมอ' },
      cat: { name: 'FUFU Cat', tag: 'ฉลาด ขี้อ้อน', body: 'ผู้ช่วยช่างสังเกต ช่วยอ่านอาการเบื้องต้นและตอบคำถามผ่าน AI Assistant' },
    },
    partners: {
      eyebrow: 'FUFU Partner', title: 'สำหรับคลินิก', titleEm: 'และธุรกิจสัตว์เลี้ยง',
      lede: 'ระบบหลังบ้านสำหรับคลินิก ร้านค้า ร้านตัดแต่งขน และโรงแรมสัตว์เลี้ยง ใช้ได้ทั้งบนคอมพิวเตอร์ แท็บเล็ต และมือถือ',
      items: ['นัดหมายและปฏิทิน', 'รับเคสคัดกรองที่ส่งต่อ', 'สรุปการเข้ารับบริการ', 'โปรไฟล์คลินิกบน FUFU App'],
      login: 'เข้าสู่ระบบพาร์ทเนอร์', join: 'สมัครเป็นพาร์ทเนอร์',
    },
    trust: {
      eyebrow: 'Intellectual property', title: 'ผลงานที่แจ้งข้อมูล', titleEm: 'ลิขสิทธิ์',
      lede: 'แจ้งข้อมูลลิขสิทธิ์ต่อกรมทรัพย์สินทางปัญญา ประเภทวรรณกรรม (โปรแกรมคอมพิวเตอร์)',
      registry: 'ทะเบียน', filed: 'แจ้งเมื่อ',
      works: [
        { title: 'FUFU Pet Care : ฟูฟู เพ็ทแคร์', filed: '20 มี.ค. 2569' },
        { title: 'โมเดลอัจฉริยะตรวจจับและวิเคราะห์โรคผิวหนังในสุนัขและแมวจากภาพถ่าย', filed: '27 เม.ย. 2569' },
        { title: 'Smart AI Veterinary Assistant Chatbot', filed: '31 ต.ค. 2569' },
        { title: 'FUFU Partner Portal: Pet Business Management System', filed: '1 พ.ย. 2569' },
      ],
      tech: 'เทคโนโลยีหลัก',
    },
    footer: {
      tagline: 'แพลตฟอร์มดูแลสุขภาพสัตว์เลี้ยง ที่เชื่อมบ้าน คลินิก และบริการเข้าด้วยกัน',
      songs: 'เพลงประจำแบรนด์', rights: 'สงวนลิขสิทธิ์',
    },
    music: { play: 'เปิดเพลง', pause: 'ปิดเพลง', title: 'FUFU Theme Song' },
    lang: 'เปลี่ยนภาษา',
  },

  en: {
    nav: { features: 'Features', flow: 'How it works', plans: 'Plans', partners: 'For clinics', login: 'Partner Login', menu: 'Menu', close: 'Close' },
    hero: {
      eyebrow: 'Happy Pet, Healthy Life',
      title: 'To us, pets are', titleEm: 'family',
      lede: 'FUFU screens your pet’s health with AI, keeps every health record in one place, and connects you with clinics nearby — all in one app.',
      cta: 'See how it works', cta2: 'For clinics',
    },
    features: {
      eyebrow: 'FUFU App', title: 'Everything your pet needs,', titleEm: 'in one app',
      items: [
        { title: 'AI Health Scan', body: 'Snap the skin, eyes or ears and let AI estimate how urgent it is.' },
        { title: 'AI Vet Chat', body: 'Ask about your pet’s health any time with our AI vet assistant.' },
        { title: 'Health book', body: 'Health history, vaccines and medication reminders for every pet.' },
        { title: 'Care nearby', body: 'Find clinics, pet shops and grooming services near you, with directions.' },
      ],
    },
    flow: {
      eyebrow: 'Connected care', title: 'From home to the clinic,', titleEm: 'every step connected',
      lede: 'Information travels with your pet. Owners decide whether to share it with a clinic.',
      lanes: { owner: 'Owner · FUFU App', ai: 'FUFU AI', clinic: 'Clinic · FUFU Partner' },
      steps: [
        { lane: 'owner', title: 'Notice a symptom', body: 'Photograph the concern and answer a few quick questions.' },
        { lane: 'ai', title: 'AI pre-screening', body: 'Sorted into 4 urgency levels within seconds.' },
        { lane: 'owner', title: 'Choose next step', body: 'Care at home, ask AI Vet, or book a clinic.' },
        { lane: 'clinic', title: 'Referral received', body: 'The clinic sees photos and symptoms once the owner consents.' },
        { lane: 'clinic', title: 'Visit & record', body: 'Appointment, treatment and notes in one system.' },
        { lane: 'owner', title: 'Summary & follow-up', body: 'Visit summary and next reminders return to the app.' },
      ],
      urgency: ['Emergency', 'See a vet in 24–48 h', 'Watch at home', 'No clear abnormality'],
    },
    mascots: {
      eyebrow: 'Meet the characters', title: 'Say hi to', titleEm: 'FUFU Dog & Cat',
      dog: { name: 'FUFU Dog', tag: 'Kind & cheerful', body: 'Keeps daily care on track and reminds you about medicine and vet visits.' },
      cat: { name: 'FUFU Cat', tag: 'Smart & affectionate', body: 'A keen observer who reads early signs and answers questions via AI Assistant.' },
    },
    partners: {
      eyebrow: 'FUFU Partner', title: 'For clinics', titleEm: '& pet businesses',
      lede: 'A back office for clinics, shops, groomers and pet hotels — on desktop, tablet and phone.',
      items: ['Appointments & calendar', 'Screening referrals', 'Visit summaries', 'Clinic profile on FUFU App'],
      login: 'Partner login', join: 'Become a partner',
    },
    trust: {
      eyebrow: 'Intellectual property', title: 'Registered', titleEm: 'copyright works',
      lede: 'Recorded with Thailand’s Department of Intellectual Property as literary works (computer programs).',
      registry: 'Registry', filed: 'Filed',
      works: [
        { title: 'FUFU Pet Care', filed: '20 Mar 2026' },
        { title: 'AI model for detecting skin diseases in dogs and cats from photos', filed: '27 Apr 2026' },
        { title: 'Smart AI Veterinary Assistant Chatbot', filed: '31 Oct 2026' },
        { title: 'FUFU Partner Portal: Pet Business Management System', filed: '1 Nov 2026' },
      ],
      tech: 'Core technology',
    },
    footer: {
      tagline: 'A pet-health platform connecting home, clinics and services.',
      songs: 'Brand songs', rights: 'All rights reserved',
    },
    music: { play: 'Play music', pause: 'Mute music', title: 'FUFU Theme Song' },
    lang: 'Change language',
  },

  zh: {
    nav: { features: '功能', flow: '使用流程', plans: '方案', partners: '诊所合作', login: '合作伙伴登录', menu: '菜单', close: '关闭' },
    hero: {
      eyebrow: 'Happy Pet, Healthy Life',
      title: '对我们来说，宠物', titleEm: '就是家人',
      lede: 'FUFU 用 AI 初步筛查宠物健康，集中保存健康记录，并为您连接附近的诊所——一个应用全部搞定。',
      cta: '了解使用流程', cta2: '诊所合作',
    },
    features: {
      eyebrow: 'FUFU App', title: '宠物所需的一切，', titleEm: '尽在一个应用',
      items: [
        { title: 'AI 健康扫描', body: '拍下皮肤、眼睛或耳朵，由 AI 初步评估紧急程度。' },
        { title: 'AI 兽医咨询', body: '随时通过 AI 兽医助手询问宠物健康问题。' },
        { title: '健康手册', body: '每只宠物的健康记录、疫苗与用药提醒一目了然。' },
        { title: '附近服务', body: '查找附近的诊所、宠物店和美容服务，并提供路线。' },
      ],
    },
    flow: {
      eyebrow: 'Connected care', title: '从家到诊所，', titleEm: '每一步都相连',
      lede: '信息随宠物流转，是否分享给诊所由主人决定。',
      lanes: { owner: '主人 · FUFU App', ai: 'FUFU AI', clinic: '诊所 · FUFU Partner' },
      steps: [
        { lane: 'owner', title: '发现症状', body: '拍摄担心的部位，并回答几个简单问题。' },
        { lane: 'ai', title: 'AI 初步筛查', body: '数秒内分为 4 个紧急等级。' },
        { lane: 'owner', title: '选择下一步', body: '居家护理、咨询 AI 兽医或预约诊所。' },
        { lane: 'clinic', title: '接收转诊', body: '经主人同意后，诊所可查看照片与症状。' },
        { lane: 'clinic', title: '就诊与记录', body: '预约、诊疗和记录在同一系统完成。' },
        { lane: 'owner', title: '摘要与随访', body: '诊疗摘要和后续提醒回到应用中。' },
      ],
      urgency: ['紧急', '24–48 小时内就医', '居家观察', '未见明显异常'],
    },
    mascots: {
      eyebrow: 'Meet the characters', title: '认识', titleEm: 'FUFU Dog & Cat',
      dog: { name: 'FUFU Dog', tag: '善良开朗', body: '陪主人做好日常护理，提醒用药和看兽医。' },
      cat: { name: 'FUFU Cat', tag: '聪明粘人', body: '细心的观察者，帮助识别早期症状并通过 AI 助手解答问题。' },
    },
    partners: {
      eyebrow: 'FUFU Partner', title: '为诊所', titleEm: '与宠物企业打造',
      lede: '为诊所、宠物店、美容店和宠物酒店提供的后台系统，电脑、平板和手机均可使用。',
      items: ['预约与日历', '筛查转诊', '就诊摘要', 'FUFU App 上的诊所主页'],
      login: '合作伙伴登录', join: '成为合作伙伴',
    },
    trust: {
      eyebrow: 'Intellectual property', title: '已登记的', titleEm: '著作权作品',
      lede: '已向泰国知识产权厅登记，类别为文字作品（计算机程序）。',
      registry: '登记号', filed: '登记日期',
      works: [
        { title: 'FUFU Pet Care', filed: '2026年3月20日' },
        { title: '基于照片检测犬猫皮肤病的 AI 模型', filed: '2026年4月27日' },
        { title: 'Smart AI Veterinary Assistant Chatbot', filed: '2026年10月31日' },
        { title: 'FUFU Partner Portal: Pet Business Management System', filed: '2026年11月1日' },
      ],
      tech: '核心技术',
    },
    footer: {
      tagline: '连接家庭、诊所与服务的宠物健康平台。',
      songs: '品牌歌曲', rights: '版权所有',
    },
    music: { play: '播放音乐', pause: '关闭音乐', title: 'FUFU 主题曲' },
    lang: '切换语言',
  },

  ja: {
    nav: { features: '機能', flow: 'しくみ', plans: 'プラン', partners: 'クリニック向け', login: 'パートナーログイン', menu: 'メニュー', close: '閉じる' },
    hero: {
      eyebrow: 'Happy Pet, Healthy Life',
      title: 'わたしたちにとって、ペットは', titleEm: '大切な家族',
      lede: 'FUFU は AI でペットの健康を簡易チェックし、健康記録をまとめて管理。近くのクリニックともつながる、ひとつのアプリです。',
      cta: 'しくみを見る', cta2: 'クリニック向け',
    },
    features: {
      eyebrow: 'FUFU App', title: 'ペットに必要なすべてを、', titleEm: 'ひとつのアプリに',
      items: [
        { title: 'AI ヘルススキャン', body: '皮膚・目・耳を撮影すると、AI が緊急度を簡易判定します。' },
        { title: 'AI 獣医チャット', body: 'AI 獣医アシスタントにいつでも健康の相談ができます。' },
        { title: '健康手帳', body: '健康履歴、ワクチン、投薬リマインダーをまとめて管理。' },
        { title: '近くのサービス', body: '近くの動物病院、ペットショップ、トリミングを経路付きで検索。' },
      ],
    },
    flow: {
      eyebrow: 'Connected care', title: '自宅からクリニックまで、', titleEm: 'すべてがつながる',
      lede: '情報はペットと一緒に移動します。クリニックへの共有は飼い主が決めます。',
      lanes: { owner: '飼い主 · FUFU App', ai: 'FUFU AI', clinic: 'クリニック · FUFU Partner' },
      steps: [
        { lane: 'owner', title: '異変に気づく', body: '気になる部分を撮影し、簡単な質問に答えます。' },
        { lane: 'ai', title: 'AI が事前判定', body: '数秒で 4 段階の緊急度に分類します。' },
        { lane: 'owner', title: '次の行動を選ぶ', body: '自宅ケア、AI 獣医に相談、または予約。' },
        { lane: 'clinic', title: '紹介を受け取る', body: '飼い主の同意後、写真と症状を確認できます。' },
        { lane: 'clinic', title: '診察と記録', body: '予約・診療・記録をひとつのシステムで。' },
        { lane: 'owner', title: 'サマリーとフォロー', body: '診療サマリーと次回のお知らせがアプリに届きます。' },
      ],
      urgency: ['緊急', '24〜48時間以内に受診', '自宅で様子を見る', '明らかな異常なし'],
    },
    mascots: {
      eyebrow: 'Meet the characters', title: 'こんにちは、', titleEm: 'FUFU Dog & Cat',
      dog: { name: 'FUFU Dog', tag: 'やさしくて元気', body: '毎日のケアをサポートし、投薬や通院のタイミングをお知らせします。' },
      cat: { name: 'FUFU Cat', tag: 'かしこくて甘えん坊', body: '観察上手なアシスタント。初期のサインを読み取り、AI で質問に答えます。' },
    },
    partners: {
      eyebrow: 'FUFU Partner', title: 'クリニックと', titleEm: 'ペット事業者のために',
      lede: '動物病院、ショップ、トリミング、ペットホテル向けの管理システム。PC・タブレット・スマホで使えます。',
      items: ['予約とカレンダー', 'スクリーニング紹介', '診療サマリー', 'FUFU App のクリニック紹介'],
      login: 'パートナーログイン', join: 'パートナー登録',
    },
    trust: {
      eyebrow: 'Intellectual property', title: '著作権届出済みの', titleEm: '作品',
      lede: 'タイ知的財産局に言語の著作物（コンピュータプログラム）として届出済みです。',
      registry: '登録番号', filed: '届出日',
      works: [
        { title: 'FUFU Pet Care', filed: '2026年3月20日' },
        { title: '写真から犬猫の皮膚疾患を検出・分析する AI モデル', filed: '2026年4月27日' },
        { title: 'Smart AI Veterinary Assistant Chatbot', filed: '2026年10月31日' },
        { title: 'FUFU Partner Portal: Pet Business Management System', filed: '2026年11月1日' },
      ],
      tech: 'コア技術',
    },
    footer: {
      tagline: '家庭・クリニック・サービスをつなぐペットヘルスケアプラットフォーム。',
      songs: 'ブランドソング', rights: 'All rights reserved',
    },
    music: { play: '音楽を再生', pause: '音楽を止める', title: 'FUFU テーマソング' },
    lang: '言語を変更',
  },

  ko: {
    nav: { features: '기능', flow: '이용 방법', plans: '요금제', partners: '병원용', login: '파트너 로그인', menu: '메뉴', close: '닫기' },
    hero: {
      eyebrow: 'Happy Pet, Healthy Life',
      title: '우리에게 반려동물은', titleEm: '소중한 가족입니다',
      lede: 'FUFU는 AI로 반려동물 건강을 1차 확인하고, 건강 기록을 한곳에 모으며, 가까운 동물병원과 연결해 드립니다. 하나의 앱으로요.',
      cta: '이용 방법 보기', cta2: '병원용',
    },
    features: {
      eyebrow: 'FUFU App', title: '반려동물에게 필요한 모든 것,', titleEm: '앱 하나로',
      items: [
        { title: 'AI 헬스 스캔', body: '피부, 눈, 귀를 촬영하면 AI가 긴급도를 1차로 판단합니다.' },
        { title: 'AI 수의사 채팅', body: 'AI 수의사 도우미에게 언제든 건강을 물어보세요.' },
        { title: '건강 수첩', body: '건강 기록, 예방접종, 투약 알림을 반려동물별로 관리합니다.' },
        { title: '가까운 서비스', body: '근처 동물병원, 펫숍, 미용 서비스를 길안내와 함께 찾으세요.' },
      ],
    },
    flow: {
      eyebrow: 'Connected care', title: '집에서 병원까지,', titleEm: '모든 단계가 연결됩니다',
      lede: '정보는 반려동물과 함께 이동하며, 병원 공유 여부는 보호자가 결정합니다.',
      lanes: { owner: '보호자 · FUFU App', ai: 'FUFU AI', clinic: '병원 · FUFU Partner' },
      steps: [
        { lane: 'owner', title: '이상 증상 발견', body: '걱정되는 부위를 촬영하고 간단한 질문에 답합니다.' },
        { lane: 'ai', title: 'AI 1차 판단', body: '몇 초 만에 4단계 긴급도로 분류합니다.' },
        { lane: 'owner', title: '다음 단계 선택', body: '집에서 관리, AI 수의사 상담, 병원 예약 중 선택.' },
        { lane: 'clinic', title: '의뢰 접수', body: '보호자 동의 후 병원이 사진과 증상을 확인합니다.' },
        { lane: 'clinic', title: '진료와 기록', body: '예약, 진료, 기록을 하나의 시스템에서.' },
        { lane: 'owner', title: '요약과 사후 관리', body: '진료 요약과 다음 알림이 앱으로 돌아옵니다.' },
      ],
      urgency: ['응급', '24–48시간 내 진료', '집에서 관찰', '뚜렷한 이상 없음'],
    },
    mascots: {
      eyebrow: 'Meet the characters', title: '만나 보세요,', titleEm: 'FUFU Dog & Cat',
      dog: { name: 'FUFU Dog', tag: '착하고 밝은', body: '매일의 건강 관리를 돕고 투약과 진료 시간을 알려 줍니다.' },
      cat: { name: 'FUFU Cat', tag: '똑똑하고 애교 많은', body: '관찰력이 뛰어난 도우미로 초기 징후를 읽고 AI로 질문에 답합니다.' },
    },
    partners: {
      eyebrow: 'FUFU Partner', title: '동물병원과', titleEm: '반려동물 사업자를 위해',
      lede: '동물병원, 펫숍, 미용실, 펫호텔을 위한 관리 시스템. PC, 태블릿, 모바일에서 사용할 수 있습니다.',
      items: ['예약과 캘린더', '스크리닝 의뢰', '진료 요약', 'FUFU App 병원 프로필'],
      login: '파트너 로그인', join: '파트너 가입',
    },
    trust: {
      eyebrow: 'Intellectual property', title: '저작권 등록', titleEm: '작품',
      lede: '태국 지식재산청에 어문저작물(컴퓨터 프로그램)로 등록되었습니다.',
      registry: '등록번호', filed: '신고일',
      works: [
        { title: 'FUFU Pet Care', filed: '2026년 3월 20일' },
        { title: '사진으로 개·고양이 피부 질환을 탐지·분석하는 AI 모델', filed: '2026년 4월 27일' },
        { title: 'Smart AI Veterinary Assistant Chatbot', filed: '2026년 10월 31일' },
        { title: 'FUFU Partner Portal: Pet Business Management System', filed: '2026년 11월 1일' },
      ],
      tech: '핵심 기술',
    },
    footer: {
      tagline: '가정, 병원, 서비스를 연결하는 반려동물 헬스케어 플랫폼.',
      songs: '브랜드 송', rights: 'All rights reserved',
    },
    music: { play: '음악 재생', pause: '음악 끄기', title: 'FUFU 테마송' },
    lang: '언어 변경',
  },
}

export const REGISTRY = ['ว1.000520', 'ว1.000636', 'ว1.001745', 'ว1.001746']

export const REQUESTS = ['469572', '471127', '485009', '485016']

// ── Additional copy (v3 landing: free launch, partner pitch, interactive mascots) ──
const extra = {
  th: {
    free: { badge: 'ฟรี', title: 'เจ้าของสัตว์เลี้ยงใช้ฟรี', titleEm: 'ทุกฟีเจอร์', body: 'แอป FUFU สำหรับเจ้าของสัตว์เลี้ยงไม่มีค่าสมัครและไม่มีค่ารายเดือน ถ้าอยากให้ FUFU เติบโตต่อไป ร่วมสนับสนุนได้ทันทีที่นี่ หรือผ่านเมนูบริจาคในแอป', donate: 'ร่วมบริจาคได้ในแอป' },
    partners: {
      title: 'เพิ่มลูกค้า ลดงานหน้าร้าน', titleEm: 'ด้วย FUFU Partner',
      lede: 'ระบบหลังบ้านสำหรับคลินิก ร้านค้า ร้านตัดแต่งขน และโรงแรมสัตว์เลี้ยง เชื่อมตรงกับเจ้าของสัตว์ที่ใช้ FUFU App',
      benefits: [
        { title: 'ลูกค้าใหม่จาก FUFU App', body: 'ร้านของคุณขึ้นบนแผนที่และผลค้นหา เจ้าของสัตว์จองนัดได้ทันที' },
        { title: 'เคสมาพร้อมข้อมูล', body: 'เห็นภาพ อาการ และระดับความเร่งด่วนจาก AI ก่อนน้องมาถึง' },
        { title: 'ลดงานหน้าร้าน', body: 'นัดหมาย ปฏิทิน และการยืนยันอยู่ในที่เดียว ไม่ต้องโทรตามทีละคน' },
        { title: 'ดูแลต่อเนื่อง', body: 'ส่งสรุปการรักษาและนัดติดตามกลับเข้าแอปของเจ้าของโดยตรง' },
      ],
      freeChip: 'คลินิกทดลองฟรี 3 เดือน', login: 'เข้าสู่ระบบพาร์ทเนอร์', join: 'สมัครเป็นพาร์ทเนอร์',
      mock: { today: 'นัดวันนี้', pending: 'รอยืนยัน', referrals: 'เคส AI ใหม่', referralTitle: 'เคสส่งต่อจาก FUFU App', pet: 'มะลิ · แมว 3 ปี', concern: 'ผื่นแดงบริเวณใบหู', urgency: 'พบสัตวแพทย์ใน 24–48 ชม.', accept: 'รับเคส', schedule: 'นัดหมายวันนี้', week: 'นัดหมาย 7 วัน', confirmed: 'ยืนยันแล้ว', waiting: 'รอยืนยัน' },
    },
    mascots: { hint: 'แตะที่น้องดูสิ', dogSays: ['ถึงเวลากินยาแล้วนะ!', 'วันนี้ไปเดินเล่นกัน!', 'อย่าลืมนัดฉีดวัคซีนนะ'], catSays: ['ผื่นแปลก ๆ? สแกนดูก่อนเลย', 'ถาม AI Vet ได้ตลอดเวลา', 'เหมียว~ ดูแลกันดีมาก'] },
    trust: { title: 'นวัตกรรมของเราเอง', titleEm: 'แจ้งลิขสิทธิ์แล้ว 4 ผลงาน', lede: 'ทุกชิ้นพัฒนาโดยทีม KITTEN CODE และแจ้งข้อมูลลิขสิทธิ์ต่อกรมทรัพย์สินทางปัญญา ประเภทวรรณกรรม (โปรแกรมคอมพิวเตอร์)', badge: 'แจ้งข้อมูลแล้ว', request: 'คำขอเลขที่', kinds: ['แอปพลิเคชันดูแลสุขภาพสัตว์เลี้ยง', 'AI คัดกรองโรคผิวหนังจากภาพถ่าย', 'ผู้ช่วยสัตวแพทย์ AI แบบสนทนา', 'ระบบบริหารคลินิกและธุรกิจสัตว์เลี้ยง'] },
  },
  en: {
    free: { badge: 'Free', title: 'Free for pet owners', titleEm: 'every feature', body: 'The FUFU app for pet owners has no sign-up fee and no monthly fee. If you’d like to help FUFU grow, you can support us right here or through the donation menu in the app.', donate: 'Donate in the app' },
    partners: {
      title: 'More clients, less front-desk work', titleEm: 'with FUFU Partner',
      lede: 'A back office for clinics, shops, groomers and pet hotels — connected directly to pet owners on FUFU App.',
      benefits: [
        { title: 'New clients from FUFU App', body: 'Your business appears on the map and in search; owners can book right away.' },
        { title: 'Cases arrive with context', body: 'See photos, symptoms and AI urgency before the pet walks in.' },
        { title: 'Less admin', body: 'Appointments, calendar and confirmations in one place — no more call-backs.' },
        { title: 'Continuous care', body: 'Send visit summaries and follow-ups straight to the owner’s app.' },
      ],
      freeChip: 'Clinics: 3 months free', login: 'Partner login', join: 'Become a partner',
      mock: { today: 'Today', pending: 'Pending', referrals: 'New AI cases', referralTitle: 'Referral from FUFU App', pet: 'Mali · cat, 3 yrs', concern: 'Red rash on the ear', urgency: 'See a vet in 24–48 h', accept: 'Accept', schedule: 'Today’s appointments', week: '7-day bookings', confirmed: 'Confirmed', waiting: 'Pending' },
    },
    mascots: { hint: 'Tap them!', dogSays: ['Time for medicine!', 'Walk time today!', 'Vaccine visit soon!'], catSays: ['Odd rash? Scan it first', 'Ask AI Vet any time', 'Meow~ great job!'] },
    trust: { title: 'Our own innovation,', titleEm: '4 registered works', lede: 'Built by the KITTEN CODE team and recorded with Thailand’s Department of Intellectual Property as literary works (computer programs).', badge: 'Registered', request: 'Request no.', kinds: ['Pet health app', 'AI skin-disease screening from photos', 'Conversational AI vet assistant', 'Clinic & pet business management'] },
  },
  zh: {
    free: { badge: '免费', title: '宠物主人', titleEm: '全部功能免费', body: '面向宠物主人的 FUFU 应用无注册费、无月费。如果您希望 FUFU 持续成长，可以直接在这里或通过应用内的捐助菜单支持我们。', donate: '在应用内捐助' },
    partners: {
      title: '获客更多，前台更轻松', titleEm: '用 FUFU Partner',
      lede: '为诊所、宠物店、美容店和宠物酒店打造的后台系统，直接连接 FUFU App 上的宠物主人。',
      benefits: [
        { title: '来自 FUFU App 的新客户', body: '您的门店出现在地图和搜索结果中，主人可立即预约。' },
        { title: '病例附带完整信息', body: '宠物到店前即可查看照片、症状和 AI 紧急程度。' },
        { title: '减少前台工作', body: '预约、日历和确认集中管理，无需逐一致电。' },
        { title: '持续关怀', body: '诊疗摘要和随访提醒直接发送到主人的应用。' },
      ],
      freeChip: '诊所免费试用 3 个月', login: '合作伙伴登录', join: '成为合作伙伴',
      mock: { today: '今日预约', pending: '待确认', referrals: '新 AI 病例', referralTitle: '来自 FUFU App 的转诊', pet: 'Mali · 猫 3 岁', concern: '耳部红疹', urgency: '24–48 小时内就医', accept: '接收', schedule: '今日预约', week: '7 天预约', confirmed: '已确认', waiting: '待确认' },
    },
    mascots: { hint: '点点它们！', dogSays: ['该吃药啦！', '今天去散步吧！', '别忘了打疫苗哦'], catSays: ['皮疹奇怪？先扫一扫', '随时问 AI 兽医', '喵~ 照顾得真好'] },
    trust: { title: '自主创新，', titleEm: '4 项著作权登记', lede: '全部由 KITTEN CODE 团队开发，并向泰国知识产权厅登记为文字作品（计算机程序）。', badge: '已登记', request: '申请号', kinds: ['宠物健康应用', '基于照片的皮肤病 AI 筛查', '对话式 AI 兽医助手', '诊所与宠物企业管理系统'] },
  },
  ja: {
    free: { badge: '無料', title: '飼い主さんは', titleEm: '全機能が無料', body: '飼い主さん向けの FUFU アプリは登録料も月額料金もありません。FUFU を応援したい方は、ここから、またはアプリ内の寄付メニューからご支援いただけます。', donate: 'アプリ内で寄付' },
    partners: {
      title: '集客を増やし、受付業務を減らす', titleEm: 'FUFU Partner で',
      lede: '動物病院、ショップ、トリミング、ペットホテル向けの管理システム。FUFU App の飼い主と直接つながります。',
      benefits: [
        { title: 'FUFU App から新規顧客', body: '地図と検索に表示され、飼い主がすぐに予約できます。' },
        { title: '情報付きで届く症例', body: '来院前に写真・症状・AI の緊急度を確認できます。' },
        { title: '受付業務を削減', body: '予約・カレンダー・確認を一元化。電話での確認は不要です。' },
        { title: '継続的なケア', body: '診療サマリーと再診案内を飼い主のアプリへ直接送信。' },
      ],
      freeChip: '病院は3か月無料', login: 'パートナーログイン', join: 'パートナー登録',
      mock: { today: '本日の予約', pending: '確認待ち', referrals: '新しい AI 症例', referralTitle: 'FUFU App からの紹介', pet: 'マリ · 猫 3歳', concern: '耳の赤い発疹', urgency: '24〜48時間以内に受診', accept: '受け付ける', schedule: '本日の予約', week: '7日間の予約', confirmed: '確定', waiting: '確認待ち' },
    },
    mascots: { hint: 'タップしてみて！', dogSays: ['お薬の時間だよ！', '今日はお散歩しよう！', 'ワクチンを忘れずに'], catSays: ['気になる発疹？まずスキャン', 'AI 獣医にいつでも相談', 'にゃ〜 よくできました'] },
    trust: { title: '自社開発のイノベーション、', titleEm: '著作権届出 4 件', lede: 'すべて KITTEN CODE チームが開発し、タイ知的財産局に言語の著作物（コンピュータプログラム）として届出済みです。', badge: '届出済み', request: '申請番号', kinds: ['ペット健康アプリ', '写真による皮膚疾患 AI スクリーニング', '対話型 AI 獣医アシスタント', 'クリニック・ペット事業管理'] },
  },
  ko: {
    free: { badge: '무료', title: '보호자는', titleEm: '모든 기능 무료', body: '보호자용 FUFU 앱은 가입비도 월 요금도 없습니다. FUFU의 성장을 응원하고 싶다면 여기에서 바로 또는 앱의 후원 메뉴로 후원해 주세요.', donate: '앱에서 후원하기' },
    partners: {
      title: '고객은 늘리고 접수 업무는 줄이고', titleEm: 'FUFU Partner로',
      lede: '동물병원, 펫숍, 미용실, 펫호텔을 위한 관리 시스템으로 FUFU App 보호자와 바로 연결됩니다.',
      benefits: [
        { title: 'FUFU App 신규 고객', body: '지도와 검색에 노출되어 보호자가 바로 예약할 수 있습니다.' },
        { title: '정보와 함께 오는 케이스', body: '내원 전에 사진, 증상, AI 긴급도를 미리 확인합니다.' },
        { title: '접수 업무 감소', body: '예약, 캘린더, 확인을 한곳에서. 일일이 전화할 필요가 없습니다.' },
        { title: '지속적인 관리', body: '진료 요약과 재진 알림을 보호자 앱으로 바로 보냅니다.' },
      ],
      freeChip: '병원 3개월 무료 체험', login: '파트너 로그인', join: '파트너 가입',
      mock: { today: '오늘 예약', pending: '확인 대기', referrals: '새 AI 케이스', referralTitle: 'FUFU App 의뢰', pet: '말리 · 고양이 3살', concern: '귀 부위 붉은 발진', urgency: '24–48시간 내 진료', accept: '접수', schedule: '오늘 예약', week: '7일 예약', confirmed: '확정', waiting: '대기' },
    },
    mascots: { hint: '눌러 보세요!', dogSays: ['약 먹을 시간이야!', '오늘 산책 가자!', '예방접종 잊지 마'], catSays: ['이상한 발진? 먼저 스캔해요', 'AI 수의사에게 언제든 질문', '냐옹~ 잘하고 있어'] },
    trust: { title: '자체 개발 혁신,', titleEm: '저작권 등록 4건', lede: '모두 KITTEN CODE 팀이 개발했으며 태국 지식재산청에 어문저작물(컴퓨터 프로그램)로 등록했습니다.', badge: '등록 완료', request: '신청번호', kinds: ['반려동물 건강 앱', '사진 기반 피부질환 AI 스크리닝', '대화형 AI 수의사 도우미', '병원·반려동물 사업 관리 시스템'] },
  },
}

for (const [code, add] of Object.entries(extra)) {
  const base = messages[code]
  base.free = add.free
  base.partners = { ...base.partners, ...add.partners }
  base.mascots = { ...base.mascots, ...add.mascots }
  base.trust = { ...base.trust, ...add.trust }
}

const NAV_TRUST = { th: 'ลิขสิทธิ์', en: 'IP', zh: '著作权', ja: '著作権', ko: '저작권' }
for (const [code, label] of Object.entries(NAV_TRUST)) messages[code].nav.trust = label

// ── Pricing for clinics (website section #pricing; prices come from /api/public/plans) ──
const PRICING = {
  th: {
    nav: 'ราคา', title: 'แพ็กเกจสำหรับคลินิก', titleEm: 'ทดลองฟรี 3 เดือน',
    lede: 'ใช้ระบบคลินิกครบทุกเมนู ลูกค้าของคุณใช้แอป FUFU ฟรี แพ็กเกจต่างกันที่จำนวนผู้ใช้เท่านั้น',
    monthly: 'รายเดือน', yearly: 'รายปี', save: 'ฟรี 2 เดือน', perMonth: '/เดือน', perYear: '/ปี', eq: 'เฉลี่ย {price}/เดือน',
    users: 'ผู้ใช้ {n} คน', unlimited: 'ผู้ใช้ไม่จำกัด', popular: 'แนะนำ', cta: 'เริ่มทดลองฟรี',
    features: ['ระบบคลินิกครบทุกเมนู: นัดหมาย คิว OPD IPD POS สต็อก', 'ลูกค้าใช้แอป FUFU ฟรี เชื่อมกับคลินิกได้ไม่จำกัด', 'แชทและโทรหาลูกค้า', 'รับเคสสแกน AI และการแชร์ฉุกเฉิน'],
  },
  en: {
    nav: 'Pricing', title: 'Packages for clinics', titleEm: '3 months free',
    lede: 'The full clinic system, and your customers use the FUFU app free. Packages differ only by the number of users.',
    monthly: 'Monthly', yearly: 'Yearly', save: '2 months free', perMonth: '/month', perYear: '/year', eq: '{price}/month',
    users: '{n} users', unlimited: 'Unlimited users', popular: 'Popular', cta: 'Start free trial',
    features: ['Full clinic system: bookings, queue, OPD, IPD, POS, stock', 'Customers use the FUFU app free, unlimited links', 'Chat and call customers', 'AI scan referrals and emergency sharing'],
  },
  zh: {
    nav: '价格', title: '诊所套餐', titleEm: '免费试用 3 个月',
    lede: '完整的诊所系统，顾客免费使用 FUFU 应用。套餐仅按用户数区分。',
    monthly: '按月', yearly: '按年', save: '免 2 个月', perMonth: '/月', perYear: '/年', eq: '折合 {price}/月',
    users: '{n} 位用户', unlimited: '不限用户', popular: '推荐', cta: '开始免费试用',
    features: ['完整诊所系统：预约、排队、门诊、住院、收银、库存', '顾客免费使用 FUFU 应用，连接不限', '与顾客聊天和通话', 'AI 扫描转诊与紧急分享'],
  },
  ja: {
    nav: '料金', title: '動物病院向けプラン', titleEm: '3か月無料',
    lede: '病院システムの全機能。お客様は FUFU アプリを無料で使えます。プランの違いはユーザー数だけです。',
    monthly: '月払い', yearly: '年払い', save: '2か月無料', perMonth: '/月', perYear: '/年', eq: '月あたり {price}',
    users: 'ユーザー {n} 人', unlimited: 'ユーザー無制限', popular: 'おすすめ', cta: '無料で試す',
    features: ['病院システム全機能：予約・受付・外来・入院・POS・在庫', 'お客様はアプリ無料、連携数無制限', 'お客様とチャット・電話', 'AIスキャンの紹介と緊急共有'],
  },
  ko: {
    nav: '요금', title: '동물병원 패키지', titleEm: '3개월 무료',
    lede: '병원 시스템 전체 기능, 고객은 FUFU 앱을 무료로 사용해요. 패키지는 사용자 수만 달라요.',
    monthly: '월간', yearly: '연간', save: '2개월 무료', perMonth: '/월', perYear: '/년', eq: '월 {price}',
    users: '사용자 {n}명', unlimited: '사용자 무제한', popular: '추천', cta: '무료 체험 시작',
    features: ['병원 시스템 전체: 예약, 대기, 외래, 입원, POS, 재고', '고객은 FUFU 앱 무료, 연결 무제한', '고객과 채팅·전화', 'AI 스캔 의뢰와 긴급 공유'],
  },
}
for (const [code, copy] of Object.entries(PRICING)) { messages[code].pricing = copy; messages[code].nav.pricing = copy.nav }

// ── Ecosystem diagram (second slide of the "flow" section) ─────────────────────
const ECO = {
  th: {
    tabs: { journey: 'เส้นทางการดูแล', system: 'ระบบเชื่อมต่อทั้งหมด' },
    lede: 'FUFU App, FUFU Cloud และ FUFU Partner ใช้ข้อมูลชุดเดียวกันแบบเรียลไทม์ ทุกการกระทำฝั่งหนึ่งไปถึงอีกฝั่งทันที',
    cols: { owner: 'เจ้าของสัตว์เลี้ยง', cloud: 'FUFU Cloud', partner: 'พาร์ทเนอร์' },
    app: { title: 'FUFU App', sub: 'iOS · Android · Web', items: ['AI Scan', 'AI Vet Chat', 'สมุดสุขภาพ', 'จองนัด', 'ร้านค้า', 'Rewards'] },
    api: { title: 'FUFU API', sub: 'ข้อมูลกลางของทั้งระบบ', items: ['บัญชีผู้ใช้', 'ข้อมูลน้องและนัดหมาย', 'รูปภาพสแกน', 'แจ้งเตือนเรียลไทม์'] },
    ai: [{ title: 'AI Vision', sub: 'YOLO · คัดกรองผิวหนัง' }, { title: 'AI Vet', sub: 'NLP · แชทตอบคำถาม' }, { title: 'Health Insight', sub: 'LSTM · คาดการณ์สุขภาพ' }],
    partner: { title: 'FUFU Partner', sub: 'Web · Tablet · Mobile', kinds: ['คลินิก', 'ร้านค้า', 'อาบน้ำตัดขน', 'โรงแรมสัตว์'], items: ['นัดหมาย', 'เคส AI', 'สรุปการรักษา', 'โปรไฟล์ร้าน'] },
    journeys: [
      { title: 'สแกนอาการ', body: 'ภาพจากแอปส่งเข้า FUFU API แล้ว AI Vision ประเมินความเร่งด่วนกลับมาในไม่กี่วินาที' },
      { title: 'ถาม AI Vet', body: 'คำถามของเจ้าของถูกส่งไปที่ AI Vet พร้อมข้อมูลของน้อง แล้วตอบกลับเข้าแอป' },
      { title: 'จองนัดและส่งเคส', body: 'นัดหมายและเคสที่เจ้าของยินยอมส่ง ไปถึงหลังบ้านคลินิกแบบเรียลไทม์' },
      { title: 'คลินิกดูแลและบันทึก', body: 'คลินิกยืนยันนัด ตรวจรักษา และบันทึกสรุปเข้าระบบ โปรไฟล์ร้านขึ้นบนแผนที่ในแอปทันที' },
      { title: 'ข้อมูลกลับถึงเจ้าของ', body: 'สรุปการรักษา การแจ้งเตือน และการคาดการณ์สุขภาพกลับเข้าแอปของเจ้าของ' },
    ],
    realtime: 'เรียลไทม์', prev: 'ก่อนหน้า', next: 'ถัดไป',
  },
  en: {
    tabs: { journey: 'Care journey', system: 'Connected system' },
    lede: 'FUFU App, FUFU Cloud and FUFU Partner share one real-time data layer — every action on one side reaches the other instantly.',
    cols: { owner: 'Pet owners', cloud: 'FUFU Cloud', partner: 'Partners' },
    app: { title: 'FUFU App', sub: 'iOS · Android · Web', items: ['AI Scan', 'AI Vet Chat', 'Health book', 'Booking', 'Shop', 'Rewards'] },
    api: { title: 'FUFU API', sub: 'The shared data hub', items: ['Accounts', 'Pets & appointments', 'Scan images', 'Real-time alerts'] },
    ai: [{ title: 'AI Vision', sub: 'YOLO · skin screening' }, { title: 'AI Vet', sub: 'NLP · chat answers' }, { title: 'Health Insight', sub: 'LSTM · health prediction' }],
    partner: { title: 'FUFU Partner', sub: 'Web · Tablet · Mobile', kinds: ['Clinics', 'Shops', 'Groomers', 'Pet hotels'], items: ['Appointments', 'AI cases', 'Visit summaries', 'Store profile'] },
    journeys: [
      { title: 'Scan a symptom', body: 'A photo goes from the app to FUFU API; AI Vision returns an urgency level within seconds.' },
      { title: 'Ask AI Vet', body: 'The owner’s question goes to AI Vet with the pet’s context, and the answer returns to the app.' },
      { title: 'Book & refer', body: 'Appointments and consented cases reach the clinic’s back office in real time.' },
      { title: 'Clinic care & records', body: 'The clinic confirms, treats and records a summary; its profile appears on the in-app map.' },
      { title: 'Back to the owner', body: 'Visit summaries, reminders and health insights flow back into the owner’s app.' },
    ],
    realtime: 'Real-time', prev: 'Previous', next: 'Next',
  },
  zh: {
    tabs: { journey: '照护流程', system: '系统全景' },
    lede: 'FUFU App、FUFU Cloud 与 FUFU Partner 共享同一套实时数据，一端的操作即时到达另一端。',
    cols: { owner: '宠物主人', cloud: 'FUFU Cloud', partner: '合作伙伴' },
    app: { title: 'FUFU App', sub: 'iOS · Android · Web', items: ['AI 扫描', 'AI 兽医聊天', '健康手册', '预约', '商城', '积分奖励'] },
    api: { title: 'FUFU API', sub: '系统共享数据中心', items: ['用户账号', '宠物与预约', '扫描图片', '实时通知'] },
    ai: [{ title: 'AI Vision', sub: 'YOLO · 皮肤筛查' }, { title: 'AI Vet', sub: 'NLP · 对话解答' }, { title: 'Health Insight', sub: 'LSTM · 健康预测' }],
    partner: { title: 'FUFU Partner', sub: 'Web · 平板 · 手机', kinds: ['诊所', '宠物店', '美容', '宠物酒店'], items: ['预约', 'AI 病例', '诊疗摘要', '门店资料'] },
    journeys: [
      { title: '扫描症状', body: '照片从应用发送到 FUFU API，AI Vision 数秒内返回紧急程度。' },
      { title: '询问 AI 兽医', body: '主人的问题连同宠物信息发送给 AI Vet，答案返回应用。' },
      { title: '预约与转诊', body: '预约和经同意的病例实时到达诊所后台。' },
      { title: '诊所照护与记录', body: '诊所确认、诊疗并记录摘要；门店资料即时出现在应用地图上。' },
      { title: '回到主人手中', body: '诊疗摘要、提醒和健康预测回流到主人的应用。' },
    ],
    realtime: '实时', prev: '上一个', next: '下一个',
  },
  ja: {
    tabs: { journey: 'ケアの流れ', system: 'システム全体' },
    lede: 'FUFU App・FUFU Cloud・FUFU Partner は同じデータをリアルタイムで共有。片方の操作がすぐにもう片方へ届きます。',
    cols: { owner: '飼い主', cloud: 'FUFU Cloud', partner: 'パートナー' },
    app: { title: 'FUFU App', sub: 'iOS · Android · Web', items: ['AI スキャン', 'AI 獣医チャット', '健康手帳', '予約', 'ショップ', 'リワード'] },
    api: { title: 'FUFU API', sub: 'システム共通のデータハブ', items: ['アカウント', 'ペットと予約', 'スキャン画像', 'リアルタイム通知'] },
    ai: [{ title: 'AI Vision', sub: 'YOLO · 皮膚スクリーニング' }, { title: 'AI Vet', sub: 'NLP · チャット回答' }, { title: 'Health Insight', sub: 'LSTM · 健康予測' }],
    partner: { title: 'FUFU Partner', sub: 'Web · タブレット · スマホ', kinds: ['動物病院', 'ショップ', 'トリミング', 'ペットホテル'], items: ['予約', 'AI 症例', '診療サマリー', '店舗プロフィール'] },
    journeys: [
      { title: '症状をスキャン', body: '写真がアプリから FUFU API へ送られ、AI Vision が数秒で緊急度を返します。' },
      { title: 'AI 獣医に相談', body: '飼い主の質問がペット情報とともに AI Vet へ届き、回答がアプリに戻ります。' },
      { title: '予約と紹介', body: '予約と同意済みの症例がリアルタイムでクリニックの管理画面に届きます。' },
      { title: 'クリニックのケアと記録', body: 'クリニックが確認・診療しサマリーを記録。店舗情報はアプリの地図にすぐ表示されます。' },
      { title: '飼い主へ戻る', body: '診療サマリー、リマインダー、健康予測が飼い主のアプリに戻ります。' },
    ],
    realtime: 'リアルタイム', prev: '前へ', next: '次へ',
  },
  ko: {
    tabs: { journey: '케어 여정', system: '연결된 시스템' },
    lede: 'FUFU App, FUFU Cloud, FUFU Partner는 하나의 실시간 데이터를 공유합니다. 한쪽의 행동이 즉시 다른 쪽에 전달됩니다.',
    cols: { owner: '보호자', cloud: 'FUFU Cloud', partner: '파트너' },
    app: { title: 'FUFU App', sub: 'iOS · Android · Web', items: ['AI 스캔', 'AI 수의사 채팅', '건강 수첩', '예약', '쇼핑', '리워드'] },
    api: { title: 'FUFU API', sub: '시스템 공통 데이터 허브', items: ['계정', '반려동물·예약', '스캔 이미지', '실시간 알림'] },
    ai: [{ title: 'AI Vision', sub: 'YOLO · 피부 스크리닝' }, { title: 'AI Vet', sub: 'NLP · 채팅 답변' }, { title: 'Health Insight', sub: 'LSTM · 건강 예측' }],
    partner: { title: 'FUFU Partner', sub: 'Web · 태블릿 · 모바일', kinds: ['동물병원', '펫숍', '미용', '펫호텔'], items: ['예약', 'AI 케이스', '진료 요약', '매장 프로필'] },
    journeys: [
      { title: '증상 스캔', body: '사진이 앱에서 FUFU API로 전송되고 AI Vision이 몇 초 만에 긴급도를 알려 줍니다.' },
      { title: 'AI 수의사에게 질문', body: '보호자의 질문이 반려동물 정보와 함께 AI Vet에 전달되고 답변이 앱으로 돌아옵니다.' },
      { title: '예약과 의뢰', body: '예약과 동의한 케이스가 병원 관리 화면에 실시간으로 도착합니다.' },
      { title: '병원 진료와 기록', body: '병원이 확인·진료하고 요약을 기록합니다. 매장 프로필은 앱 지도에 바로 표시됩니다.' },
      { title: '다시 보호자에게', body: '진료 요약, 알림, 건강 예측이 보호자 앱으로 돌아옵니다.' },
    ],
    realtime: '실시간', prev: '이전', next: '다음',
  },
}
for (const [code, eco] of Object.entries(ECO)) messages[code].eco = eco

const HERO_ALT = {
  th: 'ลูกสุนัขโกลเด้นและลูกแมววิ่งเล่นบนสนามหญ้า',
  en: 'A golden puppy and a kitten running on the grass',
  zh: '金毛幼犬和小猫在草地上奔跑',
  ja: '芝生を走るゴールデンの子犬と子猫',
  ko: '잔디밭을 달리는 골든 강아지와 아기 고양이',
}
for (const [code, alt] of Object.entries(HERO_ALT)) messages[code].hero.photoAlt = alt

// ── "Open FUFU App" call-to-action (web app) ───────────────────────────────────
const APP_ORIGIN = (process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://app.fufupetcare.com').replace(/\/$/, '')
export const APP_URL = `${APP_ORIGIN}/auth`
const APP_CTA = {
  th: { open: 'เข้าใช้งาน FUFU App', short: 'เปิดแอป', try: 'ลองใช้ FUFU App ฟรี', note: 'ใช้งานผ่านเว็บได้ทันที ไม่ต้องติดตั้ง' },
  en: { open: 'Open FUFU App', short: 'Open app', try: 'Try FUFU App free', note: 'Runs in your browser — nothing to install' },
  zh: { open: '打开 FUFU App', short: '打开应用', try: '免费试用 FUFU App', note: '网页即可使用，无需安装' },
  ja: { open: 'FUFU App を開く', short: 'アプリを開く', try: 'FUFU App を無料で試す', note: 'ブラウザですぐ使えます。インストール不要' },
  ko: { open: 'FUFU App 열기', short: '앱 열기', try: 'FUFU App 무료로 사용하기', note: '설치 없이 브라우저에서 바로 사용' },
}
for (const [code, cta] of Object.entries(APP_CTA)) messages[code].app = cta

// ── Donation panel on the landing page (public company bank account only) ─────
export const DONATION = {
  bankLogo: '/img/donation/kasikorn-logo.png',
  accountNumber: '226-3-92729-2',
  accountName: 'คิทเท่น โค้ด (Kitten Code Co., Ltd.)',
  email: 'kittencode.co.ltd@gmail.com',
  appUrl: `${APP_ORIGIN}/donation`,
  paypalQr: '/img/donation/paypal-kitten.jpg',
}
const DONATE = {
  th: { ppTitle: 'บริจาคผ่าน PayPal', ppNote: 'สแกน QR ด้วยแอป PayPal และตรวจชื่อผู้รับก่อนยืนยัน', ppSave: 'บันทึก QR', open: 'ร่วมบริจาคเลย', close: 'ซ่อนรายละเอียด', title: 'โอนผ่านบัญชีธนาคาร', bank: 'ธนาคารกสิกรไทย', name: 'ชื่อบัญชี', number: 'เลขบัญชี', copy: 'คัดลอกเลขบัญชี', copied: 'คัดลอกแล้ว', note: 'ตรวจชื่อบัญชีและยอดเงินในแอปธนาคารทุกครั้งก่อนยืนยัน การบริจาคเป็นไปตามความสมัครใจ และไม่เปลี่ยนสิทธิ์การใช้งานแอป', paypal: 'บริจาคผ่าน PayPal QR ได้ในแอป', ask: 'สอบถามเรื่องการบริจาค', uses: ['ค่าระบบ AI และเซิร์ฟเวอร์', 'ให้เจ้าของสัตว์ใช้ฟรีต่อไป', 'พัฒนาฟีเจอร์ใหม่'] },
  en: { ppTitle: 'Donate with PayPal', ppNote: 'Scan the QR with the PayPal app and check the recipient before confirming.', ppSave: 'Save QR', open: 'Donate now', close: 'Hide details', title: 'Bank transfer', bank: 'Kasikorn Bank', name: 'Account name', number: 'Account number', copy: 'Copy account number', copied: 'Copied', note: 'Always check the account name and amount in your banking app before confirming. Donations are voluntary and do not change your app access.', paypal: 'PayPal QR is available in the app', ask: 'Questions about donating', uses: ['AI and server costs', 'Keeping FUFU free', 'New features'] },
  zh: { ppTitle: '通过 PayPal 捐助', ppNote: '请用 PayPal 应用扫描二维码，并在确认前核对收款人。', ppSave: '保存二维码', open: '立即捐助', close: '收起详情', title: '银行转账', bank: '开泰银行', name: '账户名', number: '账号', copy: '复制账号', copied: '已复制', note: '确认前请务必在银行应用中核对账户名和金额。捐助完全自愿，不影响应用使用权限。', paypal: '应用内可使用 PayPal 二维码捐助', ask: '捐助相关咨询', uses: ['AI 与服务器费用', '让 FUFU 持续免费', '开发新功能'] },
  ja: { ppTitle: 'PayPal で寄付', ppNote: 'PayPal アプリで QR を読み取り、確定前に受取人をご確認ください。', ppSave: 'QR を保存', open: '今すぐ寄付する', close: '詳細を閉じる', title: '銀行振込', bank: 'カシコン銀行', name: '口座名義', number: '口座番号', copy: '口座番号をコピー', copied: 'コピーしました', note: '確定前に、銀行アプリで口座名義と金額を必ずご確認ください。寄付は任意で、アプリの利用権限は変わりません。', paypal: 'PayPal QR はアプリ内で利用できます', ask: '寄付についてのお問い合わせ', uses: ['AI とサーバーの費用', 'FUFU を無料で続けるため', '新機能の開発'] },
  ko: { ppTitle: 'PayPal로 후원', ppNote: 'PayPal 앱으로 QR을 스캔하고 확인 전에 받는 분을 확인하세요.', ppSave: 'QR 저장', open: '지금 후원하기', close: '내용 접기', title: '계좌 이체', bank: '카시콘 은행', name: '예금주', number: '계좌번호', copy: '계좌번호 복사', copied: '복사했어요', note: '확인 전에 은행 앱에서 예금주와 금액을 꼭 확인하세요. 후원은 자율이며 앱 이용 권한은 바뀌지 않아요.', paypal: 'PayPal QR은 앱에서 이용할 수 있어요', ask: '후원 문의', uses: ['AI와 서버 비용', 'FUFU 무료 운영', '새 기능 개발'] },
}
for (const [code, d] of Object.entries(DONATE)) messages[code].donate = d

// ── Seller details (required on the website by law and by payment providers) ──
// From the company registration certificate (DBD) and the contact details the company gave.
export const COMPANY = {
  nameTh: 'บริษัท คิทเทน โคด จำกัด',
  nameEn: 'KITTEN CODE CO., LTD.',
  taxId: '0655569001411',
  addressTh: '347/11 หมู่ 3 ตำบลท่าโพธิ์ อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก 65000',
  addressEn: '347/11 Moo 3, Tha Pho, Mueang Phitsanulok, Phitsanulok 65000, Thailand',
  phones: ['+66 8 0885 0555', '+66 8 3330 3393'],
  email: 'kittencode.co.ltd@gmail.com',
  website: 'https://kitten-code.com/',
}
export const PRIVACY_URL = `${APP_ORIGIN}/privacy`
const LEGAL = {
  th: { seller: 'ผู้ให้บริการ', taxId: 'เลขประจำตัวผู้เสียภาษี', address: 'ที่อยู่', phone: 'โทร', email: 'อีเมล', website: 'เว็บไซต์บริษัท', terms: 'ข้อกำหนดการใช้บริการและการคืนเงิน', privacy: 'นโยบายความเป็นส่วนตัว' },
  en: { seller: 'Service provider', taxId: 'Tax ID', address: 'Address', phone: 'Phone', email: 'Email', website: 'Company website', terms: 'Terms of service & refunds', privacy: 'Privacy policy' },
  zh: { seller: '服务提供方', taxId: '纳税人识别号', address: '地址', phone: '电话', email: '邮箱', website: '公司网站', terms: '服务条款与退款', privacy: '隐私政策' },
  ja: { seller: '提供事業者', taxId: '納税者番号', address: '所在地', phone: '電話', email: 'メール', website: '会社サイト', terms: '利用規約・返金', privacy: 'プライバシーポリシー' },
  ko: { seller: '서비스 제공자', taxId: '납세자 번호', address: '주소', phone: '전화', email: '이메일', website: '회사 웹사이트', terms: '이용약관 및 환불', privacy: '개인정보 처리방침' },
}
for (const [code, copy] of Object.entries(LEGAL)) messages[code].legal = copy

// ── Pricing section extras: net prices (FUFU is not VAT-registered), what every package includes, terms, FAQ, sales contact ──
const PRICING_MORE = {
  th: {
    notes: ['ทดลองฟรี 3 เดือน ไม่ต้องใช้บัตร', 'ไม่ต่ออายุหรือตัดเงินอัตโนมัติ', 'ราคาสุทธิ ไม่มีค่าใช้จ่ายอื่นเพิ่ม', 'ออกใบแจ้งหนี้และใบเสร็จทุกครั้ง'],
    net: 'ราคาสุทธิ',
    allTitle: 'ทุกแพ็กเกจได้ครบทุกฟีเจอร์',
    all: ['นัดหมาย ปฏิทิน และรับจองจากแอป FUFU', 'คิว OPD ห้องตรวจ และ IPD ผู้ป่วยใน', 'แคชเชียร์ POS ใบเสร็จ และใบกำกับภาษี', 'คลังยาและเวชภัณฑ์', 'เตือนวัคซีนและนัดอัตโนมัติในแอปลูกค้า', 'ฉลากยาและใบรับรองแพทย์ PDF', 'รายงานธุรกิจ ยอดขาย และลูกค้ากลับมาซ้ำ', 'นำเข้าข้อมูลเดิมจาก Excel', 'แชทและโทรหาลูกค้า', 'รับเคสสแกน AI และการแชร์ข้อมูลฉุกเฉิน'],
    termsTitle: 'เงื่อนไขการใช้บริการโดยสรุป',
    terms: ['ทดลองใช้ฟรี 3 เดือนนับจากวันที่ FUFU อนุมัติคลินิก ใช้ได้ทุกฟีเจอร์และไม่จำกัดผู้ใช้', 'เลือกแพ็กเกจในระบบหลังบ้าน ระบบออกใบแจ้งหนี้ให้ ชำระโดยโอนเข้าบัญชีบริษัท ไม่มีการตัดบัตรอัตโนมัติ', 'แพ็กเกจนับต่อจากวันหมดอายุเดิม รายเดือน 1 เดือน รายปี 12 เดือน', 'หากยังไม่ชำระ ใช้งานได้ตามปกติต่ออีก 14 วัน จากนั้นเป็นโหมดดูอย่างเดียว ข้อมูลไม่ถูกลบ ชำระแล้วใช้ต่อได้ทันที', 'เปลี่ยนแพ็กเกจหรือหยุดใช้เมื่อไรก็ได้ เพียงไม่ชำระรอบถัดไป', 'ได้รับใบแจ้งหนี้และใบเสร็จรับเงินในนามบริษัททุกครั้งที่ชำระ'],
    termsLink: 'อ่านข้อกำหนดการใช้บริการและนโยบายการคืนเงิน',
    faqTitle: 'คำถามที่พบบ่อย',
    faq: [
      { q: 'ช่วงทดลองต้องใส่บัตรหรือจ่ายอะไรไหม', a: 'ไม่ต้อง สมัครแล้วใช้ได้ทุกฟีเจอร์ 3 เดือน ใกล้หมดช่วงทดลองระบบจะแจ้งให้เลือกแพ็กเกจ' },
      { q: 'แพ็กเกจต่างกันอย่างไร', a: 'ฟีเจอร์เหมือนกันทุกแพ็กเกจ ต่างกันที่จำนวนผู้ใช้ (บัญชีพนักงาน) เลือกตามขนาดทีม และเปลี่ยนแพ็กเกจได้ภายหลัง' },
      { q: 'ถ้าหยุดจ่าย ข้อมูลคนไข้จะหายไหม', a: 'ไม่หาย ระบบเป็นโหมดดูอย่างเดียว ยังเปิดประวัติและพิมพ์เอกสารย้อนหลังได้ และขอส่งออกข้อมูลได้' },
      { q: 'ย้ายข้อมูลจากระบบเดิมได้ไหม', a: 'ได้ นำเข้ารายชื่อลูกค้า สัตว์เลี้ยง และประวัติวัคซีนจากไฟล์ Excel หรือ CSV ได้เอง หรือส่งไฟล์ให้ทีม FUFU ช่วยนำเข้า' },
      { q: 'ลูกค้าของคลินิกต้องจ่ายค่าแอปไหม', a: 'ไม่ต้อง เจ้าของสัตว์เลี้ยงใช้แอป FUFU ฟรี ทั้งจองนัด รับเตือนวัคซีน และแชทกับคลินิก' },
    ],
    salesTitle: 'อยากเห็นระบบจริงก่อนตัดสินใจ', salesBody: 'นัดเดโมออนไลน์ 30 นาที หรือโทรคุยกับทีมขายได้โดยตรง', salesMail: 'อีเมลนัดเดโม', mailSubject: 'ขอนัดเดโม FUFU Partner สำหรับคลินิก',
  },
  en: {
    notes: ['3-month free trial, no card needed', 'No auto-renewal or automatic charges', 'Net prices, nothing added', 'An invoice and receipt every time'],
    net: 'Net price',
    allTitle: 'Every package includes every feature',
    all: ['Appointments, calendar and bookings from the FUFU app', 'Queue, OPD exam room and IPD', 'Cashier, POS, receipts and tax invoices', 'Pharmacy and supplies stock', 'Automatic vaccine and appointment reminders', 'Drug labels and certificate PDFs', 'Business reports, sales and returning customers', 'Import your old data from Excel', 'Chat and call customers', 'AI scan referrals and emergency sharing'],
    termsTitle: 'Terms at a glance',
    terms: ['3-month free trial from the day FUFU approves your clinic: every feature, unlimited users', 'Choose a package in the back office and we issue an invoice; pay by bank transfer, no automatic card charges', 'A package continues from your current expiry date: 1 month or 12 months', 'If unpaid, everything keeps working for 14 more days, then the system becomes read-only; nothing is deleted and paying unlocks it straight away', 'Change package or stop any time by not paying the next invoice', 'You receive an invoice and a company receipt for every payment'],
    termsLink: 'Read the terms of service and refund policy',
    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'Do I need a card or pay anything during the trial?', a: 'No. Sign up and use every feature for 3 months. We remind you to choose a package before it ends.' },
      { q: 'How do the packages differ?', a: 'Features are the same in every package; only the number of users (staff accounts) differs. You can change later.' },
      { q: 'If we stop paying, do we lose patient data?', a: 'No. The system becomes read-only: you can still open records and print past documents, and ask for an export.' },
      { q: 'Can we move data from our old system?', a: 'Yes. Import customers, pets and vaccine history from Excel or CSV yourself, or send the file to the FUFU team.' },
      { q: 'Do our customers pay for the app?', a: 'No. Pet owners use the FUFU app free to book, get vaccine reminders and chat with your clinic.' },
    ],
    salesTitle: 'See it working before you decide', salesBody: 'Book a 30-minute online demo or call our sales team directly.', salesMail: 'Email for a demo', mailSubject: 'FUFU Partner demo request for our clinic',
  },
  zh: {
    notes: ['免费试用 3 个月，无需信用卡', '不自动续费、不自动扣款', '净价，无其他费用', '每次付款均提供账单与收据'],
    net: '净价',
    allTitle: '每个套餐都包含全部功能',
    all: ['预约、日历及来自 FUFU 应用的预订', '排队、门诊诊室与住院', '收银、POS、收据与税务发票', '药品与耗材库存', '自动疫苗与预约提醒', '药品标签与证明书 PDF', '经营报表、销售与回头客', '从 Excel 导入旧数据', '与顾客聊天和通话', 'AI 扫描转诊与紧急分享'],
    termsTitle: '服务条款摘要',
    terms: ['自 FUFU 审核通过之日起免费试用 3 个月：全部功能、不限用户', '在后台选择套餐后系统开具账单，银行转账付款，不自动扣卡', '套餐从当前到期日起续：1 个月或 12 个月', '未付款时可继续正常使用 14 天，之后变为只读；数据不会删除，付款后立即恢复', '可随时更换套餐或停止使用，只需不支付下一期账单', '每次付款均提供公司账单与收据'],
    termsLink: '阅读服务条款与退款政策',
    faqTitle: '常见问题',
    faq: [
      { q: '试用期需要绑卡或付费吗？', a: '不需要。注册后可使用全部功能 3 个月，到期前系统会提醒您选择套餐。' },
      { q: '套餐有什么区别？', a: '功能完全相同，只按用户（员工账号）数量区分，之后可以更换。' },
      { q: '停止付费后病历会丢失吗？', a: '不会。系统变为只读，仍可查看记录、打印历史文件，并可申请导出数据。' },
      { q: '能从旧系统迁移数据吗？', a: '可以。可自行从 Excel 或 CSV 导入顾客、宠物和疫苗记录，也可把文件交给 FUFU 团队导入。' },
      { q: '诊所的顾客需要为应用付费吗？', a: '不需要。宠物主人免费使用 FUFU 应用预约、接收疫苗提醒并与诊所聊天。' },
    ],
    salesTitle: '先看看实际系统', salesBody: '预约 30 分钟在线演示，或直接致电销售团队。', salesMail: '邮件预约演示', mailSubject: 'FUFU Partner clinic demo request',
  },
  ja: {
    notes: ['3か月無料、カード不要', '自動更新・自動引き落としなし', '表示価格がお支払い総額', '毎回、請求書と領収書を発行'],
    net: 'お支払い総額',
    allTitle: 'すべてのプランで全機能が使えます',
    all: ['予約・カレンダー・FUFU アプリからの予約受付', '受付順番・外来診察室・入院', '会計・POS・領収書・税務インボイス', '薬品・資材の在庫', 'ワクチン・予約の自動リマインド', '薬袋ラベルと証明書 PDF', '経営レポート・売上・リピーター', '旧システムのデータを Excel から取り込み', 'お客様とチャット・電話', 'AIスキャンの紹介と緊急共有'],
    termsTitle: '利用条件の概要',
    terms: ['FUFU の承認日から 3 か月無料：全機能・ユーザー無制限', '管理画面でプランを選ぶと請求書を発行、銀行振込でお支払い。カードの自動引き落としはありません', 'プランは現在の期限日から 1 か月または 12 か月延長', '未払いでも 14 日間は通常どおり利用でき、その後は閲覧のみ。データは削除されず、お支払い後すぐに再開', 'プラン変更・利用停止はいつでも可能。次回の請求をお支払いいただかないだけです', 'お支払いごとに会社名義の請求書と領収書をお渡しします'],
    termsLink: '利用規約と返金ポリシーを読む',
    faqTitle: 'よくある質問',
    faq: [
      { q: 'トライアル中にカード登録や支払いは必要ですか？', a: '不要です。登録後 3 か月間すべての機能を使え、終了前にプラン選択をご案内します。' },
      { q: 'プランの違いは？', a: '機能はすべて同じで、ユーザー（スタッフアカウント）数だけが異なります。後から変更できます。' },
      { q: '支払いを止めたら診療データは消えますか？', a: '消えません。閲覧のみになり、記録の閲覧や過去書類の印刷ができ、データの書き出しも依頼できます。' },
      { q: '旧システムからデータを移せますか？', a: 'はい。お客様・ペット・ワクチン記録を Excel や CSV から取り込めます。FUFU チームへのファイル送付も可能です。' },
      { q: 'お客様はアプリ代を払いますか？', a: 'いいえ。飼い主さんは FUFU アプリを無料で使い、予約・ワクチン通知・病院とのチャットができます。' },
    ],
    salesTitle: '実際の画面を見てから決めたい方へ', salesBody: '30 分のオンラインデモ、または営業チームへ直接お電話ください。', salesMail: 'メールでデモ予約', mailSubject: 'FUFU Partner clinic demo request',
  },
  ko: {
    notes: ['3개월 무료 체험, 카드 불필요', '자동 갱신·자동 결제 없음', '표시 가격이 최종 금액', '매번 청구서와 영수증 발행'],
    net: '최종 금액',
    allTitle: '모든 패키지에 모든 기능 포함',
    all: ['예약, 캘린더, FUFU 앱 예약 접수', '대기, 외래 진료실, 입원', '수납, POS, 영수증, 세금계산서', '약품·소모품 재고', '백신·예약 자동 알림', '약 라벨과 증명서 PDF', '경영 리포트, 매출, 재방문 고객', '기존 데이터 Excel 가져오기', '고객과 채팅·전화', 'AI 스캔 의뢰와 긴급 공유'],
    termsTitle: '이용 조건 요약',
    terms: ['FUFU 승인일부터 3개월 무료: 모든 기능·사용자 무제한', '관리 화면에서 패키지를 선택하면 청구서를 발행하며 계좌이체로 결제, 카드 자동 결제 없음', '패키지는 현재 만료일부터 1개월 또는 12개월 연장', '미납 시에도 14일간 정상 사용 후 열람 전용으로 전환, 데이터는 삭제되지 않으며 결제 즉시 복구', '언제든 패키지 변경·이용 중단 가능, 다음 청구서를 결제하지 않으면 됩니다', '결제할 때마다 회사 명의 청구서와 영수증 제공'],
    termsLink: '이용약관과 환불 정책 보기',
    faqTitle: '자주 묻는 질문',
    faq: [
      { q: '체험 기간에 카드 등록이나 결제가 필요한가요?', a: '아니요. 가입 후 3개월 동안 모든 기능을 사용할 수 있고, 종료 전에 패키지 선택을 안내해 드려요.' },
      { q: '패키지는 어떻게 다른가요?', a: '기능은 모두 같고 사용자(직원 계정) 수만 달라요. 나중에 변경할 수 있어요.' },
      { q: '결제를 멈추면 진료 데이터가 사라지나요?', a: '아니요. 열람 전용이 되어 기록 열람과 지난 문서 인쇄가 가능하고, 데이터 내보내기를 요청할 수 있어요.' },
      { q: '기존 시스템 데이터를 옮길 수 있나요?', a: '네. 고객·반려동물·백신 기록을 Excel이나 CSV로 직접 가져오거나 FUFU 팀에 파일을 보내 주세요.' },
      { q: '병원 고객은 앱 비용을 내나요?', a: '아니요. 보호자는 FUFU 앱을 무료로 사용해 예약, 백신 알림, 병원 채팅을 이용해요.' },
    ],
    salesTitle: '결정 전에 실제 화면을 보세요', salesBody: '30분 온라인 데모를 예약하거나 영업팀에 바로 전화하세요.', salesMail: '이메일로 데모 예약', mailSubject: 'FUFU Partner clinic demo request',
  },
}
for (const [code, more] of Object.entries(PRICING_MORE)) Object.assign(messages[code].pricing, more)
