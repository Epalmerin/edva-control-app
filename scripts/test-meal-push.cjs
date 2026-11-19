const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../supabase/functions/meal-reminders/protocol.js'),'utf8').replaceAll('export function','function');
const context={URL};vm.createContext(context);vm.runInContext(code+';this.api={allowedPushEndpoint,matchesSecret,deliveryStatus};',context);
const {allowedPushEndpoint,matchesSecret,deliveryStatus}=context.api;
test('only trusted push providers with HTTPS and no credentials/custom port',()=>{
 for(const host of ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2.notify.windows.com'])assert.equal(allowedPushEndpoint(`https://${host}/token`),true);
 for(const url of ['http://fcm.googleapis.com/token','https://fcm.googleapis.com.evil.test/token','https://fcm.googleapis.com@127.0.0.1/token','https://user@fcm.googleapis.com/token','https://localhost/test','https://169.254.169.254/latest','https://fcm.googleapis.com:444/a',null])assert.equal(allowedPushEndpoint(url),false);
});
test('cron secret and accepted/expired/rejected provider responses',()=>{
 assert.equal(matchesSecret('a'.repeat(64),'a'.repeat(64)),true);assert.equal(matchesSecret('a'.repeat(64),'b'.repeat(64)),false);assert.equal(matchesSecret(null,'a'.repeat(64)),false);
 assert.equal(deliveryStatus(201),'sent');assert.equal(deliveryStatus(410),'expired');assert.equal(deliveryStatus(404),'expired');assert.equal(deliveryStatus(429),'failed');assert.equal(deliveryStatus(500),'failed');
});
test('worker uses a fixed attendance URL, shows a notification, and does not cache credentials',()=>{
 const worker=fs.readFileSync(path.join(__dirname,'../public/meal-sw.js'),'utf8');
 assert.match(worker,/showNotification/);assert.match(worker,/new URL\('\/promoter\/attendance'/);assert.doesNotMatch(worker,/caches\.|localStorage|access_token|addEventListener\('fetch'/);
});
