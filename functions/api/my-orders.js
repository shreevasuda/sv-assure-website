import {identity,json} from "./_auth.js";
export async function onRequestGet({request,env}){
 const user=await identity(request,env);if(!user)return json({error:"Please sign in to view your requisitions."},401);
 const rows=await env.DB.prepare("SELECT id,reference,report_type,borrower_name,status,created_at,updated_at,CASE WHEN report_object_key IS NOT NULL THEN 1 ELSE 0 END AS report_available FROM orders WHERE lower(banker_email)=? ORDER BY created_at DESC LIMIT 100").bind(user.email).all();
 return json({orders:rows.results||[]});
}
