"use client";
import type {ReactNode} from "react";
export const input="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]";
export const primary="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
export const secondary="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm";
export function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section dir="rtl" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"><header className="mb-5 flex justify-between"><h2 className="font-bold">{title}</h2><button onClick={close}>✕</button></header>{children}</section></div>}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="grid gap-1.5 text-sm"><span>{label}</span>{children}</label>}
export function ErrorBox({children}:{children:ReactNode}){return <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{children}</p>}
