-- MIGRATION: FIX GENERATE_STUDENT_SLUG SECURITY DEFINER
-- Reason: Non-admin users cannot see other users' students due to RLS,
-- causing generate_student_slug to propose an existing slug and violating students_slug_unique_idx.
-- Adding SECURITY DEFINER allows the slug generator trigger to check global uniqueness across all students.

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

  -- Bypass RLS to check slug uniqueness across ALL students in the database
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

-- Re-attach trigger to ensure clean state
DROP TRIGGER IF EXISTS trg_generate_student_slug ON public.students;
CREATE TRIGGER trg_generate_student_slug
BEFORE INSERT OR UPDATE OF name, slug ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.generate_student_slug();
