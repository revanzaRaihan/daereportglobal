-- =====================================================================
-- MIGRATION: FIX MULTI-USER ISOLATION ON STUDENTS AND REPORTS
-- =====================================================================
-- Problem: The policy "Allow anonymous read on students" and "Allow anonymous read on reports"
-- was previously granted to BOTH 'anon' and 'authenticated' with 'USING (true)'.
-- As a result, newly registered accounts (e.g. via Google OAuth) could see
-- all students and reports belonging to other teachers.
--
-- Fix:
-- 1. Restrict anonymous read to ONLY 'anon' role (public parent portal).
-- 2. Ensure 'authenticated' role is strictly isolated by (auth.uid() = user_id OR is_admin()).
-- =====================================================================

-- 1. TABEL STUDENTS
DROP POLICY IF EXISTS "Allow anonymous read on students" ON public.students;
CREATE POLICY "Allow anonymous read on students" 
    ON public.students FOR SELECT TO anon 
    USING (true);

DROP POLICY IF EXISTS "Users can perform all actions on their own students" ON public.students;
CREATE POLICY "Users can perform all actions on their own students" 
    ON public.students FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 2. TABEL REPORTS
DROP POLICY IF EXISTS "Allow anonymous read on reports" ON public.reports;
CREATE POLICY "Allow anonymous read on reports" 
    ON public.reports FOR SELECT TO anon 
    USING (true);

DROP POLICY IF EXISTS "Users can perform all actions on their own reports" ON public.reports;
CREATE POLICY "Users can perform all actions on their own reports" 
    ON public.reports FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());
