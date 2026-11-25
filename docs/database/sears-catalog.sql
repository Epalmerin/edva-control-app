-- Sears catalog: 41 SKUs verified against the user's photograph on 2026-11-25.
-- Model includes product type so mattress, box, and complete set remain distinct
-- in existing sales exports and administrator views. No price/commission inferred.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.sales_records, public.sales_product_catalog, public.sales_product_commissions IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE sears_catalog_preserve ON COMMIT DROP AS
SELECT 'sales'::text AS kind,count(*) AS rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.sales_records t
UNION ALL SELECT 'catalog',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) FROM public.sales_product_catalog t
UNION ALL SELECT 'commissions',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY product_id),'')) FROM public.sales_product_commissions t;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.sales_product_catalog WHERE chain_name<>'SUBURBIA' OR brand_name<>'COLCHONES MASTER') THEN RAISE EXCEPTION 'Unexpected existing catalog; inspect before applying'; END IF;
END $guard$;
ALTER TABLE public.sales_product_catalog DROP CONSTRAINT sales_product_catalog_chain_name_check;
ALTER TABLE public.sales_product_catalog DROP CONSTRAINT sales_product_catalog_brand_name_check;
ALTER TABLE public.sales_product_catalog ADD CONSTRAINT sales_product_catalog_chain_brand_check CHECK (
 (chain_name='SUBURBIA' AND brand_name='COLCHONES MASTER') OR
 (chain_name='SEARS' AND brand_name='SISTEMAS DE DESCANSO LORD')
);
-- Existing SELECT policy matches both chain and brand against active assignments.
-- Existing private commission policies and grants remain unchanged.
CREATE OR REPLACE FUNCTION private.validate_suburbia_sale_product()
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
  IF NOT ((store_chain = 'SUBURBIA' AND store_brand = 'COLCHONES MASTER')
       OR (store_chain = 'SEARS' AND store_brand = 'SISTEMAS DE DESCANSO LORD'))
       OR store_chain IS NULL OR store_brand IS NULL THEN
    RAISE EXCEPTION 'Product catalog is not available for this chain and brand' USING ERRCODE = '23514';
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
INSERT INTO public.sales_product_catalog(chain_name,brand_name,sku,model,size) VALUES
('SEARS','SISTEMAS DE DESCANSO LORD','87996610','COLCHÓN Y BOX MUGA JGO','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','87996717','COLCHÓN Y BOX MUGA JGO','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','87996814','COLCHÓN Y BOX MUGA JGO','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','87996911','COLCHÓN Y BOX MUGA JGO','King'),
('SEARS','SISTEMAS DE DESCANSO LORD','40156009','COLCHÓN CASSAT','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40156509','COLCHÓN CASSAT','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40156992','COLCHÓN CASSAT','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40157446','COLCHÓN CASSAT','King'),
('SEARS','SISTEMAS DE DESCANSO LORD','40162823','BOX CASSAT','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40163368','BOX CASSAT','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40163804','BOX CASSAT','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','8740773','COLCHÓN SECRET','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','8740799','COLCHÓN SECRET','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','8740814','COLCHÓN SECRET','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','8740830','COLCHÓN SECRET','King'),
('SEARS','SISTEMAS DE DESCANSO LORD','8718647','BOX SECRET','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','8718689','BOX SECRET','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','8718720','BOX SECRET','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40157633','COLCHÓN LIPA','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40157777','COLCHÓN LIPA','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40158025','COLCHÓN LIPA','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40158221','COLCHÓN LIPA','King'),
('SEARS','SISTEMAS DE DESCANSO LORD','40165697','BOX LIPA','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40166810','BOX LIPA','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40167104','BOX LIPA','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40158570','COLCHÓN COLLINS','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40158767','COLCHÓN COLLINS','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40159319','COLCHÓN COLLINS','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40160174','COLCHÓN COLLINS','King'),
('SEARS','SISTEMAS DE DESCANSO LORD','40167408','BOX COLLINS','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40167506','BOX COLLINS','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40167604','BOX COLLINS','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40160718','COLCHÓN MACAO','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40160923','COLCHÓN MACAO','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40161155','COLCHÓN MACAO','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','40161459','COLCHÓN MACAO','King'),
('SEARS','SISTEMAS DE DESCANSO LORD','40168210','BOX MACAO','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','40168710','BOX MACAO','Matrimonial'),
('SEARS','SISTEMAS DE DESCANSO LORD','40170770','BOX MACAO','Queen'),
('SEARS','SISTEMAS DE DESCANSO LORD','88559577','COLCHÓN Y BOX CON BASE NASTE','Individual'),
('SEARS','SISTEMAS DE DESCANSO LORD','88559841','COLCHÓN Y BOX CON BASE NASTE','Matrimonial');
DO $verify$
DECLARE n bigint; h text; b record;
BEGIN
 FOR b IN SELECT * FROM sears_catalog_preserve LOOP
  IF b.kind='sales' THEN SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) INTO n,h FROM public.sales_records t;
  ELSIF b.kind='catalog' THEN SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) INTO n,h FROM public.sales_product_catalog t WHERE chain_name='SUBURBIA';
  ELSE SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY product_id),'')) INTO n,h FROM public.sales_product_commissions t;
  END IF;
  IF n<>b.rows OR h<>b.hash THEN RAISE EXCEPTION 'Existing % changed; cancelling migration',b.kind; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.sales_product_catalog WHERE chain_name='SEARS')<>41 THEN RAISE EXCEPTION 'Expected 41 Sears products'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
