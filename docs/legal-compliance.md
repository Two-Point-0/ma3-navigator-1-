# Ma3 legal and data-use checklist

This is a product-risk checklist, not legal advice. Before a public transport or carpool launch in Kenya, have a Kenyan transport lawyer and insurance broker review the exact operating model.

## What Ma3 can do in the MVP

Ma3 can provide route discovery, indicative fare information, user-submitted or permissioned route data, a demo driver mode, and a cost-sharing planner that is clearly labelled as a pilot. The app should not represent a driver as verified, available for hire, insured, or legally authorised unless Ma3 has checked the relevant records.

It can also show indicative supermarket prices if the data is either supplied under permission, obtained from an approved feed, provided by a retailer, or entered by users with timestamps and a source. The app should link to the source, identify when the value was checked, and tell the user to confirm before purchase.

## What is required before real passenger transport

The Traffic Act defines a public service vehicle broadly, including a vehicle licensed to carry passengers for hire or reward and a vehicle carrying passengers for hire or reward. It also sets a licensing route for PSVs and specific conditions for matatus, including inspection. [1]

Third-party motor insurance is mandatory for road use. Kenya's insurance certificate rules distinguish vehicles carrying fare-paying passengers, private-hire/public-hire vehicles, and private social/domestic/leisure vehicles. The policy and certificate must match the vehicle's actual use. [2]

The 2022 transport-network regulations apply to transport-network services offered through platforms. Their requirements include valid vehicle insurance, a roadworthiness certificate, platform privacy measures, and limits on continuous driver service. [3]

Therefore the production app must not launch public matatu booking, taxi-like booking, or paid ride matching until Ma3 has completed at least:

- driver identity and licence verification;
- vehicle registration and ownership/authorisation checks;
- insurance verification for the actual passenger-carrying use;
- roadworthiness and inspection checks;
- Sacco or operator authorisation where relevant;
- a decision with counsel on whether the service is a PSV, transport-network service, private hire, or genuine non-commercial carpool;
- terms, complaints, cancellation, incident and safety procedures.

These are not optional UI suggestions. The app can display a demo, but the backend must block public matching when verification has expired or is missing.

## Carpooling boundary

A daily posting cap and a fuel split are useful controls, but they do not themselves create a legal exemption. The safe product position is to keep carpooling limited to genuine shared journeys, calculate a transparent cost share from fuel and route distance, prohibit a driver-set markup, avoid surge pricing and commissions, cap frequency on the backend, and stop describing the feature as a taxi or ride-hailing service.

Insurance must still be confirmed with the driver's insurer because a private social/domestic policy may not cover every passenger-sharing use. If counsel or an insurer treats the service as hire/reward or transport-network activity, the appropriate commercial/PSV insurance and licensing route applies.

## Location and personal data

Live coordinates, driver identity, vehicle identifiers, passenger bookings and household profiles are personal data. ODPC describes controllers and processors and provides registration and data-subject rights channels. [4]

The production system should therefore use a privacy notice, specific location consent, purpose limitation, short retention, access controls, deletion/export requests, breach procedures, and a clear distinction between a driver location visible to a booked passenger and a location visible to the public. Do not collect children's identities merely to build a family shopping template; use age bands or an anonymous household profile instead.

## Third-party price data

Do not scrape DealMtaani or Money254 merely because their pages are public. DealMtaani's terms say prices may be sourced from third-party retailers, disclaim accuracy, reserve intellectual-property rights, and prohibit scraping or crawling that creates unreasonable load. [5]

Ma3's safe options are:

1. obtain a written data licence or feed from the publisher or retailer;
2. use retailer-provided catalogues or APIs under their terms;
3. accept user-submitted shelf checks with source, branch, date and moderation;
4. show links to the publisher and use only facts that the licence permits;
5. keep seeded demo values clearly labelled as indicative, not current or guaranteed.

The new Market page follows option five and provides links for reference. It does not claim that Ma3 has copied or scraped current DealMtaani or Money254 data.

## Product changes implemented

- Driver readiness now needs to be treated as a verification gate before real location visibility.
- Carpool pricing is fuel-cost sharing only, with no manual profit field and a daily publishing limit.
- Market templates cover bachelor, family and school profiles.
- Market values are labelled indicative and include a source-use warning.
- Emojis in the updated Market and Ndai interfaces are replaced by Lucide icons.

## References

[1]: https://kenyalaw.org/akn/ke/act/1953/39/eng@2024-04-26 "Traffic Act, Kenya Law"
[2]: https://kenyalaw.org/akn/ke/act/ln/1999/10/eng@2022-12-31 "Insurance (Motor Vehicles Third Party Risks) (Certificate of Insurance) Rules, Kenya Law"
[3]: https://digitallabour.ilo.org/legislation/national-transport-and-safety-authority-transport-network-companies-owners-drivers-and "NTSA Transport Network Companies Regulations summary, ILO Digital Labour Platform Tracker"
[4]: https://www.odpc.go.ke/ "Office of the Data Protection Commissioner, Kenya"
[5]: https://dealmtaani.co.ke/terms-of-service "DealMtaani Terms of Service"
