export const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
export const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
export async function identity(request,env){
 const cookies=request.headers.get("Cookie")||"",m=cookies.match(/(?:^|;\s*)sva_session=([a-f0-9]{64})(?:;|$)/);
 if(!m||!env.DB)return null;
 const hash=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(m[1])));
 const row=await env.DB.prepare("SELECT email FROM sessions WHERE token_hash=? AND expires_at > datetime('now')").bind(hash).first();
 return row?{email:row.email}:null;
}
export function isAdmin(request,env){return !!env.ADMIN_TOKEN&&request.headers.get("X-Admin-Token")===env.ADMIN_TOKEN;}
export function cookieClear(){return "sva_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";}
