"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Incidence = {
  id: string; employee_id: string; type: string; start_date: string | null; end_date: string | null;
  reason: string | null; file_url: string | null; status: string; created_at: string;
  supervisor_status: string; supervisor_reviewed_by: string | null; supervisor_reviewed_at: string | null; supervisor_comment: string | null;
  rh_status: string; rh_reviewed_by: string | null; rh_reviewed_at: string | null; rh_comment: string | null;
  profiles: { name: string; email: string } | null;
};
type Filter = "ALL" | "SUPERVISOR_PENDING" | "RH_PENDING" | "APPROVED" | "REJECTED";
const labels: Record<string,string> = { VACATION:"Vacaciones", PERMISSION:"Permiso", MEDICAL:"Incapacidad" };

function fmtDate(d:string|null) {
  if (!d) return "—";
  return new Date(`${d}T12:00:00`).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtDateTime(d:string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-MX",{timeZone:"America/Mexico_City",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function finalLabel(i:Incidence) {
  if (i.status==="REJECTED" || i.supervisor_status==="REJECTED" || i.rh_status==="REJECTED") return "Rechazada";
  if (i.status==="APPROVED" || (i.supervisor_status==="APPROVED" && i.rh_status==="APPROVED")) return "Autorizada";
  if (i.supervisor_status!=="APPROVED") return "Pendiente supervisor";
  return "Pendiente RH";
}
function finalStyle(i:Incidence) {
  const s=finalLabel(i);
  if(s==="Autorizada") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if(s==="Rechazada") return "bg-red-50 text-red-700 border-red-200";
  if(s==="Pendiente RH") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function AdminIncidencesPage() {
  const [incidences,setIncidences]=useState<Incidence[]>([]);
  const [reviewers,setReviewers]=useState<Record<string,string>>({});
  const [activeAccountId,setActiveAccountId]=useState<string|null>(null);
  const [activeAccountName,setActiveAccountName]=useState("Todas las cuentas");
  const [filter,setFilter]=useState<Filter>("ALL");
  const [loading,setLoading]=useState(true);
  const [processingId,setProcessingId]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [comments,setComments]=useState<Record<string,string>>({});

  useEffect(()=>{
    const resolve=async(id:string)=>{
      setActiveAccountId(id);
      if(id==="all"){setActiveAccountName("Todas las cuentas");return;}
      const {data}=await supabase.from("accounts").select("name").eq("id",id).maybeSingle();
      setActiveAccountName(data?.name||"Cuenta");
    };
    resolve(localStorage.getItem("edva_active_account")||"all");
    const handler=(e:Event)=>resolve((e as CustomEvent<string>).detail||"all");
    window.addEventListener("edva-account-change",handler);
    return()=>window.removeEventListener("edva-account-change",handler);
  },[]);

  const loadIncidences=async()=>{
    if(!activeAccountId)return;
    setLoading(true); setMessage("");
    try{
      let employeeIds:string[]|null=null;
      if(activeAccountId!=="all"){
        const {data,error}=await supabase.from("account_employees").select("employee_id").eq("account_id",activeAccountId).eq("active",true);
        if(error)throw error;
        employeeIds=(data||[]).map((r:any)=>r.employee_id);
        if(!employeeIds.length){setIncidences([]);setReviewers({});setLoading(false);return;}
      }
      let q=supabase.from("incidence_requests").select(`
        id, employee_id, type, start_date, end_date, reason, file_url, status, created_at,
        supervisor_status, supervisor_reviewed_by, supervisor_reviewed_at, supervisor_comment,
        rh_status, rh_reviewed_by, rh_reviewed_at, rh_comment,
        profiles:employee_id (name,email)
      `).order("created_at",{ascending:false});
      if(employeeIds) q=q.in("employee_id",employeeIds);
      const {data,error}=await q;
      if(error)throw error;
      const rows=(data||[]).map((x:any)=>({...x,
        supervisor_status:x.supervisor_status||"PENDING", rh_status:x.rh_status||"PENDING",
        profiles:Array.isArray(x.profiles)?x.profiles[0]||null:x.profiles
      })) as Incidence[];
      setIncidences(rows);

      const ids=Array.from(new Set(rows.flatMap(x=>[x.supervisor_reviewed_by,x.rh_reviewed_by]).filter(Boolean) as string[]));
      if(ids.length){
        const {data:people,error:pe}=await supabase.from("profiles").select("id,name").in("id",ids);
        if(pe)throw pe;
        const map:Record<string,string>={}; (people||[]).forEach((p:any)=>map[p.id]=p.name); setReviewers(map);
      } else setReviewers({});
    }catch(e:any){setMessage(`Error al cargar incidencias: ${e.message||"Error desconocido"}`);}
    finally{setLoading(false);}
  };
  useEffect(()=>{if(activeAccountId)loadIncidences();},[activeAccountId]);

  const counts=useMemo(()=>({
    total:incidences.length,
    sup:incidences.filter(i=>i.status==="PENDING"&&i.supervisor_status==="PENDING").length,
    rh:incidences.filter(i=>i.status==="PENDING"&&i.supervisor_status==="APPROVED"&&i.rh_status==="PENDING").length,
    ok:incidences.filter(i=>finalLabel(i)==="Autorizada").length,
    no:incidences.filter(i=>finalLabel(i)==="Rechazada").length,
  }),[incidences]);

  const visible=useMemo(()=>incidences.filter(i=>{
    if(filter==="ALL")return true;
    if(filter==="SUPERVISOR_PENDING")return i.status==="PENDING"&&i.supervisor_status==="PENDING";
    if(filter==="RH_PENDING")return i.status==="PENDING"&&i.supervisor_status==="APPROVED"&&i.rh_status==="PENDING";
    if(filter==="APPROVED")return finalLabel(i)==="Autorizada";
    return finalLabel(i)==="Rechazada";
  }),[incidences,filter]);

  const userId=async()=>{
    const {data,error}=await supabase.auth.getUser();
    if(error||!data.user)throw new Error("No fue posible identificar al administrador.");
    return data.user.id;
  };

  const review=async(i:Incidence,stage:"SUP"|"RH",status:"APPROVED"|"REJECTED")=>{
    setProcessingId(i.id); setMessage("");
    try{
      const uid=await userId(), now=new Date().toISOString();
      const payload=stage==="SUP"
        ? {supervisor_status:status,supervisor_reviewed_by:uid,supervisor_reviewed_at:now,supervisor_comment:comments[`sup-${i.id}`]?.trim()||null}
        : {rh_status:status,rh_reviewed_by:uid,rh_reviewed_at:now,rh_comment:comments[`rh-${i.id}`]?.trim()||null};
      const {error}=await supabase.from("incidence_requests").update(payload).eq("id",i.id);
      if(error)throw error;
      setMessage(status==="REJECTED"?"La incidencia fue rechazada.":stage==="SUP"?"Incidencia validada.":"Incidencia autorizada.");
      await loadIncidences();
    }catch(e:any){setMessage(`Error al actualizar: ${e.message||"Error desconocido"}`);}
    finally{setProcessingId(null);}
  };

  const approveAll=async(i:Incidence)=>{
    setProcessingId(i.id); setMessage("");
    try{
      const uid=await userId(), now=new Date().toISOString();
      const {error}=await supabase.from("incidence_requests").update({
        supervisor_status:"APPROVED",supervisor_reviewed_by:uid,supervisor_reviewed_at:now,supervisor_comment:comments[`sup-${i.id}`]?.trim()||null,
        rh_status:"APPROVED",rh_reviewed_by:uid,rh_reviewed_at:now,rh_comment:comments[`rh-${i.id}`]?.trim()||null
      }).eq("id",i.id);
      if(error)throw error;
      setMessage("Incidencia validada y autorizada correctamente."); await loadIncidences();
    }catch(e:any){setMessage(`Error al autorizar: ${e.message||"Error desconocido"}`);}
    finally{setProcessingId(null);}
  };

  const filters:{value:Filter;label:string;count:number}[]=[
    {value:"ALL",label:"Todas",count:counts.total},{value:"SUPERVISOR_PENDING",label:"Pend. supervisor",count:counts.sup},
    {value:"RH_PENDING",label:"Pend. RH",count:counts.rh},{value:"APPROVED",label:"Autorizadas",count:counts.ok},
    {value:"REJECTED",label:"Rechazadas",count:counts.no}
  ];

  return <main className="min-h-screen bg-neutral-100 flex">
    <Sidebar userName="Eduardo Palmerin"/>
    <section className="flex-1 min-w-0 px-6 py-6 xl:px-8">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400 uppercase">Gestión de personal</p>
          <h1 className="text-2xl xl:text-3xl font-bold text-neutral-900 mt-1">Incidencias</h1>
          <p className="text-sm text-neutral-500 mt-1">{activeAccountName} · Validación y autorización</p>
        </div>
        <button onClick={loadIncidences} disabled={loading} className="h-10 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold">Actualizar</button>
      </div>

      {message&&<div className="mb-4 px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-700">{message}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
        {[["Total",counts.total],["Pend. supervisor",counts.sup],["Pend. RH",counts.rh],["Autorizadas",counts.ok],["Rechazadas",counts.no]].map(([l,v])=>
          <div key={String(l)} className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">{l}</p><p className="text-2xl font-bold text-neutral-900 mt-1">{loading?"—":v}</p>
          </div>)}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl mb-4 p-2 flex flex-wrap gap-2">
        {filters.map(f=><button key={f.value} onClick={()=>setFilter(f.value)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${filter===f.value?"bg-neutral-900 text-white":"text-neutral-600 hover:bg-neutral-100"}`}>{f.label} · {f.count}</button>)}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="hidden xl:grid grid-cols-[1.3fr_130px_180px_180px_180px_42px] gap-4 px-4 py-2.5 bg-neutral-50 border-b text-[11px] font-bold text-neutral-400 uppercase">
          <span>Promotor</span><span>Tipo</span><span>Periodo</span><span>Supervisor</span><span>Estado</span><span/>
        </div>
        {loading?<div className="p-8 text-sm text-neutral-500">Cargando incidencias...</div>:!visible.length?<div className="p-8 text-sm text-neutral-500">No hay incidencias en este filtro.</div>:
        <div className="divide-y divide-neutral-100">{visible.map(i=>{
          const open=expandedId===i.id, stage=finalLabel(i);
          const canSup=i.status==="PENDING"&&i.supervisor_status==="PENDING";
          const canRh=i.status==="PENDING"&&i.supervisor_status==="APPROVED"&&i.rh_status==="PENDING";
          const canAll=canSup&&i.rh_status==="PENDING";
          return <div key={i.id}>
            <button onClick={()=>setExpandedId(open?null:i.id)} className="w-full grid grid-cols-1 xl:grid-cols-[1.3fr_130px_180px_180px_180px_42px] gap-2 xl:gap-4 items-center px-4 py-3 text-left hover:bg-neutral-50">
              <div className="min-w-0"><p className="text-sm font-semibold text-neutral-900 truncate">{i.profiles?.name||"Sin nombre"}</p><p className="text-xs text-neutral-400 truncate">{i.profiles?.email||""}</p></div>
              <p className="text-sm">{labels[i.type]||i.type}</p>
              <p className="text-sm text-neutral-600">{fmtDate(i.start_date)}{i.end_date&&i.end_date!==i.start_date?` — ${fmtDate(i.end_date)}`:""}</p>
              <span className={`w-fit border px-2.5 py-1 rounded-full text-xs font-semibold ${i.supervisor_status==="APPROVED"?"bg-emerald-50 text-emerald-700 border-emerald-200":i.supervisor_status==="REJECTED"?"bg-red-50 text-red-700 border-red-200":"bg-amber-50 text-amber-700 border-amber-200"}`}>{i.supervisor_status==="APPROVED"?"Validada":i.supervisor_status==="REJECTED"?"Rechazada":"Pendiente"}</span>
              <span className={`w-fit border px-2.5 py-1 rounded-full text-xs font-semibold ${finalStyle(i)}`}>{stage}</span>
              <span className="text-neutral-400 text-lg">{open?"−":"+"}</span>
            </button>

            {open&&<div className="bg-neutral-50 border-t px-4 py-4">
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
                <div className="space-y-3">
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Motivo</p>
                    <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">{i.reason||"Sin motivo registrado"}</p>
                    <p className="text-xs text-neutral-400 mt-3">Registrada: {fmtDateTime(i.created_at)}</p>
                    {i.file_url&&<a href={i.file_url} target="_blank" rel="noreferrer" className="inline-flex mt-3 px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs font-semibold">Ver archivo adjunto</a>}
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-white border rounded-xl p-4"><p className="text-xs font-bold text-neutral-500 uppercase">Supervisión</p><p className="text-sm font-semibold mt-2">{i.supervisor_status==="APPROVED"?"Validada":i.supervisor_status==="REJECTED"?"Rechazada":"Pendiente"}</p>{i.supervisor_reviewed_by&&<p className="text-xs text-neutral-500 mt-2">Por {reviewers[i.supervisor_reviewed_by]||"Usuario"}</p>}{i.supervisor_reviewed_at&&<p className="text-xs text-neutral-400 mt-1">{fmtDateTime(i.supervisor_reviewed_at)}</p>}{i.supervisor_comment&&<p className="text-sm text-neutral-600 mt-2">{i.supervisor_comment}</p>}</div>
                    <div className="bg-white border rounded-xl p-4"><p className="text-xs font-bold text-neutral-500 uppercase">Recursos Humanos</p><p className="text-sm font-semibold mt-2">{i.rh_status==="APPROVED"?"Autorizada":i.rh_status==="REJECTED"?"Rechazada":"Pendiente"}</p>{i.rh_reviewed_by&&<p className="text-xs text-neutral-500 mt-2">Por {reviewers[i.rh_reviewed_by]||"Usuario"}</p>}{i.rh_reviewed_at&&<p className="text-xs text-neutral-400 mt-1">{fmtDateTime(i.rh_reviewed_at)}</p>}{i.rh_comment&&<p className="text-sm text-neutral-600 mt-2">{i.rh_comment}</p>}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {canAll&&<button onClick={()=>approveAll(i)} disabled={processingId===i.id} className="w-full h-10 rounded-lg bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50">Validar y autorizar</button>}
                  {canSup&&<div className="bg-white border rounded-xl p-4"><p className="text-sm font-bold">Validación de Supervisor</p><textarea rows={2} placeholder="Comentario opcional" value={comments[`sup-${i.id}`]||""} onChange={e=>setComments(p=>({...p,[`sup-${i.id}`]:e.target.value}))} className="w-full mt-3 px-3 py-2 border rounded-lg text-sm resize-none"/><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>review(i,"SUP","APPROVED")} disabled={processingId===i.id} className="h-9 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Validar</button><button onClick={()=>review(i,"SUP","REJECTED")} disabled={processingId===i.id} className="h-9 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">Rechazar</button></div></div>}
                  {canRh&&<div className="bg-white border rounded-xl p-4"><p className="text-sm font-bold">Autorización de RH</p><textarea rows={2} placeholder="Comentario opcional" value={comments[`rh-${i.id}`]||""} onChange={e=>setComments(p=>({...p,[`rh-${i.id}`]:e.target.value}))} className="w-full mt-3 px-3 py-2 border rounded-lg text-sm resize-none"/><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>review(i,"RH","APPROVED")} disabled={processingId===i.id} className="h-9 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Autorizar</button><button onClick={()=>review(i,"RH","REJECTED")} disabled={processingId===i.id} className="h-9 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">Rechazar</button></div></div>}
                  {!canSup&&!canRh&&!canAll&&<div className="bg-white border rounded-xl p-4"><p className="text-sm font-semibold">Proceso finalizado</p><p className="text-xs text-neutral-500 mt-1">Esta solicitud ya no tiene acciones pendientes.</p></div>}
                </div>
              </div>
            </div>}
          </div>
        })}</div>}
      </div>
    </section>
  </main>;
}
