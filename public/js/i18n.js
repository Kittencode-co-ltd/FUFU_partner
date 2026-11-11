/**
 * Language support for the partner login / register pages (TH · EN · CN · JP · KR).
 * Shares the `fufu_lang` localStorage key with the Next.js landing page.
 *
 * Markup:
 *   data-i18n="key"              → textContent
 *   data-i18n-html="key"         → innerHTML (only for our own strings)
 *   data-i18n-placeholder="key"  → placeholder
 *   data-i18n-aria="key"         → aria-label
 *   [data-lang-switcher]         → language dropdown is rendered here
 * JS: window.FUFU_I18N.t('key')
 *
 * Loaded as a classic script (CSP: script-src 'self').
 */
(function () {
  const LANG_KEY = 'fufu_lang';
  const LANGS = [
    { code: 'th', label: 'ไทย', short: 'TH', html: 'th' },
    { code: 'en', label: 'English', short: 'EN', html: 'en' },
    { code: 'zh', label: '中文', short: 'CN', html: 'zh-CN' },
    { code: 'ja', label: '日本語', short: 'JP', html: 'ja' },
    { code: 'ko', label: '한국어', short: 'KR', html: 'ko' },
  ];

  const M = {
    th: {
      back: 'กลับหน้าหลัก', lang: 'เปลี่ยนภาษา', portal: 'Partner Portal',
      tabLogin: 'เข้าสู่ระบบ', tabRegister: 'สมัครพาร์ทเนอร์',
      loginTitle: 'ยินดีต้อนรับกลับ', loginSub: 'เข้าสู่ระบบด้วยบัญชี FUFU Partner ของคุณ',
      email: 'อีเมล', password: 'รหัสผ่าน', forgot: 'ลืมรหัสผ่าน?', remember: 'จดจำการเข้าสู่ระบบ',
      showPw: 'แสดง/ซ่อนรหัสผ่าน', submitLogin: 'เข้าสู่ระบบ', signingIn: 'กำลังเข้าสู่ระบบ...',
      noAccount: 'ยังไม่มีบัญชี?', joinLink: 'สมัครเป็นพาร์ทเนอร์',
      storeTitle: 'เลือกร้านค้า', storeSub: 'บัญชีนี้มีหลายร้านค้า กรุณาเลือกที่ต้องการจัดการ', backBtn: 'ย้อนกลับ',
      firstStore: 'สร้างร้านค้าแรก', firstStoreSub: 'บัญชีของคุณยังไม่มีร้านค้า — สร้างได้เลยตอนนี้',
      regTitle: 'สมัครเป็นพาร์ทเนอร์', regSub: 'สร้างบัญชีและร้านค้าของคุณในไม่กี่นาที',
      ownerName: 'ชื่อ-นามสกุล (เจ้าของ)', namePh: 'สมชาย ใจดี', emailHint: 'ใช้อีเมลเดิมกับ FUFU App ได้ — บัญชีเดียวใช้ได้ทั้งสองระบบ',
      phone: 'เบอร์โทรศัพท์', storeName: 'ชื่อร้าน / คลินิก', category: 'ประเภทธุรกิจ',
      catVet: 'คลินิกสัตวแพทย์', catShop: 'ร้านค้าสัตว์เลี้ยง', catHotel: 'โรงแรมสัตว์เลี้ยง', catGroom: 'อาบน้ำตัดขน',
      pwMin: 'รหัสผ่าน (อย่างน้อย 8 ตัว)', submitRegister: 'สร้างบัญชีและร้านค้า', creating: 'กำลังสร้างบัญชี...',
      haveAccount: 'มีบัญชีอยู่แล้ว?', loginLink: 'เข้าสู่ระบบ',
      exists: 'อีเมลนี้มีบัญชีอยู่แล้ว', existsSub: 'เข้าสู่ระบบ แล้วสร้างร้านใหม่จาก Dashboard ได้เลย',
      secure: 'เชื่อมต่อแบบเข้ารหัส · ข้อมูลแยกตามสิทธิ์',
      errEmpty: 'กรุณากรอกอีเมลและรหัสผ่าน', errFill: 'กรุณากรอกข้อมูลให้ครบ', errStoreName: 'กรุณากรอกชื่อร้าน',
      errNetwork: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', errRegister: 'เชื่อมต่อระบบสมัครสมาชิกไม่ได้ กรุณาลองใหม่',
      errGeneric: 'เกิดข้อผิดพลาด', okVerify: 'สร้างบัญชีสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', okCreateStore: 'สร้างบัญชีสำเร็จ! กรุณาสร้างร้านค้าของคุณ',
      creatingStore: 'กำลังสร้าง...', createStore: 'สร้างร้านค้า →',
    },
    en: {
      back: 'Back to home', lang: 'Change language', portal: 'Partner Portal',
      tabLogin: 'Sign in', tabRegister: 'Become a partner',
      loginTitle: 'Welcome back', loginSub: 'Sign in with your FUFU Partner account',
      email: 'Email', password: 'Password', forgot: 'Forgot password?', remember: 'Remember me',
      showPw: 'Show or hide password', submitLogin: 'Sign in', signingIn: 'Signing in...',
      noAccount: 'No account yet?', joinLink: 'Become a partner',
      storeTitle: 'Choose a store', storeSub: 'This account has several stores. Pick the one to manage.', backBtn: 'Back',
      firstStore: 'Create your first store', firstStoreSub: 'Your account has no store yet — create one now.',
      regTitle: 'Become a partner', regSub: 'Create your account and store in minutes',
      ownerName: 'Owner full name', namePh: 'Jane Doe', emailHint: 'You can use your FUFU App email — one account for both.',
      phone: 'Phone number', storeName: 'Store / clinic name', category: 'Business type',
      catVet: 'Veterinary clinic', catShop: 'Pet shop', catHotel: 'Pet hotel', catGroom: 'Grooming',
      pwMin: 'Password (at least 8 characters)', submitRegister: 'Create account & store', creating: 'Creating account...',
      haveAccount: 'Already have an account?', loginLink: 'Sign in',
      exists: 'This email already has an account', existsSub: 'Sign in, then add a new store from the dashboard.',
      secure: 'Encrypted connection · role-based access',
      errEmpty: 'Please enter your email and password', errFill: 'Please fill in all required fields', errStoreName: 'Please enter a store name',
      errNetwork: 'Cannot reach the server. Check your connection and try again.', errRegister: 'Sign-up service is unavailable. Please try again.',
      errGeneric: 'Something went wrong', okVerify: 'Account created. Please verify your email before signing in.', okCreateStore: 'Account created! Now create your store.',
      creatingStore: 'Creating...', createStore: 'Create store →',
    },
    zh: {
      back: '返回首页', lang: '切换语言', portal: '合作伙伴平台',
      tabLogin: '登录', tabRegister: '成为合作伙伴',
      loginTitle: '欢迎回来', loginSub: '使用您的 FUFU Partner 账号登录',
      email: '电子邮箱', password: '密码', forgot: '忘记密码？', remember: '记住登录',
      showPw: '显示或隐藏密码', submitLogin: '登录', signingIn: '正在登录...',
      noAccount: '还没有账号？', joinLink: '成为合作伙伴',
      storeTitle: '选择门店', storeSub: '该账号有多个门店，请选择要管理的门店。', backBtn: '返回',
      firstStore: '创建第一家门店', firstStoreSub: '您的账号还没有门店——现在就创建吧。',
      regTitle: '成为合作伙伴', regSub: '几分钟即可创建账号和门店',
      ownerName: '店主姓名', namePh: '张伟', emailHint: '可使用 FUFU App 的邮箱——一个账号通用两个系统。',
      phone: '电话号码', storeName: '门店 / 诊所名称', category: '业务类型',
      catVet: '宠物诊所', catShop: '宠物店', catHotel: '宠物酒店', catGroom: '洗护美容',
      pwMin: '密码（至少 8 位）', submitRegister: '创建账号和门店', creating: '正在创建账号...',
      haveAccount: '已有账号？', loginLink: '登录',
      exists: '该邮箱已注册', existsSub: '请登录后在控制台中添加新门店。',
      secure: '加密连接 · 按权限访问',
      errEmpty: '请输入邮箱和密码', errFill: '请填写所有必填项', errStoreName: '请输入门店名称',
      errNetwork: '无法连接服务器，请检查网络后重试。', errRegister: '注册服务暂不可用，请重试。',
      errGeneric: '发生错误', okVerify: '账号已创建，请先验证邮箱再登录。', okCreateStore: '账号已创建！请创建您的门店。',
      creatingStore: '正在创建...', createStore: '创建门店 →',
    },
    ja: {
      back: 'ホームへ戻る', lang: '言語を変更', portal: 'パートナーポータル',
      tabLogin: 'ログイン', tabRegister: 'パートナー登録',
      loginTitle: 'おかえりなさい', loginSub: 'FUFU Partner アカウントでログイン',
      email: 'メールアドレス', password: 'パスワード', forgot: 'パスワードをお忘れですか？', remember: 'ログイン状態を保持',
      showPw: 'パスワードを表示/非表示', submitLogin: 'ログイン', signingIn: 'ログイン中...',
      noAccount: 'アカウントをお持ちでないですか？', joinLink: 'パートナー登録',
      storeTitle: '店舗を選択', storeSub: 'このアカウントには複数の店舗があります。管理する店舗を選んでください。', backBtn: '戻る',
      firstStore: '最初の店舗を作成', firstStoreSub: 'まだ店舗がありません。今すぐ作成しましょう。',
      regTitle: 'パートナー登録', regSub: '数分でアカウントと店舗を作成できます',
      ownerName: 'オーナー氏名', namePh: '山田 花子', emailHint: 'FUFU App のメールアドレスを使えます。1つのアカウントで両方利用できます。',
      phone: '電話番号', storeName: '店舗 / クリニック名', category: '業種',
      catVet: '動物病院', catShop: 'ペットショップ', catHotel: 'ペットホテル', catGroom: 'トリミング',
      pwMin: 'パスワード（8文字以上）', submitRegister: 'アカウントと店舗を作成', creating: 'アカウント作成中...',
      haveAccount: 'すでにアカウントをお持ちですか？', loginLink: 'ログイン',
      exists: 'このメールアドレスは登録済みです', existsSub: 'ログイン後、ダッシュボードから新しい店舗を追加できます。',
      secure: '暗号化通信 · 権限ごとのアクセス',
      errEmpty: 'メールアドレスとパスワードを入力してください', errFill: '必須項目をすべて入力してください', errStoreName: '店舗名を入力してください',
      errNetwork: 'サーバーに接続できません。通信環境を確認して再試行してください。', errRegister: '登録サービスに接続できません。もう一度お試しください。',
      errGeneric: 'エラーが発生しました', okVerify: 'アカウントを作成しました。ログイン前にメールを確認してください。', okCreateStore: 'アカウントを作成しました！店舗を作成してください。',
      creatingStore: '作成中...', createStore: '店舗を作成 →',
    },
    ko: {
      back: '홈으로', lang: '언어 변경', portal: '파트너 포털',
      tabLogin: '로그인', tabRegister: '파트너 가입',
      loginTitle: '다시 오신 것을 환영합니다', loginSub: 'FUFU Partner 계정으로 로그인하세요',
      email: '이메일', password: '비밀번호', forgot: '비밀번호를 잊으셨나요?', remember: '로그인 상태 유지',
      showPw: '비밀번호 보기/숨기기', submitLogin: '로그인', signingIn: '로그인 중...',
      noAccount: '계정이 없으신가요?', joinLink: '파트너 가입',
      storeTitle: '매장 선택', storeSub: '이 계정에 여러 매장이 있습니다. 관리할 매장을 선택하세요.', backBtn: '뒤로',
      firstStore: '첫 매장 만들기', firstStoreSub: '아직 매장이 없습니다. 지금 만들어 보세요.',
      regTitle: '파트너 가입', regSub: '몇 분 만에 계정과 매장을 만드세요',
      ownerName: '대표자 이름', namePh: '홍길동', emailHint: 'FUFU App 이메일을 그대로 사용할 수 있습니다. 하나의 계정으로 두 서비스를 이용하세요.',
      phone: '전화번호', storeName: '매장 / 병원 이름', category: '업종',
      catVet: '동물병원', catShop: '펫숍', catHotel: '펫호텔', catGroom: '미용',
      pwMin: '비밀번호 (8자 이상)', submitRegister: '계정과 매장 만들기', creating: '계정 생성 중...',
      haveAccount: '이미 계정이 있으신가요?', loginLink: '로그인',
      exists: '이미 가입된 이메일입니다', existsSub: '로그인한 뒤 대시보드에서 새 매장을 추가하세요.',
      secure: '암호화 연결 · 권한별 접근',
      errEmpty: '이메일과 비밀번호를 입력하세요', errFill: '필수 항목을 모두 입력하세요', errStoreName: '매장 이름을 입력하세요',
      errNetwork: '서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.', errRegister: '가입 서비스에 연결할 수 없습니다. 다시 시도하세요.',
      errGeneric: '오류가 발생했습니다', okVerify: '계정이 생성되었습니다. 로그인 전에 이메일을 인증하세요.', okCreateStore: '계정이 생성되었습니다! 매장을 만들어 주세요.',
      creatingStore: '만드는 중...', createStore: '매장 만들기 →',
    },
  };

  function readLang() {
    try {
      const fromUrl = new URLSearchParams(location.search).get('lang');
      const saved = localStorage.getItem(LANG_KEY);
      return [fromUrl, saved].find(c => c && M[c]) || 'th';
    } catch { return 'th'; }
  }

  let lang = readLang();
  const t = (key) => (M[lang] && M[lang][key]) || M.th[key] || key;

  function apply(root = document) {
    document.documentElement.lang = (LANGS.find(l => l.code === lang) || LANGS[0]).html;
    document.documentElement.dataset.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    renderSwitchers();
  }

  function setLang(code) {
    if (!M[code]) return;
    lang = code;
    try { localStorage.setItem(LANG_KEY, code); } catch { /* ignore */ }
    apply();
  }

  function renderSwitchers() {
    document.querySelectorAll('[data-lang-switcher]').forEach(host => {
      const current = LANGS.find(l => l.code === lang) || LANGS[0];
      host.innerHTML = `
        <button type="button" class="au-lang-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${t('lang')}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span>${current.short}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <ul class="au-lang-menu" role="listbox" hidden>
          ${LANGS.map(l => `<li><button type="button" role="option" data-code="${l.code}" lang="${l.html}" aria-selected="${l.code === lang}"><span>${l.label}</span><small>${l.short}</small></button></li>`).join('')}
        </ul>`;
      const btn = host.querySelector('.au-lang-btn');
      const menu = host.querySelector('.au-lang-menu');
      const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
      menu.addEventListener('click', (e) => { const o = e.target.closest('[data-code]'); if (o) { close(); setLang(o.dataset.code); } });
    });
  }

  // One global listener closes any open language menu
  const closeAll = () => document.querySelectorAll('[data-lang-switcher]').forEach(host => {
    const menu = host.querySelector('.au-lang-menu');
    if (menu && !menu.hidden) { menu.hidden = true; host.querySelector('.au-lang-btn')?.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  window.FUFU_I18N = { t, setLang, apply, get lang() { return lang; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
})();
