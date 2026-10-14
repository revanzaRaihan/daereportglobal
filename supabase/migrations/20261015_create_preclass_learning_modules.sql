-- =====================================================================
-- MIGRATION: FEATURE #1 - AI CURRICULUM MODULE & WORKSHEET GENERATOR (PRE-CLASS ENGINE)
-- =====================================================================
-- Deskripsi: Menambahkan tabel branches, learning_frameworks, learning_modules,
-- learning_module_sources, serta bridge column pada tabel reports.
-- Dual-ID Strategy (id BIGSERIAL untuk internal joins, uid CHAR(26) untuk public/API).
-- =====================================================================

-- 1. TABEL BRANCHES (Multi-Tenant Branch Isolation)
CREATE TABLE IF NOT EXISTS public.branches (
    id BIGSERIAL PRIMARY KEY,
    uid CHAR(26) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Main Branch jika belum ada
INSERT INTO public.branches (id, uid, name, code)
VALUES (1, '01JFRM0000BRANCHDEFAULT0001', 'Main Branch', 'main')
ON CONFLICT (id) DO NOTHING;

-- 2. TABEL LEARNING_FRAMEWORKS (Standar Kurikulum Nasional & Internasional)
CREATE TABLE IF NOT EXISTS public.learning_frameworks (
    id BIGSERIAL PRIMARY KEY,
    uid CHAR(26) UNIQUE NOT NULL,
    branch_id BIGINT REFERENCES public.branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    schema_structure JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_frameworks_uid ON public.learning_frameworks(uid);
CREATE INDEX IF NOT EXISTS idx_learning_frameworks_branch_id ON public.learning_frameworks(branch_id);
CREATE INDEX IF NOT EXISTS idx_learning_frameworks_code ON public.learning_frameworks(code);

-- 3. TABEL LEARNING_MODULES (Teacher Lesson Plan & Student Worksheet / LKPD)
CREATE TABLE IF NOT EXISTS public.learning_modules (
    id BIGSERIAL PRIMARY KEY,
    uid CHAR(26) UNIQUE NOT NULL,
    branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    framework_id BIGINT NOT NULL REFERENCES public.learning_frameworks(id) ON DELETE RESTRICT,
    subject_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    topic_title VARCHAR(255) NOT NULL,
    language_code CHAR(2) NOT NULL DEFAULT 'id',
    duration_minutes SMALLINT NOT NULL DEFAULT 60,
    teacher_guide_json JSONB NOT NULL,
    student_handout_json JSONB NOT NULL,
    report_seed_json JSONB NOT NULL,
    visibility_scope VARCHAR(20) NOT NULL DEFAULT 'branch' CHECK (visibility_scope IN ('private', 'branch')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_learning_modules_uid ON public.learning_modules(uid);
CREATE INDEX IF NOT EXISTS idx_learning_modules_branch_id ON public.learning_modules(branch_id);
CREATE INDEX IF NOT EXISTS idx_learning_modules_author_id ON public.learning_modules(author_id);
CREATE INDEX IF NOT EXISTS idx_learning_modules_subject_name ON public.learning_modules(subject_name);
CREATE INDEX IF NOT EXISTS idx_learning_modules_grade_level ON public.learning_modules(grade_level);
CREATE INDEX IF NOT EXISTS idx_learning_modules_status ON public.learning_modules(status);
CREATE INDEX IF NOT EXISTS idx_learning_modules_deleted_at ON public.learning_modules(deleted_at);

-- 4. TABEL LEARNING_MODULE_SOURCES (Source-to-Module Reference Documents)
CREATE TABLE IF NOT EXISTS public.learning_module_sources (
    id BIGSERIAL PRIMARY KEY,
    uid CHAR(26) UNIQUE NOT NULL,
    module_id BIGINT NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    storage_disk VARCHAR(30) NOT NULL DEFAULT 'private',
    file_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(60) NOT NULL,
    file_size_bytes INT NOT NULL,
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_module_sources_uid ON public.learning_module_sources(uid);
CREATE INDEX IF NOT EXISTS idx_learning_module_sources_module_id ON public.learning_module_sources(module_id);
CREATE INDEX IF NOT EXISTS idx_learning_module_sources_branch_id ON public.learning_module_sources(branch_id);

-- 5. BRIDGE COLUMN PADA TABEL REPORTS (Menghubungkan Laporan Harian dengan Modul Pembelajaran)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS learning_module_id BIGINT REFERENCES public.learning_modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_learning_module_id ON public.reports(learning_module_id);

-- Compatibility View: student_reports -> reports
CREATE OR REPLACE VIEW public.student_reports AS 
SELECT * FROM public.reports;

-- 6. SEED PRESET KURIKULUM SISTEM
INSERT INTO public.learning_frameworks (id, uid, branch_id, code, name, schema_structure)
VALUES 
(
    1, 
    '01JFRMK01MERDEKACP00000001', 
    NULL, 
    'kurikulum_merdeka', 
    'Kurikulum Merdeka (CP / TP / ATP)', 
    '{"standard": "Kurikulum Merdeka Indonesia", "elements": ["Capaian Pembelajaran (CP)", "Tujuan Pembelajaran (TP)", "Alur Tujuan Pembelajaran (ATP)", "Dimensi Profil Pelajar Pancasila"]}'::jsonb
),
(
    2, 
    '01JFRMK02CAMBRIDGELP000002', 
    NULL, 
    'cambridge', 
    'Cambridge International Curriculum', 
    '{"standard": "Cambridge Assessment International Education", "elements": ["Learning Objectives (Stage/Progression)", "Success Criteria", "Key Scientific & Mathematical Terminology", "Global Perspectives & Inquiry"]}'::jsonb
),
(
    3, 
    '01JFRMK03IBPYPMYP00000003', 
    NULL, 
    'ib', 
    'International Baccalaureate (IB PYP / MYP)', 
    '{"standard": "International Baccalaureate Organization", "elements": ["Central Idea / Inquiry Statement", "Lines of Inquiry", "Learner Profile Attributes", "Key & Related Concepts"]}'::jsonb
),
(
    4, 
    '01JFRMK04ISTECSTA00000004', 
    NULL, 
    'iste_csta', 
    'ISTE & CSTA Computer Science Standards', 
    '{"standard": "CSTA & ISTE Standards for Students", "elements": ["Computational Thinking Dimensions", "Algorithms & Programming", "Hands-on Debugging & Artifact Building", "Collaborative Problem Solving"]}'::jsonb
),
(
    5, 
    '01JFRMK05COMMONCORE000005', 
    NULL, 
    'common_core', 
    'Common Core State Standards (CCSS)', 
    '{"standard": "US Common Core State Standards", "elements": ["Domain & Cluster Codes", "Mathematical/ELA Practices", "Essential Questions", "Performance Assessment Criteria"]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    schema_structure = EXCLUDED.schema_structure;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_module_sources ENABLE ROW LEVEL SECURITY;

-- Branches: read-only by authenticated users
DROP POLICY IF EXISTS "Branches are readable by authenticated users" ON public.branches;
CREATE POLICY "Branches are readable by authenticated users" 
ON public.branches FOR SELECT 
TO authenticated 
USING (true);

-- Frameworks: readable if global (branch_id IS NULL) or matching user branch or admin
DROP POLICY IF EXISTS "Frameworks readable by all authenticated" ON public.learning_frameworks;
CREATE POLICY "Frameworks readable by all authenticated" 
ON public.learning_frameworks FOR SELECT 
TO authenticated 
USING (branch_id IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Frameworks manageable by admins" ON public.learning_frameworks;
CREATE POLICY "Frameworks manageable by admins" 
ON public.learning_frameworks FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- Learning Modules: Multi-tenant and RBAC
-- SELECT: Active and either author, branch-published, or admin
DROP POLICY IF EXISTS "Modules visible to author or branch" ON public.learning_modules;
CREATE POLICY "Modules visible to author or branch" 
ON public.learning_modules FOR SELECT 
TO authenticated 
USING (
    deleted_at IS NULL AND (
        author_id = auth.uid() OR 
        visibility_scope = 'branch' OR 
        public.is_admin()
    )
);

-- INSERT: Authenticated users can create modules
DROP POLICY IF EXISTS "Modules insertable by authenticated users" ON public.learning_modules;
CREATE POLICY "Modules insertable by authenticated users" 
ON public.learning_modules FOR INSERT 
TO authenticated 
WITH CHECK (author_id = auth.uid() OR public.is_admin());

-- UPDATE: Author can update their own drafts; Admin can update anything
DROP POLICY IF EXISTS "Modules editable by author draft or admin" ON public.learning_modules;
CREATE POLICY "Modules editable by author draft or admin" 
ON public.learning_modules FOR UPDATE 
TO authenticated 
USING (
    (author_id = auth.uid() AND status = 'draft') OR 
    public.is_admin()
) 
WITH CHECK (
    (author_id = auth.uid() AND status = 'draft') OR 
    public.is_admin()
);

-- DELETE: Author can soft-delete their own drafts; Admin can soft-delete any module
DROP POLICY IF EXISTS "Modules deletable by author draft or admin" ON public.learning_modules;
CREATE POLICY "Modules deletable by author draft or admin" 
ON public.learning_modules FOR DELETE 
TO authenticated 
USING (
    (author_id = auth.uid() AND status = 'draft') OR 
    public.is_admin()
);

-- Module Sources
DROP POLICY IF EXISTS "Module sources viewable by authorized users" ON public.learning_module_sources;
CREATE POLICY "Module sources viewable by authorized users" 
ON public.learning_module_sources FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.learning_modules m 
        WHERE m.id = module_id AND (
            m.author_id = auth.uid() OR 
            m.visibility_scope = 'branch' OR 
            public.is_admin()
        )
    )
);

DROP POLICY IF EXISTS "Module sources manageable by author or admin" ON public.learning_module_sources;
CREATE POLICY "Module sources manageable by author or admin" 
ON public.learning_module_sources FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.learning_modules m 
        WHERE m.id = module_id AND (
            m.author_id = auth.uid() OR 
            public.is_admin()
        )
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.learning_modules m 
        WHERE m.id = module_id AND (
            m.author_id = auth.uid() OR 
            public.is_admin()
        )
    )
);
