-- Preserve direct PostgREST calls used by the app, but whitelist writable columns.
REVOKE ALL ON public.incidence_requests FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.incidence_requests FROM authenticated;
GRANT SELECT ON public.incidence_requests TO authenticated;
GRANT INSERT (id,employee_id,type,start_date,end_date,reason,file_url,status,created_at)
  ON public.incidence_requests TO authenticated;
GRANT UPDATE (supervisor_status,supervisor_reviewed_by,supervisor_reviewed_at,supervisor_comment,
  rh_status,rh_reviewed_by,rh_reviewed_at,rh_comment)
  ON public.incidence_requests TO authenticated;

ALTER POLICY "Employees can insert own incidences" ON public.incidence_requests
WITH CHECK (employee_id=(SELECT auth.uid()) AND (SELECT private.current_active_role()) IS NOT NULL);
ALTER POLICY "Admins and RH can manage incidences" ON public.incidence_requests
USING ((SELECT private.current_active_role()) IN ('ADMIN','RH') AND employee_id<>(SELECT auth.uid()))
WITH CHECK ((SELECT private.current_active_role()) IN ('ADMIN','RH') AND employee_id<>(SELECT auth.uid()));
ALTER POLICY "Supervisores pueden actualizar incidencias de sus cuentas" ON public.incidence_requests
USING (
  (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL')
  AND employee_id<>(SELECT auth.uid())
  AND EXISTS(SELECT 1 FROM public.account_employees ae
    JOIN public.account_supervisors aus ON aus.account_id=ae.account_id
    WHERE ae.employee_id=incidence_requests.employee_id AND ae.active IS TRUE
      AND aus.supervisor_id=(SELECT auth.uid()) AND aus.active IS TRUE)
)
WITH CHECK (
  (SELECT private.current_active_role()) IN ('SUPERVISOR','SUPERVISOR_VILLARREAL')
  AND employee_id<>(SELECT auth.uid())
  AND EXISTS(SELECT 1 FROM public.account_employees ae
    JOIN public.account_supervisors aus ON aus.account_id=ae.account_id
    WHERE ae.employee_id=incidence_requests.employee_id AND ae.active IS TRUE
      AND aus.supervisor_id=(SELECT auth.uid()) AND aus.active IS TRUE)
);

CREATE OR REPLACE FUNCTION private.enforce_incidence_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid(); actor_role text:=private.current_active_role();
  sup_changed boolean; rh_changed boolean;
BEGIN
  -- Trusted maintenance remains possible; never use this path for browser requests.
  IF actor IS NULL AND current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
  IF actor IS NULL OR actor_role IS NULL THEN
    RAISE EXCEPTION 'Se requiere un usuario activo.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.employee_id IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Solo puedes registrar tu propia solicitud.' USING ERRCODE='42501';
    END IF;
    IF COALESCE(NEW.status,'PENDING')<>'PENDING'
      OR COALESCE(NEW.supervisor_status,'PENDING')<>'PENDING'
      OR COALESCE(NEW.rh_status,'PENDING')<>'PENDING'
      OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
      OR NEW.supervisor_reviewed_by IS NOT NULL OR NEW.supervisor_reviewed_at IS NOT NULL
      OR NEW.supervisor_comment IS NOT NULL OR NEW.rh_reviewed_by IS NOT NULL
      OR NEW.rh_reviewed_at IS NOT NULL OR NEW.rh_comment IS NOT NULL THEN
      RAISE EXCEPTION 'Una solicitud nueva no puede contener aprobaciones.' USING ERRCODE='42501';
    END IF;
    NEW.status:='PENDING'; NEW.supervisor_status:='PENDING'; NEW.rh_status:='PENDING';
    NEW.created_at:=pg_catalog.statement_timestamp();
    RETURN NEW;
  END IF;

  IF (NEW.id,NEW.employee_id,NEW.type,NEW.start_date,NEW.end_date,NEW.reason,NEW.file_url,NEW.created_at,
      NEW.reviewed_by,NEW.reviewed_at,NEW.status)
    IS DISTINCT FROM
     (OLD.id,OLD.employee_id,OLD.type,OLD.start_date,OLD.end_date,OLD.reason,OLD.file_url,OLD.created_at,
      OLD.reviewed_by,OLD.reviewed_at,OLD.status) THEN
    RAISE EXCEPTION 'La revision no puede modificar la solicitud ni su estado final directamente.' USING ERRCODE='42501';
  END IF;
  sup_changed:=(NEW.supervisor_status,NEW.supervisor_reviewed_by,NEW.supervisor_reviewed_at,NEW.supervisor_comment)
    IS DISTINCT FROM (OLD.supervisor_status,OLD.supervisor_reviewed_by,OLD.supervisor_reviewed_at,OLD.supervisor_comment);
  rh_changed:=(NEW.rh_status,NEW.rh_reviewed_by,NEW.rh_reviewed_at,NEW.rh_comment)
    IS DISTINCT FROM (OLD.rh_status,OLD.rh_reviewed_by,OLD.rh_reviewed_at,OLD.rh_comment);
  IF NOT sup_changed AND NOT rh_changed THEN RETURN NEW; END IF;
  IF OLD.employee_id=actor THEN
    RAISE EXCEPTION 'No puedes revisar tu propia incidencia.' USING ERRCODE='42501';
  END IF;
  IF COALESCE(OLD.status,'PENDING')<>'PENDING' THEN
    RAISE EXCEPTION 'Esta incidencia ya esta finalizada. Actualiza la pantalla.' USING ERRCODE='40001';
  END IF;
  IF sup_changed THEN
    IF actor_role NOT IN ('ADMIN','SUPERVISOR','SUPERVISOR_VILLARREAL') THEN
      RAISE EXCEPTION 'Tu rol no puede emitir la validacion de Supervisión.' USING ERRCODE='42501';
    END IF;
    IF actor_role<>'ADMIN' AND NOT EXISTS(
      SELECT 1 FROM public.account_employees ae JOIN public.account_supervisors aus ON aus.account_id=ae.account_id
      WHERE ae.employee_id=OLD.employee_id AND ae.active IS TRUE
        AND aus.supervisor_id=actor AND aus.active IS TRUE) THEN
      RAISE EXCEPTION 'La solicitud no pertenece a una cuenta que supervises.' USING ERRCODE='42501';
    END IF;
    IF COALESCE(OLD.supervisor_status,'PENDING')<>'PENDING' OR COALESCE(OLD.rh_status,'PENDING')<>'PENDING'
      OR NEW.supervisor_status IS NULL OR NEW.supervisor_status NOT IN ('APPROVED','REJECTED') THEN
      RAISE EXCEPTION 'La validacion de Supervisión ya fue emitida o no es valida.' USING ERRCODE='40001';
    END IF;
    NEW.supervisor_reviewed_by:=actor;
    NEW.supervisor_reviewed_at:=pg_catalog.statement_timestamp();
  END IF;
  IF rh_changed THEN
    IF actor_role NOT IN ('ADMIN','RH') THEN
      RAISE EXCEPTION 'Tu rol no puede emitir la autorizacion de RH.' USING ERRCODE='42501';
    END IF;
    IF NEW.supervisor_status IS DISTINCT FROM 'APPROVED'
      OR COALESCE(OLD.rh_status,'PENDING')<>'PENDING'
      OR NEW.rh_status IS NULL OR NEW.rh_status NOT IN ('APPROVED','REJECTED') THEN
      RAISE EXCEPTION 'RH requiere validacion previa y una decision pendiente.' USING ERRCODE='40001';
    END IF;
    NEW.rh_reviewed_by:=actor;
    NEW.rh_reviewed_at:=pg_catalog.statement_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_incidence_workflow() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER incidence_10_guard_workflow BEFORE INSERT OR UPDATE ON public.incidence_requests
FOR EACH ROW EXECUTE FUNCTION private.enforce_incidence_workflow();

CREATE OR REPLACE FUNCTION public.sync_incidence_final_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
  IF NEW.supervisor_status='REJECTED' OR NEW.rh_status='REJECTED' THEN NEW.status:='REJECTED';
  ELSIF NEW.supervisor_status='APPROVED' AND NEW.rh_status='APPROVED' THEN NEW.status:='APPROVED';
  ELSE NEW.status:='PENDING'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_incidence_final_status() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
;
