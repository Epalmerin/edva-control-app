const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const JSZip = require('jszip');

const routePath = path.resolve(__dirname, '../src/app/api/admin/export-photos/route.ts');
const source = ts.transpileModule(fs.readFileSync(routePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const USER = '00000000-0000-4000-8000-000000000001';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-be-used';

function setup(overrides = {}) {
  const state = { role: 'ADMIN', active: true, records: [], ...overrides };
  const calls = { clients: 0, attendance: 0, downloads: 0, filters: [] };
  const client = {
    auth: { getUser: async (token) => {
      assert.equal(token, 'test-token');
      return state.invalidToken ? { data: { user: null }, error: new Error('invalid') }
        : { data: { user: { id: USER } }, error: null };
    } },
    from(table) {
      if (table === 'profiles') return {
        select(columns) { assert.equal(columns, 'role, active'); return this; },
        eq(column, value) { assert.equal(column, 'id'); assert.equal(value, USER); return this; },
        single: async () => ({ data: state.missingProfile ? null : { role: state.role, active: state.active }, error: null }),
      };
      assert.equal(table, 'attendance_records');
      calls.attendance++;
      const query = {
        select() { return this; }, gte() { return this; }, lte() { return this; },
        not() { return this; }, order() { return this; },
        limit(value) { assert.equal(value, 251); return this; },
        eq(column, value) { calls.filters.push([column, value]); return this; },
        then(resolve, reject) { return Promise.resolve({ data: state.records, error: state.queryError || null }).then(resolve, reject); },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'attendance-photos');
      return { download: async (filePath) => {
        assert.equal(filePath, 'fixture.jpg'); calls.downloads++;
        return { data: new Blob(['fictional photo fixture']), error: null };
      } };
    } },
  };
  const mod = new Module(routePath, module);
  mod.filename = routePath;
  mod.paths = Module._nodeModulePaths(path.dirname(routePath));
  const originalRequire = mod.require.bind(mod);
  mod.require = (id) => id === '@supabase/supabase-js' ? {
    createClient(url, key, options) {
      calls.clients++;
      assert.equal(url, process.env.NEXT_PUBLIC_SUPABASE_URL);
      assert.equal(key, 'public-test-key');
      assert.equal(options.global.headers.Authorization, 'Bearer test-token');
      assert.equal(options.auth.persistSession, false);
      return client;
    },
  } : originalRequire(id);
  mod._compile(source, routePath);
  const request = (query = 'startDate=2026-11-01&endDate=2026-11-03&employeeId=all', authorization = 'Bearer test-token') =>
    mod.exports.GET(new Request(`https://edva.example/api/admin/export-photos?${query}`, {
      headers: authorization ? { authorization } : {},
    }));
  return { request, calls };
}

test('anonymous and malformed credentials are rejected before any database access', async () => {
  for (const authorization of ['', 'Basic token', 'Bearer test-token trailing']) {
    const { request, calls } = setup();
    const response = await request('', authorization);
    assert.equal(response.status, 401); assert.equal(calls.clients, 0);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});
test('invalid JWT cannot query attendance or files', async () => {
  const { request, calls } = setup({ invalidToken: true });
  assert.equal((await request()).status, 401); assert.equal(calls.attendance, 0); assert.equal(calls.downloads, 0);
});
test('promoter, supervisors, RH and missing profiles cannot use admin export', async () => {
  for (const role of ['PROMOTOR', 'SUPERVISOR', 'SUPERVISOR_VILLARREAL', 'RH']) {
    const { request, calls } = setup({ role });
    assert.equal((await request()).status, 403); assert.equal(calls.attendance, 0);
  }
  const { request, calls } = setup({ missingProfile: true });
  assert.equal((await request()).status, 403); assert.equal(calls.attendance, 0);
});
test('inactive or unknown-state admin cannot export', async () => {
  for (const active of [false, null, undefined]) {
    const { request, calls } = setup({ active });
    assert.equal((await request()).status, 403); assert.equal(calls.attendance, 0);
  }
});
test('admin dates and employee filters are validated before querying attendance', async () => {
  for (const query of ['', 'startDate=2026-02-30&endDate=2026-03-01', 'startDate=2026-11-03&endDate=2026-11-01',
    'startDate=2026-11-01&endDate=2026-11-03&employeeId=invalid']) {
    const { request, calls } = setup();
    assert.equal((await request(query)).status, 400); assert.equal(calls.attendance, 0);
  }
});
test('admin empty periods keep the existing 404 response', async () => {
  const { request } = setup();
  assert.equal((await request()).status, 404);
});
test('existing 250-photo limit prevents downloads of oversized exports', async () => {
  const { request, calls } = setup({ records: Array(251).fill({}) });
  assert.equal((await request()).status, 413); assert.equal(calls.downloads, 0);
});
test('query errors do not disclose database internals', async () => {
  const { request } = setup({ queryError: new Error('private database detail') });
  const response = await request();
  assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /private database detail/);
});
test('active admin downloads the same named ZIP with its own JWT and employee filter', async () => {
  const { request, calls } = setup({ records: [{ id: 'photo-id', employee_id: USER, type: 'ENTRY',
    photo_url: 'https://example.supabase.co/storage/v1/object/public/attendance-photos/fixture.jpg',
    created_at: '2026-11-01T10:00:00Z', profiles: { name: 'Fixture Employee' } }] });
  const response = await request(`startDate=2026-11-01&endDate=2026-11-03&employeeId=${USER}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(calls.filters, [['employee_id', USER]]);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(await zip.file('Fixture_Employee/2026-11-01_ENTRY_photo-id.jpg').async('string'), 'fictional photo fixture');
  assert.equal(calls.downloads, 1);
});
