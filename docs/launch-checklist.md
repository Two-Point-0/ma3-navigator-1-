# Ma3 Navigator: finish the backend (test mode first, then launch)

Everything below is clicking in a dashboard, or pasting one thing into the Supabase SQL Editor.
Do the steps in order. Tick each one off.

## A. Test mode (about 20 minutes)

1. **Open your Supabase project** (ref `uygefywqxtqpfaibjete`) at supabase.com -> your project.
2. **Phone sign-in with a free test number**
   - Authentication -> Providers -> Phone -> turn it ON.
   - Turn ON "Enable phone confirmations" only if you have an SMS provider. For testing, scroll to **Test Phone Numbers** and add `254712345678=123456`
     (a number and a fixed code). You will log in with that number and code, no SMS needed.
   - Click Save.
3. **Allow your website address**
   - Authentication -> URL Configuration.
   - Site URL: `https://ma3-navigator-1.vercel.app`
   - Redirect URLs: add `https://ma3-navigator-1.vercel.app/**` and `http://localhost:5173/**`.
4. **Log in once on the live site** with the test number and code, so your account exists.
5. **Make yourself admin**
   - SQL Editor -> New query.
   - Open `supabase/seed/make_roast_admin.sql` from the project, put your test phone number where it says,
     paste the whole file in, click Run.
6. **Catalog reference rows**: paste `supabase/seed/demo_catalog.sql` into the SQL Editor and Run.
   (Already run? Running again is safe.)
7. **Check the Vercel settings** (vercel.com -> project -> Settings -> Environment Variables):
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the `sb_publishable_...` key
   - Never paste a "service_role" or "secret" key here.
   - After changing them: Deployments -> the latest one -> Redeploy.
8. **Realtime (games rooms and ride chat)**: nothing to switch on. They use Supabase Realtime, which is on by default.
   Test it with two phones: open the same Ludo room code on both.

## B. Nganya pictures

1. Supabase -> Storage -> bucket `nganya-products` (public). Make a folder `matatus` and upload the photos
   (JPG or WebP, under 300 KB each). Only use photos you own or have permission to use.
2. Click a photo -> Get URL -> copy.
3. SQL Editor, one block per nganya (change the words in capitals):

   insert into public.nganya_matatus (display_name, sacco, route_code, route_label, image_url, import_key)
   values ('NAME', 'SACCO', 'ROUTE NUMBER', 'ROUTE NAME', 'PASTE-THE-PHOTO-URL', 'unique-name-route')
   on conflict (import_key) do update set image_url = excluded.image_url;

4. Open Mirth -> Nganya. The picture shows beside the name.

Other pictures use the same idea: `place-photos` (Explore places), `business-images` (local businesses),
`profile-photos` (people, uploaded by the app itself).

## C. Real M-Pesa (only when you are ready; the wallet works in demo mode without it)

1. Create a free account at developer.safaricom.co.ke and make a **Sandbox** app (Lipa Na M-Pesa Sandbox).
2. In Supabase -> Edge Functions -> Secrets, add:
   `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_PASSKEY`, `DARAJA_SHORTCODE`,
   `DARAJA_ENV` = `sandbox`, `DARAJA_CALLBACK_URL` = `https://uygefywqxtqpfaibjete.supabase.co/functions/v1/mpesa-callback`,
   `APP_ORIGIN` = `https://ma3-navigator-1.vercel.app`.
3. Deploy the two functions (one command per line, in the project folder):
   npx.cmd supabase functions deploy mpesa-stk-push
   npx.cmd supabase functions deploy mpesa-callback --no-verify-jwt
4. In `src/lib/appMode.ts` set `realPayments: true`, build, push.
5. Test with the Safaricom sandbox test number. Go live later by switching `DARAJA_ENV` to `production` with real credentials.

## D. Flights (optional)

Free test keys from developers.amadeus.com -> Supabase secrets `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_HOST` = `test.api.amadeus.com`,
then `npx.cmd supabase functions deploy flight-offers`.

## E. Before real users

- Replace demo vehicles with real driver data (driver sign-up, admin approval).
- Rail times and fares are estimates: confirm them.
- Turn off the demo wallet extras by setting `realPayments: true` (Tap pay, Stage and Till then show "Coming soon").
- Add a privacy policy contact email and check the Legal pages.

## F. Load the Market sample data (supermarket prices)
The two files are already in `supabase/sample_data/`. They are demo rows (SKU starts with SAMPLE-) so they never pass as real prices.
1. Supabase dashboard → Project Settings → API keys → copy the **service_role** secret key. Never paste it into Vercel, the app, GitHub or a chat.
2. In the project folder terminal (PowerShell), set these two for this window only:
   - `$env:SUPABASE_URL="https://uygefywqxtqpfaibjete.supabase.co"`
   - `$env:SUPABASE_SERVICE_ROLE_KEY="paste-the-secret-here"`
3. Run: `node scripts/import-market-csv.mjs --products supabase/sample_data/products.csv --prices supabase/sample_data/price_observations.csv`
4. Close the terminal window. Open the Market page: products and prices from the five stores should appear.
Later, replace them by importing your real checked CSVs the same way (use `manual_entry` as the source type).

## G. Fly with demo flights
1. Supabase → SQL Editor → New query → paste all of `supabase/seed/demo_flights.sql` → Run. It makes about 1,300 made-up flights for the next 30 days (NBO to Mombasa, Kisumu, Malindi, Eldoret, Lamu, Entebbe, Dar, Addis, Joburg, Dubai, London, and back).
2. Open Fly → pick Nairobi (NBO) to Mombasa (MBA) → the demo flights and a drawn line appear. Every airline says "(demo)".
3. Run the file again any time to refresh the dates. Remove all of it later: `delete from public.flight_routes where id like 'demo-%';`
4. Real prices later: add the Amadeus keys (section D) and the live price card takes over.
