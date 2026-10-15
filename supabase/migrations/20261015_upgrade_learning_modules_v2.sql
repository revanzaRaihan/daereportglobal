-- =====================================================================
-- MIGRATION: UPGRADE LEARNING_MODULES V2 (LMS ARTICLE, SHARE_TOKEN & LKPD)
-- =====================================================================
-- Menambahkan kolom share_token untuk link publik interaktif zero-login (/learn/{share_token}),
-- topic_subtitle, student_article_json, student_lkpd_json, dan opsi kontrol berbagi.
-- =====================================================================

ALTER TABLE public.learning_modules 
ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS topic_subtitle VARCHAR(255),
ADD COLUMN IF NOT EXISTS student_article_json JSONB,
ADD COLUMN IF NOT EXISTS student_lkpd_json JSONB,
ADD COLUMN IF NOT EXISTS is_link_shared BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_hints_on_web BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_learning_modules_share_token ON public.learning_modules(share_token);
CREATE INDEX IF NOT EXISTS idx_learning_modules_is_link_shared ON public.learning_modules(is_link_shared);

-- RLS Policy: Pengguna publik (anonim / unauthenticated) hanya dapat membaca modul
-- jika is_link_shared = true dan modul tidak berstatus soft-deleted.
-- Catatan: Backend route /learn/[share_token] dan /api/learn/[token] juga melakukan sanitasi ketat.
DROP POLICY IF EXISTS "Public can view shared learning modules" ON public.learning_modules;
CREATE POLICY "Public can view shared learning modules"
    ON public.learning_modules FOR SELECT TO anon, authenticated
    USING (
        is_link_shared = TRUE 
        AND deleted_at IS NULL
    );
