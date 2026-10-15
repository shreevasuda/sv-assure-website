import {isAdmin,json} from "../_auth.js";
const csv=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
export async function onRequestGet({request,env}){
 if(!isAdmin(request,env))return json({error:"Admin access denied."},401);
 const r=await env.DB.prepare("SELECT reference,report_type,borrower_name,borrower_mobile,gstin,location,banker_name,designation,bank_name,branch,banker_mobile,banker_email,remarks,status,created_at,updated_at,CASE WHEN report_object_key IS NOT NULL THEN 'Yes' ELSE 'No' END AS report_available FROM orders ORDER BY created_at DESC").all();
 const headers=["Reference","Report type","Borrower","Borrower mobile","GSTIN","Location","Banker","Designation","Bank","Branch","Banker mobile","Banker email","Remarks","Status","Created at","Updated at","Report available"];
 const rows=(r.results||[]).map(o=>[o.reference,o.report_type,o.borrower_name,o.borrower_mobile,o.gstin,o.location,o.banker_name,o.designation,o.bank_name,o.branch,o.banker_mobile,o.banker_email,o.remarks,o.status,o.created_at,o.updated_at,o.report_available].map(csv).join(","));
 return new Response([headers.map(csv).join(","),...rows].join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=sv-assure-requisitions.csv","Cache-Control":"no-store"}});
}
