/**
 * Retry helper for per-store running numbers (pets.hn, queue_entries.queue_number).
 *
 * These numbers are allocated app-side as `MAX(...) + 1`, which is not atomic:
 * two concurrent requests can read the same MAX and try to insert the same
 * number. DB-level UNIQUE constraints (see scripts/db_rebuild/09_sequence_race_fix.sql)
 * make the duplicate insert fail with SQLSTATE 23505 instead of corrupting data.
 *
 * `attempt` must RE-READ the current MAX and perform the insert each call, then
 * return Supabase's `{ data, error }`. On a unique-violation we simply run it
 * again — the next read sees the winning row and picks the next number.
 *
 * @param {() => Promise<{data: any, error: any}>} attempt
 * @param {number} [maxTries=5]
 * @returns {Promise<{data: any, error: any}>}
 */
export async function insertWithSeqRetry(attempt, maxTries = 5) {
  let lastError = null;
  for (let i = 0; i < maxTries; i++) {
    const { data, error } = await attempt();
    if (!error) return { data, error: null };
    if (error.code !== '23505') return { data: null, error }; // not a race — surface it
    lastError = error;
  }
  return { data: null, error: lastError };
}
