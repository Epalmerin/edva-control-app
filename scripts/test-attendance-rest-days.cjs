const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.join(__dirname, '..');
function loadTs(relativePath, overrides = {}) {
  const module = { exports: {} };
  const filename = path.join(root, relativePath);
  const requireModule = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return loadTs('src/' + name.slice(2) + '.ts');
    return require(name);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: requireModule, console, Intl, Date });
  return module.exports;
}
const { isRestDay, getAttendanceState } = loadTs('src/lib/attendance-status.ts');

function fixture({ count = 39, entries = 33, restDays = [4], date = '2026-11-05' } = {}) {
  const employees = Array.from({ length: count }, (_, i) => ({
    id: 'employee-' + i, name: i === 0 ? 'PROMOTORA EN DESCANSO' : 'PROMOTOR ' + i,
    email: 'employee' + i + '@example.test', rest_days: i === 0 ? restDays : null,
  }));
  const stores = [{ id: 'store-1', name: 'TIENDA DE PRUEBA', chain_name: 'SEARS', brand_name: 'RESTONIC' }];
  const assignments = employees.map(e => ({ employee_id: e.id, store_id: stores[0].id, profiles: e, stores: stores[0] }));
  const records = employees.slice(1, entries + 1).map(e => ({
    id: 'entry-' + e.id, employee_id: e.id, type: 'ENTRY', created_at: date + 'T18:00:00Z',
    store_id: stores[0].id, stores: stores[0], profiles: e, photo_url: null, latitude: null, longitude: null,
  }));
  return { employees, stores, assignments, records, date };
}

function renderPage(page, data, stateOverrides = {}) {
  const attendance = page === 'attendance';
  const states = attendance
    ? [data.records, data.employees, data.stores, data.assignments, 'account-1', 'CUENTA DE PRUEBA', data.date, false, '', true, null]
    : [data.employees.length, data.records.length, 0, 0, 0, data.assignments, data.records, data.date, false, 'account-1', 'CUENTA DE PRUEBA', '', 0];
  for (const [index, value] of Object.entries(stateOverrides)) states[index] = value;
  let cursor = 0;
  const hooks = {
    ...React, useState: () => [states[cursor++], () => {}], useEffect: () => {},
    useMemo: callback => callback(), useCallback: callback => callback, useRef: value => ({ current: value }),
  };
  const component = loadTs(attendance ? 'src/app/admin/attendance/page.tsx' : 'src/app/admin/page.tsx', {
    react: hooks,
    '@/components/Sidebar': { __esModule: true, default: () => React.createElement('aside', null, 'EDVA') },
    '@/components/ProtectedFileLink': { __esModule: true, default: ({ children }) => React.createElement('span', null, children) },
    '@/lib/supabase': { supabase: {} },
    'next/link': { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children) },
  }).default;
  return renderToStaticMarkup(React.createElement(component));
}

test('ISO weekdays use the selected date and support Sunday, year boundaries and multiple rests', () => {
  assert.equal(isRestDay('2026-11-05', [4]), true);
  assert.equal(isRestDay('2026-11-04', [4]), false);
  assert.equal(isRestDay('2026-11-06', [4]), false);
  assert.equal(isRestDay('2026-11-08', [7]), true);
  assert.equal(isRestDay('2027-01-01', [5, 7]), true);
  assert.equal(isRestDay('2026-11-05', [2, 4]), true);
});
test('unconfigured or empty rest days are not inferred from the contract', () => {
  for (const days of [null, undefined, []]) assert.equal(getAttendanceState('2026-11-05', days, false), 'pending');
});
test('invalid dates do not turn people into resting employees', () => {
  for (const date of ['', 'invalid', '2026-02-30', '2026-13-05']) assert.equal(isRestDay(date, [1,2,3,4,5,6,7]), false);
});
test('a real entry takes precedence over the recurring rest day', () => {
  assert.equal(getAttendanceState('2026-11-05', [4], true), 'reported');
});
test('attendance removes the Thursday rest from pending and displays DESCANSO', () => {
  const html = renderPage('attendance', fixture());
  const pending = html.split('Pendientes por reportar')[1].split('Descanso semanal registrado')[0];
  assert.doesNotMatch(pending, /PROMOTORA EN DESCANSO/);
  assert.match(html, /PROMOTORA EN DESCANSO/);
  assert.match(html, /TIENDA DE PRUEBA · DESCANSO/);
  assert.match(html, /de 38 con entrada esperada/);
  assert.match(html, /Descanso sin configurar/);
  assert.match(pending, />5<\/span>/);
});
test('changing the attendance date restores the employee to pending on a working day', () => {
  const html = renderPage('attendance', fixture({ date: '2026-11-04' }));
  const pending = html.split('Pendientes por reportar')[1].split('Asistencia del día')[0];
  assert.match(pending, /PROMOTORA EN DESCANSO/);
  assert.doesNotMatch(html, /Descanso semanal registrado/);
  assert.match(pending, />6<\/span>/);
});
test('dashboard partitions 39 active promoters into 33 entries, one rest and five pending', () => {
  const html = renderPage('dashboard', fixture());
  assert.match(html, /En descanso<\/p><p[^>]*>1<\/p>/);
  assert.match(html, />Pendientes<\/p><p[^>]*>5<\/p>/);
  assert.match(html, /38 promotores con entrada esperada/);
  assert.match(html, /87%/);
  assert.match(html, /SEARS<\/td><td[^>]*>39<\/td><td[^>]*>33<\/td><td[^>]*>1<\/td><td[^>]*>5<\/td>/);
});
test('dashboard uses the operation date, not an unconditional rest exclusion', () => {
  const html = renderPage('dashboard', fixture({ date: '2026-11-04' }));
  assert.match(html, />Pendientes<\/p><p[^>]*>6<\/p>/);
  assert.match(html, /39 promotores con entrada esperada/);
});
test('multiple assignments do not double count a resting promoter', () => {
  const data = fixture();data.assignments.push({ ...data.assignments[0], store_id: 'store-2' });
  const html = renderPage('dashboard', data);
  assert.match(html, /En descanso<\/p><p[^>]*>1<\/p>/);
  assert.match(html, /SEARS<\/td><td[^>]*>39<\/td>/);
});
test('a real entry on a rest day is counted as present in both views', () => {
  const data = fixture();data.records.push({ ...data.records[0], id: 'rest-day-entry', employee_id: data.employees[0].id });
  const attendance = renderPage('attendance', data);
  assert.doesNotMatch(attendance, /TIENDA DE PRUEBA · DESCANSO/);
  assert.match(attendance, /34 reportados/);
  const dashboard = renderPage('dashboard', data);
  assert.match(dashboard, /En descanso<\/p><p[^>]*>0<\/p>/);
});
test('all resting is not zero attendance coverage or a critical chain', () => {
  const data = fixture({ count: 1, entries: 0 });
  const html = renderPage('dashboard', data);
  assert.match(html, /No aplica/);
  assert.match(html, />Pendientes<\/p><p[^>]*>0<\/p>/);
  assert.match(html, /Operación sin alertas críticas/);
});
test('a selected account uses only the supplied account members', () => {
  const data = fixture({ count: 2, entries: 1 });
  const html = renderPage('dashboard', data);
  assert.match(html, /SEARS<\/td><td[^>]*>2<\/td><td[^>]*>1<\/td><td[^>]*>1<\/td><td[^>]*>0<\/td>/);
});
test('empty account has no pending promoters or attendance coverage', () => {
  const data = fixture({ count: 0, entries: 0 });
  assert.match(renderPage('dashboard', data), /Sin asignaciones activas para evaluar/);
  assert.match(renderPage('attendance', data), /No hay promotores pendientes de entrada/);
});

module.exports = { fixture, renderPage };
