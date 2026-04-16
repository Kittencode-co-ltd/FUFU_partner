# FUFU Partner Platform — Deployment Checklist

## Pre-Launch Checklist

### 🔐 Security
- [ ] Remove all demo tokens and mock credentials  
- [ ] Enable Supabase RLS policies on ALL tables  
- [ ] Verify auth guards on all dashboard routes  
- [ ] Ensure HTTPS is enforced on production domain  
- [ ] Rotate Supabase anon/service keys  
- [ ] Add CORS whitelist for production domain only  
- [ ] Enable Supabase email confirmation for sign-ups  
- [ ] Review `api.js` for secrets in environment variables (not hardcoded)  
- [ ] Enable rate limiting on Edge Functions  
- [ ] Remove `console.log` statements from production builds  

### 🗄 Database
- [ ] Run `SUPABASE-SCHEMA-V2.sql` on production Supabase instance  
- [ ] Verify all foreign key constraints  
- [ ] Test RLS policies with different user roles  
- [ ] Create initial seed data for partner categories  
- [ ] Enable automatic backups (Supabase Pro plan)  
- [ ] Set up pg_cron for scheduled tasks (e.g., vaccine reminders)  
- [ ] Verify timezone settings are `Asia/Bangkok`  

### 🎨 Frontend
- [ ] Minify CSS files (`base.css`, `landing.css`, `dashboard.css`, `public.css`, `components.css`)  
- [ ] Bundle and minify JavaScript modules  
- [ ] Add favicon and meta OG tags for social sharing  
- [ ] Test responsive design on iPhone SE, iPad, Desktop  
- [ ] Verify Thai font rendering (Prompt, Sarabun)  
- [ ] Test AOS.js animations work on first load  
- [ ] Validate ARIA labels and keyboard navigation  
- [ ] Test dark mode compatibility (if applicable)  

### 📱 Mobile App (FUFU Pet Care)
- [ ] Update API base URL to production  
- [ ] Verify deep link configuration  
- [ ] Test push notifications (FCM)  
- [ ] Publish to App Store and Google Play  
- [ ] Update app version and changelog  

### 🔗 Integrations
- [ ] Configure SMS Gateway credentials (ThaiBulkSMS)  
- [ ] Set up PromptPay merchant details per partner  
- [ ] Configure Line Notify tokens for each partner  
- [ ] Verify map API key (Longdo Map or Google Maps)  
- [ ] Test ESC/POS printer connection at pilot site  

### 📊 Monitoring
- [ ] Set up Supabase alerts for database errors  
- [ ] Configure uptime monitoring (e.g., UptimeRobot, Better Uptime)  
- [ ] Set up error tracking (Sentry or LogRocket)  
- [ ] Configure Supabase log retention  
- [ ] Set up weekly performance reports  

---

## Deployment Steps

### Phase 1: Staging
```bash
# 1. Push to staging branch
git checkout -b staging
git push origin staging

# 2. Deploy to staging Supabase project
supabase db push --db-url postgresql://...staging-url

# 3. Deploy Edge Functions
supabase functions deploy --project-ref staging-project-id

# 4. Test all flows
open https://staging.fufu.app
```

### Phase 2: Production
```bash
# 1. Tag release
git tag -a v2.0.0 -m "FUFU Partner v2.0.0 — Phase 2 Launch"
git push origin v2.0.0

# 2. Deploy database schema
supabase db push --db-url postgresql://...production-url

# 3. Deploy Edge Functions
supabase functions deploy --project-ref production-project-id

# 4. Update DNS and SSL
# Point fufu.app to Supabase custom domain

# 5. Smoke test
curl -s https://fufu.app | head -5
```

### Phase 3: Post-Launch
- [ ] Monitor error logs for 24 hours  
- [ ] Verify payment processing end-to-end  
- [ ] Collect initial partner feedback  
- [ ] Schedule first weekly backup verification  
- [ ] Prepare hotfix process documentation  

---

## Environment Variables Checklist

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service role key (server-side only) |
| `API_BASE` | ✅ | Backend API URL |
| `SMS_API_KEY` | ⬜ | ThaiBulkSMS API key |
| `LINE_NOTIFY_TOKEN` | ⬜ | Line Notify access token |
| `PROMPTPAY_PHONE` | ⬜ | PromptPay phone number |
| `MAP_API_KEY` | ⬜ | Longdo Map or Google Maps API key |

---

## Rollback Procedure
1. Identify the failing migration version
2. `supabase db reset --version <previous-version>`
3. Redeploy previous frontend tag: `git checkout v1.x.x`
4. Notify affected partners via Line Notify
5. Post-mortem within 24 hours

---

> **Last Updated:** April 2026  
> **Maintained by:** Kitten Code Co., Ltd.
