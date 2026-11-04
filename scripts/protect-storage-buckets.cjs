// Run from the project root. Default is read-only; --apply updates bucket settings.
// Server credentials stay in memory and are never written to output.
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret || secret.includes('dummy')) throw new Error('Server-side Storage configuration is missing.');
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const raster = ['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/heic','image/heif','image/avif','image/tiff'];
const settings = {
  'attendance-photos': { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ['image/jpeg','image/png','image/webp'] },
  'warranty-photos': { public: false, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: raster },
  'incidence-files': { public: false, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: ['application/pdf', ...raster] },
};
(async () => {
  const results = [];
  for (const [bucket, config] of Object.entries(settings)) {
    if (process.argv.includes('--apply')) {
      const result = await client.storage.updateBucket(bucket, config);
      if (result.error) throw new Error('Could not update bucket ' + bucket);
    }
    const { data, error } = await client.storage.getBucket(bucket);
    if (error || !data) throw new Error('Could not verify bucket ' + bucket);
    if (process.argv.includes('--apply') && (data.public !== false || Number(data.file_size_limit) !== config.fileSizeLimit)) {
      throw new Error('Bucket configuration verification failed: ' + bucket);
    }
    results.push({ bucket, public: data.public, file_size_limit: data.file_size_limit, allowed_mime_types: data.allowed_mime_types });
  }
  console.log(JSON.stringify({ applied: process.argv.includes('--apply'), buckets: results }, null, 2));
})().catch(() => { console.error('Storage bucket operation failed. No credentials were logged.'); process.exitCode = 1; });
