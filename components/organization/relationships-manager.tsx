"use client";
import {useEffect,useState} from "react";
import {Plus,RefreshCw,Power} from "lucide-react";
import type {Assignment,Relationship} from "./types";
import {api,req,list} from "./api";
import {Modal,Field,input,primary,secondary,ErrorBox} from "./ui";

const kinds=[
 ["REPORTS_TO","گزارش‌دهی به"],
 ["FUNCTIONAL_REPORTS_TO","گزارش‌دهی عملکردی به"],
 ["SUPERVISES","نظارت بر"],
 ["COLLABORATES_WITH","همکاری با"],
 ["ADVISES","مشاوره به"],
 ["DELEGATES_TO","تفویض اختیار به"],
];

export default function RelationshipsManager({assignments}:{assignments:Assignment[]}){
 const [rows,R]=useState<Relationship[]>([]);
 const [open,O]=useState(false),[src,S]=useState(""),[dst,D]=useState("");
 const [kind,K]=useState(kinds[0][0]),[start,ST]=useState(new Date().toISOString().slice(0,10));
 const [end,EN]=useState(""),[desc,DS]=useState(""),[error,E]=useState("");
 async function load(){
  try{const data=await api<any>("/api/organization/relationships?status=ACTIVE");R(list<Relationship>(data,"relationships"));E("")}
  catch(e){E(e instanceof Error?e.message:"دریافت روابط سازمانی ناموفق بود.")}
 }
 useEffect(()=>{void load()},[]);
 async function create(){
  if(!src||!dst||src===dst){E("دو انتصاب متفاوت انتخاب کنید.");return}
  try{
   await api("/api/organization/relationships",req("POST",{
    sourceAssignmentId:src,targetAssignmentId:dst,relationshipType:kind,
    startDate:new Date(start).toISOString(),endDate:end?new Date(end).toISOString():null,description:desc
   }));
   O(false);S("");D("");DS("");await load();
  }catch(e){E(e instanceof Error?e.message:"ثبت رابطه ناموفق بود.")}
 }
 async function deactivate(id:string){
  try{await api(`/api/organization/relationships/${id}`,req("DELETE"));await load()}
  catch(e){E(e instanceof Error?e.message:"خاتمه رابطه ناموفق بود.")}
 }
 return <section className="grid gap-3">
  <header className="flex justify-between">
   <h2 className="font-bold">روابط سازمانی</h2>
   <div className="flex gap-2">
    <button className={secondary} onClick={()=>void load()}><RefreshCw size={15}/></button>
    <button className={primary} onClick={()=>O(true)}><Plus size={16} className="inline"/> رابطه جدید</button>
   </div>
  </header>
  {error&&<ErrorBox>{error}</ErrorBox>}
  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
   <table className="w-full text-right text-sm">
    <thead><tr className="bg-black/5"><th className="p-3">مبدأ</th><th>نوع رابطه</th><th>مقصد</th><th>شروع</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
     {rows.map(r=><tr key={r.id} className="border-t border-[var(--border)]">
      <td className="p-3">{r.sourceAssignment?.user?.fullName||r.sourceAssignmentId}</td>
      <td>{kinds.find(x=>x[0]===r.relationshipType)?.[1]||r.relationshipType}</td>
      <td>{r.targetAssignment?.user?.fullName||r.targetAssignmentId}</td>
      <td>{new Date(r.startDate).toLocaleDateString("fa-IR")}</td>
      <td>{r.status==="ACTIVE"?"فعال":r.status==="SUSPENDED"?"معلق":"خاتمه‌یافته"}</td>
      <td><button title="خاتمه رابطه" className="text-red-500" onClick={()=>void deactivate(r.id)}><Power size={15}/></button></td>
     </tr>)}
     {!rows.length&&<tr><td colSpan={6} className="p-5 text-center">رابطه فعالی ثبت نشده است.</td></tr>}
    </tbody>
   </table>
  </div>
  {open&&<Modal title="رابطه جدید" close={()=>O(false)}>
   <div className="grid gap-3">
    <Field label="مبدأ"><select className={input} value={src} onChange={e=>S(e.target.value)}><option value="">انتخاب انتصاب</option>{assignments.filter(a=>a.status==="ACTIVE").map(a=><option key={a.id} value={a.id}>{a.user?.fullName||a.userId} — {a.position?.title||""}</option>)}</select></Field>
    <Field label="مقصد"><select className={input} value={dst} onChange={e=>D(e.target.value)}><option value="">انتخاب انتصاب</option>{assignments.filter(a=>a.status==="ACTIVE").map(a=><option key={a.id} value={a.id}>{a.user?.fullName||a.userId} — {a.position?.title||""}</option>)}</select></Field>
    <Field label="نوع رابطه"><select className={input} value={kind} onChange={e=>K(e.target.value)}>{kinds.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
    <Field label="تاریخ شروع"><input type="date" className={input} value={start} onChange={e=>ST(e.target.value)}/></Field>
    <Field label="تاریخ پایان (اختیاری)"><input type="date" className={input} value={end} onChange={e=>EN(e.target.value)}/></Field>
    <Field label="توضیحات"><textarea className={input} value={desc} onChange={e=>DS(e.target.value)}/></Field>
    <div className="flex justify-end gap-2"><button className={secondary} onClick={()=>O(false)}>انصراف</button><button className={primary} onClick={()=>void create()}>ثبت رابطه</button></div>
   </div>
  </Modal>}
 </section>;
}
