const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/storage-files.ts');
const mod = new Module(filename, module);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { parseStoredFile, storedFileReference, downloadProtectedFile } = mod.exports;
const base = 'https://project.example';
test('historical URLs and new references resolve to the same private object', () => {
  for (const bucket of ['attendance-photos', 'warranty-photos', 'incidence-files']) {
    const target = { bucket, path: 'user/file.jpg' };
    assert.deepEqual(parseStoredFile(`${base}/storage/v1/object/public/${bucket}/user/file.jpg`, base), target);
    assert.deepEqual(parseStoredFile(storedFileReference(bucket, target.path), base), target);
  }
});
test('external origins, unapproved buckets, traversal, credentials and tokens are rejected', () => {
  for (const ref of [
    'https://evil.example/storage/v1/object/public/attendance-photos/user/file.jpg',
    `${base}/storage/v1/object/public/recruitment-files/user/file.pdf`,
    `${base}/storage/v1/object/public/attendance-photos/user/../file.jpg`,
    `${base}/storage/v1/object/public/attendance-photos/user/%2e%2e/file.jpg`,
    `${base}/storage/v1/object/public/attendance-photos/user/%252e%252e/file.jpg`,
    `${base}/storage/v1/object/public/attendance-photos/user/file.jpg?token=secret`,
    'https://name:password@project.example/storage/v1/object/public/attendance-photos/user/file.jpg',
    'storage://attendance-photos/user/%2fsecret', 'storage://attendance-photos/user/%5csecret',
    'storage://attendance-photos/user/../file.jpg', 'storage://attendance-photos/user/%00.jpg',
    'storage://attendance-photos/user//file.jpg', 'storage://attendance-photos/user/%ZZ',
  ]) assert.equal(parseStoredFile(ref, base), null, ref);
});
test('private download uses the supplied authenticated client, bucket and object path', async () => {
  const blob = new Blob(['fictional image']);
  const client = { storage: { from(bucket) { assert.equal(bucket, 'attendance-photos'); return {
    async download(file) { assert.equal(file, 'user/photo.jpg'); return { data: blob, error: null }; },
  }; } } };
  assert.equal(await downloadProtectedFile(client, 'storage://attendance-photos/user/photo.jpg', base), blob);
});
test('denied downloads do not fall back to a public URL', async () => {
  const client = { storage: { from() { return { async download() { return { data: null, error: new Error('denied') }; } }; } } };
  await assert.rejects(downloadProtectedFile(client, 'storage://attendance-photos/user/photo.jpg', base), /permisos/);
  await assert.rejects(downloadProtectedFile(client, 'https://evil.example/photo.jpg', base), /referencia/);
});
