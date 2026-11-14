export type CommissionSale = {
  product_catalog_id: string | null;
  sku_source: string | null;
  quantity?: number | null;
};

export type CommissionRates = Record<string, number | string | null>;

// A legacy SKU match is insufficient evidence of a commission-bearing sale.
export function commissionCents(sale: CommissionSale, rates: CommissionRates): number | null {
  if (sale.sku_source !== "catalog" || !sale.product_catalog_id) return null;
  const raw = rates[sale.product_catalog_id];
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

export function summarizeCommissions(sales: CommissionSale[], rates: CommissionRates) {
  return sales.reduce((summary, sale) => {
    const cents = saleCommissionCents(sale, rates);
    if (cents === null) summary.pending += 1;
    else { summary.cents += cents; summary.defined += 1; }
    return summary;
  }, { cents: 0, defined: 0, pending: 0 });
}

export function saleCommissionCents(sale: CommissionSale, rates: CommissionRates): number | null {
  const unitCents = commissionCents(sale, rates);
  const quantity = sale.quantity ?? 1;
  if (unitCents === null || !Number.isInteger(quantity) || quantity < 1) return null;
  const total = unitCents * quantity;
  return Number.isSafeInteger(total) ? total : null;
}
