-- ============================================================
-- FUFU Database Rebuild — Step 2: Drop all public tables
-- Run AFTER step 01 (backup). CASCADE handles FK order.
-- ============================================================

DROP TABLE IF EXISTS public.treatment_sheets     CASCADE;
DROP TABLE IF EXISTS public.ipd_vitals           CASCADE;
DROP TABLE IF EXISTS public.ipd_treatments       CASCADE;
DROP TABLE IF EXISTS public.ipd_admissions       CASCADE;
DROP TABLE IF EXISTS public.ipd_cages            CASCADE;
DROP TABLE IF EXISTS public.grooming_records     CASCADE;
DROP TABLE IF EXISTS public.grooming_sessions    CASCADE;
DROP TABLE IF EXISTS public.hotel_bookings       CASCADE;
DROP TABLE IF EXISTS public.hotel_rooms          CASCADE;
DROP TABLE IF EXISTS public.stock_movements      CASCADE;
DROP TABLE IF EXISTS public.inventory_batches    CASCADE;
DROP TABLE IF EXISTS public.products             CASCADE;
DROP TABLE IF EXISTS public.suppliers            CASCADE;
DROP TABLE IF EXISTS public.order_items          CASCADE;
DROP TABLE IF EXISTS public.orders               CASCADE;
DROP TABLE IF EXISTS public.invoices             CASCADE;
DROP TABLE IF EXISTS public.transactions         CASCADE;
DROP TABLE IF EXISTS public.expenses             CASCADE;
DROP TABLE IF EXISTS public.documents            CASCADE;
DROP TABLE IF EXISTS public.soap_templates       CASCADE;
DROP TABLE IF EXISTS public.service_items        CASCADE;
DROP TABLE IF EXISTS public.tasks                CASCADE;
DROP TABLE IF EXISTS public.audit_logs           CASCADE;
DROP TABLE IF EXISTS public.scan_results         CASCADE;
DROP TABLE IF EXISTS public.vaccinations         CASCADE;
DROP TABLE IF EXISTS public.pet_vaccinations     CASCADE;
DROP TABLE IF EXISTS public.health_records       CASCADE;
DROP TABLE IF EXISTS public.medical_records      CASCADE;
DROP TABLE IF EXISTS public.queue_entries        CASCADE;
DROP TABLE IF EXISTS public.appointments         CASCADE;
DROP TABLE IF EXISTS public.staff_roles          CASCADE;
DROP TABLE IF EXISTS public.staff_permissions    CASCADE;
DROP TABLE IF EXISTS public.roles                CASCADE;
DROP TABLE IF EXISTS public.staff                CASCADE;
DROP TABLE IF EXISTS public.store_staff          CASCADE;
DROP TABLE IF EXISTS public.customers            CASCADE;
DROP TABLE IF EXISTS public.pets                 CASCADE;
DROP TABLE IF EXISTS public.pet_owners           CASCADE;
DROP TABLE IF EXISTS public.notifications        CASCADE;
DROP TABLE IF EXISTS public.stores               CASCADE;
DROP TABLE IF EXISTS public.profiles             CASCADE;

SELECT 'All tables dropped successfully' AS status;
