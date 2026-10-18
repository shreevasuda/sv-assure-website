import { onRequestPost as createOrder } from "../../functions/api/orders.js";
import { onRequestPost as requestLogin } from "../../functions/api/auth/request.js";
import { onRequestPost as verifyLogin } from "../../functions/api/auth/verify.js";
import { onRequestGet as getAuth, onRequestDelete as deleteAuth } from "../../functions/api/auth/me.js";
import { onRequestGet as getMyOrders } from "../../functions/api/my-orders.js";
import { onRequestGet as listOrders, onRequestPatch as updateOrder, onRequestPost as logOrder } from "../../functions/api/admin/orders.js";
import { onRequestGet as orderEvents } from "../../functions/api/admin/events.js";
import { onRequestGet as exportOrders } from "../../functions/api/admin/export.js";
import { onRequestGet as downloadReport, onRequestPost as uploadReport } from "../../functions/api/reports.js";

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const allowedOrigin=(env)=>String(env.PUBLIC_SITE_URL||"https://svassure.com").replace(/\/$/,"");
function corsHeaders(origin,env){
 const allowed=allowedOrigin(env);
 if(origin!==allowed)return {};
 return {"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Methods":"GET, POST, PATCH, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-Admin-Token","Access-Control-Max-Age":"600","Vary":"Origin"};
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),origin=request.headers.get("Origin");
  if(origin&&origin!==allowedOrigin(env))return json({error:"Request origin not allowed."},403);
  const cors=corsHeaders(origin,env);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  const routes={
   "POST /api/orders":createOrder,
   "POST /api/auth/request":requestLogin,
   "POST /api/auth/verify":verifyLogin,
   "GET /api/auth/me":getAuth,
   "DELETE /api/auth/me":deleteAuth,
   "GET /api/my-orders":getMyOrders,
   "GET /api/admin/orders":listOrders,
   "PATCH /api/admin/orders":updateOrder,
   "POST /api/admin/orders":logOrder,
   "GET /api/admin/events":orderEvents,
   "GET /api/admin/export":exportOrders,
   "GET /api/reports":downloadReport,
   "POST /api/reports":uploadReport
  };
  const handler=routes[request.method+" "+url.pathname];
  if(!handler)return json({error:"Not found."},404);
  // Existing endpoint handlers enforce same-origin checks. The Worker validates the configured
  // website origin above, then removes Origin before dispatching those same handlers.
  const headers=new Headers(request.headers);headers.delete("Origin");
  const safeRequest=new Request(request,{headers});
  try{
   const response=await handler({request:safeRequest,env,ctx,params:{},waitUntil:p=>ctx?.waitUntil?.(p),passThroughOnException:()=>{}});
   const outHeaders=new Headers(response.headers);for(const [k,v] of Object.entries(cors))outHeaders.set(k,v);
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outHeaders});
  }catch(e){console.error("Portal API router error",e);return json({error:"The service encountered an unexpected error."},500);}
 }
};