# MA3 Navigator product plan

This plan turns the requested all-in-one Kenya travel and local-commerce app into shippable stages. The current web app already has map-first Ma3, Ndai, Fly, Market, Explore and Mirth pages. Keep those pages and their map overlays as the core navigation pattern; don't create a separate map instance for every small popup. Lazy-load page modules, query only the visible map area, and load route geometry or catalogue rows only after a user searches to keep the first screen quick.

## 1. Ma3 routes, transfers, waiting and parcels

- Search by route number, SACCO/operator, route endpoints, vehicle style/name and stop. Maintain a reviewed Kenya-wide SACCO/route directory with source and last-checked date; do not infer service from vehicle nicknames such as Double M or Citi Hoppa.
- Put the search controls in a draggable bottom sheet over the map. Show direct, fewest-transfer, lowest-indicative-fare and shortest-estimated-time options, with walking legs, transfer stops and data freshness. Label fare/time as estimates until an operator feed exists.
- Keep “I’m waiting here” voluntary and stop-specific. The existing Supabase RPC exposes aggregate counts only; add the driver view with short polling or Realtime, route authorization, expiry, and abuse limits. Never expose passenger identity or phone GPS to drivers.
- Add parcel booking only after an operator opts in. Sender chooses parcel size, route and handoff stop; receiver confirms the matching stop and one-time handoff code. Record status, custody events, prohibited-items policy, support contact, price disclosure and cancellation. Use an operator-approved manifest, not an unverified public driver map.
- For person-to-person safety and liability, publish sender/receiver contact-sharing consent and a clear lost/damaged parcel process before accepting real parcels.

## 2. Rail, Ndai and airport transfers

- Keep mapped railway geometry separate from service availability. A route planner may recommend walking or matatu where no verified train schedule is loaded, but must not call a mapped track an operating train or invent times/fares.
- Ndai should use a provider adapter for quotes, driver acceptance, live trip state, receipts, support and cancellations. Until a licensed/insured provider agreement is in place, label the screen a booking prototype and route real users to an approved provider.
- “Carpool” must remain genuine shared-trip cost splitting. Have Kenyan transport counsel and the insurer decide whether the precise matching/payment model falls under PSV, private hire or transport-network rules. No driver markup, surge or public for-hire matching before that review.
- Fly should show sourced flight availability only when an airline/GDS feed is contracted. Otherwise maintain an admin-managed directory of airline/agent booking URLs, show no availability or fare claims, and hand off to the provider. Airport taxi links should use the same Ndai provider/verification gate.

## 3. Market, baskets, local businesses and delivery

- Market navigation should be **Compare**, **Baskets** and **Local Market**. Compare means complete-basket totals and missing-price disclosure; Baskets means household templates, custom lists, save/share and delivery handoff; Local Market means nearby seller discovery.
- Build 20–30 seller profile pages from one reusable profile template, not 30 separately coded pages. Each profile is data-driven: name, category, seller-approved photos, map point, hours, stock/offer note, service radius, pickup/delivery options, minimum order, contact/checkout link and last-confirmed date. Suggested launch categories: kibandaski, mama mboga, butcher, fishmonger, cereals/posho mill, bakery, milk/eggs, water/gas, chemist, salon/barber, tailor, shoe repair, mitumba, household goods, phone repair, electronics, printing/cyber, hardware, stationery, laundry, car wash, mechanic, market stall, restaurant/kibanda, flowers/gifts, baby goods, pet supplies, farm produce, cleaning services and local delivery.
- Use seller onboarding and consent to collect listings. HOTOSM can seed public place discovery, but it is not a verified seller catalogue and should not be used to invent stock, opening hours or seller contact details.
- Let users name and save baskets locally at first. A share link should contain only product identifiers, quantities and a basket label; recipients preview it and explicitly save it. For cross-device/private sharing, move to Supabase basket records with owner/read-token access, expiration/revocation and RLS. Do not place addresses, payment details or account identifiers in a share URL.
- “Boda Basket” can remain the clear English service label; test a short Kiswahili/Sheng name with actual Nairobi users before renaming. Delivery actions should pass a confirmed pickup and dropoff to an enabled operator in Ndai. Do not promise delivery until a courier accepts.
- Create 5,000 product records only from a retailer or licensed catalogue. Synthetic demonstration rows may be used for UI performance demos only if product names and every price are clearly marked simulated and are never mixed into real comparisons. Do not treat a 5,000-row generated file as Kenyan market research.

## 4. Explore, Mirth and onboarding

- The HOTOSM archive in `C:\Users\denni\OneDrive\Desktop\project 1` is the Kenya POI GeoJSON snapshot already described in `supabase-setup.md`. Run the existing importer from a terminal with the Supabase service key set only in that terminal. Explore should request a small viewport/category-filtered result set; attribute OpenStreetMap and show the snapshot date.
- Keep Mirth map overlays useful: selected route shape, community ranking, and challenge targets can appear together. Rankings need an explicit route and scoring period; avoid putting a person’s live location on a route. Let a user challenge a public score using an opt-in profile, not by publishing another user's account without consent.
- The Mirth database already awards non-cash points for route votes and POI navigation. Bring a summary card to Home and link it to Mirth Challenges. Do not describe points as redeemable until rewards, funding, fraud controls, terms and a compliant redemption flow exist.
- Keep the three onboarding charts, explain Move / Market / Mirth in plain language, and animate the Ma3 “3” through red, amber and green once on each slide. On the third slide, transition to the existing app loader; do not add a second fixed multi-second wait.

## 5. Recommended delivery order

1. Finish the Supabase migration and verify auth, RLS, backup and environment setup.
2. Import the existing HOTOSM snapshot and the archived transit export; add snapshot/source labels and query by viewport.
3. Ship search, route planning, voluntary stop counts and driver aggregate view. Get current route/SACCO/fare data from operators before claiming national coverage.
4. Add seller directory, reusable profile template and seller opt-in workflow; pilot with 20 Nairobi businesses before opening self-service listings.
5. Add saved/shared baskets and handoff integrations; use mock checkout only in a clearly labelled sandbox.
6. Obtain legal, insurance and partner sign-off for parcels, carpool, Ndai, Boda delivery and flight/rail booking, then implement provider adapters one at a time.
7. Deploy a staging build, verify account/privacy flows and data freshness with local users, then launch a limited Nairobi pilot before expanding nationally.

## 6. Decisions that need real-world inputs

The app can prepare screens and database contracts, but it cannot manufacture current SACCO routes, vehicle GPS, parcel acceptance, supermarket prices, seller stock, flight inventory, train schedules, licenses or insurance status. These require operator/retailer/seller agreements, data owners and a Kenyan legal review. Keep demo content visibly separate from live content in the UI and database.
