"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Setting={enabled:boolean;remind_at:string;timezone:string};
const endpoint='https://eqryspdvojszvlwxnecj.supabase.co/functions/v1/meal-reminders';
async function pushApi(path:string,body?:object) {
  const {data}=await supabase.auth.getSession();
  if(!data.session) throw new Error('Vuelve a iniciar sesión.');
  const response=await fetch(`${endpoint}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json(); if(!response.ok) throw new Error(result.error||'No se pudo completar la operación.'); return result;
}
function keyBytes(value:string) {
  const plain=atob(value.replaceAll('-','+').replaceAll('_','/'));
  return Uint8Array.from(plain,c=>c.charCodeAt(0));
}
export default function MealNotificationSettings() {
  const [userId,setUserId]=useState(''),[setting,setSetting]=useState<Setting|null>(null),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[supported,setSupported]=useState(true),[installFirst,setInstallFirst]=useState(false);
  useEffect(()=>{
    let alive=true;
    async function load() {
      const {data}=await supabase.auth.getSession(); const id=data.session?.user.id; if(!id) return;
      const {data:profile,error}=await supabase.from('profiles').select('role,active').eq('id',id).maybeSingle();
      if(!alive||error||profile?.role!=='PROMOTOR'||!profile.active) return;
      setUserId(id);
      const compatible='serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setSupported(compatible);
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
      setInstallFirst(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator & {standalone?:boolean}).standalone);
      const result=await supabase.from('meal_reminder_settings').select('enabled,remind_at,timezone').eq('employee_id',id).maybeSingle();
      if(!alive)return; if(result.error) setMessage('No se pudo consultar tu horario. Puedes volver a abrir esta página para reintentar.'); else setSetting(result.data);
      if(!compatible)return;
      const registration=await navigator.serviceWorker.getRegistration('/'); const sub=await registration?.pushManager.getSubscription();
      if(!sub)return;
      const owner=localStorage.getItem('edva_meal_device_owner');
      if(owner&&owner!==id) {await sub.unsubscribe();localStorage.removeItem('edva_meal_device_owner');return;}
      const saved=await supabase.from('meal_push_subscriptions').select('enabled').eq('employee_id',id).eq('endpoint',sub.endpoint).maybeSingle();
      if(alive)setActive(Boolean(saved.data?.enabled&&Notification.permission==='granted'));
      if(Notification.permission!=='granted') await supabase.from('meal_push_subscriptions').update({enabled:false}).eq('employee_id',id).eq('endpoint',sub.endpoint);
    }
    void load().catch(()=>{if(alive)setMessage('No se pudo comprobar este dispositivo. Vuelve a intentar.');});
    const {data:listener}=supabase.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_OUT') {
        setUserId('');setActive(false);
        void (async()=>{if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistration('/');await (await r?.pushManager.getSubscription())?.unsubscribe();}localStorage.removeItem('edva_meal_device_owner');})();
      }
    });
    return()=>{alive=false;listener.subscription.unsubscribe();};
  },[]);
  async function activate() {
    if(busy)return;setBusy(true);setMessage('');
    try {
      // Permission is requested only from this explicit user action.
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('No se autorizaron las notificaciones. Revisa los permisos del navegador para EDVA.');
      const {publicKey}=await pushApi('public-key');
      const registration=await navigator.serviceWorker.register('/meal-sw.js',{scope:'/',updateViaCache:'none'});
      await navigator.serviceWorker.ready;
      let sub=await registration.pushManager.getSubscription();
      if(sub){await sub.unsubscribe();sub=null;}
      if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
      const keys=sub.toJSON().keys;
      if(!keys?.p256dh||!keys.auth)throw new Error('No se pudieron registrar las claves de este dispositivo.');
      const {error}=await supabase.from('meal_push_subscriptions').upsert({endpoint:sub.endpoint,employee_id:userId,p256dh:keys.p256dh,auth:keys.auth,enabled:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw new Error('No se pudo guardar este dispositivo. Desactiva sus avisos anteriores y vuelve a intentar.');
      localStorage.setItem('edva_meal_device_owner',userId);setActive(true);setMessage('Avisos activados en este dispositivo. Usa Enviar prueba para comprobarlos.');
    } catch(error){setMessage(error instanceof Error?error.message:'No se pudieron activar los avisos.');}
    finally{setBusy(false);}
  }
  async function deactivate() {
    setBusy(true);setMessage('');
    try{
      const r=await navigator.serviceWorker.getRegistration('/');const sub=await r?.pushManager.getSubscription();
      if(sub){const {error}=await supabase.from('meal_push_subscriptions').delete().eq('employee_id',userId).eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe();}
      localStorage.removeItem('edva_meal_device_owner');setActive(false);setMessage('Avisos desactivados en este dispositivo.');
    }catch{setMessage('No se pudieron desactivar los avisos. Intenta nuevamente.');}finally{setBusy(false);}
  }
  async function test() {
    setBusy(true);setMessage('');
    try{const r=await navigator.serviceWorker.getRegistration('/');const sub=await r?.pushManager.getSubscription();if(!sub)throw new Error('Activa nuevamente este dispositivo.');await pushApi('test',{endpoint:sub.endpoint});setMessage('Prueba aceptada por el servicio. Revisa las notificaciones de tu celular.');}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo enviar la prueba.');}finally{setBusy(false);}
  }
  if(!userId)return null;
  return <aside className="bg-white border-b border-rose-100 px-4 py-3 text-neutral-900"><details className="max-w-4xl mx-auto">
    <summary className="cursor-pointer text-sm font-semibold py-1">Avisos de comida · {active?'Activados en este dispositivo':'Activar en este celular'}</summary>
    <div className="pt-3 pb-2 space-y-3 text-sm"><p>{setting?.enabled?`Tu recordatorio: ${setting.remind_at.slice(0,5)} · ${setting.timezone}.`:'El administrador todavía no ha activado tu horario. Puedes registrar y probar tu celular desde ahora.'}</p>
      <p className="text-xs text-neutral-600">Recibirás un aviso si tienes entrada registrada y aún no has registrado comida ni salida. Al tocarlo se abre Asistencia. La entrega depende de tu conexión y de los permisos del teléfono.</p>
      {!supported&&<p className="text-amber-800">Este navegador no admite avisos push. En Android, prueba un navegador actualizado; en iPhone agrega EDVA a la pantalla de inicio.</p>}
      {installFirst&&<p className="text-amber-800">En iPhone/iPad (iOS 16.4 o posterior), usa Compartir → Agregar a pantalla de inicio. Abre EDVA desde ese icono y activa los avisos aquí.</p>}
      <div className="flex flex-wrap gap-3">{active?<><button type="button" onClick={()=>void test()} disabled={busy} className="bg-red-500 text-white px-4 py-2 rounded-lg disabled:opacity-50">Enviar prueba</button><button type="button" onClick={()=>void deactivate()} disabled={busy} className="border border-neutral-300 px-4 py-2 rounded-lg disabled:opacity-50">Desactivar en este dispositivo</button></>:<button type="button" onClick={()=>void activate()} disabled={busy||!supported||installFirst} className="bg-red-500 text-white px-4 py-2 rounded-lg disabled:opacity-50">{busy?'Activando…':'Activar notificaciones'}</button>}</div>
      {message&&<p role="status" className="bg-rose-50 border border-rose-100 p-3 rounded-lg">{message}</p>}
    </div></details></aside>;
}
