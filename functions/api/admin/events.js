import {isAdmin,json} from "../_auth.js";
export async function onRequestGet({request,env}){
 if(!isAdmin(request,env))return json({error:"Admin access denied."},401);
 const id=Number(new URL(request.url).searchParams.get("orderId"));
 if(!Number.isInteger(id)||id<1)return json({error:"Invalid order."},400);
 const ev=await env.DB.prepare("SELECT event,from_status,to_status,actor,note,created_at FROM order_events WHERE order_id=? ORDER BY id ASC").bind(id).all();
 const conf=await env.DB.prepare("SELECT confirmed_at,consent_version,authority_version FROM order_confirmations WHERE order_id=?").bind(id).first();
 return json({events:ev.results||[],confirmation:conf||null});
}
