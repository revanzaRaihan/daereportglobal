-- =====================================================================
-- MIGRATION: INSTRUCTOR INVITATIONS, WHITELIST & SECURE ADMIN CHECK
-- =====================================================================
-- Mendukung arsitektur login Opsi 2 (Invite-Only Whitelist) dengan
-- pengiriman tautan aktivasi ke Gmail instruktur dan manajemen
-- tim pengajar mandiri bagi admin cabang.
-- =====================================================================

-- 1. Tabel INSTRUCTOR_INVITATIONS (Daftar Putih & Token Aktivasi)
CREATE TABLE IF NOT EXISTS public.instructor_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'teacher', -- 'teacher' | 'admin'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'revoked'
    activation_token TEXT,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT now(),
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indeks performa pencarian email & status
CREATE INDEX IF NOT EXISTS idx_instructor_invitations_email ON public.instructor_invitations (email);
CREATE INDEX IF NOT EXISTS idx_instructor_invitations_status ON public.instructor_invitations (status);

-- 2. Keamanan RLS untuk INSTRUCTOR_INVITATIONS
ALTER TABLE public.instructor_invitations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'instructor_invitations' AND policyname = 'Admin full access on instructor_invitations'
    ) THEN
        CREATE POLICY "Admin full access on instructor_invitations"
            ON public.instructor_invitations
            FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 3. Perbaikan fungsi is_admin(): Kunci privilese pada app_metadata (Anti Client-Tampering)
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
