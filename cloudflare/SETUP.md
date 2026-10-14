# SV Assure report portal — deployment and safety checklist

## Architecture
- Public requisition page: `https://svassure.com/order-report/`
- Dedicated API Worker: `svassure-report-portal-api`
- API custom domain: `https://api.svassure.com` (must be attached to this Worker in Cloudflare)
- D1 database: `svassure-portal`, binding `DB`
- Private R2 bucket: `svassure-private-reports`, binding `REPORTS_BUCKET` (Public Access must remain disabled)
- Email: Resend; notifications to `contact@svassure.com`

The existing apex website and its DNS/Worker route must remain unchanged. Do not attach the API Worker to `svassure.com` or `www.svassure.com`.

## One-time GitHub Actions setup
The workflow `.github/workflows/deploy-portal-api.yml` is manual-only. Before running it, add these **repository Actions secrets** in GitHub → Settings → Secrets and variables → Actions:
1. `CLOUDFLARE_API_TOKEN`: Cloudflare API token with permissions to deploy Workers and manage D1 for this account.
2. `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
3. `D1_DATABASE_ID`: UUID shown in Cloudflare D1 → `svassure-portal` → Settings/Overview.

Never add Resend or admin credentials to GitHub. They belong only in Cloudflare Worker secrets.

The workflow substitutes the D1 ID into `portal-worker/wrangler.toml` only in its temporary runner checkout, applies the additive `CREATE TABLE/INDEX IF NOT EXISTS` schema, then deploys the dedicated API Worker. It does not deploy the apex website. Run it manually only after the three GitHub Actions secrets are configured.

## Cloudflare Worker configuration
In Workers & Pages → `svassure-report-portal-api` → Settings → Variables and Secrets, configure:
- Secret `RESEND_API_KEY`: Resend API key.
- Secret `ADMIN_TOKEN`: a long random token (at least 32 random bytes).
- Variable `PUBLIC_SITE_URL`: `https://svassure.com`.
- Variable `NOTIFY_EMAIL`: `contact@svassure.com`.
- Variable `MAIL_FROM`: a sender address verified in Resend, for example `SV Assure Reports <contact@svassure.com>`.

The code accepts `FROM_EMAIL` as a compatibility fallback, but `MAIL_FROM` is the documented setting. Never put secrets in source code, GitHub files, or screenshots.

## Database
`cloudflare/schema.sql` contains additive `CREATE TABLE IF NOT EXISTS` statements for requisitions, one-time login tokens, sessions, and persistent email throttling. The deployment workflow applies it to the named D1 database. Do not use destructive SQL or manually delete tables.

## Required verification before real data
1. Confirm the API Worker has custom domain `api.svassure.com`, HTTPS works, and `GET https://api.svassure.com/` returns a harmless 404 (the root is not a user-facing page).
2. Confirm a valid dummy order saves to D1 and a notification reaches `contact@svassure.com`.
3. Confirm invalid form submissions are rejected and origin/CORS allow only `https://svassure.com`.
4. Confirm magic-link email is delivered; token expires after 15 minutes and cannot be replayed.
5. Confirm banker access is restricted to orders for their verified email.
6. Upload a dummy PDF; confirm unauthenticated and wrong-banker downloads are denied and R2 remains private.
7. Confirm admin token is required for listing, status changes, uploads, and CSV export.
8. Check Worker logs, error handling, mobile layout, and existing website functionality.

Do not use real borrower details or real reports until all tests pass and privacy, retention, consent, institutional, and incident-response requirements are approved. Per-email login throttling is present; consider Cloudflare edge rate limiting before public launch.
