-- The summary updater is trigger-only and must not be exposed through PostgREST RPC.
revoke all on function public.update_store_review_summary_trigger() from public, anon, authenticated;
