-- =====================================================================
-- MIGRATION: ENFORCE APP_METADATA ADMIN ROLE (PREVENT PRIVILEGE ESCALATION)
-- =====================================================================
-- Audit Finding 3.2: Memastikan fungsi public.is_admin() murni mengecek
-- app_metadata ->> 'role' = 'admin' dari token JWT yang ditandatangani server.
-- Menghapus seluruh dependensi pada user_metadata (yang dapat dimanipulasi
-- dari browser client melalui supabase.auth.updateUser()).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
