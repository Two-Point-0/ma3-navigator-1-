# Local business posters (100 demo businesses)

Each business is a pin on Market > Local. Tap the pin and its poster opens full screen.

## Steps
1. Open `docs/local-poster-prompts.txt`. Paste the MASTER STYLE into Stitch once, then each business line.
2. Save each picture with the exact file name (example `mama-njeri-mboga.png`). Landscape 3:2, JPG, under 300 KB.
3. Supabase > **Storage** > bucket **business-images**. Click **Create folder**, name it `demo`, open it, then drag all the pictures in.
4. Supabase > **SQL Editor** > new snippet. Paste `supabase/seed/demo_local_businesses.sql` > **Run**. (Log in to the app once first so an account exists.)
5. Open the live app > Market > Local. The pins appear around Nairobi. Tap one to see its poster.

A real owner later registers in the app and uploads their own photo, which becomes their poster.

## The 100 businesses

| # | File | Business | Type | Area |
|---|---|---|---|---|
| 1 | mama-njeri-mboga.png | Mama Njeri Mboga | mboga | Kawangware |
| 2 | mama-wanjiru-fresh-greens.png | Mama Wanjiru Fresh Greens | mboga | Githurai |
| 3 | mama-achieng-veggies.png | Mama Achieng Veggies | mboga | Kibera |
| 4 | mama-atieno-stall.png | Mama Atieno Stall | mboga | Umoja |
| 5 | kamau-and-sons-greens.png | Kamau and Sons Greens | mboga | Kasarani |
| 6 | fruit-basket-corner.png | Fruit Basket Corner | fruits | CBD |
| 7 | tropical-fruit-stand.png | Tropical Fruit Stand | fruits | Westlands |
| 8 | matunda-fresh.png | Matunda Fresh | fruits | Buruburu |
| 9 | kamau-butchery.png | Kamau Butchery | butchery | Kawangware |
| 10 | choma-zone-butchery.png | Choma Zone Butchery | butchery | Ngong Road |
| 11 | mwangi-meat-hub.png | Mwangi Meat Hub | butchery | Embakasi |
| 12 | fresh-cuts-butchery.png | Fresh Cuts Butchery | butchery | Rongai |
| 13 | nyama-mtaani.png | Nyama Mtaani | butchery | Kasarani |
| 14 | maziwa-fresh-dairy.png | Maziwa Fresh Dairy | dairy | Kikuyu |
| 15 | egg-basket.png | Egg Basket | dairy | Githurai |
| 16 | mama-pima-kibanda.png | Mama Pima Kibanda | food | CBD |
| 17 | mama-oliech-fish-joint.png | Mama Oliech Fish Joint | food | Kibera |
| 18 | chapo-corner.png | Chapo Corner | food | Eastleigh |
| 19 | nyama-choma-spot.png | Nyama Choma Spot | food | Kasarani |
| 20 | swahili-plate.png | Swahili Plate | food | Eastleigh |
| 21 | githeri-point.png | Githeri Point | food | Umoja |
| 22 | oven-fresh-bakery.png | Oven Fresh Bakery | bakery | Buruburu |
| 23 | mandazi-house.png | Mandazi House | bakery | Ruaka |
| 24 | sweet-crumbs.png | Sweet Crumbs | bakery | Karen |
| 25 | baraka-kiosk.png | Baraka Kiosk | kiosk | Githurai |
| 26 | jirani-shop.png | Jirani Shop | kiosk | Donholm |
| 27 | twende-mini-mart.png | Twende Mini Mart | kiosk | South B |
| 28 | mama-fua-wholesale.png | Mama Fua Wholesale | kiosk | Embakasi |
| 29 | duka-la-mtaa.png | Duka la Mtaa | kiosk | Roysambu |
| 30 | pesa-point-m-pesa-and-bank-agent.png | Pesa Point M-Pesa and Bank Agent | mpesa | CBD |
| 31 | haraka-agent.png | Haraka Agent | mpesa | Kawangware |
| 32 | salama-cash-agent.png | Salama Cash Agent | mpesa | Umoja |
| 33 | mtaani-pesa.png | Mtaani Pesa | mpesa | Kasarani |
| 34 | eastleigh-money-hub.png | Eastleigh Money Hub | mpesa | Eastleigh |
| 35 | safi-maji-water-vendor.png | Safi Maji Water Vendor | water | Kibera |
| 36 | maji-hub-refill-station.png | Maji Hub Refill Station | water | Kasarani |
| 37 | mama-maji.png | Mama Maji | water | Githurai |
| 38 | blue-drop-water-depot.png | Blue Drop Water Depot | water | Ruiru |
| 39 | shine-car-wash.png | Shine Car Wash | carwash | Westlands |
| 40 | mtaani-car-wash.png | Mtaani Car Wash | carwash | Umoja |
| 41 | jet-wash-hub.png | Jet Wash Hub | carwash | Mombasa Road |
| 42 | kings-car-wash.png | Kings Car Wash | carwash | Kitengela |
| 43 | iron-house-gym.png | Iron House Gym | gym | Kilimani |
| 44 | fit-mtaani.png | Fit Mtaani | gym | Kasarani |
| 45 | power-zone-gym.png | Power Zone Gym | gym | Rongai |
| 46 | core-fitness-studio.png | Core Fitness Studio | gym | Karen |
| 47 | glam-ladies-salon.png | Glam Ladies Salon | salon | Buruburu |
| 48 | crown-salon-and-spa.png | Crown Salon and Spa | salon | Kilimani |
| 49 | mama-wambui-salon.png | Mama Wambui Salon | salon | Kawangware |
| 50 | sharp-cuts-barbershop.png | Sharp Cuts Barbershop | salon | CBD |
| 51 | kinyozi-king.png | Kinyozi King | salon | Githurai |
| 52 | gentlemen-barber-lounge.png | Gentlemen Barber Lounge | salon | Westlands |
| 53 | mzee-cobbler.png | Mzee Cobbler | shoes | CBD |
| 54 | fundi-wa-viatu.png | Fundi wa Viatu | shoes | Kawangware |
| 55 | handmade-leather-sandals.png | Handmade Leather Sandals | shoes | Ngong Road |
| 56 | stitch-perfect-tailors.png | Stitch Perfect Tailors | tailor | Buruburu |
| 57 | mama-fatuma-tailor.png | Mama Fatuma Tailor | tailor | Eastleigh |
| 58 | kitenge-corner.png | Kitenge Corner | tailor | Kikuyu |
| 59 | uniform-hub.png | Uniform Hub | tailor | Umoja |
| 60 | fundi-garage.png | Fundi Garage | mechanic | Mombasa Road |
| 61 | jua-kali-auto.png | Jua Kali Auto | mechanic | Kasarani |
| 62 | boda-fix.png | Boda Fix | mechanic | Githurai |
| 63 | quick-tyres-and-alignment.png | Quick Tyres and Alignment | mechanic | Westlands |
| 64 | simu-fix.png | Simu Fix | phone | CBD |
| 65 | mtaani-phone-shop.png | Mtaani Phone Shop | phone | Umoja |
| 66 | digital-corner.png | Digital Corner | phone | Eastleigh |
| 67 | charge-and-go.png | Charge and Go | phone | Kasarani |
| 68 | msingi-hardware.png | Msingi Hardware | hardware | Embakasi |
| 69 | mabati-and-more.png | Mabati and More | hardware | Ruiru |
| 70 | rafiki-hardware.png | Rafiki Hardware | hardware | Rongai |
| 71 | afya-chemist.png | Afya Chemist | pharmacy | Buruburu |
| 72 | jirani-pharmacy.png | Jirani Pharmacy | pharmacy | Kasarani |
| 73 | zuri-chemist.png | Zuri Chemist | pharmacy | Kikuyu |
| 74 | net-point-cyber.png | Net Point Cyber | cyber | CBD |
| 75 | click-cyber-cafe.png | Click Cyber Cafe | cyber | Kasarani |
| 76 | easy-print.png | Easy Print | cyber | Westlands |
| 77 | safi-laundry.png | Safi Laundry | laundry | Kilimani |
| 78 | mama-fua.png | Mama Fua | laundry | Umoja |
| 79 | quick-dry-cleaners.png | Quick Dry Cleaners | laundry | Karen |
| 80 | stage-boda-riders.png | Stage Boda Riders | transport | Githurai |
| 81 | kawangware-boda-stage.png | Kawangware Boda Stage | transport | Kawangware |
| 82 | rongai-rides.png | Rongai Rides | transport | Rongai |
| 83 | corner-pub.png | Corner Pub | bar | Roysambu |
| 84 | rhumba-lounge.png | Rhumba Lounge | bar | Westlands |
| 85 | shamba-direct.png | Shamba Direct | farm | Kikuyu |
| 86 | green-valley-produce.png | Green Valley Produce | farm | Ruiru |
| 87 | umeme-fundi.png | Umeme Fundi | electrical | Embakasi |
| 88 | bright-sparks-electricals.png | Bright Sparks Electricals | electrical | Kasarani |
| 89 | jiko-gas-refill.png | Jiko Gas Refill | gas | Githurai |
| 90 | moto-gas.png | Moto Gas | gas | Umoja |
| 91 | mtaani-gas-depot.png | Mtaani Gas Depot | gas | Kitengela |
| 92 | picha-studio.png | Picha Studio | photo | CBD |
| 93 | moment-photography.png | Moment Photography | photo | Kilimani |
| 94 | tent-and-chairs-hire.png | Tent and Chairs Hire | events | Ruiru |
| 95 | little-stars-daycare.png | Little Stars Daycare | daycare | Buruburu |
| 96 | afya-bora-clinic.png | Afya Bora Clinic | clinic | Githurai |
| 97 | savannah-day-trips.png | Savannah Day Trips | tours | Westlands |
| 98 | mara-escapes.png | Mara Escapes | tours | Karen |
| 99 | ngong-hills-guide.png | Ngong Hills Guide | other | Ngong Road |
| 100 | print-and-brand.png | Print and Brand | other | Eastleigh |
