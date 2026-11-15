import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('commerce migration creates isolated, tenant-scoped commerce records', async () => {
  const migration = await read('../supabase/migrations/20261115000600_commerce_orders.sql');
  assert.match(migration, /create table if not exists public\.commerce_orders/);
  assert.match(migration, /create table if not exists public\.commerce_order_items/);
  assert.match(migration, /unique\(user_id, idempotency_key\)/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /public\.is_store_order_operator\(store_id\)/);
  assert.match(migration, /create policy products_public_store_discovery/);
  assert.doesNotMatch(migration, /create table if not exists public\.orders\s*\(/);
});

test('checkout and order transitions are atomic and actor-checked', async () => {
  const migration = await read('../supabase/migrations/20261115000600_commerce_orders.sql');
  const api = await read('../server/routes/orders.js');
  assert.match(migration, /create or replace function public\.create_commerce_order[\s\S]*security definer/);
  assert.match(migration, /for update/);
  assert.match(migration, /stock_qty=coalesce\(stock_qty,0\)-v_qty/);
  assert.match(migration, /create or replace function public\.transition_commerce_order[\s\S]*public\.is_store_order_operator/);
  assert.match(migration, /order_status_history\(order_id,from_status,to_status,changed_by,reason\)/);
  assert.match(api, /router\.use\(requireAuth\)/);
  assert.match(api, /requireRole\('owner', 'staff', 'reception', 'vet'\)/);
});
