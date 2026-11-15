// In-app browsers (LINE, Facebook, Instagram, TikTok, Android WebView…) cannot receive Web Push or install
// web apps, so push (push-notifications.js) and install (install-app.js) send people to a real browser first.
export const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|\bLine\/|KAKAOTALK|Twitter|TikTok|musical_ly|BytedanceWebview|MicroMessenger|Snapchat|Pinterest|; wv\)/i;
export const isInAppBrowser = (userAgent = navigator.userAgent) => IN_APP_BROWSER.test(userAgent);
