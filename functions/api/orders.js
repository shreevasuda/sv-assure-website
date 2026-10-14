const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (v, max = 200) => String(v || "").trim().slice(0, max);
const digits = v => String(v || "").replace(/\D/g, "");
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const escapeHtml = v => String(v || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ error: "The order service is not configured yet. Please contact SV Assure directly." }, 503);
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: "Request origin not allowed." }, 403);
    const body = await request.json();
    if (clean(body.website, 100)) return json({ error: "Invalid submission." }, 400);
    const fields = {
      reportType: clean(body.reportType, 100) || "Tier-3 MSME Due Diligence Report",
      borrowerName: clean(body.borrowerName, 200),
      borrowerMobile: digits(body.borrowerMobile).slice(0, 15),
      gstin: clean(body.gstin, 15).toUpperCase(),
      location: clean(body.location, 180),
      bankerName: clean(body.bankerName, 120),
      designation: clean(body.designation, 120),
      bankName: clean(body.bankName, 160),
      branch: clean(body.branch, 160),
      bankerMobile: digits(body.bankerMobile).slice(0, 15),
      bankerEmail: clean(body.bankerEmail, 200).toLowerCase(),
      remarks: clean(body.remarks, 1500)
    };
    if (!fields.borrowerName || fields.borrowerMobile.length < 10 || !fields.bankerName || !fields.designation || !fields.bankName || fields.bankerMobile.length < 10 || !validEmail(fields.bankerEmail) || body.consent !== "on" && body.consent !== true) {
      return json({ error: "Please complete all mandatory fields, enter valid mobile numbers and confirm consent." }, 400);
    }
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE date(created_at)=date('now')").first();
    const date = new Date();
    const ref = "SVA-" + date.toISOString().slice(2, 7).replace("-", "") + "-" + crypto.randomUUID().slice(0, 6).toUpperCase();
    const result = await env.DB.prepare(`INSERT INTO orders
      (reference, report_type, borrower_name, borrower_mobile, gstin, location, banker_name, designation, bank_name, branch, banker_mobile, banker_email, remarks, status, consent_confirmed, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 1, 'website', datetime('now'))`)
      .bind(ref, fields.reportType, fields.borrowerName, fields.borrowerMobile, fields.gstin, fields.location, fields.bankerName, fields.designation, fields.bankName, fields.branch, fields.bankerMobile, fields.bankerEmail, fields.remarks).run();
    if (!result.success) return json({ error: "The requisition could not be saved. Please try again." }, 500);
    if (env.RESEND_API_KEY) {
      const rows = Object.entries(fields).map(([k,v]) => '<tr><th style="text-align:left;padding:6px 12px;border-bottom:1px solid #ddd">'+escapeHtml(k)+'</th><td style="padding:6px 12px;border-bottom:1px solid #ddd">'+escapeHtml(v || "—")+'</td></tr>').join("");
      const mail = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ "Authorization":"Bearer "+env.RESEND_API_KEY, "Content-Type":"application/json" }, body:JSON.stringify({ from:env.MAIL_FROM || "SV Assure <notifications@svassure.com>", to:[env.NOTIFY_EMAIL || "contact@svassure.com"], subject:"New SV Assure report requisition: "+ref, html:"<h2>New report requisition</h2><p><strong>Reference:</strong> "+escapeHtml(ref)+"</p><table>"+rows+"</table>" }) });
      if (!mail.ok) console.error("Notification email failed", await mail.text());
    }
    return json({ ok:true, reference:ref }, 201);
  } catch (e) {
    console.error("Order endpoint error", e);
    return json({ error:"An unexpected error occurred. Please try again later." }, 500);
  }
}