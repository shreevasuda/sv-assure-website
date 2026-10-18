import {identity,json,cookieClear,hex} from "../_auth.js";
export async function onRequestGet({request,env}){const user=await identity(request,env);return json({authenticated:!!user,email:user?.email||null});}
// Sign out: remove the session from the database as well as clearing the cookie, so a copied cookie stops working.
export async function onRequestDelete({request,env}){
 try{
  const m=(request.headers.get("Cookie")||"").match(/(?:^|;\s*)sva_session=([a-f0-9]{64})(?:;|$)/);
  if(m&&env.DB){const hash=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(m[1])));await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(hash).run();}
 }catch(e){console.error("Sign-out error",e);}
 return json({ok:true},200,{"Set-Cookie":cookieClear()});
}
