-- =====================================================================
-- MIGRATION: 20261008_create_audit_logs_activity_trail.sql
-- =====================================================================
-- Deskripsi: Menambahkan tabel public.audit_logs untuk mencatat
-- jejak aktivitas krusial administrasi studio (transfer murid,
-- pembaruan konfigurasi AI, manajemen instruktur, dan penghapusan laporan).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    description TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs (entity_type);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Kebijakan Baca: Hanya Admin yang dapat melihat catatan audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 2. Kebijakan Sisip: Pengguna terautentikasi dapat mencatat aktivitasnya sendiri atau admin
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 3. Kebijakan Tolak Update & Hapus: Audit log bersifat IMMUTABLE (Append-only)
-- Tidak ada policy UPDATE atau DELETE untuk authenticated / anon agar catatan tidak dapat dimanipulasi.
