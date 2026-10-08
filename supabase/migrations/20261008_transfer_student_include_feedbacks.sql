-- =====================================================================
-- MIGRATION: 20261008_transfer_student_include_feedbacks.sql
-- =====================================================================
-- Deskripsi: Menyempurnakan fungsi transfer_student agar memindahkan
-- seluruh masukan orang tua (feedbacks) ke pengajar baru (P1 High).
-- Menjamin kontinuitas komunikasi pengajar baru dengan orang tua murid.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.transfer_student(
    target_student_id UUID,
    new_teacher_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat memindahkan murid.';
    END IF;

    -- 1. Pindahkan kepemilikan murid
    UPDATE public.students 
    SET user_id = new_teacher_id, updated_at = now()
    WHERE id = target_student_id;

    -- 2. Pindahkan seluruh riwayat laporan pertemuan
    UPDATE public.reports
    SET user_id = new_teacher_id, updated_at = now()
    WHERE student_id = target_student_id;

    -- 3. Pindahkan seluruh masukan orang tua (feedbacks) ke pengajar baru
    UPDATE public.feedbacks
    SET user_id = new_teacher_id
    WHERE student_id = target_student_id;

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_student(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_student(UUID, UUID) TO authenticated;
