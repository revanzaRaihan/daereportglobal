-- =====================================================================
-- MASTER DATABASE SCHEMA: DAELY REPORT STUDIO
-- =====================================================================
-- Versi: 1.0 (Commercial Ready)
-- Deskripsi: Skema database lengkap dan konsolidasi untuk inisialisasi
-- sistem Daely Report pada project Supabase baru dalam sekali eksekusi.
-- =====================================================================

-- 0. EKSTENSI DATABASE
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. DEFINISI TABEL-TABEL UTAMA (DDL)
-- =====================================================================

-- 1.1 Tabel STUDENTS (Data Murid)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    meeting_count INT NOT NULL DEFAULT 0,
    first_meeting_date DATE,
    slug TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 1.2 Tabel REPORTS (Laporan Pertemuan)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    meeting_number INT NOT NULL,
    report_date DATE NOT NULL,
    materi VARCHAR(255) NOT NULL,
    behavior TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 1.3 Tabel SCHEDULES (Jadwal Mengajar Guru)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INT NOT NULL, -- 1=Senin, 2=Selasa, ..., 7=Minggu
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    label VARCHAR(255),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 1.4 Tabel SCHEDULE_STUDENT (Relasi Pivot Jadwal - Murid)
CREATE TABLE IF NOT EXISTS public.schedule_student (
    id BIGSERIAL PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.5 Tabel DATASET_ENTRIES (Gaya Penulisan AI)
CREATE TABLE IF NOT EXISTS public.dataset_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_type VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'id',
    body TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.6 Tabel RECOMMENDATION_DATASETS (Dataset Rekomendasi Latihan AI)
CREATE TABLE IF NOT EXISTS public.recommendation_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'id',
    body TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.7 Tabel APP_SETTINGS (Pengaturan Global & Preferensi Akun)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.8 Tabel FEEDBACKS (Masukan dari Orang Tua via Portal Publik)
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    feedback TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. HELPER FUNCTIONS & LOGIKA BISNIS
-- =====================================================================

-- 2.1 Fungsi Deteksi Role Admin (Berbasis Metadata Token)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      false
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- 2.2 Fungsi Generator Slug Murid Otomatis & Anti-Duplikasi
CREATE OR REPLACE FUNCTION public.generate_student_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  candidate_slug TEXT;
  counter INT := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND trim(NEW.slug) <> '' THEN
    base_slug := lower(regexp_replace(regexp_replace(trim(NEW.slug), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s_-]+', '-', 'g'));
  ELSE
    base_slug := lower(regexp_replace(regexp_replace(trim(NEW.name), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s_-]+', '-', 'g'));
  END IF;

  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'student';
  END IF;

  candidate_slug := base_slug;

  WHILE EXISTS (
    SELECT 1 FROM public.students 
    WHERE slug = candidate_slug 
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    counter := counter + 1;
    candidate_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := candidate_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Pasang Trigger Auto-Slug pada Tabel STUDENTS
DROP TRIGGER IF EXISTS trg_generate_student_slug ON public.students;
CREATE TRIGGER trg_generate_student_slug
BEFORE INSERT OR UPDATE OF name, slug ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.generate_student_slug();

-- 2.3 Fungsi Rekap Guru untuk Admin (Teachers Overview)
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

-- 2.4 Fungsi Daftar Seluruh Guru (Dropdown Transfer Murid)
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

-- 2.5 Fungsi Rekap Riwayat Sesi Guru (History Overview)
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

-- 2.6 Fungsi Transfer Kepemilikan Murid & Laporan oleh Admin
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

    UPDATE public.students 
    SET user_id = new_teacher_id, updated_at = now()
    WHERE id = target_student_id;

    UPDATE public.reports
    SET user_id = new_teacher_id, updated_at = now()
    WHERE student_id = target_student_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_student(UUID, UUID) TO authenticated;

-- =====================================================================
-- 3. INDEXING UNTUK PERFORMA TINGGI (PERFORMANCE INDEXES)
-- =====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS students_slug_unique_idx ON public.students (slug);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_student_id_date ON public.reports (student_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id_date ON public.reports (user_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules (user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_student_schedule_id ON public.schedule_student (schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_student_student_id ON public.schedule_student (student_id);
CREATE INDEX IF NOT EXISTS idx_dataset_entries_user_id ON public.dataset_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_datasets_user_id ON public.recommendation_datasets (user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_student_id ON public.feedbacks (student_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON public.feedbacks (user_id);

-- =====================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Aktifkan RLS di seluruh tabel
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_student ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- 4.1 Policies Tabel STUDENTS
DROP POLICY IF EXISTS "Allow anonymous read on students" ON public.students;
CREATE POLICY "Allow anonymous read on students" 
    ON public.students FOR SELECT TO anon 
    USING (true);

DROP POLICY IF EXISTS "Users can perform all actions on their own students" ON public.students;
CREATE POLICY "Users can perform all actions on their own students" 
    ON public.students FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4.2 Policies Tabel REPORTS
DROP POLICY IF EXISTS "Allow anonymous read on reports" ON public.reports;
CREATE POLICY "Allow anonymous read on reports" 
    ON public.reports FOR SELECT TO anon 
    USING (true);

DROP POLICY IF EXISTS "Users can perform all actions on their own reports" ON public.reports;
CREATE POLICY "Users can perform all actions on their own reports" 
    ON public.reports FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4.3 Policies Tabel SCHEDULES
DROP POLICY IF EXISTS "Users can perform all actions on their own schedules" ON public.schedules;
CREATE POLICY "Users can perform all actions on their own schedules" 
    ON public.schedules FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4.4 Policies Tabel SCHEDULE_STUDENT
DROP POLICY IF EXISTS "Users can perform all actions on their own schedule_student relations" ON public.schedule_student;
CREATE POLICY "Users can perform all actions on their own schedule_student relations" 
    ON public.schedule_student FOR ALL TO authenticated 
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.students 
            WHERE students.id = schedule_student.student_id 
            AND students.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.schedules 
            WHERE schedules.id = schedule_student.schedule_id 
            AND schedules.user_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.students 
            WHERE students.id = schedule_student.student_id 
            AND students.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.schedules 
            WHERE schedules.id = schedule_student.schedule_id 
            AND schedules.user_id = auth.uid()
        )
    );

-- 4.5 Policies Tabel DATASET_ENTRIES
DROP POLICY IF EXISTS "Users can perform all actions on their own dataset_entries" ON public.dataset_entries;
CREATE POLICY "Users can perform all actions on their own dataset_entries" 
    ON public.dataset_entries FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4.6 Policies Tabel RECOMMENDATION_DATASETS
DROP POLICY IF EXISTS "Users can perform all actions on their own recommendation_datasets" ON public.recommendation_datasets;
CREATE POLICY "Users can perform all actions on their own recommendation_datasets" 
    ON public.recommendation_datasets FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4.7 Policies Tabel APP_SETTINGS (Terkunci & Aman)
DROP POLICY IF EXISTS "Allow authenticated users to read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow authenticated users to delete app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can read non-sensitive app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can insert non-sensitive app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can update non-sensitive app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can delete app_settings" ON public.app_settings;

CREATE POLICY "Authenticated users can read non-sensitive app_settings"
    ON public.app_settings FOR SELECT TO authenticated
    USING (
        public.is_admin() 
        OR key NOT IN ('ai_api_key', 'ai_provider', 'ai_model')
    );

CREATE POLICY "Authenticated users can insert non-sensitive app_settings"
    ON public.app_settings FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin() 
        OR key NOT IN ('ai_api_key', 'ai_provider', 'ai_model')
    );

CREATE POLICY "Authenticated users can update non-sensitive app_settings"
    ON public.app_settings FOR UPDATE TO authenticated
    USING (
        public.is_admin() 
        OR key NOT IN ('ai_api_key', 'ai_provider', 'ai_model')
    )
    WITH CHECK (
        public.is_admin() 
        OR key NOT IN ('ai_api_key', 'ai_provider', 'ai_model')
    );

CREATE POLICY "Only admins can delete app_settings"
    ON public.app_settings FOR DELETE TO authenticated
    USING (public.is_admin());

-- 4.8 Policies Tabel FEEDBACKS
DROP POLICY IF EXISTS "Allow anonymous insert on feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can view their own feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can update their own feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can delete their own feedbacks" ON public.feedbacks;

CREATE POLICY "Allow anonymous insert on feedbacks" 
    ON public.feedbacks FOR INSERT TO anon, authenticated
    WITH CHECK (student_id IS NOT NULL);

CREATE POLICY "Users can view their own feedbacks" 
    ON public.feedbacks FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update their own feedbacks" 
    ON public.feedbacks FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own feedbacks" 
    ON public.feedbacks FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- =====================================================================
-- 5. REALTIME REPLICATION SETUP
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'feedbacks' AND n.nspname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.feedbacks;
    END IF;
END $$;

-- =====================================================================
-- 6. STORAGE BUCKET & POLICIES ('reports')
-- =====================================================================

-- 6.1 Inisialisasi Bucket Storage 'reports' (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6.2 Kebijakan Akses Storage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public select on reports'
    ) THEN
        CREATE POLICY "Allow public select on reports" 
            ON storage.objects FOR SELECT TO public 
            USING (bucket_id = 'reports');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated uploads on reports'
    ) THEN
        CREATE POLICY "Allow authenticated uploads on reports" 
            ON storage.objects FOR INSERT TO authenticated 
            WITH CHECK (bucket_id = 'reports');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated deletes on reports'
    ) THEN
        CREATE POLICY "Allow authenticated deletes on reports" 
            ON storage.objects FOR DELETE TO authenticated 
            USING (bucket_id = 'reports');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated updates on reports'
    ) THEN
        CREATE POLICY "Allow authenticated updates on reports" 
            ON storage.objects FOR UPDATE TO authenticated 
            USING (bucket_id = 'reports') 
            WITH CHECK (bucket_id = 'reports');
    END IF;
END $$;

