export const SUBURBIA_CHAIN = "SUBURBIA";
export const SUBURBIA_BRAND = "COLCHONES MASTER";

export type SuburbiaProduct = {
  id: string;
  chain_name: string;
  brand_name: string;
  sku: string;
  model: string;
  size: string;
};

export type SuburbiaSaleInput = {
  store_id: string;
  sale_date: string;
  sku: string;
  model: string;
  size: string;
  ticket_number: string;
  amount: number;
  product_catalog_id: string | null;
  sku_source: "catalog" | "direct";
};

const normalize = (value: string | null | undefined) => (value || "").trim().toUpperCase();

export function isSuburbiaStore(store: { chain_name: string | null; brand_name: string | null } | undefined) {
  return !!store && normalize(store.chain_name) === SUBURBIA_CHAIN && normalize(store.brand_name) === SUBURBIA_BRAND;
}

export function findSuburbiaProduct(products: SuburbiaProduct[], sku: string) {
  return products.find((product) => normalize(product.sku) === normalize(sku));
}

export function resolveSuburbiaProduct(products: SuburbiaProduct[], sku: string, model: string, size: string) {
  const product = findSuburbiaProduct(products, sku);
  if (product) return { sku: product.sku, model: product.model, size: product.size, product_catalog_id: product.id, sku_source: "catalog" as const };
  if (!sku.trim() || !model.trim() || !size.trim()) throw new Error("Completa el SKU, modelo y tamaño del producto.");
  return { sku: sku.trim(), model: model.trim(), size: size.trim(), product_catalog_id: null, sku_source: "direct" as const };
}
