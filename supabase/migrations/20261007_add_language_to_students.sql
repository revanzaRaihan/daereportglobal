-- =====================================================================
-- MIGRATION: ADD REPORT LANGUAGE PREFERENCE TO STUDENTS TABLE
-- =====================================================================
-- Menambahkan kolom `language` pada tabel `students` agar bahasa laporan
-- ('id' untuk Bahasa Indonesia, 'en' untuk English) terikat otomatis
-- ke masing-masing murid dan auto-detect di halaman Buat Laporan.
-- =====================================================================

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'id';

-- Berikan komentar deskriptif pada kolom
COMMENT ON COLUMN public.students.language IS 'Pilihan bahasa laporan murid: "id" (Bahasa Indonesia) atau "en" (English)';

-- Buat indeks untuk performa query jika diperlukan filtering per bahasa
CREATE INDEX IF NOT EXISTS idx_students_language ON public.students (language);
