# Suburbia product catalog

The Suburbia / COLCHONES MASTER sales form uses the approved responsive design.
Other chains retain their existing form and save payload. The original sales
history, totals, target calculations and reporting remain in place.

## Data

- `sales_product_catalog`: SKU (text), model, size, chain and brand. Initial import:
  75 products from the supplied Suburbia workbook. Leading zeros are preserved.
- `sales_product_commissions`: commission per unit, keyed to a product. It has an
  independent SELECT policy permitting only an active ADMIN. No commission field
  is stored on the promoter-visible catalog or sales row.
- `sales_records`: adds nullable `size`, `product_catalog_id` and `sku_source`.
  Existing records are not backfilled, reclassified or modified. A missing
  historical size is displayed as "No registrado".

The schema reference is `docs/database/suburbia-catalog.sql`. The production
migration and its initial import are recorded in Supabase migration history.
Workbook commission values are not embedded in frontend code or seed files in
this repository. Administrators can consult the imported rates at
`/admin/suburbia-catalog`.

## Capture and access

The SKU field suggests the assigned chain's products. A known SKU supplies its
canonical model and size; an unlisted SKU allows direct model and size entry.
The database trigger validates this relationship on new-format writes. Old
clients and other-chain writes with no new metadata remain compatible.

Catalog loading failures prevent saving in the Suburbia form until a retry
succeeds. Rates are loaded only by the ADMIN page, and database policies also
deny them to promoters, RH, supervisors, inactive users and anonymous users.
Unlisted products have no catalog commission rate; importing a catalog does not
retroactively calculate pay or change historical sales.

## Validation

Run `node --test scripts/test-suburbia-products.cjs` for product selection and
scope regression checks. The schema was also tested in an isolated Postgres
engine for role isolation, legacy-write compatibility, canonicalization and
direct input, and with read-only authorization checks against the live database.
The migration compares all original sales fields under a table lock before and
after adding columns, and aborts if any original value changes.
# Vista de ventas del administrador

Al seleccionar Suburbia en Ventas (o una cuenta cuyas tiendas sean exclusivamente Suburbia / Colchones Master), el administrador consulta la venta, el modelo, SKU, tamaño y tarifa por unidad. La búsqueda y el filtro de origen afectan tanto las filas como sus indicadores. Las metas por vendedor conservan su alcance mensual por cuenta.

La comisión acumulada suma en centavos una tarifa vigente por registro con `sku_source = 'catalog'` y `product_catalog_id` identificado. Una tarifa de cero sí cuenta como definida. Las ventas anteriores, SKU escritos sin producto identificado y tarifas ausentes quedan pendientes y se excluyen del importe. No se deducen equivalencias por SKU histórico ni se actualizan ventas al abrir el detalle. El acumulado es una consulta del catálogo vigente, no un registro de pagos ni una tarifa histórica congelada.

Las tarifas se consultan por separado en `sales_product_commissions`, bajo la política existente que admite exclusivamente administradores activos. Un error de consulta muestra el acumulado como no disponible, nunca como cero.

Validación del cálculo: `node --test scripts/test-suburbia-summary.cjs`.

