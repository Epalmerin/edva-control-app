-- Additive schema. Existing attendance and employee schedules are not modified.
CREATE TABLE public.meal_reminder_settings (
  employee_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  remind_at time NOT NULL DEFAULT '14:00',
  weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]),
  CHECK (extract(second FROM remind_at) = 0)
);
CREATE FUNCTION private.validate_meal_settings() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Zona horaria inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.employee_id AND role='PROMOTOR' AND (active OR NOT NEW.enabled)) THEN RAISE EXCEPTION 'Selecciona un promotor activo'; END IF;
  NEW.updated_at=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_meal_settings() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_meal_settings BEFORE INSERT OR UPDATE ON public.meal_reminder_settings FOR EACH ROW EXECUTE FUNCTION private.validate_meal_settings();
ALTER TABLE public.meal_reminder_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meal_reminder_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meal_reminder_settings TO authenticated;
GRANT ALL ON public.meal_reminder_settings TO service_role;
CREATE POLICY "Administrators manage meal settings" ON public.meal_reminder_settings TO authenticated
  USING ((SELECT private.current_active_role())='ADMIN') WITH CHECK ((SELECT private.current_active_role())='ADMIN');
CREATE POLICY "Promoters read own meal settings" ON public.meal_reminder_settings FOR SELECT TO authenticated
  USING (employee_id=(SELECT auth.uid()) AND (SELECT private.current_active_role())='PROMOTOR');

CREATE TABLE public.meal_push_subscriptions (
  endpoint text PRIMARY KEY CHECK (length(endpoint) BETWEEN 20 AND 4096 AND endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])*push[.]apple[.]com|([a-z0-9-]+[.])+notify[.]windows[.]com)/[^[:space:]]+$'),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh text NOT NULL CHECK(p256dh ~ '^[A-Za-z0-9_-]{87}=?$'),
  auth text NOT NULL CHECK(auth ~ '^[A-Za-z0-9_-]{22}={0,2}$'),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meal_push_employee_idx ON public.meal_push_subscriptions(employee_id) WHERE enabled;
ALTER TABLE public.meal_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meal_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meal_push_subscriptions TO authenticated;
GRANT ALL ON public.meal_push_subscriptions TO service_role;
CREATE POLICY "Active promoters manage only their own push subscriptions" ON public.meal_push_subscriptions TO authenticated
  USING (employee_id=(SELECT auth.uid()) AND (SELECT private.current_active_role())='PROMOTOR')
  WITH CHECK (employee_id=(SELECT auth.uid()) AND (SELECT private.current_active_role())='PROMOTOR');

CREATE TABLE private.meal_push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL, local_date date NOT NULL,
  status text NOT NULL DEFAULT 'claimed' CHECK(status IN('claimed','sent','failed','expired','skipped')),
  created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, http_status integer,
  UNIQUE(employee_id,local_date,endpoint)
);
CREATE INDEX meal_delivery_employee_idx ON private.meal_push_deliveries(employee_id,created_at DESC);
ALTER TABLE private.meal_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.meal_push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.meal_push_deliveries TO service_role;
CREATE TABLE private.meal_push_tests(endpoint text PRIMARY KEY, requested_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.meal_push_tests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.meal_push_tests FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.meal_push_tests TO service_role;
CREATE INDEX IF NOT EXISTS attendance_employee_created_meal_idx ON public.attendance_records(employee_id,created_at,type);

-- Eligibility is shared by the scheduler, claim operation and last-second send check.
CREATE FUNCTION private.meal_due_candidates(p_now timestamptz DEFAULT now())
RETURNS TABLE(employee_id uuid,endpoint text,local_date date,p256dh text,auth text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.id, sub.endpoint, local_clock.day, sub.p256dh, sub.auth
  FROM public.meal_reminder_settings s JOIN public.profiles p ON p.id=s.employee_id
  JOIN public.meal_push_subscriptions sub ON sub.employee_id=p.id AND sub.enabled
  CROSS JOIN LATERAL (SELECT (p_now AT TIME ZONE s.timezone)::date AS day, p_now AT TIME ZONE s.timezone AS moment) local_clock
  WHERE s.enabled AND p.active AND p.role='PROMOTOR'
    AND extract(isodow FROM local_clock.day)::integer=ANY(s.weekdays)
    AND local_clock.moment >= local_clock.day+s.remind_at
    AND local_clock.moment < local_clock.day+s.remind_at+interval '10 minutes'
    AND EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.employee_id=p.id AND a.type='ENTRY'
      AND a.created_at >= local_clock.day::timestamp AT TIME ZONE s.timezone
      AND a.created_at < (local_clock.day+1)::timestamp AT TIME ZONE s.timezone)
    AND NOT EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.employee_id=p.id AND a.type IN('BREAK_OUT','BREAK_IN','EXIT')
      AND a.created_at >= local_clock.day::timestamp AT TIME ZONE s.timezone
      AND a.created_at < (local_clock.day+1)::timestamp AT TIME ZONE s.timezone)
$$;
REVOKE ALL ON FUNCTION private.meal_due_candidates(timestamptz) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.claim_meal_notifications() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  WITH claims AS (
    INSERT INTO private.meal_push_deliveries(employee_id,endpoint,local_date)
    SELECT d.employee_id,d.endpoint,d.local_date FROM private.meal_due_candidates() d
    WHERE NOT EXISTS(SELECT 1 FROM private.meal_push_deliveries l WHERE l.employee_id=d.employee_id AND l.endpoint=d.endpoint AND l.local_date=d.local_date)
    ORDER BY d.employee_id,d.endpoint LIMIT 50 ON CONFLICT DO NOTHING
    RETURNING id,employee_id,endpoint,local_date
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'employee_id',c.employee_id,'endpoint',c.endpoint,'local_date',c.local_date,'p256dh',s.p256dh,'auth',s.auth)),'[]'::jsonb)
    INTO result FROM claims c JOIN public.meal_push_subscriptions s ON s.endpoint=c.endpoint;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.claim_meal_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meal_notifications() TO service_role;

CREATE FUNCTION public.meal_notification_still_due(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM private.meal_push_deliveries l JOIN private.meal_due_candidates() d
    ON d.employee_id=l.employee_id AND d.endpoint=l.endpoint AND d.local_date=l.local_date WHERE l.id=p_id AND l.status='claimed');
$$;
REVOKE ALL ON FUNCTION public.meal_notification_still_due(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meal_notification_still_due(uuid) TO service_role;

CREATE FUNCTION public.finish_meal_notification(p_id uuid,p_status text,p_http integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE private.meal_push_deliveries SET status=p_status,http_status=p_http,finished_at=now() WHERE id=p_id AND status='claimed';
  IF p_status='expired' THEN UPDATE public.meal_push_subscriptions SET enabled=false WHERE endpoint=(SELECT endpoint FROM private.meal_push_deliveries WHERE id=p_id); END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_meal_notification(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_meal_notification(uuid,text,integer) TO service_role;

CREATE FUNCTION public.meal_push_test_allowed(p_endpoint text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
  INSERT INTO private.meal_push_tests(endpoint) VALUES(p_endpoint)
    ON CONFLICT(endpoint) DO UPDATE SET requested_at=now() WHERE private.meal_push_tests.requested_at < now()-interval '1 minute';
  GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $$;
REVOKE ALL ON FUNCTION public.meal_push_test_allowed(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meal_push_test_allowed(text) TO service_role;

CREATE FUNCTION private.meal_reminder_admin_status_internal()
RETURNS TABLE(employee_id uuid,devices bigint,last_sent_at timestamptz,failed bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF private.current_active_role() IS DISTINCT FROM 'ADMIN' THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id,
    (SELECT count(*) FROM public.meal_push_subscriptions sub WHERE sub.employee_id=p.id AND sub.enabled),
    (SELECT max(finished_at) FROM private.meal_push_deliveries l WHERE l.employee_id=p.id AND l.status='sent'),
    (SELECT count(*) FROM private.meal_push_deliveries l WHERE l.employee_id=p.id AND (l.status IN('failed','expired') OR (l.status='claimed' AND l.created_at<now()-interval '5 minutes')) AND l.created_at>now()-interval '7 days')
    FROM public.profiles p WHERE p.role='PROMOTOR' AND p.active;
END $$;
REVOKE ALL ON FUNCTION private.meal_reminder_admin_status_internal() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.meal_reminder_admin_status_internal() TO authenticated;
CREATE OR REPLACE FUNCTION public.meal_reminder_admin_status()
RETURNS TABLE(employee_id uuid,devices bigint,last_sent_at timestamptz,failed bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT * FROM private.meal_reminder_admin_status_internal();
$$;
REVOKE ALL ON FUNCTION public.meal_reminder_admin_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meal_reminder_admin_status() TO authenticated;
CREATE POLICY "Only service role handles deliveries" ON private.meal_push_deliveries TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Only service role handles test limits" ON private.meal_push_tests TO service_role USING (true) WITH CHECK (true);
