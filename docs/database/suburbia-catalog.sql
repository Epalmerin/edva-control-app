SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.sales_product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_name text NOT NULL CHECK (chain_name = 'SUBURBIA'),
  brand_name text NOT NULL CHECK (brand_name = 'COLCHONES MASTER'),
  sku text NOT NULL CHECK (sku <> '' AND sku = btrim(sku)),
  model text NOT NULL CHECK (btrim(model) <> ''),
  size text NOT NULL CHECK (btrim(size) <> ''),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chain_name, brand_name, sku)
);

-- Rates never share a row, view, or client response with the promoter catalog.
CREATE TABLE public.sales_product_commissions (
  product_id uuid PRIMARY KEY REFERENCES public.sales_product_catalog(id) ON DELETE RESTRICT,
  commission_amount numeric(12,2) NOT NULL CHECK (commission_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_product_commissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_product_catalog, public.sales_product_commissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sales_product_catalog, public.sales_product_commissions TO authenticated;
GRANT ALL ON public.sales_product_catalog, public.sales_product_commissions TO service_role;

CREATE POLICY "Assigned active users can read Suburbia products"
ON public.sales_product_catalog FOR SELECT TO authenticated
USING (
  (SELECT private.current_active_role()) = 'ADMIN'
  OR (active IS TRUE AND (SELECT private.current_active_role()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.employee_store_assignments a
      JOIN public.stores s ON s.id = a.store_id
      WHERE a.employee_id = (SELECT auth.uid()) AND a.active IS TRUE
        AND upper(btrim(s.chain_name)) = sales_product_catalog.chain_name
        AND upper(btrim(s.brand_name)) = sales_product_catalog.brand_name
    ))
);

CREATE POLICY "Only active administrators can read commission rates"
ON public.sales_product_commissions FOR SELECT TO authenticated
USING ((SELECT private.current_active_role()) = 'ADMIN');

-- All original values are compared under the same table lock. No backfill.
LOCK TABLE public.sales_records IN ACCESS EXCLUSIVE MODE;
DO $preserve$
DECLARE before_rows bigint; after_rows bigint; before_hash text; after_hash text;
BEGIN
  SELECT count(*), md5(coalesce(string_agg(md5(to_jsonb(s)::text), '' ORDER BY id), ''))
  INTO before_rows, before_hash FROM public.sales_records s;

  ALTER TABLE public.sales_records ADD COLUMN size text;
  ALTER TABLE public.sales_records ADD COLUMN product_catalog_id uuid
    REFERENCES public.sales_product_catalog(id) ON DELETE RESTRICT;
  ALTER TABLE public.sales_records ADD COLUMN sku_source text
    CHECK (sku_source IS NULL OR sku_source IN ('catalog','direct'));

  SELECT count(*), md5(coalesce(string_agg(md5((to_jsonb(s) - 'size' - 'product_catalog_id' - 'sku_source')::text), '' ORDER BY id), ''))
  INTO after_rows, after_hash FROM public.sales_records s;
  IF before_rows <> after_rows OR before_hash <> after_hash THEN
    RAISE EXCEPTION 'Existing sales changed; migration cancelled';
  END IF;
END;
$preserve$;

CREATE INDEX sales_records_product_catalog_idx ON public.sales_records(product_catalog_id)
WHERE product_catalog_id IS NOT NULL;

CREATE FUNCTION private.validate_suburbia_sale_product()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE store_chain text; store_brand text; product public.sales_product_catalog%ROWTYPE;
BEGIN
  -- Old clients and other chains retain their original write contract.
  IF NEW.size IS NULL AND NEW.product_catalog_id IS NULL AND NEW.sku_source IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT upper(btrim(s.chain_name)), upper(btrim(s.brand_name))
  INTO store_chain, store_brand FROM public.stores s WHERE s.id = NEW.store_id;
  IF store_chain IS DISTINCT FROM 'SUBURBIA' OR store_brand IS DISTINCT FROM 'COLCHONES MASTER' THEN
    RAISE EXCEPTION 'Product catalog is available only for Suburbia' USING ERRCODE = '23514';
  END IF;
  IF NEW.sku_source IS NULL OR NEW.sku_source NOT IN ('catalog','direct')
     OR nullif(btrim(NEW.sku),'') IS NULL THEN
    RAISE EXCEPTION 'SKU and capture source are required' USING ERRCODE = '23514';
  END IF;

  IF NEW.sku_source = 'catalog' THEN
    SELECT * INTO product FROM public.sales_product_catalog c
    WHERE c.id = NEW.product_catalog_id AND c.active IS TRUE
      AND c.chain_name = store_chain AND c.brand_name = store_brand
      AND upper(c.sku) = upper(btrim(NEW.sku));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Select a valid SKU for this chain' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.product_catalog_id IS NOT NULL THEN
      RAISE EXCEPTION 'Direct SKU must not link a catalog product' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO product FROM public.sales_product_catalog c
    WHERE c.chain_name = store_chain AND c.brand_name = store_brand
      AND upper(c.sku) = upper(btrim(NEW.sku)) AND c.active IS TRUE;
  END IF;

  IF product.id IS NOT NULL THEN
    NEW.sku := product.sku;
    NEW.model := product.model;
    NEW.size := product.size;
    NEW.product_catalog_id := product.id;
    NEW.sku_source := 'catalog';
  ELSE
    IF nullif(btrim(NEW.model),'') IS NULL OR nullif(btrim(NEW.size),'') IS NULL THEN
      RAISE EXCEPTION 'Model and size are required for an unlisted SKU' USING ERRCODE = '23514';
    END IF;
    NEW.sku := btrim(NEW.sku);
    NEW.model := btrim(NEW.model);
    NEW.size := btrim(NEW.size);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.validate_suburbia_sale_product() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_suburbia_sale_product
BEFORE INSERT OR UPDATE OF store_id, sku, model, size, product_catalog_id, sku_source
ON public.sales_records FOR EACH ROW EXECUTE FUNCTION private.validate_suburbia_sale_product();
NOTIFY pgrst, 'reload schema';
