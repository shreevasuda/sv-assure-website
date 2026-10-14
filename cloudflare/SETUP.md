# SV Assure report portal — staged Cloudflare setup

The report portal is deployed as a separate API Worker. The existing static website Worker for `svassure.com` must not be repointed or replaced. This portal is not production-ready until deployed and tested. Do not use real borrower information yet.

## Existing resources
- D1 database: `svassure-portal` (binding name `DB`).
- Private R2 bucket: `svassure-private-reports` (binding name `REPORTS_BUCKET`; Public Access must remain disabled).
- Existing website: `svassure.com`.
- API Worker name: `svassure-report-portal-api`.
- API custom domain: `api.svassure.com`.
- Email sender: `notifications@svassure.com` (must be verified in Resend); notifications go to `contact@svassure.com`.

## Deploy through GitHub Actions
1. In repository Settings → Secrets and variables → Actions, ensure these **repository secrets** exist:
   - `CLOUDFLARE_API_TOKEN`: API token authorized to deploy Workers and manage D1.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
   - `D1_DATABASE_ID`: UUID of the `svassure-portal` database.
2. In Cloudflare Workers & Pages → `svassure-report-portal-api` → Settings → Variables and Secrets → Production, ensure:
   - Secret `RESEND_API_KEY`.
   - Secret `ADMIN_TOKEN` (long random value, at least 32 random bytes).
   - Variable `FROM_EMAIL` is not consumed by the Worker config; `MAIL_FROM` is set by `portal-worker/wrangler.toml`. Use the verified sender `SV Assure Reports <notifications@svassure.com>`.
   - `DB` D1 binding to `svassure-portal` and `REPORTS_BUCKET` R2 binding to `svassure-private-reports`.
3. Open GitHub → Actions → **Deploy SV Assure portal API** → **Run workflow** on `main`. The workflow applies the additive schema and deploys the dedicated Worker. It must not modify the main website Worker.
4. Confirm the run succeeds. Then visit `https://api.svassure.com/`; a JSON 404 response is expected for the root path. A plain `Hello World!` response means the actual portal API has not been deployed.
5. The portal frontend calls `https://api.svassure.com`. Do not point the apex `svassure.com` or `www` to this API Worker.

## API routes
- `POST /api/orders`
- `POST /api/auth/request`
- `POST /api/auth/verify`
- `GET|DELETE /api/auth/me`
- `GET /api/my-orders`
- `GET|PATCH /api/admin/orders`
- `GET /api/admin/export`
- `GET|POST /api/reports`

## Test checklist before production
1. Confirm API Worker deployment and HTTPS on `api.svassure.com`; unknown routes return 404 and no secrets are exposed.
2. Configure Resend and verify a dummy sign-in email goes to the requested address; check token expiry and single-use behavior.
3. Submit a dummy requisition and confirm the row plus notification email.
4. Verify a banker sees only orders associated with their verified email.
5. Upload a dummy PDF; verify unauthenticated access is denied and a different banker receives 403.
6. Check admin token handling, status changes, CSV export, mobile layout, errors, logs, and duplicate submissions.
7. Confirm the existing website still works. Do not handle real borrower data until tests and institutional/privacy approvals are complete.

## Important notes
- Do not put reports, borrower information, secrets, or admin tokens in GitHub or public website assets.
- R2 must remain private; do not enable public access or attach a public R2 domain.
- Admin token is supplied by a header and held in the admin page's memory only.
- Banker access is tied to the verified email entered on the requisition; confirm this access model is acceptable under institutional policy.
- Per-email magic-link throttling is not a substitute for edge-level abuse protection.
- Review consent language, retention, audit logging, and incident response before handling real borrower data.
