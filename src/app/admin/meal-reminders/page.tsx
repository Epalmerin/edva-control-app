"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';

type Person = { id:string; name:string; work_timezone:string|null; break_start_time:string|null; rest_days:number[]|null };
type Setting = { employee_id:string; enabled:boolean; remind_at:string; weekdays:number[]; timezone:string };
type Status = { employee_id:string; devices:number; last_sent_at:string|null; failed:number };
const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
function reminderForm(person:Person|undefined,setting:Setting|undefined) {
  if(setting)return {enabled:setting.enabled,remind_at:setting.remind_at.slice(0,5),weekdays:setting.weekdays,timezone:setting.timezone};
  const weekdays=[1,2,3,4,5,6,7].filter(day=>!person?.rest_days?.includes(day));
  return {enabled:false,remind_at:person?.break_start_time?.slice(0,5)||'14:00',weekdays:weekdays.length?weekdays:[1,2,3,4,5],timezone:person?.work_timezone||'America/Mexico_City'};
}
async function allRows<T>(table:string,select:string,filter?:(query:any)=>any):Promise<T[]> {
  const rows:T[]=[];
  while(true) {
    let query=supabase.from(table).select(select); if(filter) query=filter(query);
    const {data,error}=await query.order(table==='profiles'?'id':'employee_id').range(rows.length,rows.length+499);
    if(error) throw error; if(!data?.length) return rows; rows.push(...data as T[]);
  }
}
export default function MealReminderAdminPage() {
  const [people,setPeople]=useState<Person[]>([]),[settings,setSettings]=useState<Setting[]>([]),[statuses,setStatuses]=useState<Status[]>([]);
  const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const [form,setForm]=useState({enabled:false,remind_at:'14:00',weekdays:[1,2,3,4,5,6,7],timezone:'America/Mexico_City'});
  async function load() {
    setLoading(true); setMessage('');
    try {
      const [p,s,status]=await Promise.all([
        allRows<Person>('profiles','id,name,work_timezone,break_start_time,rest_days',q=>q.eq('role','PROMOTOR').eq('active',true)),
        allRows<Setting>('meal_reminder_settings','employee_id,enabled,remind_at,weekdays,timezone'),
        supabase.rpc('meal_reminder_admin_status'),
      ]);
      if(status.error) throw status.error;
      setPeople(p.sort((a,b)=>a.name.localeCompare(b.name,'es'))); setSettings(s); setStatuses(status.data||[]);
      if(selected)setForm(reminderForm(p.find(person=>person.id===selected),s.find(setting=>setting.employee_id===selected)));
    } catch { setMessage('No se pudieron cargar los recordatorios. Usa Actualizar para reintentar.'); }
    finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  function choose(id:string) {
    setForm(reminderForm(people.find(p=>p.id===id),settings.find(s=>s.employee_id===id)));
    setSelected(id);setMessage('');
  }
  const filtered=useMemo(()=>people.filter(p=>p.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))),[people,search]);
  const zones=Array.from(new Set(['America/Mexico_City','America/Cancun','America/Tijuana','America/Hermosillo','America/Mazatlan','America/Chihuahua','America/Monterrey',form.timezone]));
  const status=statuses.find(s=>s.employee_id===selected);
  async function save(event:React.FormEvent) {
    event.preventDefault(); if(!selected||saving) return; setSaving(true);setMessage('');
    try {
      if(!form.weekdays.length) throw new Error('Selecciona al menos un día.');
      const {error}=await supabase.from('meal_reminder_settings').upsert({employee_id:selected,...form},{onConflict:'employee_id'});
      if(error) throw error;
      setSettings(old=>[...old.filter(s=>s.employee_id!==selected),{employee_id:selected,...form}]);
      setMessage(form.enabled?'Recordatorio activado. El promotor debe autorizar las notificaciones en su celular.':'Recordatorio pausado.');
    } catch(error) {setMessage(error instanceof Error?error.message:'No se pudo guardar el recordatorio.');}
    finally {setSaving(false);}
  }
  const field='block w-full mt-2 border border-neutral-300 rounded-xl bg-white px-3 py-3';
  return <main className="min-h-screen bg-rose-50 flex text-neutral-900"><Sidebar />
    <section className="flex-1 min-w-0 p-5 md:p-8">
      <div className="flex flex-wrap justify-between gap-4 mb-6"><div><h1 className="text-3xl font-bold">Recordatorios de comida</h1><p className="text-sm text-neutral-600 mt-2">Configura un horario por promotor. Esta pantalla incluye a todos los promotores activos.</p></div><Link href="/admin/employees" className="text-sm underline">Volver a empleados</Link></div>
      <p className="bg-white border border-rose-200 rounded-xl p-4 text-sm mb-6">Se envía un aviso por dispositivo en los días elegidos, si el promotor registró entrada y aún no ha registrado comida ni salida. Los horarios de trabajo del expediente se conservan.</p>
      <div className="grid xl:grid-cols-[minmax(260px,1fr)_minmax(320px,1fr)] gap-6">
        <section className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="flex items-end gap-3"><label className="flex-1 text-sm font-semibold">Buscar promotor<input type="search" value={search} onChange={e=>setSearch(e.target.value)} className={field} /></label><button disabled={loading||saving} onClick={()=>void load()} className="border rounded-xl p-3 text-sm disabled:opacity-50">Actualizar</button></div>
          <p className="text-xs text-neutral-500 my-4">{loading?'Cargando…':`${filtered.length} promotores · Selecciona uno para configurar`}</p>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-neutral-100">{filtered.map(p=>{const s=settings.find(s=>s.employee_id===p.id),status=statuses.find(s=>s.employee_id===p.id);return <button type="button" key={p.id} disabled={saving||loading} onClick={()=>choose(p.id)} aria-pressed={selected===p.id} className={`block w-full text-left p-3 rounded-lg ${selected===p.id?'bg-rose-50 ring-1 ring-rose-200':'hover:bg-neutral-50'}`}><span className="block font-semibold text-sm">{p.name}</span><span className="block text-xs text-neutral-600 mt-1">{s?.enabled?`${s.remind_at.slice(0,5)} · ${s.timezone}`:'Sin activar'} · {status?.devices||0} dispositivo(s)</span></button>;})}</div>
        </section>
        <section className="bg-white border border-neutral-200 rounded-2xl p-5">
          {!selected?<p className="text-neutral-600">Selecciona un promotor.</p>:<form onSubmit={save} className="space-y-5">
            <h2 className="text-lg font-bold">{people.find(p=>p.id===selected)?.name}</h2>
            <label className="flex gap-3 items-center font-semibold text-sm"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})} disabled={saving} />Activar recordatorio de comida</label>
            <label className="block text-sm font-semibold">Hora del aviso<input type="time" step="60" required value={form.remind_at} onChange={e=>setForm({...form,remind_at:e.target.value})} className={field} disabled={saving} /></label>
            <label className="block text-sm font-semibold">Zona horaria<select value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} className={field} disabled={saving}>{zones.map(z=><option key={z}>{z}</option>)}</select></label>
            <fieldset disabled={saving}><legend className="text-sm font-semibold mb-3">Días en que aplica</legend><div className="flex flex-wrap gap-3">{days.map((day,index)=><label key={day} className="text-sm flex gap-2 items-center"><input type="checkbox" checked={form.weekdays.includes(index+1)} onChange={e=>setForm({...form,weekdays:e.target.checked?[...form.weekdays,index+1].sort():form.weekdays.filter(d=>d!==index+1)})} />{day}</label>)}</div></fieldset>
            <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-2"><p>Dispositivos registrados: <strong>{status?.devices||0}</strong></p><p>Último envío aceptado: {status?.last_sent_at?new Date(status.last_sent_at).toLocaleString('es-MX',{timeZone:form.timezone}):'Aún no hay envíos'}</p>{Boolean(status?.failed)&&<p className="text-amber-800">{status?.failed} intento(s) no aceptado(s) en los últimos 7 días.</p>}<p className="text-xs text-neutral-500">El servicio puede aceptar un aviso sin que el teléfono lo muestre: influyen la conexión, los permisos y el modo No molestar.</p></div>
            <button disabled={saving||loading} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-3 font-semibold disabled:opacity-50">{saving?'Guardando…':'Guardar recordatorio'}</button>
          </form>}
        </section>
      </div>
      {message&&<p role="status" className="mt-5 bg-white border border-rose-200 rounded-xl p-4 text-sm">{message}</p>}
    </section>
  </main>;
}
