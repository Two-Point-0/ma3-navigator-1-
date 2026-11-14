# Parcel requests and M-Pesa wallet top-ups

## Parcel request sync

Do not sync by copying local storage to a shared table. Treat a Supabase Postgres row as the source of truth, with Supabase Auth `user_id`, route and stop IDs, status, timestamps, assignment, and only the contact details needed to complete that specific delivery. A requester should see their own requests. A driver should not be able to set a local-storage role and gain access: create an admin-approved driver profile on the server and use RLS/RPC checks tied to `auth.uid()`.

For discovery, expose unassigned requests through a driver-only RPC or view that returns only route, pickup/drop-off and parcel size. After an atomic claim, return the receiver name/phone only to that assigned driver. Use an RPC to claim so two drivers cannot accept one parcel at the same time. The requester's app should subscribe to its own request rows via Supabase Realtime; the driver app should query/subscribe only to requests on its approved routes. Keep status transitions constrained (requested → assigned → picked up → delivered/cancelled). Generate pickup confirmation secrets on the server, store only a hash, and verify them server-side. Send the secret to the receiver through a real SMS service before claiming OTP-confirmed delivery; displaying the code on the sender's screen is not proof of delivery. Add retention and deletion rules for phone numbers and names.

The current `ParcelPanel` remains a local prototype and needs that separate parcel schema, driver approval workflow, authenticated client, RPCs and status UI before it can securely sync with drivers. Do not present a client-side fee estimate or archived route dataset as a confirmed commercial delivery booking.

## M-Pesa integration prepared in this branch

`20261101_wallet_mpesa.sql` creates server-authoritative wallet balances, a top-up request table, a transaction ledger, owner-only read policies, and an idempotent settlement RPC. `functions/mpesa-stk-push` accepts only an authenticated user and creates a pending payment; it never credits a balance. `functions/mpesa-callback` is reachable without a Supabase JWT because Safaricom cannot send one, but it treats the callback as untrusted and checks the CheckoutRequestID using Daraja STK Query before it asks Postgres to settle. The SQL RPC compares the amount and phone and credits the ledger once. The browser polls only its own pending request and refreshes the server balance after settlement.

The default app flag `APP_MODE.realPayments` must remain `false` until the project, merchant and tested callback are ready. Use the Daraja sandbox first. Do not add live secrets to Vite variables, the repository, a source file or a chat message.

### Required Supabase Edge Function secrets

Set these in the Supabase Dashboard's Edge Function Secrets. Keep them out of `.env` files committed to Git:

- `DARAJA_ENV`: `sandbox` for initial testing; use `production` only after the merchant is approved and the flow is tested.
- `DARAJA_CONSUMER_KEY` and `DARAJA_CONSUMER_SECRET`: from the Daraja app for the selected environment.
- `DARAJA_SHORTCODE` and `DARAJA_PASSKEY`: the merchant shortcode and Lipa Na M-Pesa passkey for that same environment.
- `DARAJA_TRANSACTION_TYPE`: `CustomerPayBillOnline` or `CustomerBuyGoodsOnline`, as configured for that merchant.
- `DARAJA_CALLBACK_URL`: the HTTPS URL ending `/functions/v1/mpesa-callback`.
- `APP_ORIGIN`: exact production web-app origin, for example `https://app.example.com`; localhost:3000 is allowed for local UI testing.

Supabase injects the project URL and server secret key into hosted functions. The function code supports current secret-key maps and the legacy service-role environment name. Never put a Supabase secret/service-role key in the browser.

### Deploy sequence

1. In the correct Supabase project, apply `supabase/migrations/20261101_wallet_mpesa.sql` only after confirming it is the intended project and reviewing the SQL. Ensure Auth and Row Level Security are enabled.
2. Create a Daraja **sandbox** app and enter the test credentials as Edge Function secrets. Configure the Daraja callback URL to the deployed `mpesa-callback` function URL and ensure it is publicly reachable over HTTPS.
3. Install/use the Supabase CLI, authenticate, link this repository to the correct project ref, set the secrets, then deploy only `mpesa-stk-push` and `mpesa-callback`. `supabase/config.toml` keeps JWT verification on for the user-facing initiation function and off only for the Safaricom callback, which verifies through a server-side Daraja query.
4. Test success, user cancellation, wrong phone/amount, duplicate callback, timeout and unauthorized calls with sandbox numbers. Confirm one and only one server-side wallet credit per accepted receipt.
5. Keep `APP_MODE.realPayments` false until all tests and business/legal checks pass. Production requires Safaricom production credentials and a valid merchant arrangement. Set production secrets in the dashboard, deploy, verify the HTTPS callback, then enable real mode deliberately. Never use the user's stored local/demo balance as funds.

The local project currently has no linked project ref, no CLI login, and no Daraja credentials. Therefore these functions are code-ready but are **not deployed** and real payments are **not active**. Do not share consumer secrets, passkeys or service-role keys with the assistant. Deployment can proceed after you authenticate/link the CLI on this device and enter Daraja secrets through Supabase Dashboard or CLI secrets management.

## References

- [Safaricom Daraja developer portal](https://developer.safaricom.co.ke/) — create sandbox/production apps and review the active API documentation. The STK Push page is JavaScript-rendered and its detailed schema was not extractable in this environment, so verify the current merchant-specific API contract and callback requirements in the portal before production launch.
- [Supabase Edge Function security](https://supabase.com/docs/guides/functions/auth) — authenticated user JWT patterns and unauthenticated webhook handlers that must authenticate the provider themselves.
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets) — configure server-side credentials in Supabase, never in client code.
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy) — authenticate the CLI, link by project ref and deploy individual functions.
- [Secondary STK Push guide](https://django-daraja.readthedocs.io/en/latest/pages/apis/stk_push.html) — corroborates that STK Push sends a PIN prompt and reports the outcome to the callback URL. The official Daraja portal remains the authority for production payload fields.
