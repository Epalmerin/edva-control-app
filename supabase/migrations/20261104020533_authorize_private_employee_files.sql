CREATE OR REPLACE FUNCTION private.can_read_employee_file(p_bucket text, p_name text, p_owner text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE actor uuid := auth.uid(); actor_role text := private.current_active_role();
  canonical_ref text := 'storage://' || p_bucket || '/' || p_name;
  legacy_ref text := 'https://eqryspdvojszvlwxnecj.supabase.co/storage/v1/object/public/' || p_bucket || '/' || p_name;
BEGIN
  IF actor IS NULL OR actor_role IS NULL OR p_bucket NOT IN ('attendance-photos','warranty-photos','incidence-files') THEN RETURN false; END IF;
  IF actor_role IN ('ADMIN','RH') THEN RETURN true; END IF;
  IF p_owner IS NULL OR pg_catalog.split_part(p_name,'/',1) IS DISTINCT FROM p_owner THEN RETURN false; END IF;
  IF p_owner = actor::text THEN RETURN true; END IF;
  IF actor_role NOT IN ('SUPERVISOR','SUPERVISOR_VILLARREAL') THEN RETURN false; END IF;
  IF p_bucket = 'attendance-photos' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.attendance_records r
      JOIN public.account_stores ast ON ast.store_id=r.store_id
      JOIN public.account_supervisors aus ON aus.account_id=ast.account_id
      WHERE aus.supervisor_id=actor AND aus.active IS TRUE
        AND r.employee_id::text=p_owner AND r.photo_url IN (canonical_ref,legacy_ref)
    ) OR EXISTS (
      SELECT 1 FROM public.store_visit_records r
      JOIN public.account_stores ast ON ast.store_id=r.store_id
      JOIN public.account_supervisors aus ON aus.account_id=ast.account_id
      WHERE aus.supervisor_id=actor AND aus.active IS TRUE
        AND r.employee_id::text=p_owner AND r.photo_url IN (canonical_ref,legacy_ref)
    );
  ELSIF p_bucket = 'incidence-files' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.incidence_requests r
      JOIN public.account_employees ae ON ae.employee_id=r.employee_id
      JOIN public.account_supervisors aus ON aus.account_id=ae.account_id
      WHERE aus.supervisor_id=actor AND aus.active IS TRUE AND ae.active IS TRUE
        AND r.employee_id::text=p_owner AND r.file_url IN (canonical_ref,legacy_ref)
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.warranty_reports r
      JOIN public.account_stores ast ON ast.store_id=r.store_id
      JOIN public.account_supervisors aus ON aus.account_id=ast.account_id
      WHERE aus.supervisor_id=actor AND aus.active IS TRUE AND r.employee_id::text=p_owner
        AND (r.mattress_photo_url IN(canonical_ref,legacy_ref)
          OR r.base_photo_url IN(canonical_ref,legacy_ref)
          OR r.ticket_photo_url IN(canonical_ref,legacy_ref))
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.can_read_employee_file(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_employee_file(text,text,text) TO authenticated;

DROP POLICY "Authenticated users can read attendance photos" ON storage.objects;
DROP POLICY "Authenticated users can upload attendance photos" ON storage.objects;
CREATE POLICY "Active users read authorized employee files" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id IN ('attendance-photos','warranty-photos','incidence-files')
  AND private.can_read_employee_file(bucket_id,name,owner_id)
);
CREATE POLICY "Active users upload own employee files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id IN ('attendance-photos','warranty-photos','incidence-files')
  AND (SELECT private.current_active_role()) IS NOT NULL
  AND pg_catalog.split_part(name,'/',1)=(SELECT auth.uid())::text
  AND owner_id=(SELECT auth.uid())::text
);
NOTIFY pgrst, 'reload schema';
