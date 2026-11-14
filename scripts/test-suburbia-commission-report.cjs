const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const XLSX = require('xlsx');
function loadModule(relativePath, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (!(name in imports)) throw Error('Unexpected import: ' + name); return imports[name]; } });
  return exports;
}
const summary = loadModule('../src/app/admin/sales/suburbia-summary.ts');
const { buildSuburbiaCommissions } = loadModule('../src/app/admin/reports/suburbia-commissions.ts', { '../sales/suburbia-summary': summary });
const sale = (overrides = {}) => ({ sale_date: '2026-11-13', ticket_number: 'TEST', amount: 9000, sku: '0000123', model: 'Modelo ejemplo', size: 'Matrimonial', quantity: 3, sku_source: 'catalog', product_catalog_id: 'p', employee_id: 'e1', profiles: { name: 'Ejemplo', email: 'ejemplo@example.com' }, stores: { name: 'Tienda ejemplo', chain_name: 'SUBURBIA', brand_name: 'COLCHONES MASTER' }, ...overrides });

test('quantity and decimal rates reconcile detail, promoter and grand total; sales amount stays unchanged', () => {
  const report = buildSuburbiaCommissions([sale(), sale({ quantity: 2, employee_id: 'e2', profiles: { name: 'Otra persona' } })], { p: '31.40' });
  assert.equal(report.total, 157); assert.equal(report.units, 5); assert.equal(report.defined, 2);
  assert.equal(report.detail[0]['Comisión total (MXN)'], 94.2);
  assert.equal(report.detail[0]['Venta total (MXN)'], 9000);
  assert.equal(report.byPromoter.reduce((sum, row) => sum + row['Comisión acumulada (MXN)'], 0), 157);
});
test('pending and historical rows are blank, legitimate zero rates are numeric zero', () => {
  const report = buildSuburbiaCommissions([sale({ sku_source: 'direct', product_catalog_id: null }), sale({ sku_source: null }), sale({ product_catalog_id: 'missing' }), sale({ product_catalog_id: 'zero' })], { p: 31.4, zero: 0 });
  assert.equal(report.pending, 3); assert.equal(report.defined, 1); assert.equal(report.total, 0);
  for (const row of report.detail.slice(0, 3)) assert.equal(row['Comisión total (MXN)'], '');
  assert.equal(report.detail[3]['Comisión total (MXN)'], 0);
  assert.equal(buildSuburbiaCommissions([sale({ sku_source: null })], {}).total, '');
  assert.equal(buildSuburbiaCommissions([], {}).total, 0);
});
test('chain and brand boundaries, unidentified promoters, and old quantity fallback are explicit', () => {
  const report = buildSuburbiaCommissions([sale({ stores: { name: 'Other', chain_name: 'SEARS', brand_name: 'COLCHONES MASTER' } }), sale({ employee_id: null, profiles: null, quantity: null }), sale({ stores: { name: 'Sub', chain_name: 'SUBURBIA', brand_name: 'OTHER' } })], { p: 10 });
  assert.equal(report.detail.length, 2); assert.equal(report.total, 10); assert.equal(report.pending, 1);
  assert.ok(report.byPromoter.some((row) => row.Promotor === 'Sin promotor'));
});
test('Excel serialization preserves SKU leading zeros and pending blanks', () => {
  const report = buildSuburbiaCommissions([sale(), sale({ sku_source: 'direct', product_catalog_id: null })], { p: 31.4 });
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(report.detail), 'Comisiones detalle');
  const read = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(read.Sheets['Comisiones detalle'], { defval: '' });
  assert.equal(rows[0].SKU, '0000123'); assert.equal(rows[0].Cantidad, 3);
  assert.equal(rows[0]['Comisión total (MXN)'], 94.2); assert.equal(rows[1]['Comisión total (MXN)'], '');
});
