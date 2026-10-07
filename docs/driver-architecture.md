# Ma3 passenger and driver architecture

## Does Ma3 need two separate apps?

**No, not for the current product.** Ma3 can remain one responsive web app and one codebase with role-based workspaces:

- **Passenger workspace:** `/ma3`, `/ndai`, `/market`, `/explore`, `/mirth`, wallet and bookings.
- **Matatu driver workspace:** `/driver` with route selection, consented location broadcast, available seats and stop demand.
- **Carpool driver workspace:** `/driver` with a planned trip and available seats.

Uber uses separate downloadable apps mainly for independent release cycles, store listings, permissions, support and branding. Those are product and operations choices, not a technical requirement for GPS.

## What is implemented now

- First-run onboarding asks whether the person is a passenger, matatu driver or carpool driver.
- Driver navigation is hidden from passenger accounts.
- `/driver` is protected by the selected role and refuses passenger access.
- The driver page requests browser geolocation only after the driver presses **Start location broadcast**.
- The current adapter writes a demo location to browser storage so two browser tabs can be used to test the interaction without pretending that production tracking is live.

## What is still required for real bookings

Replace the local `saveLocation` adapter in `src/pages/Driver.tsx` with an authenticated backend, preferably Firebase Realtime Database for the first pilot or a server using WebSockets for more control.

Recommended production records:

```text
/driverLocations/{driverId}
  lat
  lng
  accuracy
  updatedAt
  routeId
  vehicleType
  seatsAvailable
  status

/driverSessions/{driverId}
  verified
  consentedAt
  expiresAt

/bookings/{bookingId}
  passengerId
  driverId
  status
  pickup
  destination
  createdAt
```

Required safeguards:

1. Authenticate every driver and passenger.
2. Verify the driver, vehicle and Sacco before public discovery.
3. Require explicit location consent and provide a visible stop control.
4. Expire stale coordinates and never display a driver as available indefinitely.
5. Throttle location writes, for example every 5–10 seconds while active.
6. Use Firebase security rules so a driver can write only their own location.
7. Keep precise location private until a booking or approved operational use requires it.
8. Add cancellation, incident reporting and support workflows before a public launch.

## Packaging options later

The same React codebase can later be packaged as:

- one PWA with role-based install shortcuts;
- one passenger PWA and one driver PWA built from the same repository; or
- two store applications sharing components and backend services.

Do not split into two repositories until driver operations, permissions, analytics and release cadence genuinely need independent products.
