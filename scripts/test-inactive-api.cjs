const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-test-key';
const routes = [
  ['admin/create-employee', 'POST'], ['admin/update-employee', 'POST'],
  ['admin/generate-contract', 'POST'], ['admin/generate-sears-letters', 'POST'],
  ['recruitment', 'GET'],
];
function loadRoute(name, state) {
  const file = path.resolve(__dirname, '../src/app/api', name, 'route.ts');
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  const ordinaryRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (id !== '@supabase/supabase-js') return ordinaryRequire(id);
    return { createClient: () => ({
      auth: {
        getUser: async () => state.invalidToken
          ? { data: { user: null }, error: new Error('invalid') }
          : { data: { user: { id: '00000000-0000-4000-8000-000000000001' } }, error: null },
        admin: new Proxy({}, { get: () => () => { throw new Error('unexpected administrative mutation'); } }),
      },
      from: (table) => {
        state.tables.push(table);
        assert.equal(table, 'profiles', 'authorization must precede other reads/writes');
        return {
          select: () => ({ eq: () => ({ single: async () => ({
            data: state.missingProfile ? null : { role: state.role, active: state.active },
            error: state.missingProfile ? new Error('missing') : null,
          }) }) }),
        };
      },
    }) };
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, file);
  return mod.exports;
}
async function invoke(name, method, overrides = {}) {
  const state = { role: 'ADMIN', active: true, tables: [], ...overrides };
  const route = loadRoute(name, state);
  const request = new Request('https://example.invalid/api/' + name + '?view=unsupported-test-view', {
    method,
    headers: state.noToken ? {} : { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  const response = await route[method](request);
  return { response, state };
}
for (const [name, method] of routes) {
  for (const active of [false, null, undefined]) test(name + ' denies inactive/unknown state: ' + active, async () => {
    const { response, state } = await invoke(name, method, { active });
    assert.equal(response.status, 403);
    assert.deepEqual(state.tables, ['profiles']);
  });
  test(name + ' rejects missing profile', async () => assert.equal((await invoke(name, method, { missingProfile: true })).response.status, 403));
  test(name + ' rejects invalid JWT', async () => assert.equal((await invoke(name, method, { invalidToken: true })).response.status, 401));
  test(name + ' rejects absence of JWT', async () => {
    const { response, state } = await invoke(name, method, { noToken: true });
    assert.equal(response.status, 401);
    assert.equal(state.tables.length, 0);
  });
  test(name + ' active ADMIN passes auth and reaches normal input validation', async () => assert.equal((await invoke(name, method)).response.status, 400));
  test(name + ' promoter is not authorized', async () => assert.equal((await invoke(name, method, { role: 'PROMOTOR' })).response.status, 403));
}
test('active RH retains recruitment access and reaches view validation', async () => {
  assert.equal((await invoke('recruitment', 'GET', { role: 'RH' })).response.status, 400);
});
