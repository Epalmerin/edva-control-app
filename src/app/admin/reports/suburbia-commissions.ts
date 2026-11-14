import { commissionCents, saleCommissionCents, type CommissionRates } from "../sales/suburbia-summary";

export type CommissionReportSale = {
  sale_date: string; ticket_number: string | null;
  amount: number | string | null; sku: string | null; model: string | null;
  size: string | null; quantity: number | null;
  sku_source: string | null; product_catalog_id: string | null;
  employee_id: string | null;
  profiles: { name: string | null; email?: string | null } | null;
  stores: { name: string; chain_name: string | null; brand_name: string | null } | null;
};

export function buildSuburbiaCommissions(sales: CommissionReportSale[], rates: CommissionRates) {
  const groups = new Map<string, { name: string; email: string; stores: Set<string>; units: number;
    defined: number; pending: number; cents: number }>();
  let totalCents = 0, defined = 0, pending = 0, units = 0;
  const detail = sales.filter((sale) => sale.stores?.chain_name?.trim().toUpperCase() === "SUBURBIA").map((sale) => {
    const inCatalogChain = sale.stores?.brand_name?.trim().toUpperCase() === "COLCHONES MASTER";
    const unitCents = inCatalogChain ? commissionCents(sale, rates) : null;
    const cents = inCatalogChain ? saleCommissionCents(sale, rates) : null;
    const quantity = sale.quantity ?? 1;
    const validUnits = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
    const key = sale.employee_id || "SIN_PROMOTOR";
    const group = groups.get(key) || { name: sale.profiles?.name || "Sin promotor", email: sale.profiles?.email || "",
      stores: new Set<string>(), units: 0, defined: 0, pending: 0, cents: 0 };
    group.stores.add(sale.stores?.name || "Sin tienda");
    group.units += validUnits; units += validUnits;
    if (cents === null) { group.pending += 1; pending += 1; }
    else { group.cents += cents; group.defined += 1; totalCents += cents; defined += 1; }
    groups.set(key, group);
    return {
      Fecha: sale.sale_date, Ticket: sale.ticket_number || "", Promotor: group.name, Email: group.email,
      Tienda: sale.stores?.name || "", SKU: sale.sku || "", Modelo: sale.model || "",
      Tamaño: sale.size || "No registrado", Cantidad: quantity,
      "Venta total (MXN)": Number(sale.amount || 0),
      "Comisión por unidad (MXN)": unitCents === null ? "" : unitCents / 100,
      "Comisión total (MXN)": cents === null ? "" : cents / 100,
      Estado: cents !== null ? "Definida" : !sale.sku_source ? "Sin revisión histórica" : "Sin comisión definida",
    };
  });
  const byPromoter = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "es")).map((group) => ({
    Promotor: group.name, Email: group.email, Tiendas: Array.from(group.stores).join(", "), Colchones: group.units,
    "Registros con tarifa": group.defined, "Registros pendientes": group.pending,
    "Comisión acumulada (MXN)": group.defined > 0 ? group.cents / 100 : "",
    Estado: group.pending > 0 ? group.defined > 0 ? "Parcial: incluye pendientes" : "Por definir" : "Completa",
  }));
  return { detail, byPromoter, units, defined, pending, total: defined > 0 || detail.length === 0 ? totalCents / 100 : "" };
}
