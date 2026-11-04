export type CommissionSale = {
  product_catalog_id: string | null;
  sku_source: string | null;
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
    const cents = commissionCents(sale, rates);
    if (cents === null) summary.pending += 1;
    else { summary.cents += cents; summary.defined += 1; }
    return summary;
  }, { cents: 0, defined: 0, pending: 0 });
}
