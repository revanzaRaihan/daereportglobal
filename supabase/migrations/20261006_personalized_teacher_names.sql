-- =====================================================================
-- MIGRATION: PERSONALIZED TEACHER NAME FOR ALL ACCOUNTS
-- =====================================================================
-- 1. Remove obsolete shared global teacher_name key from app_settings
DELETE FROM public.app_settings WHERE key = 'teacher_name';

-- 2. Update get_teachers_overview to prioritize teacher_name from user_metadata
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

GRANT EXECUTE ON FUNCTION public.get_teachers_overview() TO authenticated;

-- 3. Update get_all_teachers to prioritize teacher_name from user_metadata
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

GRANT EXECUTE ON FUNCTION public.get_all_teachers() TO authenticated;

-- 4. Update get_history_teachers_overview to prioritize teacher_name from user_metadata
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

GRANT EXECUTE ON FUNCTION public.get_history_teachers_overview() TO authenticated;
