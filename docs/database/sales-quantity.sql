-- Additive change; omitted quantities retain the previous one-unit behavior.
DO $$
DECLARE before_hash text; after_hash text;
BEGIN
  LOCK TABLE public.sales_records IN ACCESS EXCLUSIVE MODE;
  SELECT md5(coalesce(string_agg(md5((to_jsonb(s)-'quantity')::text), '' ORDER BY id), ''))
    INTO before_hash FROM public.sales_records s;
  ALTER TABLE public.sales_records ADD COLUMN quantity integer NOT NULL DEFAULT 1
    CONSTRAINT sales_records_quantity_positive CHECK (quantity > 0);
  SELECT md5(coalesce(string_agg(md5((to_jsonb(s)-'quantity')::text), '' ORDER BY id), ''))
    INTO after_hash FROM public.sales_records s;
  IF before_hash IS DISTINCT FROM after_hash THEN
    RAISE EXCEPTION 'Existing sales changed unexpectedly';
  END IF;
END $$;
COMMENT ON COLUMN public.sales_records.quantity IS
  'Units of the same SKU and size. Defaults to 1 for previous records and clients. amount remains the line total in MXN.';
