# Legal review brief: what to take to a Kenyan lawyer

This is a plain checklist, not legal advice. It lists what the app does today and what a lawyer should confirm before any real money moves.

## What the app does now (and what it does NOT do)
- Nganya products show "Coming soon". A product can only be bought when it has a price, stock, status `active` AND `rights_status = cleared` (set by you, by hand, after the artist licence is signed).
- Every order records the planned split (70% app, 15% route group, 15% matatu owner) as **held**. Nothing is paid out. `payout_status` stays `held` until you change it.
- "Ma3 Community List" is a free interest list. It takes no money and promises no benefits.
- Listing fees and photo fees run in demo mode. The switch is `app_settings.demo_payments`. Set it to `false` before launch and real payments must be connected.
- Tour and transport businesses must give a licence number. You still verify it by hand (`licence_verified`).
- Checkout needs a tick for terms and the privacy notice.

## Questions for the lawyer
1. **Sacco rules (SACCO Societies Act, SASRA).** Only a registered society may collect member deposits or share profit with members. Is paying 15% to a "route sacco" lawful as a commercial commission to a registered society, and what must that society look like? Until then, keep it an interest list.
2. **Agreements (see `legal_agreements`).** Artist licence (rights to print the artwork on products), vehicle-owner agreement (why the owner gets 15%), route sacco agreement, platform terms. Who signs, and what does each say about the split?
3. **Nganya artwork and likeness.** Who owns the livery art? Do you need a licence from the artist and the owner for each design? Any trademark or copyright issues with matatu names and logos?
4. **Consumer protection.** Returns, refunds, delivery terms, and the shop terms text that the checkbox points to. (Consumer Protection Act, 2012.)
5. **Data protection.** Phone numbers, location and photos. Do you need to register with the Data Protection Commissioner (Data Protection Act, 2019)? Privacy notice wording. Retention of location data (the app keeps only the latest point).
6. **Transport and tours.** Matatu route broadcasts need the vehicle to be NTSA/PSV compliant. Tour vans need the Tourism Regulatory Authority licence. Carpool must stay cost-sharing, not hire-and-reward.
7. **Promotions and games.** Game points have no cash value and no betting. Confirm this keeps you outside gambling rules (Betting, Lotteries and Gaming Act).
8. **Payments.** M-Pesa Daraja terms, and whether holding customers' money makes you a payment service provider (National Payment System Act). A licensed partner may be safer.
9. **NFT idea.** Not built. Ask before any token or collectible with resale value.
10. **Tax.** VAT, income tax and digital service tax on your share of sales and listing fees.

## Before launch checklist
- [ ] Agreements signed, then add rows to `legal_agreements` and set `verified = true`.
- [ ] Set `rights_status = cleared` only on products whose artwork licence is signed.
- [ ] Terms and privacy text written by the lawyer and linked at checkout.
- [ ] `app_settings.demo_payments` set to `false` and real M-Pesa connected.
- [ ] Payouts approved by hand (`payout_status = approved`) only after verification.
