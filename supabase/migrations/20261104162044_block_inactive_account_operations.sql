-- Active status is checked against the database on every authenticated operation.
SET LOCAL lock_timeout='5s';

-- Only this minimal own-account projection remains available after deactivation.
CREATE FUNCTION private.current_access_status()
RETURNS TABLE(id uuid,role text,active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT p.id,p.role,p.active IS TRUE
 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION private.current_access_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.current_access_status() TO authenticated;

CREATE FUNCTION public.get_current_access_status()
RETURNS TABLE(id uuid,role text,active boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM private.current_access_status() $$;
REVOKE ALL ON FUNCTION public.get_current_access_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_current_access_status() TO authenticated;

-- Restrictive policies intersect with the existing role/account/owner policies.
-- They grant no new access and do not apply to trusted server maintenance roles.
DO $$
DECLARE target record;
BEGIN
 FOR target IN
   SELECT schemaname,tablename FROM pg_catalog.pg_tables
   WHERE schemaname='public' OR (schemaname='storage' AND tablename='objects')
 LOOP
   EXECUTE pg_catalog.format(
     'CREATE POLICY "Active account required" ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.current_active_role()) IS NOT NULL) WITH CHECK ((SELECT private.current_active_role()) IS NOT NULL)',
     target.schemaname,target.tablename);
 END LOOP;
END;
$$;

-- The app uses its assignment trigger, not a client RPC, for this internal work.
-- The trigger is owned by postgres and remains able to call the synchronizer.
REVOKE EXECUTE ON FUNCTION public.sync_employee_accounts(uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_sync_employee_accounts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_employee_accounts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_sync_employee_accounts() TO service_role;
NOTIFY pgrst,'reload schema';
