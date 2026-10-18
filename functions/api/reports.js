import {identity,isAdmin,json} from "./_auth.js";
const safeName=s=>String(s||"report.pdf").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
const event=(env,id,ev,actor,note="")=>env.DB.prepare("INSERT INTO order_events(order_id,event,actor,note) VALUES(?,?,?,?)").bind(id,ev,actor,note).run();
export async function onRequestPost({request,env}){
 if(!isAdmin(request,env))return json({error:"Admin access denied."},401);
 if(!env.REPORTS_BUCKET||!env.DB)return json({error:"Private report storage is not configured."},503);
 const form=await request.formData(),id=Number(form.get("orderId")),file=form.get("file");
 if(!Number.isInteger(id)||id<1||!file||typeof file.arrayBuffer!=="function")return json({error:"Select an order and a PDF file."},400);
 if(file.size>15*1024*1024)return json({error:"Only PDF files up to 15 MB are accepted."},400);
 const bytes=await file.arrayBuffer();
 // Check the real file signature, not only the type the browser reports.
 if(new TextDecoder().decode(new Uint8Array(bytes.slice(0,5)))!=="%PDF-")return json({error:"The file is not a valid PDF."},400);
 const order=await env.DB.prepare("SELECT reference,status FROM orders WHERE id=?").bind(id).first();
 if(!order)return json({error:"Order not found."},404);
 const key="reports/"+order.reference+"/"+crypto.randomUUID()+"-"+safeName(file.name);
 await env.REPORTS_BUCKET.put(key,bytes,{httpMetadata:{contentType:"application/pdf",contentDisposition:'attachment; filename="'+safeName(file.name)+'"'}});
 await env.DB.batch([
  env.DB.prepare("UPDATE orders SET report_object_key=?,status='Completed',updated_at=datetime('now') WHERE id=?").bind(key,id),
  env.DB.prepare("INSERT INTO order_events(order_id,event,from_status,to_status,actor,note) VALUES(?,?,?,?,?,?)").bind(id,"Report uploaded",order.status,"Completed","admin","")
 ]);
 return json({ok:true});
}
export async function onRequestGet({request,env}){
 if(!env.REPORTS_BUCKET||!env.DB)return json({error:"Private report storage is not configured."},503);
 const u=new URL(request.url),id=Number(u.searchParams.get("id"));
 if(!Number.isInteger(id)||id<1)return json({error:"Invalid report request."},400);
 const admin=isAdmin(request,env),user=admin?null:await identity(request,env);
 if(!admin&&!user)return json({error:"Sign in to access authorised reports."},401);
 const order=await env.DB.prepare("SELECT banker_email,report_object_key,reference FROM orders WHERE id=?").bind(id).first();
 if(!order||!order.report_object_key)return json({error:"Report is not available."},404);
 if(!admin&&(!order.banker_email||order.banker_email.toLowerCase()!==user.email.toLowerCase()))return json({error:"You are not authorised to access this report."},403);
 const obj=await env.REPORTS_BUCKET.get(order.report_object_key);
 if(!obj)return json({error:"Report file not found."},404);
 await event(env,id,"Report downloaded",admin?"admin":user.email);
 const headers=new Headers();
 if(obj.writeHttpMetadata)obj.writeHttpMetadata(headers);
 headers.set("Content-Type","application/pdf");
 headers.set("Content-Disposition",'attachment; filename="'+order.reference+'-report.pdf"');
 headers.set("Cache-Control","private, no-store");
 headers.set("X-Content-Type-Options","nosniff");
 return new Response(obj.body,{headers});
}
