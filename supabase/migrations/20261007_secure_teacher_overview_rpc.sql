-- =====================================================================
-- MIGRATION: 20261007_secure_teacher_overview_rpc.sql
-- =====================================================================
-- Deskripsi: Mengunci 3 fungsi stored procedure SECURITY DEFINER
-- rekapitulasi instruktur dengan guard is_admin() untuk mencegah
-- kebocoran data privasi / PII guru kepada pengguna non-admin (P1 High).
-- =====================================================================

-- 1. Kunci fungsi get_teachers_overview
CREATE OR REPLACE FUNCTION public.get_teachers_overview()
RETURNS TABLE (
    teacher_id UUID,
    email VARCHAR,
    name TEXT,
    student_count BIGINT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang berhak mengakses data rekapitulasi guru.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id AS teacher_id,
        u.email,
        COALESCE(
            NULLIF(trim(u.raw_user_meta_data->>'teacher_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
            split_part(u.email, '@', 1)
        ) AS name,
        COUNT(s.id) AS student_count
    FROM auth.users u
    INNER JOIN public.students s ON s.user_id = u.id AND s.deleted_at IS NULL
    GROUP BY u.id, u.email, u.raw_user_meta_data
    HAVING COUNT(s.id) > 0
    ORDER BY student_count DESC, name ASC;
END;
$$;

-- 2. Kunci fungsi get_all_teachers
CREATE OR REPLACE FUNCTION public.get_all_teachers()
RETURNS TABLE (
    teacher_id UUID,
    email VARCHAR,
    name TEXT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang berhak mengakses daftar guru.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id AS teacher_id,
        u.email,
        COALESCE(
            NULLIF(trim(u.raw_user_meta_data->>'teacher_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
            split_part(u.email, '@', 1)
        ) AS name
    FROM auth.users u
    ORDER BY name ASC;
END;
$$;

-- 3. Kunci fungsi get_history_teachers_overview
CREATE OR REPLACE FUNCTION public.get_history_teachers_overview()
RETURNS TABLE (
    teacher_id UUID,
    email VARCHAR,
    name TEXT,
    student_count BIGINT,
    report_count BIGINT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang berhak mengakses rekap riwayat guru.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id AS teacher_id,
        u.email,
        COALESCE(
            NULLIF(trim(u.raw_user_meta_data->>'teacher_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
            split_part(u.email, '@', 1)
        ) AS name,
        COUNT(DISTINCT s.id) AS student_count,
        COUNT(DISTINCT r.id) AS report_count
    FROM auth.users u
    LEFT JOIN public.students s ON s.user_id = u.id AND s.deleted_at IS NULL
    LEFT JOIN public.reports r ON r.user_id = u.id AND r.deleted_at IS NULL
    GROUP BY u.id, u.email, u.raw_user_meta_data
    HAVING COUNT(DISTINCT r.id) > 0 OR COUNT(DISTINCT s.id) > 0
    ORDER BY report_count DESC, name ASC;
END;
$$;

-- Cabut akses dari anon dan batasi ke authenticated
REVOKE EXECUTE ON FUNCTION public.get_teachers_overview() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_all_teachers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_history_teachers_overview() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_teachers_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_teachers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_history_teachers_overview() TO authenticated;
