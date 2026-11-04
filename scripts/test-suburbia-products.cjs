const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, '../src/lib/suburbia-products.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, {exports: exportsObject});
const {isSuburbiaStore, findSuburbiaProduct, resolveSuburbiaProduct} = exportsObject;
const products = [{id:'example-product', chain_name:'SUBURBIA', brand_name:'COLCHONES MASTER', sku:'0000123456789', model:'Example model', size:'Matrimonial'}];

test('catalog is limited to Suburbia and the catalog brand', () => {
  assert.equal(isSuburbiaStore({chain_name:' Suburbia ',brand_name:'colchones master'}), true);
  for(const chain_name of ['SEARS','LIVERPOOL','CHAPUR',null]) assert.equal(isSuburbiaStore({chain_name,brand_name:'COLCHONES MASTER'}), false);
  assert.equal(isSuburbiaStore({chain_name:'SUBURBIA',brand_name:'OTHER'}), false);
  assert.equal(isSuburbiaStore(undefined), false);
});
test('SKU is text; leading zeros and catalog size are preserved', () => {
  const result = resolveSuburbiaProduct(products, ' 0000123456789 ', 'Wrong model', 'Wrong size');
  assert.equal(result.sku, '0000123456789');
  assert.equal(result.model, 'Example model');
  assert.equal(result.size, 'Matrimonial');
  assert.equal(result.product_catalog_id, 'example-product');
  assert.equal(result.sku_source, 'catalog');
  assert.equal(findSuburbiaProduct(products,'123456789'), undefined);
});
test('unlisted SKU can be entered in the same field with model and size', () => {
  const result = resolveSuburbiaProduct(products,' NEW-SKU ',' Other model ',' Custom size ');
  assert.equal(result.sku,'NEW-SKU');
  assert.equal(result.model,'Other model');
  assert.equal(result.size,'Custom size');
  assert.equal(result.sku_source,'direct');
  assert.equal(result.product_catalog_id,null);
});
test('unlisted SKU requires all three product fields', () => {
  for(const fields of [['','Model','Queen'],['NEW','','Queen'],['NEW','Model','   ']]) assert.throws(() => resolveSuburbiaProduct(products,...fields));
});
