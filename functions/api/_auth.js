export const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
export const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
export const SESSION_DAYS=14;
export async function identity(request,env){
 const cookies=request.headers.get("Cookie")||"",m=cookies.match(/(?:^|;\s*)sva_session=([a-f0-9]{64})(?:;|$)/);
 if(!m||!env.DB)return null;
 const hash=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(m[1])));
 const row=await env.DB.prepare("SELECT email FROM sessions WHERE token_hash=? AND expires_at > datetime('now')").bind(hash).first();
 return row?{email:row.email}:null;
}
// Constant-time comparison so the admin token cannot be guessed by timing the response.
function safeEqual(a,b){
 const x=new TextEncoder().encode(String(a)),y=new TextEncoder().encode(String(b));
 let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
 return diff===0;
}
export function isAdmin(request,env){const t=request.headers.get("X-Admin-Token");return !!env.ADMIN_TOKEN&&!!t&&safeEqual(t,env.ADMIN_TOKEN);}
export function sessionCookie(value,maxAge){return "sva_session="+value+"; Path=/; Max-Age="+maxAge+"; HttpOnly; Secure; SameSite=Lax";}
export function cookieClear(){return sessionCookie("",0);}
// Cloudflare Turnstile: enforced only when TURNSTILE_SECRET is configured, so the form keeps working until it is set up.
export async function turnstileOk(request,env,token){
 if(!env.TURNSTILE_SECRET)return true;
 if(!token)return false;
 const form=new FormData();form.append("secret",env.TURNSTILE_SECRET);form.append("response",String(token));
 const ip=request.headers.get("CF-Connecting-IP");if(ip)form.append("remoteip",ip);
 try{const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});const d=await r.json();return !!d.success;}catch(e){console.error("Turnstile verification failed",e);return false;}
}
// Wording versions: bump the version string whenever the on-page wording changes, so each order records exactly what was confirmed.
export const CONSENT_VERSION="2026-10-v1";
export const CONSENT_TEXT="I confirm that the borrower has been informed and has consented to verification of the details submitted for credit-appraisal purposes.";
export const AUTHORITY_VERSION="2026-10-v2";
export const AUTHORITY_TEXT="By submitting this requisition the banker confirmed being authorised to engage SV Assure, on behalf of their institution, to make enquiries and checks on the borrower named for this requisition.";
export const MODULES={residence:"Residence visit(s)",unit:"Unit visit",security:"Security visit",supplier:"Supplier verification",cost:"Cost vetting"};
export const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function newReference(){const d=new Date();return "SVA-"+d.toISOString().slice(2,7).replace("-","")+"-"+crypto.randomUUID().slice(0,6).toUpperCase();}
export async function sendMail(env,{to,subject,html}){
 if(!env.RESEND_API_KEY)return false;
 try{
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.MAIL_FROM||"SV Assure <notifications@svassure.com>",to:[to],subject,html})});
  if(!r.ok)console.error("Email failed",r.status);
  return r.ok;
 }catch(e){console.error("Email error",e);return false;}
}
