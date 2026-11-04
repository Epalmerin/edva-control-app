-- Keep the existing PostgREST queries. Enforce the account boundary in RLS.
SET LOCAL lock_timeout='5s';

-- These supporting reads are scoped too. No write permission is added.
ALTER POLICY "Supervisores pueden ver sus cuentas" ON public.account_supervisors
USING (supervisor_id=(SELECT auth.uid()) AND active IS TRUE
  AND (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL'));

CREATE POLICY "Active supervisors can read assigned accounts" ON public.accounts
FOR SELECT TO authenticated USING (active IS TRUE
  AND (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL')
  AND EXISTS(SELECT 1 FROM public.account_supervisors aus
    WHERE aus.account_id=accounts.id AND aus.supervisor_id=(SELECT auth.uid()) AND aus.active IS TRUE));

CREATE POLICY "Active supervisors can read assigned account stores" ON public.account_stores
FOR SELECT TO authenticated USING (
  (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL')
  AND EXISTS(SELECT 1 FROM public.account_supervisors aus
    JOIN public.accounts a ON a.id=aus.account_id AND a.active IS TRUE
    WHERE aus.account_id=account_stores.account_id AND aus.supervisor_id=(SELECT auth.uid()) AND aus.active IS TRUE));

ALTER POLICY "Supervisores pueden ver empleados de sus cuentas" ON public.account_employees
USING (active IS TRUE
  AND (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL')
  AND EXISTS(SELECT 1 FROM public.account_supervisors aus
    JOIN public.accounts a ON a.id=aus.account_id AND a.active IS TRUE
    WHERE aus.account_id=account_employees.account_id AND aus.supervisor_id=(SELECT auth.uid()) AND aus.active IS TRUE));

-- Invoker: all joins continue to obey RLS. No user-supplied actor or target ID.
CREATE FUNCTION private.supervised_employee_store_pairs()
RETURNS TABLE(employee_id uuid,store_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
  SELECT DISTINCT ae.employee_id,ast.store_id
  FROM public.account_supervisors aus
  JOIN public.accounts a ON a.id=aus.account_id AND a.active IS TRUE
  JOIN public.account_employees ae ON ae.account_id=aus.account_id AND ae.active IS TRUE
  JOIN public.account_stores ast ON ast.account_id=aus.account_id
  WHERE aus.supervisor_id=(SELECT auth.uid()) AND aus.active IS TRUE
    AND (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL')
$$;
REVOKE ALL ON FUNCTION private.supervised_employee_store_pairs() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.supervised_employee_store_pairs() TO authenticated;

ALTER POLICY "Supervisor Villarreal read attendance" ON public.attendance_records
USING ((employee_id,store_id) IN (SELECT p.employee_id,p.store_id FROM private.supervised_employee_store_pairs() p));
ALTER POLICY "Supervisor Villarreal read sales" ON public.sales_records
USING ((employee_id,store_id) IN (SELECT p.employee_id,p.store_id FROM private.supervised_employee_store_pairs() p));
ALTER POLICY "Supervisor Villarreal read assignments" ON public.employee_store_assignments
USING ((employee_id,store_id) IN (SELECT p.employee_id,p.store_id FROM private.supervised_employee_store_pairs() p));
-- ADMIN was also covered by this policy; preserve that existing access explicitly.
ALTER POLICY "Supervisor Villarreal read store visits" ON public.store_visit_records
USING ((SELECT private.current_active_role())='ADMIN'
  OR (employee_id,store_id) IN (SELECT p.employee_id,p.store_id FROM private.supervised_employee_store_pairs() p));

-- Existing private definer helpers must honor account deactivation as well.
CREATE OR REPLACE FUNCTION private.employee_directory()
RETURNS TABLE(id uuid,name text,email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT target.id,target.name,target.email
 FROM public.profiles actor
 JOIN public.profiles target ON (
   target.id=actor.id OR actor.role IN('ADMIN','RH') OR (
     actor.role IN('SUPERVISOR','SUPERVISOR_VILLARREAL') AND EXISTS(
       SELECT 1 FROM public.account_supervisors aus
       JOIN public.accounts a ON a.id=aus.account_id AND a.active IS TRUE
       JOIN public.account_employees ae ON ae.account_id=aus.account_id AND ae.active IS TRUE
       WHERE aus.supervisor_id=actor.id AND aus.active IS TRUE AND ae.employee_id=target.id)))
 WHERE actor.id=(SELECT auth.uid()) AND actor.active IS TRUE
$$;
REVOKE ALL ON FUNCTION private.employee_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.employee_directory() TO authenticated;

CREATE OR REPLACE FUNCTION private.can_read_employee_file(p_bucket text,p_name text,p_owner text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid(); actor_role text:=private.current_active_role();
  canonical_ref text:='storage://'||p_bucket||'/'||p_name;
  legacy_ref text:='https://eqryspdvojszvlwxnecj.supabase.co/storage/v1/object/public/'||p_bucket||'/'||p_name;
BEGIN
 IF actor IS NULL OR actor_role IS NULL OR p_bucket NOT IN('attendance-photos','warranty-photos','incidence-files') THEN RETURN false; END IF;
 IF actor_role IN('ADMIN','RH') THEN RETURN true; END IF;
 IF p_owner IS NULL OR pg_catalog.split_part(p_name,'/',1) IS DISTINCT FROM p_owner THEN RETURN false; END IF;
 IF p_owner=actor::text THEN RETURN true; END IF;
 IF actor_role NOT IN('SUPERVISOR','SUPERVISOR_VILLARREAL') THEN RETURN false; END IF;
 IF p_bucket='attendance-photos' THEN
   RETURN EXISTS(SELECT 1 FROM public.attendance_records r
     JOIN private.supervised_employee_store_pairs() p ON p.employee_id=r.employee_id AND p.store_id=r.store_id
     WHERE r.employee_id::text=p_owner AND r.photo_url IN(canonical_ref,legacy_ref))
     OR EXISTS(SELECT 1 FROM public.store_visit_records r
     JOIN private.supervised_employee_store_pairs() p ON p.employee_id=r.employee_id AND p.store_id=r.store_id
     WHERE r.employee_id::text=p_owner AND r.photo_url IN(canonical_ref,legacy_ref));
 ELSIF p_bucket='incidence-files' THEN
   RETURN EXISTS(SELECT 1 FROM public.incidence_requests r
     JOIN public.account_employees ae ON ae.employee_id=r.employee_id AND ae.active IS TRUE
     JOIN public.account_supervisors aus ON aus.account_id=ae.account_id
     JOIN public.accounts a ON a.id=aus.account_id AND a.active IS TRUE
     WHERE aus.supervisor_id=actor AND aus.active IS TRUE AND r.employee_id::text=p_owner
       AND r.file_url IN(canonical_ref,legacy_ref));
 ELSE
   RETURN EXISTS(SELECT 1 FROM public.warranty_reports r
     JOIN private.supervised_employee_store_pairs() p ON p.employee_id=r.employee_id AND p.store_id=r.store_id
     WHERE r.employee_id::text=p_owner AND (r.mattress_photo_url IN(canonical_ref,legacy_ref)
       OR r.base_photo_url IN(canonical_ref,legacy_ref) OR r.ticket_photo_url IN(canonical_ref,legacy_ref)));
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.can_read_employee_file(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_employee_file(text,text,text) TO authenticated;

CREATE INDEX IF NOT EXISTS account_supervisors_active_actor_idx
  ON public.account_supervisors(supervisor_id,account_id) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS attendance_records_employee_store_idx
  ON public.attendance_records(employee_id,store_id);
CREATE INDEX IF NOT EXISTS sales_records_employee_store_idx
  ON public.sales_records(employee_id,store_id);
NOTIFY pgrst,'reload schema';
;
