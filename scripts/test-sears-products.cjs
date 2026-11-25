const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/sears-products.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject});
const {isSearsStore,findSearsProduct,searchSearsProducts,resolveSearsProduct}=exportsObject;
const source=require('../templates/sears-products.json');
const products=source.map((row,i)=>({...row,id:String(i),chain_name:'SEARS',brand_name:'SISTEMAS DE DESCANSO LORD'}));
test('41 photographed SKUs are unique; Secret and Collins corrections are preserved',()=>{
 assert.equal(products.length,41);assert.equal(new Set(products.map(p=>p.sku)).size,41);
 assert.equal(findSearsProduct(products,'8740814').model,'COLCHÓN SECRET');
 assert.equal(findSearsProduct(products,'8718647').model,'BOX SECRET');
 assert.equal(findSearsProduct(products,'8718720').size,'Queen');
 assert.equal(findSearsProduct(products,'40158767').model,'COLCHÓN COLLINS');
});
test('model searches keep sizes and mattress/box alternatives separate',()=>{
 const matches=searchSearsProducts(products,'cassat');assert.equal(matches.length,7);
 assert.equal(searchSearsProducts(products,'COLCHON CASSAT QUEEN').length,1);
 assert.equal(searchSearsProducts(products,'box cassat queen')[0].sku,'40163804');
 assert.equal(searchSearsProducts(products,'MUGA JGO').length,4);
 assert.equal(searchSearsProducts(products,'naste base').length,2);
});
test('exact SKU uses canonical product, size and ID rather than manual fields',()=>{
 const p=resolveSearsProduct(products,' 40156009 ','BOX','incorrecto','King');
 assert.equal(p.model,'COLCHÓN CASSAT');assert.equal(p.size,'Individual');assert.equal(p.sku_source,'catalog');assert.ok(p.product_catalog_id);
});
test('a model or partial SKU never silently saves one of several results',()=>{
 for(const query of ['CASSAT','40156','BOX CASSAT QUEEN'])assert.throws(()=>resolveSearsProduct(products,query,'BOX','Other','Queen'),/Selecciona/);
});
test('unknown complete numeric SKU requires explicit product type, model and size',()=>{
 const p=resolveSearsProduct(products,'99999999','BOX','nuevo','Queen');assert.equal(p.model,'BOX NUEVO');assert.equal(p.product_catalog_id,null);assert.equal(p.sku_source,'direct');
 for(const fields of [['CASSATT','BOX','Nuevo','Queen'],['99999999','','Nuevo','Queen'],['99999999','BOX','','Queen'],['99999999','BOX','Nuevo','']])assert.throws(()=>resolveSearsProduct(products,...fields));
});
test('Sears catalog cannot use a Suburbia product or another brand',()=>{
 assert.equal(isSearsStore({chain_name:' sears ',brand_name:'sistemas de descanso lord'}),true);
 assert.equal(isSearsStore({chain_name:'SUBURBIA',brand_name:'COLCHONES MASTER'}),false);
 const mixed=[...products,{...products[0],id:'suburbia',chain_name:'SUBURBIA',brand_name:'COLCHONES MASTER',sku:'12345678',model:'CASSAT'}];
 assert.equal(findSearsProduct(mixed,'12345678'),undefined);assert.equal(searchSearsProducts(mixed,'cassat').length,7);
});
