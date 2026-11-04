const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/admin/sales/suburbia-summary.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const { commissionCents, summarizeCommissions } = exportsObject;
const catalog = (id) => ({ sku_source: 'catalog', product_catalog_id: id });
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
