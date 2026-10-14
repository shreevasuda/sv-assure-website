const json=(b,s=200,h={})=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...h}});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
export async function onRequestPost({request,env}){
 try{
  if(!env.DB)return json({error:"Authentication is not configured."},503);
  const origin=request.headers.get("Origin");
  if(origin&&new URL(origin).origin!==new URL(request.url).origin)return json({error:"Request origin not allowed."},403);
  const body=await request.json(),token=String(body.token||"");
  if(!/^[a-f0-9]{64}$/.test(token))return json({error:"This sign-in link is invalid or expired."},400);
  const tokenHash=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
  // Consume the token and obtain its email in one atomic statement to prevent replay races.
  const consumed=await env.DB.prepare("DELETE FROM auth_tokens WHERE token_hash=? AND expires_at > datetime('now') RETURNING email").bind(tokenHash).first();
  if(!consumed)return json({error:"This sign-in link is invalid, expired, or already used. Request a new link."},400);
  const session=hex(crypto.getRandomValues(new Uint8Array(32))),sessionHash=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(session)));
  await env.DB.prepare("INSERT INTO sessions(email,token_hash,expires_at,created_at) VALUES(?,?,datetime('now','+30 days'),datetime('now'))").bind(consumed.email,sessionHash).run();
  return json({ok:true,email:consumed.email},200,{"Set-Cookie":"sva_session="+session+"; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax"});
 }catch(e){console.error("Auth verify error",e);return json({error:"Sign-in could not be completed."},500);}
}