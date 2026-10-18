import {json,turnstileOk,CONSENT_VERSION,CONSENT_TEXT,AUTHORITY_VERSION,AUTHORITY_TEXT,esc,newReference,sendMail} from "./_auth.js";
const clean=(v,max=200)=>String(v||"").trim().slice(0,max);
const digits=v=>String(v||"").replace(/\D/g,"");
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const ticked=v=>v===true||v==="on"||v==="true";
export async function onRequestPost({request,env,ctx}){
 try{
  if(!env.DB)return json({error:"The order service is not configured yet. Please contact SV Assure directly."},503);
  const origin=request.headers.get("Origin");
  if(origin&&new URL(origin).host!==new URL(request.url).host)return json({error:"Request origin not allowed."},403);
  const body=await request.json();
  if(clean(body.website,100))return json({error:"Invalid submission."},400);
  if(!(await turnstileOk(request,env,body.turnstileToken)))return json({error:"Spam check failed. Please refresh the page and try again."},400);
  const f={
   reportType:clean(body.reportType,100)||"Tier-3 MSME Due Diligence Report",
   borrowerName:clean(body.borrowerName,200),
   borrowerMobile:digits(body.borrowerMobile).slice(0,15),
   gstin:clean(body.gstin,15).toUpperCase(),
   location:clean(body.location,180),
   bankerName:clean(body.bankerName,120),
   designation:clean(body.designation,120),
   bankName:clean(body.bankName,160),
   branch:clean(body.branch,160),
   bankerMobile:digits(body.bankerMobile).slice(0,15),
   bankerEmail:clean(body.bankerEmail,200).toLowerCase(),
   remarks:clean(body.remarks,1500)
  };
  if(!f.borrowerName||f.borrowerMobile.length<10||!f.bankerName||!f.designation||!f.bankName||f.bankerMobile.length<10||!validEmail(f.bankerEmail)){
   return json({error:"Please complete all mandatory fields and enter valid mobile numbers and a valid official email."},400);
  }
  if(!ticked(body.consent)||!ticked(body.authority)){
   return json({error:"Please tick both confirmations (borrower consent and your authority to engage SV Assure) to submit."},400);
  }
  // Light abuse limits that need no extra services: per banker email, and overall.
  const perEmail=await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE banker_email=? AND created_at > datetime('now','-1 hour')").bind(f.bankerEmail).first();
  const overall=await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE source='website' AND created_at > datetime('now','-1 hour')").first();
  if(Number(perEmail?.n||0)>=10||Number(overall?.n||0)>=200)return json({error:"Too many requisitions in a short time. Please contact SV Assure on WhatsApp."},429);
  const ref=newReference();
  const ins=await env.DB.prepare(`INSERT INTO orders
   (reference,report_type,borrower_name,borrower_mobile,gstin,location,banker_name,designation,bank_name,branch,banker_mobile,banker_email,remarks,status,consent_confirmed,source,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'New',1,'website',datetime('now'))`)
   .bind(ref,f.reportType,f.borrowerName,f.borrowerMobile,f.gstin,f.location,f.bankerName,f.designation,f.bankName,f.branch,f.bankerMobile,f.bankerEmail,f.remarks).run();
  if(!ins.success)return json({error:"The requisition could not be saved. Please try again."},500);
  const row=await env.DB.prepare("SELECT id FROM orders WHERE reference=?").bind(ref).first();
  await env.DB.batch([
   env.DB.prepare("INSERT INTO order_confirmations(order_id,confirmed_at,consent_version,consent_text,authority_version,authority_text) VALUES(?,datetime('now'),?,?,?,?)").bind(row.id,CONSENT_VERSION,CONSENT_TEXT,AUTHORITY_VERSION,AUTHORITY_TEXT),
   env.DB.prepare("INSERT INTO order_events(order_id,event,to_status,actor,note) VALUES(?,?,?,?,?)").bind(row.id,"Requisition received","New","banker (website)","Borrower consent and authority confirmed by "+f.bankerEmail)
  ]);
  const rows=Object.entries(f).map(([k,v])=>'<tr><th style="text-align:left;padding:6px 12px;border-bottom:1px solid #ddd">'+esc(k)+'</th><td style="padding:6px 12px;border-bottom:1px solid #ddd">'+esc(v||"—")+'</td></tr>').join("");
  const tasks=[
   sendMail(env,{to:env.NOTIFY_EMAIL||"contact@svassure.com",subject:"New SV Assure report requisition: "+ref,html:"<h2>New report requisition</h2><p><strong>Reference:</strong> "+esc(ref)+"</p><p>Borrower consent and banker authority confirmed on the form ("+esc(AUTHORITY_VERSION)+").</p><table>"+rows+"</table>"}),
   sendMail(env,{to:f.bankerEmail,subject:"We received your SV Assure requisition "+ref,html:"<p>Dear "+esc(f.bankerName)+",</p><p>Thank you. SV Assure has received your requisition <strong>"+esc(ref)+"</strong> for <strong>"+esc(f.borrowerName)+"</strong> ("+esc(f.reportType)+").</p><p>Our team will contact you shortly to confirm the details. Please quote the reference in any communication.</p><p>SV Assure &mdash; Know Better. Decide Better.</p>"})
  ];
  if(ctx&&ctx.waitUntil)ctx.waitUntil(Promise.all(tasks));else await Promise.all(tasks);
  return json({ok:true,reference:ref},201);
 }catch(e){
  console.error("Order endpoint error",e);
  return json({error:"An unexpected error occurred. Please try again later."},500);
 }
}
