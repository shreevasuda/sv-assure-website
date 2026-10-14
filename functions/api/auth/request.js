const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const clean=v=>String(v||"").trim().toLowerCase();
const validEmail=v=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v);
export async function onRequestPost({request,env}){
 try{
  if(!env.DB||!env.RESEND_API_KEY||!env.MAIL_FROM)return json({error:"Email sign-in is not configured yet. Please contact SV Assure."},503);
  const origin=request.headers.get("Origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return json({error:"Request origin not allowed."},403);
  const body=await request.json(),email=clean(body.email);
  if(!validEmail(email)||email.length>200)return json({error:"Enter a valid official email address."},400);
  // Limit magic-link requests per address; configure Cloudflare edge rate limiting as an additional control before production.
  const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE email=? AND created_at > datetime('now','-15 minutes')").bind(email).first();
  if(Number(recent?.n||0)>=3)return json({ok:true,message:"If the address can receive portal access links, an email has been sent. Check your inbox."});
  const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
  const tokenHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
  await env.DB.prepare("DELETE FROM auth_tokens WHERE expires_at < datetime('now')").run();
  await env.DB.prepare("INSERT INTO auth_tokens(email,token_hash,expires_at,created_at) VALUES(?,?,datetime('now','+15 minutes'),datetime('now'))").bind(email,tokenHash).run();
  const siteBase=String(env.PUBLIC_SITE_URL||"https://svassure.com").replace(/\\/$/,"");
  const link=new URL("/order-report/verify/",siteBase);link.searchParams.set("token",raw);
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:"Your SV Assure secure sign-in link",html:"<p>A sign-in link was requested for SV Assure Report Portal.</p><p><a href=\\""+link.href+"\\">Sign in securely</a></p><p>This link expires in 15 minutes and can be used only once. If you did not request it, ignore this email.</p>"})});
  if(!sent.ok){console.error("Magic-link email failed",await sent.text());return json({error:"We could not send the sign-in email. Please try again later."},502);}
  return json({ok:true,message:"If the address can receive portal access links, an email has been sent. Check your inbox."});
 }catch(e){console.error("Auth request error",e);return json({error:"Unable to request a sign-in link right now."},500);}
}