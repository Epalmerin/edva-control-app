CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Only reads the caller's database-backed role; no caller-controlled metadata.
CREATE OR REPLACE FUNCTION private.current_active_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p
  WHERE p.id = (SELECT auth.uid()) AND p.active IS TRUE
$$;
REVOKE ALL ON FUNCTION private.current_active_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_active_role() TO authenticated;

-- Intentionally privileged, narrowly projected directory. No dossier fields.
CREATE OR REPLACE FUNCTION private.employee_directory()
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target.id, target.name, target.email
  FROM public.profiles actor
  JOIN public.profiles target ON (
    target.id = actor.id
    OR actor.role IN ('ADMIN', 'RH')
    OR (
      actor.role IN ('SUPERVISOR', 'SUPERVISOR_VILLARREAL')
      AND EXISTS (
        SELECT 1 FROM public.account_supervisors aus
        JOIN public.account_employees ae ON ae.account_id = aus.account_id
        WHERE aus.supervisor_id = actor.id AND aus.active IS TRUE
          AND ae.employee_id = target.id AND ae.active IS TRUE
      )
    )
  )
  WHERE actor.id = (SELECT auth.uid()) AND actor.active IS TRUE
$$;
REVOKE ALL ON FUNCTION private.employee_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.employee_directory() TO authenticated;

-- PostgREST entry point runs as the caller. Privileged code stays private.
CREATE OR REPLACE FUNCTION public.get_employee_directory()
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$ SELECT * FROM private.employee_directory() $$;
REVOKE ALL ON FUNCTION public.get_employee_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_directory() TO authenticated;
NOTIFY pgrst, 'reload schema';
