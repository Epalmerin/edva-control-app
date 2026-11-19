export function allowedPushEndpoint(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && value.length <= 4096 &&
      (['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(u.hostname) ||
       /^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(u.hostname) || /^(?:[a-z0-9-]+\.)+notify\.windows\.com$/.test(u.hostname));
  } catch { return false; }
}
export function matchesSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 64 || b.length !== 64) return false;
  let difference = 0;
  for (let i=0; i<64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function deliveryStatus(httpStatus) {
  return httpStatus >= 200 && httpStatus < 300 ? 'sent' : [404,410].includes(httpStatus) ? 'expired' : 'failed';
}
