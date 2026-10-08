-- =====================================================================
-- MIGRATION: 20261007_prevent_accidental_student_cascade_delete.sql
-- =====================================================================
-- Deskripsi: Mencegah penghapusan massal data murid dan laporan secara tidak
-- sengaja saat instruktur dihapus (P1 High). Mengubah relasi foreign key
-- students.user_id dari CASCADE menjadi RESTRICT.
-- =====================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'students_user_id_fkey' 
        AND table_name = 'students'
    ) THEN
        ALTER TABLE public.students DROP CONSTRAINT students_user_id_fkey;
    END IF;

    ALTER TABLE public.students 
        ADD CONSTRAINT students_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
END $$;
