# SV Assure report portal — Cloudflare setup

This branch adds the initial order page and D1-backed requisition endpoint. It is **not live until the bindings below are configured and tested**.

## Cloudflare Pages bindings

In the Pages project for `svassure.com`, open **Settings → Functions** and configure:

- D1 database binding: variable name `DB`, database `svassure-portal`.
- Secret `RESEND_API_KEY`: API key for the transactional email service.
- Variable `NOTIFY_EMAIL`: `contact@svassure.com`.
- Variable `MAIL_FROM`: a verified sender on a domain you control, for example `SV Assure <notifications@svassure.com>`.

Create the D1 database named `svassure-portal`, then apply `cloudflare/schema.sql` using Wrangler or the D1 console.

## Important limitations in this first commit

- Public order form and requisition capture are implemented.
- Email notification is attempted when the Resend secret is configured.
- Email-link authentication, Super Admin editing, R2 upload/download and status tracking are **not yet enabled**. The UI must not be represented as having those capabilities until the next backend stage is implemented and tested.
- No public report directory is included. Report files must never be committed to GitHub or placed in public site assets.

## Local / staging test

1. Bind D1 to the Pages project.
2. Apply the schema.
3. Configure the email secret and verified sender.
4. Deploy the branch as a preview deployment.
5. Submit a test order with dummy data and verify that the row appears in D1 and the notification reaches the configured inbox.
6. Do not use real borrower data until access controls, authentication, retention and private report storage are complete.