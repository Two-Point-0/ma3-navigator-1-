# Ma3 passenger and driver architecture

## One app, with role-based workspaces

Ma3 Navigator remains one responsive React/Vite application and one codebase. The passenger workspace uses `/ma3`, Explore, Market, Mirth and the passenger wallet. The matatu-driver workspace uses `/driver`; a carpool-driver workspace can share the route and safety components while keeping its operating rules separate. A role choice in the onboarding screen is only a UI preference. It is not proof of a driving licence, vehicle inspection, PSV insurance or permission to broadcast a public vehicle.

## Current Supabase architecture

Supabase is the intended application backend for authentication, Postgres data, Storage, Realtime and Edge Functions. The browser uses the Supabase URL and a public publishable key; server-only keys stay in trusted functions or a restricted import terminal. Database migrations define driver profiles, approved routes, short-lived pickup intent and active-shift driver locations. Row-level security and protected RPCs—not hidden UI controls—enforce access.

### Driver live broadcast

A driver must sign in with a Supabase-verified phone account and receive an administrative approval record in `ma3_driver_profiles`, including the route IDs they may operate. In `/driver`, the driver reviews the consent information and presses **Go Online** before browser geolocation starts. While online in the foreground, the app writes only the latest driver point, reported accuracy, route, available seats and last-seen time to `ma3_driver_live_locations`. The driver can press **Go Offline** to remove the row. The system keeps no location history in this table, and riders stop seeing a point after 45 seconds without an update.

A passenger can use the Ma3 route card to request fresh live vehicles for the selected route. This action does not request or transmit the passenger’s GPS. The database permits only phone-verified users to discover approved driver points, and route filtering is applied by the client’s selected route query. A live marker represents a recent point from a driver who chose to go online. It does not prove that the driver is accepting passengers, that the vehicle has a seat, or that it will arrive at a predicted time.

### Passenger stage demand and walking-to-stage signal

A phone-verified passenger can select the first matatu pickup stage in a journey option and tap **Share pickup**. The database stores an account-linked route-and-stop intent for up to 30 minutes. The intent is self-reported: it means the passenger selected that stage, not that an independent system has verified the person is standing there.

When the passenger begins walking toward that stage, they can explicitly tap **I’m walking to this stage**. The browser requests a one-time location fix only after the tap. The server checks that the reported accuracy is 100 metres or better and that the straight-line distance from the selected stage is no more than 800 metres. This is a geodesic proximity check, not a walking-network route calculation. The exact latitude and longitude are passed to the protected RPC for validation and are not written to the demand table. The database stores only the `walking` intent and its 10-minute expiry. The passenger can cancel the request or refresh the walking intent with another explicit one-time check.

An approved, phone-verified driver may call `get_ma3_waiting_counts` for the driver’s approved route. The protected function returns a stage name and two aggregate fields—waiting count and walking count—without passenger IDs, phone numbers or exact positions. The Driver screen refreshes these counts every 15 seconds. This is near-live polling, not a push notification. Counts are self-reported demand signals, not bookings, guaranteed passengers or a promise that the driver should stop unsafely. Rows stop counting at expiry; a separate physical expired-row cleanup schedule must be configured and tested before public launch.

### Driver-reported traffic issues

The Matatu Driver workspace includes a small map of the selected route. A route-approved driver can tap **Report issue (+)**, then tap the highlighted route line to set a location, choose a category (pothole, collision, police/traffic checkpoint, roadworks, flooding, obstruction, congestion or other hazard), add an optional short factual note and submit. Reports are not a navigation instruction or a verified emergency feed; users must stop safely before interacting with the phone. Police/checkpoint reports are short-lived and explicitly must not be used to evade law enforcement.

The `20261113_ma3_traffic_reports.sql` migration requires a phone-verified account and an admin-approved driver route. Reports are readable only to approved drivers for the same route. A server-side point-to-segment check requires a submitted point to fall within 200 metres of that route’s imported `ma3_route_shapes` polyline; the frontend’s map click is not the only validation. The Realtime-published report table does not contain the reporter’s identity; a separate RLS-locked audit table stores that only for rate limiting (maximum 12/hour). Expiry removes reports from route discovery after 30 minutes for checkpoints, 2 hours for collisions/flooding, 24 hours for potholes and 90 minutes for other categories. This is visibility expiry, not a configured physical deletion schedule. Notes are capped at 140 characters; users should not include names, phone numbers, plates or other personal details. Reports remain driver-submitted and unverified.

### Parcel flow

Boda Basket requests use Supabase-backed records and driver-specific discovery/claim logic. Parcel claims are separate from the stop-demand counts and from the live vehicle point. A parcel claim should not reveal the passenger’s phone location to unrelated drivers. Payment settlement or parcel advertising must not rely on a client-side success state.

## Data and access boundaries

- Phone OTP is required for verified driver broadcast and the current stop-demand RPC. The SMS provider must be configured in Supabase Auth; owning a phone does not configure OTP delivery.
- A moderator must check a driver and approve their route in the backend. A frontend checkbox or user-selected role does not grant approval.
- Passenger stop-demand rows are scoped by user at table level. Drivers receive only aggregate counts through the protected route-specific function.
- Exact passenger coordinates for a walking check-in are used transiently by the server calculation and are not persisted. The driver does not get a passenger marker.
- A driver publishes only after an explicit online action. The driver can go offline; active rows expire from rider discovery after 45 seconds without an update.
- A PWA does not guarantee background GPS after the browser is backgrounded or closed. Do not promise continuous tracking. A native app would need additional battery, privacy, permission and store-policy review.
- Current application flags in `src/lib/appMode.ts` remain demo-oriented (`demo: true`, live transport/pricing, real payments and real driver broadcasts disabled). Connecting Supabase does not silently turn on live services.

## Safety, privacy and ethical safeguards

The product must explain why each location permission is requested, who receives information, how long the signal remains active, and how the user can cancel. Avoid collecting a location when a passenger only needs to search a route or view a driver. Make denial of location permission a usable path rather than a dead end. Test that unapproved accounts cannot broadcast or read counts and that the driver function cannot query another route. Add rate limits, abuse reporting, expired-row cleanup, a clear privacy notice and a support/deletion process before public release.

Drivers should not use the app while moving the vehicle. Demand counts can guide planning but must not prompt an unsafe stop or guarantee a passenger will be present. Discuss access barriers for people without smartphones, data or accurate GPS, and provide non-location-based route search. The Kenya Data Protection Act and the actual operating model should be reviewed by a qualified local adviser before a public location-sharing or transport service launches.

## Two-phone test sequence

1. Verify two distinct phone accounts through the configured Supabase SMS provider.
2. Assign one account as a driver in the UI, then have an authorised administrator approve its test route in `ma3_driver_profiles`.
3. On the parked driver phone, select the approved route, explicitly go online and observe its own broadcast state.
4. On the passenger phone, select the same route and stage, share a waiting request, and confirm the driver sees only the waiting count.
5. Within 800 metres of the selected stage and with suitable GPS accuracy, explicitly mark walking. Confirm the driver sees a walking count, not a passenger identity or map marker.
6. Try a distant location, poor accuracy, an unapproved driver and an unrelated route; each protected operation should be rejected.
7. Cancel the passenger request, go offline on the driver phone, and confirm the counts and fresh marker disappear as expected.
8. Test location denial and a closed/backgrounded PWA. Search and route information should remain usable without passenger GPS, and the app should not claim continuous driver tracking after the page closes.
9. With an approved route driver, open **Driver road reports**, tap **Report issue (+)**, tap the route line, submit a test pothole and confirm the marker/list appears on another approved driver account for that same route. Confirm an unapproved account, a passenger and a different-route driver cannot read it; verify that the report disappears from discovery at expiry.

## Remaining work before production

Apply and test migrations in the actual Supabase project; configure the SMS provider; approve and audit test drivers; validate routes and stop coordinates; verify RLS and function grants using adversarial test accounts; configure physical cleanup of expired demand rows; test intermittent network recovery and rate limits; write privacy, safety, support, cancellation and deletion procedures; and complete local legal review. Replace archived route data and placeholder schedules only with sourced, dated feeds. Keep payment features in Daraja sandbox until settlement and production approval are complete. Native background location, five-image local-business moderation and production product checkout are separate work items.
