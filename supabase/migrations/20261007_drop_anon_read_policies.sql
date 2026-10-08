-- =====================================================================
-- MIGRATION: 20261007_drop_anon_read_policies.sql
-- =====================================================================
-- Deskripsi: Menutup celah kebocoran data massal anonim (P0 Critical)
-- pada tabel students dan reports melalui Supabase PostgREST.
-- Seluruh akses data portal publik orang tua kini wajib dilayani
-- secara aman melalui server-side Next.js SSR (createAdminClient).
-- =====================================================================

-- 1. Cabut kebijakan baca anonim pada tabel students
DROP POLICY IF EXISTS "Allow anonymous read on students" ON public.students;

-- 2. Cabut kebijakan baca anonim pada tabel reports
DROP POLICY IF EXISTS "Allow anonymous read on reports" ON public.reports;
