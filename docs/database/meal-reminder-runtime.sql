CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- Vault holds the signing keys and scheduler secret; no secret is committed to source.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='edva_meal_cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'edva_meal_cron_secret');
  END IF;
END $$;
CREATE FUNCTION public.meal_push_runtime(p_public text DEFAULT NULL,p_private text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pub text; priv text; secret text;
BEGIN
  PERFORM pg_advisory_xact_lock(71220419);
  SELECT decrypted_secret INTO pub FROM vault.decrypted_secrets WHERE name='edva_meal_vapid_public';
  SELECT decrypted_secret INTO priv FROM vault.decrypted_secrets WHERE name='edva_meal_vapid_private';
  IF pub IS NULL AND p_public IS NOT NULL AND p_private IS NOT NULL THEN
    IF p_public !~ '^[A-Za-z0-9_-]{87}$' OR p_private !~ '^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Invalid signing keys'; END IF;
    PERFORM vault.create_secret(p_public,'edva_meal_vapid_public');
    PERFORM vault.create_secret(p_private,'edva_meal_vapid_private');
    pub=p_public; priv=p_private;
  END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='edva_meal_cron_secret';
  RETURN jsonb_build_object('publicKey',pub,'privateKey',priv,'cronSecret',secret);
END $$;
REVOKE ALL ON FUNCTION public.meal_push_runtime(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meal_push_runtime(text,text) TO service_role;

CREATE FUNCTION private.tick_meal_reminders(p_health boolean DEFAULT false) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text; request_id bigint;
BEGIN
  IF NOT p_health AND NOT EXISTS(SELECT 1 FROM private.meal_due_candidates() d WHERE NOT EXISTS(
    SELECT 1 FROM private.meal_push_deliveries l WHERE l.employee_id=d.employee_id AND l.endpoint=d.endpoint AND l.local_date=d.local_date)) THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='edva_meal_cron_secret';
  SELECT net.http_post(url:='https://eqryspdvojszvlwxnecj.supabase.co/functions/v1/meal-reminders/'||CASE WHEN p_health THEN 'health' ELSE 'dispatch' END,
    headers:=jsonb_build_object('Content-Type','application/json','x-meal-cron-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=60000) INTO request_id;
  RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION private.tick_meal_reminders(boolean) FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('edva-meal-reminders','* * * * *','SELECT private.tick_meal_reminders();');
