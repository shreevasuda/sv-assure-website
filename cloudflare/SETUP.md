# SV Assure report portal — staged Cloudflare setup

The portal is being prepared as a separate API Worker so the existing static-assets-only production Worker for `svassure.com` does not need to be reconfigured. This is not production-ready until deployed and tested. Do not use real borrower information yet.

## Existing resources
- D1 database: `svassure-portal`
- Private R2 bucket: `svassure-private-reports` (keep Public Access disabled)
- Existing website: `svassure.com`
- API Worker name: `svassure-report-portal-api`

## Separate API Worker
The router is in `portal-worker/src/index.js`. Its example config is `portal-worker/wrangler.toml.example`.
1. Obtain the D1 database ID from Cloudflare D1 > `svassure-portal` > Settings/Overview.
2. Copy the example file to `portal-worker/wrangler.toml` locally and replace `REPLACE_WITH_D1_DATABASE_ID`. Do not commit the real config if it contains account-specific identifiers.
3. From the repository root, install/use Wrangler and deploy the dedicated Worker with `npx wrangler deploy --config portal-worker/wrangler.toml`.
4. Configure secrets interactively from the `portal-worker` directory (or pass the config path): `RESEND_API_KEY` and `ADMIN_TOKEN`. Never put secret values in GitHub or source files. Use a long random admin token (at least 32 random bytes).
5. Verify the sender domain/address in Resend. Set `MAIL_FROM` to that verified sender; set `NOTIFY_EMAIL=contact@svassure.com` and `PUBLIC_SITE_URL=https://svassure.com`.
6. Keep the R2 bucket private: no public development URL, no custom public domain.

The Worker API uses an exact-origin allowlist from `PUBLIC_SITE_URL` and CORS with credentials for the website. It is intended to be tested first on the Worker-provided `workers.dev` URL. Once deployed, configure `order-report/api-config.js` with the actual API Worker URL for preview testing. Do not guess this URL.

## API routes
- `POST /api/orders`
- `POST /api/auth/request`
- `POST /api/auth/verify`
- `GET|DELETE /api/auth/me`
- `GET /api/my-orders`
- `GET|PATCH /api/admin/orders`
- `GET /api/admin/export`
- `GET|POST /api/reports`

## Database schema
The verified database currently contains `orders`, `auth_tokens`, and `sessions`. The checked-in `cloudflare/schema.sql` is aligned to those structures. Do not run destructive SQL against any database containing data.

## Test checklist before production
1. Deploy the API Worker separately; verify unknown routes return 404 and no secrets are exposed.
2. Configure Resend and verify a dummy sign-in email goes to the requested address; check token expiry and single-use behavior.
3. Submit a dummy requisition and confirm the row plus notification email.
4. Verify banker sees only orders associated with their verified email.
5. Upload a dummy PDF; verify unauthenticated access is denied and a different banker receives 403.
6. Check admin token handling, status changes, CSV export, mobile layout, errors, logs, and duplicate submissions.
7. Confirm existing website still works. Do not route production traffic or handle real borrower data until tests and institutional/privacy approvals are complete.

## Important notes
- Do not put reports, borrower information, secrets, or admin tokens in GitHub or public website assets.
- Admin token is supplied by a header and held in the admin page's memory only.
- Banker access is tied to the verified email entered on the requisition; confirm this access model is acceptable under institutional policy.
- Configure rate limiting/abuse protection at the edge before production. Per-email magic-link throttling is present but is not a substitute for edge controls.
- Review consent language, retention, audit logging, and incident response before handling real borrower data.
