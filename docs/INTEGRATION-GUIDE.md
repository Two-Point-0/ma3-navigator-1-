# Integration guide: backend first, then push (step by step)

Do the parts in this order. Parts 1 and 2 happen BEFORE you push. Nothing here needs you to edit code.
All commands go in the VS Code terminal (PowerShell), opened in your project folder.

---
## PART 1. Put the new files in
1. Save `ma3-live.zip` into the project folder.
2. Run: `Expand-Archive -Path ".\ma3-live.zip" -DestinationPath . -Force`
3. Run: `Remove-Item .\ma3-live.zip`
4. Run: `npm install` (nothing new, but it is harmless).

## PART 2. Backend (Supabase), before you push
### 2A. Database changes (4 new migrations)
1. Practice run: `npx.cmd supabase db push --remote --dry-run`
   You should see exactly these four:
   - 20261117000000_more_games.sql  (new games)
   - 20261117000100_mchongwano_live.sql  (live roast battles, tournaments, votes)
   - 20261117000200_shared_baskets.sql  (named, shareable shopping lists)
   - 20261117000300_driver_applications_admin.sql  (driver applications and approval)
2. If the list matches, apply: `npx.cmd supabase db push --remote` and answer Yes.

### 2B. Phone sign-in (Supabase dashboard, in the browser)
1. Open your project > **Authentication** > **Sign In / Providers** > **Phone**. Switch **Enable Phone provider** on.
2. In the same box find **Test Phone Numbers and OTPs**. Enter your own two phones like this (no plus sign, number = code, comma between):
   `254724726032=123456,254182578382=123456`
   Click **Save**. (These are NOT in the code. They live only in Supabase.)
3. **Your friends' phones (the drivers).** Drivers must sign in with a verified phone, so each friend needs a login code. Two ways:
   - **Pilot with friends (free, now):** add each friend to the same box with a code of your choice, e.g. `...,2547XXXXXXXX=482913,2547YYYYYYYY=770216`. Tell each friend their own code privately. Fine for 5 to 20 trusted people. Not safe for the public, because the code never changes.
   - **Real public launch (needed before strangers sign up):** in the same Phone settings choose an SMS provider (Twilio is the easiest one Supabase offers), paste its keys, and keep a little money in that account. Each login SMS costs a few US cents. Then remove the fixed test numbers you no longer need.
4. Also on **Authentication > URL Configuration**: set **Site URL** to your live Vercel address and add it under Redirect URLs (needed for Google sign-in).

### 2B-2. Extra testers on your two laptops (and anyone else)
The app signs people in with **Google (any Gmail)** or a **phone number**. There is no email-and-password box. So:
- **Laptop as a passenger, shopper, audience, Mchongwano fighter or basket friend:** press "Continue with Google" and use any Gmail. Each different Gmail is a different person. Use a different browser profile or a private window per person so they do not share a login.
- **Laptop as a DRIVER:** drivers must be phone-verified (a safety rule). A laptop can still do it: on the sign-in screen use the phone box with a number you added as a test number. Add two extra made-up test numbers in the same Supabase box, for example `254700000001=111111,254700000002=222222` (they do not need to be real phones). Sign in on the laptop with that number and code. Laptop location comes from Wi-Fi so the dot is roughly right, not exact. A real phone walking around is the best GPS test.
- So the full test team can be: your 2 phones + 2 laptops + friends. The more different accounts, the better the Mchongwano audience and tournament tests.

### 2C. Your Nganya products (50+ items, pictures, descriptions)
**Where the pictures live (plain English):** the app has no pictures inside it. Supabase has a "storage" cupboard (a bucket called `nganya-products`) that the app reads from. The command below copies each picture from your computer into that cupboard, and saves the name, price and description in the product list (a database table). When someone opens Mirth > Shop, the app reads the list and shows each picture from the cupboard. So yes: run one command, and the images from your PC end up on Supabase and appear in the app. You never put pictures into the code or into GitHub.
They show up in **Mirth > Shop** (search box, category chips, picture and full description on tap).
1. Put your product list in ONE spreadsheet. Needed columns: `sku` (a short code like NG-NFT-001), `name`, `description`, `category` (any word: models-toys, nft, brick-sets, wearables...), `price_kes`, `stock_qty`. Optional: `image` (exact picture file name). In Excel use **File > Save As > CSV UTF-8**. (Your existing file can be used: the importer understands names like title/details/type/price.)
2. Put ALL the pictures in ONE folder (sub-folders are fine). Name each picture after the sku: `NG-NFT-001.png`. If a picture is named differently, put its exact file name in the `image` column. Formats: png, jpg, webp.
3. Get the secret key: Supabase > **Project Settings > API Keys** > the **secret** (service role) key. Never put it in a file or share it.
4. Practice run (changes nothing, shows what it found and which products have no picture):
   ```
   $env:SUPABASE_URL = "https://uygefywqxtqpfaibjete.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Paste the secret key"
   node scripts/import-nganya-products.mjs "C:\path\products.csv" "C:\path\images" --dry
   ```
5. If it looks right, run it for real. Add `--mark-cleared` ONLY if you confirm you own the art and designs, and `--activate` if those rows have a price and stock and should be on sale:
   ```
   node scripts/import-nganya-products.mjs "C:\path\products.csv" "C:\path\images" --mark-cleared --activate
   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY ; Remove-Item Env:SUPABASE_URL
   ```
   Without `--activate` the products show as "Coming soon" with an "I'd buy this" button, which tells you what to make first.
6. To change a price or stock later: edit the spreadsheet and run step 5 again. Same sku = update, not a duplicate.
7. **Two warnings before you sell:**
   - Do not use the LEGO name or logo on products. It is a registered trademark. Call them "brick sets" or "building sets".
   - NFTs: sell them as "digital collectible art" unless a lawyer has approved a real crypto token sale. Kenya now regulates virtual-asset businesses.

### 2D. Check the backend took
In the Supabase dashboard open **Table Editor**. You should see roast_matches, roast_lines, roast_tournaments, shared_baskets, and nganya_products with your rows. In **Database > Publications > supabase_realtime** roast_matches, roast_lines and shared_baskets should be ticked (the migration does this for you).

## PART 3. Build and push
1. `npm run build` (must end without red errors).
2. `git add .`
3. `git status --short` must NOT list `.env.local` or `project-overview.txt` or any zip.
4. `git commit -m "Live roast arena, more games, shared baskets, driver sign-up, product import"`
5. `git push origin main`
6. Vercel rebuilds by itself. Check **Vercel > your project > Settings > Environment Variables** has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Production). Optional later: `VITE_VIDEO_HOST` if you move video to your own provider. Redeploy after changing any variable.

## PART 4. After it is live: set up the real people
Use the live Vercel address on the phones (GPS and camera only work on https).

### 4A. You as owner/admin
1. On your own phone, open the app and sign in with your number (code 123456). This creates your account.
2. Supabase > **SQL Editor** > open `supabase/seed/make_roast_admin.sql` from the project, check the phone number is yours, run it.
3. Open `yourapp/admin` on your phone. You should see "Admin · drivers". This is where you approve drivers. In Mirth > Games > Mchongwano Live you also get "create a tournament".

### 4B. Your friends as drivers (the Nairobi pilot)
1. Friend opens the app, signs in with their number, chooses **Matatu driver** on the welcome screen, then opens the **Driver** tab.
2. They fill in name, number plate and pick their route(s), then press **Send application**.
3. You open `/admin`, phone them or check the plate, press **Approve**.
4. The friend presses **Go online** and allows location. Keep the app open and the screen on (a web app cannot track reliably in the background; a native app is the long-term fix).
5. A rider opens **Ma3**, picks that route, and sees the live matatu dot. A driver disappears from rider maps if their location is older than 45 seconds.
Different friends in different parts of Nairobi on different routes is exactly the right test.

### 4C. Two-phone checks (do these in order)
Phone A = rider (you). Phone B = driver (your second number, or a friend).
- **Live matatu / GPS:** B goes online as above. A opens Ma3 > the route. A sees B's dot move when B walks or rides.
- **Location sharing:** Menu > Share location on both. A taps Pair > creates the one-time code, sends it to B in WhatsApp; B pastes it and accepts. Both press Start sharing. Each sees the other on the map.
- **Mchongwano:** A and B both open Mirth > Games > Mchongwano Live, accept the 18+ rules (stage names), A taps Challenge, B taps Accept. A third signed-in account (a friend's phone, or Google on a laptop) opens the same lobby, taps the live battle and watches and votes. Fighters cannot vote in their own battle.
  To test fast, run this once in SQL Editor, then put it back after: `update app_settings set value='20' where key in ('roast_turn_seconds','roast_vote_seconds');`
- **Tournament:** as admin, in the Mchongwano lobby create a tournament. Let 2 to 4 accounts register. Tap "Admin: pair the next round". Fighters see "Your scheduled battles" and press I'm ready. The winner of each round moves on. Repeat "pair the next round" until one champion is left.
- **Shared basket:** Market > Basket > My lists. A adds items, names the list, saves, taps Share. B enters the 6-letter code under Join. Both can then use it as their basket and save changes for each other.
- **Games:** Mirth > Games shows every game as a tile. Ludo opens with the full board. Pick a route in Route King, play, and the score goes to the route board.
- **Pop-ups:** every page now opens its panel as a large centred pop-up that sits between the top buttons and the bottom menu. Tap the grip/minimise button and it shrinks to show the map and route line. While you are placing a pin it hides completely.

## PART 4D. Google Analytics and SEO (optional, 10 minutes)
**SEO (already done in the code):** every page now has its own title and description, share-link tags, a robots file (it tells Google to skip /admin, /wallet, /profile, /login), and a rewrite file so links like `yourapp/market` open correctly. After you push, check it: open the live site, right-click > View page source, and look for the description line. To get on Google: open **Google Search Console**, add your live address, verify it, and press "Request indexing" for the home page. Be aware: this is a map app, so Google will see little text. Ranking takes weeks. Using your own domain (not the long vercel.app name) helps a lot.
**Analytics (GA4):**
1. Go to analytics.google.com, create a property for the app, add a **Web data stream** with your live address, and copy the **Measurement ID** (looks like `G-AB12CD34EF`).
2. In **Vercel > Settings > Environment Variables** add `VITE_GA_MEASUREMENT_ID` = that ID (Production), then **Redeploy**.
3. Open the live app. A small "Help us improve Ma3?" card appears (this is the consent step Kenyan data law expects). Press **Allow**. Nothing is counted until someone presses Allow.
4. In Google Analytics open **Reports > Realtime**. Move around the app on your phone: you should see yourself within a minute (one active user, pages like /market).
If you press "No thanks" nothing is sent. The text in Privacy already explains this.

## PART 5. What is still NOT real (be honest with your first users)
- **Payments:** wallet top-ups, orders and listing fees are still in demonstration mode. Real M-Pesa needs a Safaricom Daraja account (paybill/till, consumer key and secret, a callback address) and one more backend function. Tell me when you have the Daraja keys and I will build it. Until then do not take real money.
- **Supermarket prices:** the Compare screen is only as good as the prices loaded. Today's prices are observations/seeded data, not live shelf prices. Real prices need a source (your own price collection, a partner, or user submissions).
- **Live video:** the camera in Mchongwano is a beta using a free public video room. It can limit session length and is not true broadcasting to hundreds of viewers. The text battle, live voting and crowd bar are fully live. For real streaming we later plug in a paid video provider (set `VITE_VIDEO_HOST`).
- **Game scores** are reported by the phone and only partly checked by the server (time limits, daily cap). Fine for fun and small prizes, not for cash prizes.
- **Lawyer:** have a Kenyan lawyer check the roast rules (src/data/legalText.ts, ROAST), the privacy policy and terms, the 70/15/15 revenue split and anything involving sacco payouts before the public launch.
- **Fill in** the `[square bracket]` items in `src/data/legalText.ts` (your business name, contact, data-protection details).
