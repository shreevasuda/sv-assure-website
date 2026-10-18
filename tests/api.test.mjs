// Run with:  node --test tests/        (Node 22+). Uses an in-memory SQLite database and dummy data only.
import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import worker from "../portal-worker/src/index.js";

const SITE="https://svassure.com", API="https://api.svassure.com";
function makeEnv(extra={}){
 const db=new DatabaseSync(":memory:");
 db.exec(readFileSync(new URL("../cloudflare/schema.sql",import.meta.url),"utf8"));
 const stmt=(sql,args=[])=>({
  bind:(...a)=>stmt(sql,a),
  first:async()=>db.prepare(sql).get(...args)??null,
  all:async()=>({results:db.prepare(sql).all(...args)}),
  run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
 });
 const store=new Map();
 return {
  db,store,
  env:{
   DB:{prepare:s=>stmt(s),batch:async list=>{const out=[];for(const s of list)out.push(await s.run());return out;}},
   REPORTS_BUCKET:{put:async(k,v)=>store.set(k,v),get:async k=>store.has(k)?{body:store.get(k),writeHttpMetadata(){}}:null},
   ADMIN_TOKEN:"test-admin-token-not-real",RESEND_API_KEY:"re_dummy",MAIL_FROM:"SV Assure <notifications@svassure.com>",
   PUBLIC_SITE_URL:SITE,NOTIFY_EMAIL:"contact@svassure.com",...extra
  }
 };
}
const sent=[];
globalThis.fetch=async(url,opts)=>{if(String(url).includes("resend.com"))sent.push(JSON.parse(opts.body));return new Response("{}",{status:200});};
const ctx={waitUntil:()=>{}};
const call=(env,method,path,{body,headers={},raw}={})=>worker.fetch(new Request(API+path,{method,headers:{Origin:SITE,...(body?{"Content-Type":"application/json"}:{}),...headers},body:raw??(body?JSON.stringify(body):undefined)}),env,ctx);
const ADMIN={"X-Admin-Token":"test-admin-token-not-real"};
const order=(o={})=>({reportType:"Tier-3 MSME Due Diligence Report",borrowerName:"Test Borrower Pvt Ltd",borrowerMobile:"9000000001",bankerName:"Test Banker",designation:"Branch Manager",bankName:"Test Bank",bankerMobile:"9000000002",bankerEmail:"banker.a@example.test",consent:true,authority:true,...o});

test("order is stored with confirmation record, status trail and two emails",async()=>{
 const {env,db}=makeEnv();sent.length=0;
 const r=await call(env,"POST","/api/orders",{body:order()});
 assert.equal(r.status,201);const {reference}=await r.json();assert.match(reference,/^SVA-\d{4}-[A-Z0-9]{6}$/);
 const o=db.prepare("SELECT * FROM orders WHERE reference=?").get(reference);
 assert.equal(o.status,"New");assert.equal(o.source,"website");
 const c=db.prepare("SELECT * FROM order_confirmations WHERE order_id=?").get(o.id);
 assert.match(c.authority_text,/authorised to engage SV Assure/);assert.ok(c.confirmed_at);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM order_events WHERE order_id=?").get(o.id).n,1);
 assert.deepEqual(sent.map(m=>m.to[0]).sort(),["banker.a@example.test","contact@svassure.com"]);
});
test("order is refused without the authority confirmation, without consent, and on honeypot",async()=>{
 const {env}=makeEnv();
 assert.equal((await call(env,"POST","/api/orders",{body:order({authority:false})})).status,400);
 assert.equal((await call(env,"POST","/api/orders",{body:order({consent:false})})).status,400);
 assert.equal((await call(env,"POST","/api/orders",{body:order({website:"spam"})})).status,400);
 assert.equal((await call(env,"POST","/api/orders",{body:order({bankerEmail:"not-an-email"})})).status,400);
});
test("order from another website origin is rejected",async()=>{
 const {env}=makeEnv();
 const r=await call(env,"POST","/api/orders",{body:order(),headers:{Origin:"https://evil.example"}});
 assert.equal(r.status,403);
});
test("Turnstile is enforced once its secret is configured",async()=>{
 const {env}=makeEnv({TURNSTILE_SECRET:"dummy-secret"});
 assert.equal((await call(env,"POST","/api/orders",{body:order()})).status,400);
});
test("a single banker email is rate limited",async()=>{
 const {env}=makeEnv();let last;
 for(let i=0;i<11;i++)last=await call(env,"POST","/api/orders",{body:order()});
 assert.equal(last.status,429);
});
test("admin routes reject missing and wrong tokens",async()=>{
 const {env}=makeEnv();
 for(const [m,p] of [["GET","/api/admin/orders"],["POST","/api/admin/orders"],["PATCH","/api/admin/orders"],["GET","/api/admin/events?orderId=1"],["GET","/api/admin/export"]]){
  assert.equal((await call(env,m,p,{body:m==="GET"?undefined:{}})).status,401,m+" "+p);
  assert.equal((await call(env,m,p,{body:m==="GET"?undefined:{},headers:{"X-Admin-Token":"wrong"}})).status,401);
 }
});
test("admin can log a WhatsApp order; it shares the same reference and status trail",async()=>{
 const {env,db}=makeEnv();
 const r=await call(env,"POST","/api/admin/orders",{headers:ADMIN,body:{channel:"whatsapp",borrowerName:"Wa Borrower",bankName:"Test Bank",bankerMobile:"9000000003"}});
 assert.equal(r.status,201);const {reference,id}=await r.json();
 assert.equal(db.prepare("SELECT source FROM orders WHERE id=?").get(id).source,"whatsapp");
 const u=await call(env,"PATCH","/api/admin/orders",{headers:ADMIN,body:{id,status:"Accepted",note:"Called banker"}});
 assert.equal(u.status,200);
 const ev=await (await call(env,"GET","/api/admin/events?orderId="+id,{headers:ADMIN})).json();
 assert.deepEqual(ev.events.map(e=>e.to_status),["New","Accepted"]);assert.equal(ev.events[1].from_status,"New");
 assert.match(reference,/^SVA-/);
 assert.equal((await call(env,"POST","/api/admin/orders",{headers:ADMIN,body:{channel:"phone"}})).status,400);
});
test("magic link: single use, bankers only see their own orders, sign-out invalidates the session",async()=>{
 const {env}=makeEnv();
 await call(env,"POST","/api/orders",{body:order({bankerEmail:"banker.a@example.test"})});
 await call(env,"POST","/api/orders",{body:order({bankerEmail:"banker.b@example.test",borrowerName:"Other Borrower"})});
 async function login(email){
  sent.length=0;await call(env,"POST","/api/auth/request",{body:{email}});
  const token=/token=([a-f0-9]{64})/.exec(sent.find(m=>m.to[0]===email).html)[1];
  const v=await call(env,"POST","/api/auth/verify",{body:{token}});assert.equal(v.status,200);
  const cookie=v.headers.get("Set-Cookie");assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.ok(!/SameSite=None/.test(cookie));
  assert.equal((await call(env,"POST","/api/auth/verify",{body:{token}})).status,400,"link must be single-use");
  return cookie.split(";")[0];
 }
 const a=await login("banker.a@example.test"),b=await login("banker.b@example.test");
 const ma=await (await call(env,"GET","/api/my-orders",{headers:{Cookie:a}})).json();
 const mb=await (await call(env,"GET","/api/my-orders",{headers:{Cookie:b}})).json();
 assert.deepEqual(ma.orders.map(o=>o.borrower_name),["Test Borrower Pvt Ltd"]);
 assert.deepEqual(mb.orders.map(o=>o.borrower_name),["Other Borrower"]);
 assert.equal((await call(env,"GET","/api/my-orders")).status,401);
 await call(env,"DELETE","/api/auth/me",{headers:{Cookie:a}});
 assert.equal((await call(env,"GET","/api/my-orders",{headers:{Cookie:a}})).status,401,"signed-out cookie must stop working");
 assert.equal((await call(env,"GET","/api/my-orders",{headers:{Cookie:b}})).status,200);
});
test("reports: real PDF only; anonymous denied, owner allowed, other banker denied, admin allowed, downloads logged",async()=>{
 const {env,db}=makeEnv();
 await call(env,"POST","/api/orders",{body:order({bankerEmail:"banker.a@example.test"})});
 const id=db.prepare("SELECT id FROM orders").get().id;
 const upload=(bytes,name)=>{const fd=new FormData();fd.append("orderId",String(id));fd.append("file",new File([bytes],name,{type:"application/pdf"}));return worker.fetch(new Request(API+"/api/reports",{method:"POST",headers:{Origin:SITE,...ADMIN},body:fd}),env,ctx);};
 assert.equal((await upload(new TextEncoder().encode("<html>not a pdf</html>"),"x.pdf")).status,400,"fake PDF must be refused");
 assert.equal((await upload(new TextEncoder().encode("%PDF-1.4 dummy"),"dummy.pdf")).status,200);
 assert.equal(db.prepare("SELECT status FROM orders WHERE id=?").get(id).status,"Completed");
 const sign=async email=>{sent.length=0;await call(env,"POST","/api/auth/request",{body:{email}});const t=/token=([a-f0-9]{64})/.exec(sent.find(m=>m.to[0]===email).html)[1];return (await call(env,"POST","/api/auth/verify",{body:{token:t}})).headers.get("Set-Cookie").split(";")[0];};
 const a=await sign("banker.a@example.test"),b=await sign("banker.b@example.test");
 assert.equal((await call(env,"GET","/api/reports?id="+id)).status,401);
 assert.equal((await call(env,"GET","/api/reports?id="+id,{headers:{Cookie:b}})).status,403);
 assert.equal((await call(env,"GET","/api/reports?id="+id,{headers:{Cookie:a}})).status,200);
 assert.equal((await call(env,"GET","/api/reports?id="+id,{headers:ADMIN})).status,200);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM order_events WHERE event='Report downloaded'").get().n,2);
});
test("CSV export neutralises spreadsheet formulas and includes the channel",async()=>{
 const {env}=makeEnv();
 await call(env,"POST","/api/orders",{body:order({borrowerName:"=HYPERLINK(\"http://x\")"})});
 const csv=await (await call(env,"GET","/api/admin/export",{headers:ADMIN})).text();
 assert.ok(csv.includes("\"'=HYPERLINK"),"formula must be prefixed");assert.ok(csv.includes("\"Channel\""));assert.ok(csv.includes("\"website\""));
});
test("unknown routes and foreign origins are refused",async()=>{
 const {env}=makeEnv();
 assert.equal((await call(env,"GET","/")).status,404);
 assert.equal((await call(env,"GET","/api/auth/me",{headers:{Origin:"https://evil.example"}})).status,403);
});
