import {isAdmin,json,newReference} from "../_auth.js";
const statuses=["New","Accepted","In Progress","Query Raised","Completed","Cancelled"];
const channels=["whatsapp","phone","email","other"];
const clean=(v,max=200)=>String(v||"").trim().slice(0,max);
const digits=v=>String(v||"").replace(/\D/g,"");
export async function onRequestGet({request,env}){
 if(!isAdmin(request,env))return json({error:"Admin access denied."},401);
 const u=new URL(request.url),q=(u.searchParams.get("q")||"").trim().slice(0,100),status=u.searchParams.get("status");
 let sql="SELECT id,reference,report_type,borrower_name,borrower_mobile,gstin,location,banker_name,designation,bank_name,branch,banker_mobile,banker_email,remarks,status,source,created_at,updated_at,CASE WHEN report_object_key IS NOT NULL THEN 1 ELSE 0 END AS report_available FROM orders",args=[],where=[];
 if(q){where.push("(reference LIKE ? OR borrower_name LIKE ? OR banker_email LIKE ? OR bank_name LIKE ?)");args.push("%"+q+"%","%"+q+"%","%"+q+"%","%"+q+"%");}
 if(status&&statuses.includes(status)){where.push("status=?");args.push(status);}
 if(where.length)sql+=" WHERE "+where.join(" AND ");
 sql+=" ORDER BY created_at DESC LIMIT 500";
 const r=await env.DB.prepare(sql).bind(...args).all();
 return json({orders:r.results||[],statuses,channels});
}
// Log an order that arrived by WhatsApp, phone or email so it gets the same reference and status trail as a website order.
export async function onRequestPost({request,env}){
 if(!isAdmin(request,env))return json({error:"Admin access denied."},401);
 const b=await request.json();
 const channel=channels.includes(b.channel)?b.channel:"other";
 const f={
  borrowerName:clean(b.borrowerName,200),borrowerMobile:digits(b.borrowerMobile).slice(0,15),
  gstin:clean(b.gstin,15).toUpperCase(),location:clean(b.location,180),
  bankerName:clean(b.bankerName,120),designation:clean(b.designation,120),bankName:clean(b.bankName,160),branch:clean(b.branch,160),
  bankerMobile:digits(b.bankerMobile).slice(0,15),bankerEmail:clean(b.bankerEmail,200).toLowerCase(),
  remarks:clean(b.remarks,1500),reportType:clean(b.reportType,100)||"Tier-3 MSME Due Diligence Report"
 };
 if(!f.borrowerName)return json({error:"Enter the borrower / company name."},400);
 if(f.bankerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.bankerEmail))return json({error:"The banker email looks invalid."},400);
 const ref=newReference();
 const ins=await env.DB.prepare(`INSERT INTO orders
  (reference,report_type,borrower_name,borrower_mobile,gstin,location,banker_name,designation,bank_name,branch,banker_mobile,banker_email,remarks,status,consent_confirmed,source,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'New',0,?,datetime('now'))`)
  .bind(ref,f.reportType,f.borrowerName,f.borrowerMobile,f.gstin,f.location,f.bankerName,f.designation,f.bankName,f.branch,f.bankerMobile,f.bankerEmail,f.remarks,channel).run();
 if(!ins.success)return json({error:"The order could not be saved."},500);
 const row=await env.DB.prepare("SELECT id FROM orders WHERE reference=?").bind(ref).first();
 await env.DB.prepare("INSERT INTO order_events(order_id,event,to_status,actor,note) VALUES(?,?,?,?,?)").bind(row.id,"Order logged by SV Assure from "+channel,"New","admin","Authority and borrower consent to be confirmed with the banker directly").run();
 return json({ok:true,reference:ref,id:row.id},201);
}
export async function onRequestPatch({request,env}){
 if(!isAdmin(request,env))return json({error:"Admin access denied."},401);
 const b=await request.json(),id=Number(b.id),status=String(b.status||""),note=clean(b.note,500);
 if(!Number.isInteger(id)||id<1||!statuses.includes(status))return json({error:"Invalid order or status."},400);
 const cur=await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(id).first();
 if(!cur)return json({error:"Order not found."},404);
 await env.DB.batch([
  env.DB.prepare("UPDATE orders SET status=?,updated_at=datetime('now') WHERE id=?").bind(status,id),
  env.DB.prepare("INSERT INTO order_events(order_id,event,from_status,to_status,actor,note) VALUES(?,?,?,?,?,?)").bind(id,"Status changed",cur.status,status,"admin",note)
 ]);
 return json({ok:true});
}
