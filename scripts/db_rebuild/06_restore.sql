-- ============================================================
-- FUFU Database Rebuild — Step 6: Restore backup data
-- Run AFTER step 05 (triggers).
-- Safe to run even when some _bak_ tables are missing.
-- ============================================================

DO $$
BEGIN

-- ── stores ──────────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_stores') THEN
  INSERT INTO stores (
    id, owner_id, owner_email, name, category, partner_type, phone, address,
    description, website, logo_url, theme_color, location_lat, location_lng,
    opening_hours, business_hours, default_service_rates, tax_id, receipt_header_note,
    total_revenue, is_verified, is_active, created_at
  )
  SELECT
    id, owner_id, owner_email, name,
    COALESCE(category, partner_type) AS category,
    COALESCE(partner_type, 'vet_clinic'),
    phone, address,
    COALESCE(description, detail) AS description,
    website, logo_url, theme_color,
    location_lat, location_lng, opening_hours, business_hours, default_service_rates,
    tax_id, receipt_header_note,
    COALESCE(total_revenue, 0), COALESCE(is_verified, false), COALESCE(is_active, true), created_at
  FROM _bak_stores
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: stores';
ELSE
  RAISE NOTICE 'Skipped (no backup): stores';
END IF;

-- ── store_staff → staff (migration) ─────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_store_staff') THEN
  INSERT INTO staff (store_id, email, full_name, role, is_active, created_at)
  SELECT
    ss.store_id,
    ss.user_email,
    ss.name,
    CASE
      WHEN ss.roles && ARRAY['owner']                  THEN 'owner'
      WHEN ss.roles && ARRAY['vet', 'doctor']          THEN 'veterinarian'
      WHEN ss.roles && ARRAY['groomer']                THEN 'groomer'
      WHEN ss.roles && ARRAY['receptionist','counter'] THEN 'receptionist'
      WHEN ss.roles && ARRAY['pharmacist']             THEN 'pharmacist'
      ELSE 'staff'
    END AS role,
    COALESCE(ss.is_active, true),
    ss.created_at
  FROM _bak_store_staff ss
  WHERE ss.store_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM staff WHERE store_id = ss.store_id AND email = ss.user_email
    );
  RAISE NOTICE 'Restored: store_staff → staff';
ELSE
  RAISE NOTICE 'Skipped (no backup): store_staff';
END IF;

-- ── pet_owners ───────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_pet_owners') THEN
  INSERT INTO pet_owners (id, auth_user_id, name, phone, email, line_id, address, push_token, notes, created_at, updated_at)
  SELECT id, auth_user_id, name, phone, email, line_id, address, push_token, notes, created_at, updated_at
  FROM _bak_pet_owners
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: pet_owners';
ELSE
  RAISE NOTICE 'Skipped (no backup): pet_owners';
END IF;

-- ── pets (maps old columns → new column names) ────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_pets') THEN
  INSERT INTO pets (id, user_id, owner_id, store_id, name, species, breed, dob, age,
                    weight_kg, gender, color, microchip_no, is_neutered, allergies,
                    notes, avatar_url, hn, is_active, created_at, updated_at)
  SELECT
    id, user_id, owner_id, store_id, name,
    COALESCE(species, type, 'dog')       AS species,
    breed, dob, age,
    COALESCE(weight_kg, weight)          AS weight_kg,
    gender, color,
    COALESCE(microchip_no, microchip_id) AS microchip_no,
    COALESCE(is_neutered, false),
    allergies, notes,
    COALESCE(avatar_url, photo_url)      AS avatar_url,
    hn,
    COALESCE(is_active, true),
    created_at, updated_at
  FROM _bak_pets
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: pets';
ELSE
  RAISE NOTICE 'Skipped (no backup): pets';
END IF;

-- ── customers ────────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_customers') THEN
  INSERT INTO customers (id, store_id, user_id, full_name, phone, email, address, province,
                         membership_tier, total_spent, points, notes, created_at, updated_at)
  SELECT id, store_id, user_id, full_name, phone, email, address, province,
         COALESCE(membership_tier, 'none'), COALESCE(total_spent, 0), COALESCE(points, 0),
         notes, created_at, updated_at
  FROM _bak_customers
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: customers';
ELSE
  RAISE NOTICE 'Skipped (no backup): customers';
END IF;

-- ── notifications ────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_notifications') THEN
  INSERT INTO notifications (id, user_id, title, body, icon, category, is_read, created_at)
  SELECT id, user_id, title, body, icon, category, is_read, created_at
  FROM _bak_notifications
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: notifications';
ELSE
  RAISE NOTICE 'Skipped (no backup): notifications';
END IF;

-- ── appointments ─────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_appointments') THEN
  INSERT INTO appointments (id, user_id, owner_id, pet_id, store_id, pet_name, category,
    service_type, appt_date, appt_time_slot, appt_time, drop_off_method, status,
    notes, reminder_24h_sent, reminder_1h_sent, created_at)
  SELECT
    id, user_id, owner_id, pet_id, store_id, pet_name, category,
    COALESCE(service_type, 'ตรวจทั่วไป'),
    appt_date, appt_time_slot, appt_time, drop_off_method,
    CASE status
      WHEN 'Pending'   THEN 'Pending'
      WHEN 'Confirmed' THEN 'Confirmed'
      WHEN 'Cancelled' THEN 'Cancelled'
      WHEN 'Completed' THEN 'Completed'
      ELSE 'Cancelled'
    END AS status,
    notes,
    COALESCE(reminder_24h_sent, false),
    COALESCE(reminder_1h_sent, false),
    created_at
  FROM _bak_appointments
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: appointments';
ELSE
  RAISE NOTICE 'Skipped (no backup): appointments';
END IF;

-- ── orders ───────────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_orders') THEN
  INSERT INTO orders (id, user_id, store_id, delivery_method, delivery_address,
                      total_amount, delivery_fee, status, created_at)
  SELECT id, user_id, NULL, delivery_method, delivery_address,
         total_amount, COALESCE(delivery_fee, 0), status, created_at
  FROM _bak_orders
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: orders';
ELSE
  RAISE NOTICE 'Skipped (no backup): orders';
END IF;

-- ── order_items ──────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_order_items') THEN
  INSERT INTO order_items (id, order_id, product_name, quantity, price)
  SELECT id, order_id, product_name, quantity, price
  FROM _bak_order_items
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: order_items';
ELSE
  RAISE NOTICE 'Skipped (no backup): order_items';
END IF;

-- ── vaccinations ─────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_vaccinations') THEN
  INSERT INTO vaccinations (id, user_id, pet_id, vaccine_name, date_administered,
                            next_due_date, veterinarian, location, created_at)
  SELECT id, user_id, pet_id, vaccine_name, date_administered,
         next_due_date, veterinarian, location, created_at
  FROM _bak_vaccinations
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: vaccinations';
ELSE
  RAISE NOTICE 'Skipped (no backup): vaccinations';
END IF;

-- ── pet_vaccinations ─────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_pet_vaccinations') THEN
  INSERT INTO pet_vaccinations (id, pet_id, store_id, vaccine_name, given_date,
                                next_due_date, batch_no, vet_name, notes, created_at)
  SELECT id, pet_id, store_id, vaccine_name, given_date,
         next_due_date, batch_no, vet_name, notes, created_at
  FROM _bak_pet_vaccinations
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: pet_vaccinations';
ELSE
  RAISE NOTICE 'Skipped (no backup): pet_vaccinations';
END IF;

-- ── medical_records ──────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_medical_records') THEN
  INSERT INTO medical_records (
    id, store_id, pet_id, owner_id, customer_id, vet_staff_id,
    record_type, visit_date, pet_name, owner_name, species,
    subjective, objective, assessment, plan,
    weight_kg, temperature_c, heart_rate, respiratory_rate, vitals,
    diagnosis, treatment, prescriptions, lab_results, medical_images,
    body_map_data, next_appointment, notes, status,
    deleted_at, created_at, updated_at
  )
  SELECT
    id, store_id, pet_id, owner_id, customer_id, vet_staff_id,
    COALESCE(record_type, 'opd'), visit_date, pet_name, owner_name,
    COALESCE(species, 'dog'),
    subjective, objective, assessment, plan,
    weight_kg, temperature_c, heart_rate, respiratory_rate, vitals,
    diagnosis, treatment,
    COALESCE(prescriptions, prescribed_meds, '[]'::jsonb),
    COALESCE(lab_results, '[]'::jsonb),
    COALESCE(medical_images, '[]'::jsonb),
    COALESCE(body_map_data, '[]'::jsonb),
    next_appointment, notes,
    COALESCE(status, 'open'),
    deleted_at, created_at, updated_at
  FROM _bak_medical_records
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: medical_records';
ELSE
  RAISE NOTICE 'Skipped (no backup): medical_records';
END IF;

-- ── roles ────────────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_roles') THEN
  INSERT INTO roles (id, store_id, name, color, permissions, created_at)
  SELECT id, store_id, name, COALESCE(color, '#6B7280'), permissions, created_at
  FROM _bak_roles
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: roles';
ELSE
  RAISE NOTICE 'Skipped (no backup): roles';
END IF;

-- ── scan_results ─────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_bak_scan_results') THEN
  INSERT INTO scan_results (id, user_id, pet_id, body_part, diagnosis, confidence, status, image_url, notes, created_at)
  SELECT id, user_id, pet_id, body_part, diagnosis, confidence, status, image_url, notes, created_at
  FROM _bak_scan_results
  ON CONFLICT (id) DO NOTHING;
  RAISE NOTICE 'Restored: scan_results';
ELSE
  RAISE NOTICE 'Skipped (no backup): scan_results';
END IF;

END $$;

-- ── Verify final row counts ───────────────────────────────────
SELECT tablename AS tbl,
  (xpath('/row/c/text()',
    query_to_xml(format('SELECT COUNT(*) AS c FROM %I', tablename), false, true, ''))
  )[1]::text::int AS rows
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '_bak_%'
ORDER BY tablename;
