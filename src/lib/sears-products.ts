import type { SuburbiaSaleInput } from "./suburbia-products";

export const SEARS_CHAIN = "SEARS";
export const SEARS_BRAND = "SISTEMAS DE DESCANSO LORD";
export type SearsProduct = { id: string; chain_name: string; brand_name: string; sku: string; model: string; size: string };
export type SearsSaleInput = SuburbiaSaleInput;
const normalize = (value: string | null | undefined) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export function isSearsStore(store: { chain_name: string | null; brand_name: string | null } | undefined) {
  return !!store && normalize(store.chain_name) === SEARS_CHAIN && normalize(store.brand_name) === SEARS_BRAND;
}

export function findSearsProduct(products: SearsProduct[], sku: string) {
  return products.find(product => isSearsStore(product) && product.sku.trim() === sku.trim());
}

export function searchSearsProducts(products: SearsProduct[], query: string) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return products.filter(product => isSearsStore(product) && tokens.every(token => normalize(`${product.sku} ${product.model} ${product.size}`).includes(token)))
    .sort((a, b) => Number(b.sku === query.trim()) - Number(a.sku === query.trim()) || a.model.localeCompare(b.model, "es") || a.sku.localeCompare(b.sku));
}

export function resolveSearsProduct(products: SearsProduct[], query: string, manualType: string, manualModel: string, manualSize: string) {
  const product = findSearsProduct(products, query);
  if (product) return { sku: product.sku, model: product.model, size: product.size, product_catalog_id: product.id, sku_source: "catalog" as const };
  if (searchSearsProducts(products, query).length) throw new Error("Selecciona el producto y tamaño de la lista antes de guardar.");
  if (!/^\d{6,14}$/.test(query.trim())) throw new Error("Escribe el SKU completo del producto (solo números).");
  if (!["COLCHÓN", "BOX", "COLCHÓN Y BOX", "COLCHÓN Y BOX CON BASE"].includes(manualType) || !manualModel.trim() || !manualSize.trim()) throw new Error("Completa el tipo de producto, modelo y tamaño del SKU no listado.");
  return { sku: query.trim(), model: `${manualType} ${manualModel.trim().toUpperCase()}`, size: manualSize.trim(), product_catalog_id: null, sku_source: "direct" as const };
}
