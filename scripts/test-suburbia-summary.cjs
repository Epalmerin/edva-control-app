const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/admin/sales/suburbia-summary.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const { commissionCents, saleCommissionCents, summarizeCommissions } = exportsObject;
const catalog = (id) => ({ sku_source: 'catalog', product_catalog_id: id });

test('quantity multiplies commission once, leaving unit rate unchanged', () => {
  const sale = { ...catalog('a'), quantity: 3, amount: 9000 };
  assert.equal(commissionCents(sale, { a: '31.40' }), 3140);
  assert.equal(saleCommissionCents(sale, { a: '31.40' }), 9420);
  assert.equal(summarizeCommissions([sale], { a: '31.40' }).cents, 9420);
  assert.equal(sale.amount, 9000);
});
test('old records default to one and invalid quantities remain unresolved', () => {
  assert.equal(saleCommissionCents(catalog('a'), { a: 10 }), 1000);
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal(saleCommissionCents({ ...catalog('a'), quantity }, { a: 10 }), null);
  }
  assert.equal(saleCommissionCents({ sku_source: 'direct', product_catalog_id: null, quantity: 4 }, { a: 10 }), null);
});
test('sums unit rates in cents, counting zero as defined', () => {
  const result = summarizeCommissions([catalog('a'), catalog('b'), catalog('zero')], { a: '31.40', b: '48.00', zero: 0 });
  assert.equal(result.cents, 7940); assert.equal(result.defined, 3); assert.equal(result.pending, 0);
});
test('legacy and directly written SKUs never gain an inferred commission', () => {
  for (const sku_source of [null, 'direct']) assert.equal(commissionCents({ sku_source, product_catalog_id: 'a' }, { a: 31.4 }), null);
});
test('missing or invalid rates remain pending rather than zero', () => {
  for (const value of [undefined, null, '', -1, 'invalid', Infinity]) assert.equal(commissionCents(catalog('a'), { a: value }), null);
  const result = summarizeCommissions([catalog('missing')], {});
  assert.equal(result.defined, 0); assert.equal(result.pending, 1);
});
test('summary uses only supplied filtered records and does not mutate them', () => {
  const records = Object.freeze([Object.freeze(catalog('a'))]);
  const result = summarizeCommissions(records, { a: '0.10', b: '99.90' });
  assert.equal(result.cents, 10); assert.equal(result.defined, 1);
  assert.equal(summarizeCommissions([], {}).cents, 0);
});
