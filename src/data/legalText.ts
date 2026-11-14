// DRAFT legal text written in plain language. Have a Kenyan lawyer check it before you open the app to the public.
// Replace the three [square bracket] items below, then delete the DRAFT banner in src/pages/Legal.tsx.
export const OWNER_NAME = "[Your name or registered business name]";
export const OWNER_CONTACT = "[Your contact email]";
export const OWNER_PLACE = "[Your business address, Nairobi, Kenya]";
export const LEGAL_UPDATED = "November 2026";

export type LegalSection = { title: string; body: string[] };

export const PRIVACY: LegalSection[] = [
  { title: "Who we are", body: [`Ma3 Navigator ("Ma3", "we") is run by ${OWNER_NAME}, ${OWNER_PLACE}. You can reach us at ${OWNER_CONTACT}. We are the data controller for the personal information described here and we follow the Data Protection Act, 2019 of Kenya.`] },
  { title: "What we collect and why", body: [
    "Account details: if you sign in with Google we receive your name, email and profile picture. If you sign in with a phone number we receive that number. We use these to keep your account and your saved things safe. Guests can browse without an account.",
    "Location: only when you allow your phone to share it. We use it to show nearby stops, stores and places, and to follow a trip. Drivers and tour-van owners who choose to go live share their latest position only while live. We keep only the latest point, not a history, and it disappears shortly after they stop.",
    "Things you create: saved routes, fares you log, driver earnings you log, shopping baskets, photos and business listings you upload, votes and game scores. Saved routes, fares and earnings are private to you.",
    "Orders: your phone number and delivery note, so that we can deliver and contact you about the order.",
    "Technical data: basic device and error information so that we can fix problems."] },
  { title: "Legal basis", body: ["We process your information because you consent (for example when you share location or tick the box at checkout), to carry out what you ask (such as an order), and for our legitimate interest in keeping the app secure. You can withdraw consent at any time by turning off location sharing, removing a listing, or asking us to delete your data."] },
  { title: "Who we share it with", body: [
    "We do not sell your personal information.",
    "Service providers that run the app for us: Supabase (database, sign-in and file storage), Vercel (website hosting) and Google (sign-in). When card or M-Pesa payments are switched on, Safaricom M-Pesa will process payment details. Flight price searches send only the airports and date you search.",
    "Public information: the name, description, photos, phone number and location of a business you list, and a photo you add to a place, are shown to other users while the listing is active. Do not put information in a listing that you do not want to be public.",
    "We may disclose information when the law requires it."] },
  { title: "How long we keep it", body: ["Live location points expire within minutes. Orders are kept for as long as needed for delivery, support and tax records. Other information is kept until you delete it or ask us to delete your account."] },
  { title: "Your rights", body: ["Under the Data Protection Act you may ask to see your information, correct it, delete it, object to how we use it, or receive a copy. Email us and we will reply within a reasonable time. If you are unhappy you may complain to the Office of the Data Protection Commissioner of Kenya."] },
  { title: "Children", body: ["Ma3 is for people aged 18 and over. People under 18 should use it with a parent or guardian, and may not list a business or take payments."] },
  { title: "Security", body: ["Information is stored with access rules so that people can only see what they are allowed to see. No system is perfectly secure, so please keep your sign-in details safe."] },
  { title: "Changes", body: [`We may update this notice. The date at the top of this page shows the latest version (${LEGAL_UPDATED}).`] },
];

export const TERMS: LegalSection[] = [
  { title: "Using Ma3", body: [`These terms are between you and ${OWNER_NAME}. By using the app you agree to them. The app is an early version. Some parts are demonstrations: matatu positions, driver matching and payments may be switched off or simulated, and the app says so where this applies.`] },
  { title: "Information is a guide", body: ["Routes, stops, fares, prices, flights and train times come from public and partner sources and may be out of date. Always check with the operator, shop or airline before you rely on them. Booking flights or trains happens on the operator's own site, not in Ma3."] },
  { title: "Your account and behaviour", body: ["Keep your sign-in safe and give true information. Do not use Ma3 to break the law, harass others, post false or harmful content, copy the app or attack its systems. We may remove content or suspend accounts that break these terms."] },
  { title: "Drivers, tour vans and businesses", body: [
    "If you offer a transport or tour service you must hold every licence the law requires (for example NTSA/PSV for passenger vehicles and Tourism Regulatory Authority for tours) and keep your vehicle insured and roadworthy. The licence number you give must be true. Ma3 does not check or guarantee your documents and is not your employer or insurer.",
    "Carpool is for sharing fuel costs only. Do not use it to carry passengers for hire without the right licence.",
    "A business listing must be accurate and lawful. The listing fee keeps the listing visible for the period shown. We may remove a listing that is false or unlawful."] },
  { title: "Photos and content you upload", body: ["Only upload photos and text you own or have permission to use. You give Ma3 permission to show them in the app while your listing or photo is active. You can remove them at any time. We may take down content that breaks the law or other people's rights."] },
  { title: "Points and games", body: ["Game points and Route King medals are for fun. They have no cash value, cannot be sold or transferred, and may be used only for features the app offers, such as showing a place photo. There is no betting and no cash prize. We may correct or remove points gained by cheating."] },
  { title: "Nganya products and the community list", body: ["Product ideas shown as \"Coming soon\" are not for sale. The Ma3 Community List is a free list of people interested in a future matatu-community group. It is not a registered sacco, it takes no money and promises no benefits."] },
  { title: "Third-party links", body: ["Links to airlines, Kenya Railways, maps, payment providers and other sites are provided for convenience. Those sites have their own terms and we are not responsible for them."] },
  { title: "Our responsibility", body: ["We work to keep Ma3 useful and safe, but we provide it as is. To the extent the law allows, we are not responsible for losses that come from relying on information in the app, from outages, or from dealings between users and operators. Nothing in these terms limits any right you have under Kenyan consumer law."] },
  { title: "Law and contact", body: [`These terms are governed by the laws of Kenya. Questions: ${OWNER_CONTACT}.`] },
];

export const SHOP: LegalSection[] = [
  { title: "Before launch", body: ["Nganya products marked \"Coming soon\" cannot be ordered. They become available only when we publish a price, stock and confirmed artwork rights."] },
  { title: "Orders and prices", body: ["Prices are in Kenya shillings and shown before you order. The price is checked again on our server when you place the order. An order is confirmed only when we confirm it. If a product runs out we will tell you and refund anything you have paid."] },
  { title: "Payment", body: ["While payments are in demonstration mode nothing is charged. When M-Pesa is switched on you will see the exact amount and pay on your own phone."] },
  { title: "Delivery", body: ["We will contact you on the phone number you give to agree delivery. Delivery time and any delivery fee will be told to you before you pay."] },
  { title: "Faulty or wrong items", body: ["Goods must be as described and of acceptable quality. If an item is faulty or not as described, contact us and we will repair, replace or refund it as Kenyan consumer law requires."] },
  { title: "Artwork", body: ["Nganya artwork on products is used only with the written permission of the artist and the vehicle owner. Product pages show the artwork rights status."] },
  { title: "Your information", body: ["We use your phone number and delivery note only to handle your order. See the Privacy notice."] },
];
