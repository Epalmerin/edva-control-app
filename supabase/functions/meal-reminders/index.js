import { createClient } from 'npm:@supabase/supabase-js@2.106.0';
import webpush from 'npm:web-push@3.6.7';
import { allowedPushEndpoint, matchesSecret, deliveryStatus } from './protocol.js';

const projectUrl = Deno.env.get('SUPABASE_URL');
const service = createClient(projectUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const origins = ['https://control.edvapublicidad.com','https://edva-control-app.vercel.app'];
async function rpc(name, args = {}) {
  const { data, error } = await service.rpc(name, args);
  if (error) throw new Error('Database operation failed');
  return data;
}
async function runtime() {
  let config = await rpc('meal_push_runtime');
  if (!config.publicKey) {
    const keys = webpush.generateVAPIDKeys();
    config = await rpc('meal_push_runtime', { p_public: keys.publicKey, p_private: keys.privateKey });
  }
  return config;
}
function requestDetails(sub, payload, config) {
  if (!allowedPushEndpoint(sub.endpoint)) throw new Error('Unsupported push endpoint');
  return webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
    vapidDetails: { subject: 'https://control.edvapublicidad.com', publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 60, urgency: 'high', topic: payload.kind==='test'?'edva-meal-test':'edva-meal', contentEncoding: 'aes128gcm',
  });
}
async function send(sub, payload, config) {
  const details = requestDetails(sub, payload, config);
  const response = await fetch(details.endpoint, { method: 'POST',
    headers: Object.fromEntries(Object.entries(details.headers).map(([k,v]) => [k,String(v)])),
    body: new Uint8Array(details.body), redirect: 'error', signal: AbortSignal.timeout(12000) });
  await response.body?.cancel();
  return response.status;
}
Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
    ...(origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } : {}) };
  const reply = (body, status=200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.includes(origin)) return reply({ error: 'Origen no permitido' },403);
  if (req.method === 'OPTIONS') return new Response(null, { status:204, headers });
  const path = new URL(req.url).pathname.split('/').pop();
  try {
    if (['dispatch','health'].includes(path)) {
      if (req.method !== 'POST') return reply({error:'Método no permitido'},405);
      // The gateway is disabled because this endpoint authenticates the scheduler itself.
      const current = await rpc('meal_push_runtime');
      if (!matchesSecret(req.headers.get('x-meal-cron-secret'),current.cronSecret)) return reply({error:'No autorizado'},401);
      const config = await runtime();
      if (path === 'health') {
        const receiver = webpush.generateVAPIDKeys();
        const auth = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
        const details = requestDetails({ endpoint:'https://fcm.googleapis.com/fcm/send/crypto-self-test', p256dh:receiver.publicKey, auth }, { title:'Self test' }, config);
        return reply({ ready:Boolean(config.publicKey), encryptionVerified:details.body.length > 16 });
      }
      const claims = await rpc('claim_meal_notifications');
      let sent=0, failed=0, skipped=0;
      // Bounded concurrency avoids exceeding the edge function lifetime.
      for (let offset=0;offset<claims.length;offset+=8) {
        await Promise.all(claims.slice(offset,offset+8).map(async (claim) => {
          let status='failed', http=null;
          try {
            if (!await rpc('meal_notification_still_due',{p_id:claim.id})) { status='skipped'; skipped++; }
            else {
              http = await send(claim, { title:'EDVA · Hora de comida', body:'Recuerda tomar tu hora de comida y registrar tu salida.', date:claim.local_date, kind:'meal' },config);
              status=deliveryStatus(http); if(status==='sent') sent++; else failed++;
            }
          } catch { failed++; }
          await rpc('finish_meal_notification',{p_id:claim.id,p_status:status,p_http:http});
        }));
      }
      console.log(JSON.stringify({ event:'meal-dispatch', claimed:claims.length,sent,failed,skipped }));
      return reply({ claimed:claims.length,sent,failed,skipped });
    }
    if (!['public-key','test'].includes(path)) return reply({error:'No encontrado'},404);
    const bearer = req.headers.get('authorization') || '';
    if (!bearer.startsWith('Bearer ')) return reply({error:'Inicia sesión'},401);
    const { data:authData,error:authError } = await service.auth.getUser(bearer.slice(7));
    if (authError || !authData.user) return reply({error:'Sesión no válida'},401);
    const userId = authData.user.id;
    const { data:profile,error:profileError } = await service.from('profiles').select('role, active').eq('id',userId).maybeSingle();
    if (profileError || !profile?.active || profile.role!=='PROMOTOR') return reply({error:'Solo promotores activos'},403);
    if(path==='public-key' && req.method==='GET') return reply({ publicKey:(await runtime()).publicKey });
    if(path!=='test' || req.method!=='POST') return reply({error:'Método no permitido'},405);
    const text = await req.text();
    if(text.length>5000) return reply({error:'Solicitud demasiado grande'},400);
    const { endpoint } = JSON.parse(text);
    if(!allowedPushEndpoint(endpoint)) return reply({error:'Dispositivo no válido'},400);
    const { data:sub,error:subError } = await service.from('meal_push_subscriptions').select('endpoint,p256dh,auth').eq('employee_id',userId).eq('endpoint',endpoint).eq('enabled',true).maybeSingle();
    if(subError || !sub) return reply({error:'Activa los avisos en este dispositivo'},400);
    if(!await rpc('meal_push_test_allowed',{p_endpoint:endpoint})) return reply({error:'Espera un minuto antes de repetir la prueba'},429);
    const code = await send(sub,{title:'EDVA · Prueba de avisos',body:'Este dispositivo puede recibir tus recordatorios de comida.',kind:'test'},await runtime());
    if(deliveryStatus(code)==='expired') await service.from('meal_push_subscriptions').update({enabled:false}).eq('endpoint',endpoint).eq('employee_id',userId);
    return code>=200 && code<300 ? reply({accepted:true}) : reply({error:'El servicio de notificaciones no aceptó el aviso. Vuelve a activar este dispositivo.'},502);
  } catch {
    console.error('Meal notification operation failed');
    return reply({error:'No fue posible completar la operación. Intenta nuevamente.'},500);
  }
});
