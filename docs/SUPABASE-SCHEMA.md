# FUFU Partner – Supabase Schema Reference

## Overview

FUFU Partner uses Supabase as the backend data layer. The following tables are used
by the frontend dashboard and the `api.js` Express.js proxy.

---

## Tables

### `profiles`
User authentication profiles (managed by Supabase Auth).

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Supabase Auth user ID |
| `email` | `text` | User email |
| `full_name` | `text` | Display name |
| `role` | `text` | `partner`, `admin`, `user` |
| `created_at` | `timestamptz` | Registration date |

---

### `partners`
Partner business profiles linked to auth users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Partner UUID |
| `user_id` | `uuid` (FK → profiles.id) | Owner user ID |
| `status` | `text` | `active`, `pending`, `suspended` |
| `created_at` | `timestamptz` | Registration date |

---

### `stores`
Individual store/clinic locations owned by partners.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Store UUID |
| `partner_id` | `uuid` (FK → partners.id) | Owning partner |
| `name` | `text` | Store display name |
| `category` | `text` | `vet_clinic`, `pet_shop`, `pet_hotel`, `pet_grooming` |
| `phone` | `text` | Contact phone |
| `latitude` | `float8` | GPS latitude |
| `longitude` | `float8` | GPS longitude |
| `address` | `text` | Physical address |
| `created_at` | `timestamptz` | Creation date |

---

### `appointments`
Queue/booking records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Appointment UUID |
| `store_id` | `uuid` (FK → stores.id) | Associated store |
| `pet_name` | `text` | Pet name |
| `owner_name` | `text` | Owner name |
| `service` | `text` | Service description |
| `scheduled_at` | `timestamptz` | Appointment date/time |
| `status` | `text` | `waiting`, `active`, `done`, `cancelled` |
| `notes` | `text` | Additional notes |
| `created_at` | `timestamptz` | Creation date |

---

### `transactions`
Financial records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Transaction UUID |
| `store_id` | `uuid` (FK → stores.id) | Associated store |
| `appointment_id` | `uuid` (FK → appointments.id) | Linked appointment (optional) |
| `description` | `text` | Transaction description |
| `amount` | `numeric` | Amount in THB |
| `status` | `text` | `completed`, `pending`, `refunded` |
| `created_at` | `timestamptz` | Transaction date |

---

### `products`
Product/service catalog.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Product UUID |
| `store_id` | `uuid` (FK → stores.id) | Associated store |
| `name` | `text` | Product/service name |
| `price` | `numeric` | Price in THB |
| `stock` | `integer` | Stock quantity (null = unlimited) |
| `icon` | `text` | Emoji or icon identifier |
| `category` | `text` | Product category |
| `is_active` | `boolean` | Whether listed |
| `created_at` | `timestamptz` | Creation date |

---

## Table → Feature Mapping

| Dashboard Feature | Primary Table | Secondary Tables |
|-------------------|---------------|------------------|
| Queue Management | `appointments` | `stores` |
| Income / Finance | `transactions` | `appointments` |
| Products / Services | `products` | `stores` |
| Medical Records | `appointments` + custom fields | `stores` |
| Store Settings | `stores` | `partners` |
| Admin Overview | All tables | – |

---

## RLS Policy Suggestions

```sql
-- Partners can only see their own stores
CREATE POLICY "Partners see own stores" ON stores
  FOR SELECT USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );

-- Store data scoped to stores owned by the user
CREATE POLICY "Store-scoped appointments" ON appointments
  FOR ALL USING (
    store_id IN (
      SELECT id FROM stores WHERE partner_id IN (
        SELECT id FROM partners WHERE user_id = auth.uid()
      )
    )
  );

-- Same pattern for transactions and products
CREATE POLICY "Store-scoped transactions" ON transactions
  FOR ALL USING (
    store_id IN (
      SELECT id FROM stores WHERE partner_id IN (
        SELECT id FROM partners WHERE user_id = auth.uid()
      )
    )
  );
```
