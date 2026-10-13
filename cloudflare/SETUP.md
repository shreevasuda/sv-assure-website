# SV Assure report portal — Cloudflare setup and release checklist

This is a staged implementation on `feature/report-ordering-portal`. It is not deployed or production-ready until the bindings, secrets, schema, tests, and access controls below are completed. The current live website is unchanged.

## Cloudflare Pages bindings
- D1 binding `DB` → database `svassure-portal`.
- R2 binding `REPORTS_BUCKET` → a **private** bucket for report PDFs (do not enable public access or custom domain).
- Secret `RESEND_API_KEY` → Resend API key.
- Variable `NOTIFY_EMAIL` → `contact@svassure.com`.
- Variable `MAIL_FROM` → verified sender, e.g. `SV Assure <notifications@svassure.com>`.
- Secret `ADMIN_TOKEN` → generate a long random secret (at least 32 random bytes). This is used by the admin page/API; never commit it or share it with bankers.

Create the D1 database `svassure-portal` and apply `cloudflare/schema.sql` with Wrangler or the D1 console. Configure Resend sender/domain verification before testing email.

Admin dashboard: `/order-report/admin/` (requires the `ADMIN_TOKEN` secret). Banker portal: `/order-report/my-orders/` after email verification.

## Implemented in this branch
- Public requisition capture with D1 insert and optional email notification.
- Banker one-time email sign-in links (15-minute, single-use), HttpOnly/Secure session cookie, and own-order listing.
- Admin-token-protected order listing/status changes and PDF upload.
- PDF reports stored in private R2 and downloads checked against the verified ordering email or admin token.
- No public report directory or public R2 endpoint.

## Important security / operational notes
- Use only dummy data during testing. The admin token must be entered only on the private admin screen; do not store it in browser local storage or share it.
- Restrict access to `/order-report/admin/` at Cloudflare Access as an additional layer if available.
- Review applicable privacy/consent, retention, audit-log, and incident-response requirements before handling real borrower data.
- Banker access is currently tied to the email captured on the requisition. An email owner who can verify that address can access orders associated with it; validate institutional policy before production.
- Email sign-in, D1 inserts, and report upload/download require configured Cloudflare bindings/secrets. No code-only change can configure the user's Cloudflare account.
- Reports are uploaded through an authenticated admin API and never written into GitHub/public assets.

## Test before release
1. Deploy this branch only as a Pages preview.
2. Submit a dummy requisition and confirm a D1 row plus notification email.
3. Request a banker sign-in link; verify expiry, single-use behaviour, and that only matching email orders appear.
4. Upload a dummy PDF from the admin page; verify an unauthenticated user cannot download it and a different banker receives 403.
5. Check mobile layout, error paths, duplicate submits, logs, and email deliverability.
6. Review the full diff and only then merge/deploy. Do not use real borrower data until tests and institutional approvals are complete.
