"use client";
import {useEffect,useState} from "react";
import type {Assignment} from "./types";
import {api,req} from "./api";
import {Modal,Field,input,primary,secondary,ErrorBox} from "./ui";

type Catalog={roles:{id:string;key:string;name:string}[];permissions:{id:string;key:string;name:string;module:{name:string}}[]};
type Grant={id:string;isActive:boolean;isAllowed?:boolean;scope?:string;expiresAt?:string|null;role?:{name:string;key:string};permission?:{name:string;key:string}};
export default function AssignmentAccessManager({assignment,close}:{assignment:Assignment;close:()=>void}){
 const [catalog,C]=useState<Catalog>({roles:[],permissions:[]}),[roles,R]=useState<Grant[]>([]),[perms,P]=useState<Grant[]>([]);
 const [kind,K]=useState("permission"),[id,I]=useState(""),[allowed,A]=useState(true),[scope,S]=useState("OWN"),[expires,X]=useState(""),[err,E]=useState(""),[busy,B]=useState(false);
 async function load(){try{const [cat,grants]=await Promise.all([api<Catalog>("/api/organization/access-catalog"),api<any>(`/api/organization/assignments/${assignment.id}/access`)]);C(cat);R(grants.roles||[]);P(grants.permissions||[]);E("")}catch(e){E(e instanceof Error?e.message:"دریافت دسترسی‌ها ناموفق بود.")}}
 useEffect(()=>{void load()},[assignment.id]);
 async function save(){if(!id){E("یک مورد را انتخاب کنید.");return}B(true);E("");try{await api(`/api/organization/assignments/${assignment.id}/access`,req("POST",kind==="role"?{roleId:id,expiresAt:expires||null}:{permissionId:id,isAllowed:allowed,scope,expiresAt:expires||null}));I("");X("");await load()}catch(e){E(e instanceof Error?e.message:"ذخیره دسترسی ناموفق بود.")}finally{B(false)}}
 async function revoke(grant:Grant,grantKind:"role"|"permission"){try{await api(`/api/organization/assignments/${assignment.id}/access`,req("DELETE",{id:grant.id,kind:grantKind}));await load()}catch(e){E(e instanceof Error?e.message:"لغو دسترسی ناموفق بود.")}}
 return <Modal title="مدیریت دسترسی انتصاب" close={close}>
 <div className="grid gap-4"><p className="text-sm font-semibold">{assignment.user?.fullName||assignment.userId}</p>
 <div className="grid gap-3 rounded-xl border border-[var(--border)] p-3">
 <Field label="نوع دسترسی"><select className={input} value={kind} onChange={e=>{K(e.target.value);I("")}}><option value="permission">مجوز (Permission)</option><option value="role">نقش (Role)</option></select></Field>
 <Field label={kind==="role"?"نقش":"مجوز"}><select className={input} value={id} onChange={e=>I(e.target.value)}><option value="">انتخاب کنید</option>{kind==="role"?catalog.roles.map(x=><option key={x.id} value={x.id}>{x.name} ({x.key})</option>):catalog.permissions.map(x=><option key={x.id} value={x.id}>{x.module.name} / {x.name} ({x.key})</option>)}</select></Field>
 {kind==="permission"&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowed} onChange={e=>A(e.target.checked)}/> اجازه انجام عملیات</label><Field label="محدوده"><select className={input} value={scope} onChange={e=>S(e.target.value)}>{["OWN","UNIT","SUBTREE","DEPARTMENT","ASSIGNED","ALL"].map(x=><option key={x}>{x}</option>)}</select></Field></>}
 <Field label="انقضا (اختیاری)"><input type="datetime-local" className={input} value={expires} onChange={e=>X(e.target.value)}/></Field>
 <button disabled={busy} className={primary} onClick={()=>void save()}>{busy?"در حال ذخیره":"ثبت دسترسی"}</button>
 </div>
 <div className="grid gap-2"><h3 className="text-sm font-bold">نقش‌های اختصاص‌یافته</h3>{roles.map(x=><div key={x.id} className="flex items-center justify-between rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5"><span>{x.role?.name||x.role?.key} {x.expiresAt?`— تا ${new Date(x.expiresAt).toLocaleDateString("fa-IR")}`:""}</span><button className="text-red-500" onClick={()=>void revoke(x,"role")}>لغو</button></div>)}{!roles.length&&<p className="text-xs text-[var(--muted)]">نقشی اختصاص نیافته است.</p>}</div>
 <div className="grid gap-2"><h3 className="text-sm font-bold">مجوزهای اختصاص‌یافته</h3>{perms.map(x=><div key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5"><span>{x.permission?.name||x.permission?.key} · {x.isAllowed?"مجاز":"ممنوع"} · {x.scope}</span><button className="shrink-0 text-red-500" onClick={()=>void revoke(x,"permission")}>لغو</button></div>)}{!perms.length&&<p className="text-xs text-[var(--muted)]">مجوز اختصاصی ثبت نشده است.</p>}</div>
 {err&&<ErrorBox>{err}</ErrorBox>}<div className="flex justify-end"><button className={secondary} onClick={close}>بستن</button></div></div>
 </Modal>
}
