#!/usr/bin/env bash
# One-time Web Push setup for App, Portal and Admin (design.md §18).
# Run from the FUFU_partner folder:  bash scripts/setup-web-push.sh
# It asks before changing the database, never prints secret values, and keeps them out of the repo.
set -euo pipefail

KEYS="${VAPID_KEYS_FILE:-$HOME/.fufu/vapid-keys.env}"
APP_DIR="${APP_DIR:-../FUFU-WEB-APP}"
ADMIN_DIR="${ADMIN_DIR:-../fufu_admin}"
VAULT_SQL="$HOME/.fufu/web-push-vault.sql"

say()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
val()  { grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

[ -d supabase ] || fail "Run this from the FUFU_partner folder (the one with supabase/)."
command -v supabase >/dev/null || fail "Supabase CLI not found. Install it first:  brew install supabase/tap/supabase"
[ -f "$KEYS" ] || fail "Key file $KEYS not found."

# Project ref from the App's Supabase URL (https://<ref>.supabase.co)
SUPA_URL="$(val NEXT_PUBLIC_SUPABASE_URL "$APP_DIR/.env.local")"
REF="$(printf '%s' "$SUPA_URL" | sed -nE 's#^https://([a-z0-9]+)\.supabase\.co/?$#\1#p')"
[ -n "$REF" ] || fail "Could not read the project ref from NEXT_PUBLIC_SUPABASE_URL in $APP_DIR/.env.local"
FUNCTION_URL="https://$REF.supabase.co/functions/v1/send-web-push"

SUBJECT="$(val VAPID_SUBJECT "$KEYS")"
if [ -z "$SUBJECT" ]; then
  read -r -p "Team contact email for push services (e.g. support@your-domain): " EMAIL
  [[ "$EMAIL" == *@* ]] || fail "Please enter an email address."
  SUBJECT="mailto:$EMAIL"
  sed -i '' "s#^VAPID_SUBJECT=.*#VAPID_SUBJECT=$SUBJECT#" "$KEYS"
fi
ADMIN_EMAILS="$(val ADMIN_EMAILS "$ADMIN_DIR/.env.local")"
[ -n "$ADMIN_EMAILS" ] || fail "ADMIN_EMAILS is empty in $ADMIN_DIR/.env.local"

say "1/5  Sign in and link project $REF"
supabase projects list >/dev/null 2>&1 || supabase login
supabase link --project-ref "$REF"

say "2/5  Database migrations waiting to be applied"
supabase db push --dry-run
read -r -p "Apply these migrations to $REF now? [y/N] " OK
[[ "$OK" =~ ^[Yy]$ ]] || fail "Stopped before changing the database. Nothing else was changed."
supabase db push

say "3/5  Edge function secrets (values are not shown)"
TMP="$(mktemp)"; chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
{
  echo "VAPID_PUBLIC_KEY=$(val VAPID_PUBLIC_KEY "$KEYS")"
  echo "VAPID_PRIVATE_KEY=$(val VAPID_PRIVATE_KEY "$KEYS")"
  echo "VAPID_SUBJECT=$SUBJECT"
  echo "WEB_PUSH_WEBHOOK_SECRET=$(val WEB_PUSH_WEBHOOK_SECRET "$KEYS")"
  echo "ADMIN_EMAILS=$ADMIN_EMAILS"
} > "$TMP"
supabase secrets set --env-file "$TMP" >/dev/null
echo "Secrets set: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEB_PUSH_WEBHOOK_SECRET, ADMIN_EMAILS"

say "4/5  Deploy the send-web-push function"
supabase functions deploy send-web-push --no-verify-jwt

say "5/5  Vault entries the database triggers read"
umask 077
cat > "$VAULT_SQL" <<SQL
-- FUFU Web Push: Vault entries for dispatch_web_push(). Safe to run more than once.
do \$\$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'web_push_function_url';
  if v_id is null then perform vault.create_secret('$FUNCTION_URL', 'web_push_function_url');
  else perform vault.update_secret(v_id, '$FUNCTION_URL'); end if;
  v_id := null;
  select id into v_id from vault.secrets where name = 'web_push_webhook_secret';
  if v_id is null then perform vault.create_secret('$(val WEB_PUSH_WEBHOOK_SECRET "$KEYS")', 'web_push_webhook_secret');
  else perform vault.update_secret(v_id, '$(val WEB_PUSH_WEBHOOK_SECRET "$KEYS")'); end if;
end \$\$;
SQL
if command -v pbcopy >/dev/null; then pbcopy < "$VAULT_SQL"; COPIED=" (already copied to the clipboard)"; else COPIED=""; fi
echo "Open https://supabase.com/dashboard/project/$REF/sql/new and paste the SQL$COPIED, then press Run."
echo "The SQL is also saved at $VAULT_SQL (readable only by you)."

say "Done. Restart the App, Portal and Admin dev servers (and set the same public keys on your hosting) to finish."
