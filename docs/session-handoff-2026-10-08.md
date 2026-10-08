# Ma3 project handoff — 8 October 2026

## Product

**Ma3** means *Move, Market, Mirth*. It is a Kenyan mobility and lifestyle web app. The visual identity uses a nocturnal charcoal base, sharp modernist transit-map styling, and traffic-light accent tokens:

- Green: ready, safe, active
- Amber: attention, fare, pending
- Red: stop, warning, cancellation

The interface should use Lucide icons rather than emoji. Passenger and driver experiences are separated by role, but remain in one React/Vite codebase. This is the same architecture as having passenger and driver modes in Uber: one codebase can produce role-specific screens, permissions and navigation. Two entirely separate apps are not required for the MVP.

## Repository and environment

- GitHub: `https://github.com/Two-Point-0/ma3-navigator-1-`
- Sandbox clone: `/home/ubuntu/ma3-navigator-1-`
- Main branch is normally kept synchronized with GitHub.
- Local development command: `npm run dev`
- Production validation: `npm run build`
- Local app: `http://localhost:3000`

Recent commits include:

- `11a07ce` — glass UX and constrained carpool cost sharing
- Earlier commits added role onboarding, Driver mode, route planning, wallet, Market and related updates.

## Main application features already implemented

### Move / Ma3

- MapLibre transit visualization.
- Direct and transfer route planning.
- Walking legs, including the current demo walking-leg logic.
- Demo vehicles moving on route polylines.
- Onboard progress strip showing next stops.
- Route search and station/route UI.
- Demo train and rail presentation work exists in the project history.

### Market

The Market page is being evolved into a Smart Shopping Planner. The intended planner supports:

- Bachelor basket.
- Family basket with household member input.
- School basket with kindergarten, primary, secondary and university choices.
- Basket quantities.
- Product search.
- Comparison of the same products across Naivas, Quickmart and Carrefour.
- Per-item cheapest store.
- Full basket total by store.
- Cheapest overall store.
- Budget comparison.
- Indicative-price disclaimer.

Current seeded product categories include staples, kitchen, dairy, protein, household, personal care and school supplies. The current implementation intentionally uses indicative seeded data rather than claiming live prices.

### Ndai / carpool

- Ndai is the passenger-facing ride/carpool interface.
- Driver mode is available at `/driver` for `matatu-driver` and `carpool-driver` roles.
- Carpool pricing no longer has a driver-entered arbitrary amount.
- Fuel contribution is calculated from distance, fuel consumption and fuel price.
- Current prototype assumptions: 8 litres/100 km and KES 190/litre.
- Daily carpool publishing limit is currently two commutes per day and persisted in browser local storage.
- The app states that this is cost-sharing, not profit or a commercial taxi/PSV service.
- This is a product safeguard, not a legal guarantee. A backend must enforce limits in production.

### Driver mode

`src/pages/Driver.tsx` contains the current pilot driver workspace. It:

- Separates passenger and driver access by role.
- Uses browser geolocation when available, with demo coordinates as fallback.
- Broadcasts demo location through browser local storage/events.
- Tracks route label and available seats.
- Shows position and last broadcast time.
- Adds readiness attestations for licence, insurance, roadworthiness and location consent.
- Blocks starting the broadcast until all readiness checkboxes are selected.
- Clearly says that prototype attestations are not document verification.

Production needs server-side identity, vehicle, insurance and roadworthiness verification before exposing a driver to passengers.

## Legal research findings

This is not legal advice. Before public transport or paid carpool launch, obtain Kenyan legal advice and an insurance broker review.

### Transport

The Kenya Traffic Act defines a public service vehicle broadly, including vehicles carrying passengers for hire or reward. It has licensing requirements for PSVs and specific matatu inspection/licensing conditions.

Relevant source:

- https://kenyalaw.org/akn/ke/act/1953/39/eng@2024-04-26

The 2022 NTSA Transport Network Companies, Owners, Drivers and Passengers Regulations apply to transport-network services offered through platforms. The reviewed summary identifies valid vehicle insurance, roadworthiness, privacy measures, and limits on continuous driver service.

Relevant source:

- https://digitallabour.ilo.org/legislation/national-transport-and-safety-authority-transport-network-companies-owners-drivers-and

### Insurance

Third-party motor insurance is mandatory for road use. Kenya's insurance certificate rules distinguish vehicles used for fare-paying passengers/private or public hire from private vehicles used for social, domestic and leisure purposes. The policy must match actual vehicle use.

Relevant source:

- https://kenyalaw.org/akn/ke/act/ln/1999/10/eng@2022-12-31

A trip cap or fuel split does not automatically make carpooling lawful or guarantee that a private motor policy covers passengers. The production version must get insurer confirmation and legal review of the operating model.

### Data protection

Live coordinates, driver identity, vehicle identifiers, bookings and household profiles are personal data. The app needs a privacy notice, specific location consent, purpose limitation, retention limits, access controls, deletion/export procedures, breach handling and role-based location visibility.

Do not collect children’s identities merely to create a family shopping template. Use age bands or anonymous household settings unless there is a clear lawful basis and appropriate safeguards.

Relevant source:

- https://www.odpc.go.ke/

### Market data and scraping

Do not scrape DealMtaani or Money254 merely because pages are publicly reachable. DealMtaani’s reviewed terms disclaim price accuracy, protect original content and prohibit abusive scraping/crawling. Safe options are:

1. written data licence or partner feed;
2. retailer-provided catalogue/API under its terms;
3. retailer-submitted prices;
4. moderated user-submitted shelf checks with branch/date/source;
5. seeded demo prices clearly labelled as indicative.

Relevant source:

- https://dealmtaani.co.ke/terms-of-service

The Market page should link to source material for attribution but must not imply permission to copy or scrape. Prices need source, branch/region, pack size, timestamp and a “verify before purchase” notice.

## Key files

- `src/App.tsx` — route wiring and role-aware navigation.
- `src/components/Onboarding.tsx` — passenger, matatu-driver and carpool-driver role onboarding.
- `src/pages/Ma3.tsx` — main Move transit page.
- `src/pages/Market.tsx` — Smart Shopping Planner and indicative price comparison.
- `src/pages/Ndai.tsx` — passenger ride/carpool page.
- `src/pages/Driver.tsx` — driver mode and current readiness gates.
- `src/index.css` — global traffic-light tokens and iOS-inspired glass styling.
- `src/lib/journey.ts` — route calculation.
- `src/lib/firebase.ts` — Firebase scaffolding.
- `docs/driver-architecture.md` — passenger/driver architecture and production GPS handoff.
- `docs/legal-compliance.md` — legal and data-use checklist.
- `research/open-data-legal-findings.md` — existing open-data/legal research.
- `/home/ubuntu/manus-slides/ma3-move-market-mirth-mub2f612-c4061a46/` — 10-slide HTML presentation work.

## Immediate next steps in a new chat

1. Run `npm run build` after the latest `Market.tsx` and `Driver.tsx` edits.
2. Fix any TypeScript or JSX errors.
3. Run an app-wide emoji scan and convert remaining visual emoji to Lucide icons where appropriate.
4. Commit and push the Market/legal/Driver changes.
5. Test `/market`, `/ndai`, `/driver` and the role onboarding flow in the browser.
6. Add a backend verification model before real driver broadcasts:
   - `driverVerificationStatus`
   - `vehicleVerificationStatus`
   - `insuranceExpiry`
   - `roadworthinessExpiry`
   - `locationConsentAt`
   - server-side carpool daily count
7. Add privacy notice and explicit location-sharing controls.
8. Decide whether to pilot with partner Saccos or keep all transport data in demo mode.

## Commands for the user’s Windows VS Code clone

```powershell
cd "C:\Users\denni\OneDrive\Desktop\project 2\ma3-navigator (1)"
git fetch origin
git pull --ff-only origin main
npm install
npm run build
npm run dev
```

Open:

- `http://localhost:3000/market`
- `http://localhost:3000/ndai`
- `http://localhost:3000/driver`

Do not apply the old patch files. The repository is now the source of truth. If the working tree has local changes, save them or commit them before pulling.
