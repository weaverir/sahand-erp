export async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const r=await fetch(url,{credentials:"same-origin",...init,headers:{"Content-Type":"application/json",...(init?.headers||{})}});
 const b=await r.json().catch(()=>null) as any;
 if(!r.ok||b?.success===false)throw new Error(b?.error||b?.message||`خطای سرور ${r.status}`);
 return (b&&"data" in b?b.data:b) as T;
}
export const req=(method:string,body?:unknown):RequestInit=>({method,...(body===undefined?{}:{body:JSON.stringify(body)})});
export function list<T>(v:any,key:string):T[]{if(Array.isArray(v))return v;if(Array.isArray(v?.[key]))return v[key];if(Array.isArray(v?.items))return v.items;if(Array.isArray(v?.data))return v.data;return [];}
