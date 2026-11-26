// Curated Kenyan tourist sights. One page per sight (and one per park gate).
// Pins and pages come from THIS file, so they work even before any database import.
// Entry fees below are adult, per day, from the KWS tariff in force from 1 Oct 2025 (and Narok County's 2026 Mara rates). Fees change: the page tells visitors to confirm on the official site.
export type SightKind = "park" | "reserve" | "museum" | "heritage" | "lake" | "mountain" | "beach" | "culture" | "wildlife";

export interface Sight {
  id: string; name: string; kind: SightKind; county: string; lat: number; lon: number;
  /** 3 = world famous, 1 = good to know. Decides which sights pop up first along a flight. */
  fame: 1 | 2 | 3;
  summary: string; highlights: string[]; bestTime: string; fee: string; hours: string; tips: string[]; gettingThere: string; website?: string;
  gates?: { id: string; name: string; lat: number; lon: number; note: string }[];
}

/** One searchable entry: a sight, or one gate of a sight. Gates have their own pin and page. */
export interface SightEntry extends Sight { parentId?: string; gateName?: string; gateNote?: string; approx?: boolean }

const KWS = "https://www.kws.go.ke";
const PARK_HOURS = "Gates 6:00 am – 6:00 pm";
const KWS_FEE = "KSh 1,000 citizen · KSh 1,350 resident · USD 80 non-resident (adult, per day, KWS Oct 2025)";

export const SIGHTS: Sight[] = [
  { id: "maasai-mara", name: "Maasai Mara National Reserve", kind: "reserve", county: "Narok", lat: -1.49, lon: 35.144, fame: 3,
    summary: "Kenya's most famous safari reserve: endless savannah, big cats all year, and the Great Migration of wildebeest crossing the Mara River.",
    highlights: ["Great Migration river crossings (roughly July – October)", "Lions, leopards, cheetahs and the Big Five", "Hot-air balloon safaris at sunrise", "Visit a Maasai village (agree the fee first)"],
    bestTime: "July – October for the migration; the rest of the year is quieter and cheaper.", fee: "Narok County 2026 (1 Jul – 31 Dec): KSh 3,000 citizen · USD 200 non-resident (adult, per day). Mara Triangle charges separately.",
    hours: "Entry from 6:00 am, exit by 6:00 pm", tips: ["Book a lodge or conservancy stay early for July – September.", "Sekenani is the busiest gate; Talek and Musiara are quieter."],
    gettingThere: "About 5 – 6 hours by road from Nairobi via Narok, or a 45-minute flight from Wilson Airport (WIL) to the Mara airstrips.", website: "https://www.maasaimara.travel/",
    gates: [
      { id: "sekenani", name: "Sekenani Gate", lat: -1.5433, lon: 35.2711, note: "Eastern gate on the main road from Narok. The easiest and busiest entrance." },
      { id: "talek", name: "Talek Gate", lat: -1.4283, lon: 35.1118, note: "North-western gate beside the Talek River, close to many camps." },
      { id: "musiara", name: "Musiara Gate", lat: -1.4069, lon: 35.1631, note: "Northern gate, best for the Mara River and Marsh pride." },
      { id: "oloololo", name: "Oloololo Gate", lat: -1.3944, lon: 35.0372, note: "Entrance to the Mara Triangle (run by the Mara Conservancy), famous for the Mara River crossings." },
      { id: "oloolaimutiek", name: "Oloolaimutiek Gate", lat: -1.5436, lon: 35.3858, note: "Quiet eastern gate in the hills, a good way in from the Nairobi side." },
    ] },
  { id: "amboseli", name: "Amboseli National Park", kind: "park", county: "Kajiado", lat: -2.6527, lon: 37.2606, fame: 3,
    summary: "Big elephant herds with Mount Kilimanjaro rising behind them. The best place in Kenya for that photo.",
    highlights: ["Large elephant herds against Kilimanjaro", "Observation Hill for a view over the swamps", "Maasai culture nearby", "Over 400 bird species"],
    bestTime: "June – October and January – February (dry months, clearer mountain views, especially at sunrise).", fee: "KSh 1,500 citizen · KSh 2,025 resident · USD 90 non-resident (adult, per day, KWS Oct 2025)",
    hours: PARK_HOURS, tips: ["Kilimanjaro is clearest early in the morning; clouds usually cover it by midday.", "Roads are dusty: bring a scarf and a camera cover."],
    gettingThere: "About 4 – 5 hours by road from Nairobi via Emali or Namanga, or fly from Wilson Airport (WIL) to Amboseli airstrip.", website: `${KWS}/park/amboseli-national-park/`,
    gates: [
      { id: "meshanani", name: "Meshanani Gate", lat: -2.5772, lon: 37.1272, note: "North-western gate near Lake Amboseli. Closest to Namanga on the Nairobi – Arusha road." },
      { id: "iremito", name: "Iremito Gate", lat: -2.6736, lon: 37.4642, note: "Eastern gate with the KWS offices and the most facilities. Reached via Emali." },
      { id: "kimana", name: "Kimana Gate", lat: -2.7861, lon: 37.3667, note: "South-eastern gate near the park headquarters. Old and busy, with most lodges close by." },
      { id: "kitirua", name: "Kitirua Gate", lat: -2.8167, lon: 37.1167, note: "Remote south-western gate with close views of Kilimanjaro. Mostly used by guests from Tanzania." },
    ] },
  { id: "nairobi-national-park", name: "Nairobi National Park", kind: "park", county: "Nairobi", lat: -1.3733, lon: 36.8583, fame: 3,
    summary: "A real wildlife park on the edge of the city: lions, rhinos and giraffes with skyscrapers in the background.",
    highlights: ["Black rhinos, lions, giraffes, buffaloes", "Skyline-and-wildlife photos", "Safari Walk and Animal Orphanage near the main gate", "Hippo pools and picnic sites"],
    bestTime: "Year-round; dry months (June – October, January – February) make animals easier to spot.", fee: KWS_FEE,
    hours: PARK_HOURS, tips: ["Go early (6:00 am) for the best chance of seeing lions.", "A half-day is enough; you can be back in town for lunch."],
    gettingThere: "About 7 km from the city centre. Matatu or Ndai to Langata Road, then a taxi or tour vehicle into the park. Close to Wilson Airport (WIL).", website: `${KWS}/park/nairobi-national-park/`,
    gates: [
      { id: "main", name: "Main Gate (Langata Road)", lat: -1.3619, lon: 36.8131, note: "The principal entrance, near KWS headquarters, the Safari Walk and the Animal Orphanage." },
      { id: "east", name: "East Gate (Athi River)", lat: -1.3917, lon: 36.9361, note: "Handy for JKIA airport and the Athi Basin dams." },
      { id: "langata", name: "Langata Gate", lat: -1.3817, lon: 36.7747, note: "South-western gate near Karen and Ngong Road." },
    ] },
  { id: "tsavo-east", name: "Tsavo East National Park", kind: "park", county: "Taita-Taveta / Kilifi", lat: -2.9, lon: 38.9, fame: 3,
    summary: "A huge, wild park known for red-dust elephants, the Galana River and the Yatta Plateau.",
    highlights: ["Red elephants dust-bathing", "Lugard Falls and the Galana River", "Aruba Dam wildlife", "Big prides of lions"],
    bestTime: "June – October and January – February.", fee: KWS_FEE, hours: PARK_HOURS,
    tips: ["Distances are long. Stay at least one night.", "The SGR train stops at Voi, the easiest base for the park."],
    gettingThere: "About 5 – 6 hours by road from Nairobi or Mombasa, or by SGR to Voi then a safari vehicle to the Voi Gate.", website: `${KWS}/park/tsavo-east-national-park/`,
    gates: [
      { id: "voi", name: "Voi Gate", lat: -3.3769, lon: 38.5789, note: "Main southern gate near Voi town and the SGR station." },
      { id: "manyani", name: "Manyani Gate", lat: -3.0, lon: 38.2167, note: "North-western gate on the Nairobi – Mombasa highway side." },
      { id: "sala", name: "Sala Gate", lat: -3.0167, lon: 39.2167, note: "Eastern gate used from Malindi and the coast." },
      { id: "buchuma", name: "Buchuma Gate", lat: -3.3833, lon: 39.1333, note: "South-eastern gate used by visitors from Mombasa." },
    ] },
  { id: "tsavo-west", name: "Tsavo West National Park", kind: "park", county: "Taita-Taveta", lat: -2.9833, lon: 38.0, fame: 3,
    summary: "Volcanic hills, lava flows and Mzima Springs, where hippos and fish can be watched from an underwater viewing chamber.",
    highlights: ["Mzima Springs hippos and crocodiles", "Shetani lava flow and caves", "Ngulia Rhino Sanctuary", "Chyulu Hills views"],
    bestTime: "June – October and January – February.", fee: KWS_FEE, hours: PARK_HOURS,
    tips: ["Combine with Tsavo East for a 3 – 4 day trip.", "Mzima Springs is best in the morning."],
    gettingThere: "About 3 – 4 hours from Nairobi via Mtito Andei on the Mombasa highway.", website: `${KWS}/park/tsavo-west-national-park/`,
    gates: [
      { id: "mtito-andei", name: "Mtito Andei Gate", lat: -2.6833, lon: 38.1667, note: "Northern gate right on the Nairobi – Mombasa highway. The easiest way in." },
      { id: "tsavo-gate", name: "Tsavo Gate", lat: -3.0, lon: 38.4833, note: "Eastern gate near the Tsavo River, towards Voi." },
      { id: "ziwani", name: "Ziwani Gate", lat: -3.3167, lon: 38.0167, note: "Southern gate near Lake Jipe, a quiet side of the park." },
    ] },
  { id: "lake-nakuru", name: "Lake Nakuru National Park", kind: "park", county: "Nakuru", lat: -0.3667, lon: 36.0833, fame: 3,
    summary: "A shallow soda lake with flamingos, plus a rhino sanctuary and Baboon Cliff viewpoint.",
    highlights: ["Flamingos and pelicans (numbers vary)", "Both black and white rhinos", "Baboon Cliff and Out of Africa viewpoints", "Rothschild's giraffes"],
    bestTime: "Year-round; birdlife is strongest in the dry months.", fee: "KSh 1,500 citizen · KSh 2,025 resident · USD 90 non-resident (adult, per day, KWS Oct 2025)",
    hours: PARK_HOURS, tips: ["Flamingo numbers change with the water level. Ask the rangers at the gate.", "A full day trip from Nairobi is possible but long; stay in Nakuru town if you can."],
    gettingThere: "About 2.5 – 3 hours from Nairobi via Naivasha. Matatus run to Nakuru town; then a taxi to the Main Gate.", website: `${KWS}/park/lake-nakuru-national-park/`,
    gates: [
      { id: "main", name: "Main Gate (Nakuru town)", lat: -0.3639, lon: 36.0953, note: "Closest to Nakuru town. The most used entrance." },
      { id: "lanet", name: "Lanet Gate", lat: -0.3342, lon: 36.1306, note: "Eastern gate near Lanet and the Nairobi side." },
      { id: "nderit", name: "Nderit Gate", lat: -0.4558, lon: 36.0672, note: "Southern gate, handy from the Naivasha road." },
    ] },
  { id: "hells-gate", name: "Hell's Gate National Park", kind: "park", county: "Nakuru", lat: -0.9, lon: 36.3167, fame: 2,
    summary: "Red cliffs, gorge walks and geothermal steam. One of the few Kenyan parks where you can cycle and walk among wildlife.",
    highlights: ["Cycle or walk among zebra and giraffe", "Hell's Gate Gorge walk", "Olkaria geothermal steam vents and spa", "Fischer's Tower rock column"],
    bestTime: "Dry months. Avoid the gorge if it has just rained (flash floods).", fee: "Check the KWS tariff for the current fee (about KSh 1,000 – 1,500 citizen).", hours: PARK_HOURS,
    tips: ["Hire a bicycle at the gate. Carry water and sunscreen.", "Hire a guide for the gorge."],
    gettingThere: "About 2 hours from Nairobi: matatu to Naivasha, then a boda or taxi to Elsa Gate.", website: `${KWS}/park/hells-gate-national-park/`,
    gates: [
      { id: "elsa", name: "Elsa Gate", lat: -0.8983, lon: 36.3419, note: "Main entrance on the Naivasha side, with bicycle hire." },
      { id: "olkaria", name: "Olkaria Gate", lat: -0.9094, lon: 36.2889, note: "Southern entrance near the geothermal plant and spa." },
    ] },
  { id: "mount-kenya", name: "Mount Kenya National Park", kind: "mountain", county: "Nyeri / Meru / Kirinyaga", lat: -0.1521, lon: 37.3084, fame: 3,
    summary: "Africa's second-highest mountain (5,199 m), a UNESCO World Heritage Site with glaciers, moorland and giant lobelias.",
    highlights: ["Point Lenana summit trek (4,985 m)", "Alpine lakes and waterfalls", "Sirimon, Naro Moru and Chogoria routes", "Elephants in the lower forest"],
    bestTime: "January – February and August – September.", fee: "Check the KWS tariff (mountain climbing fees apply per day).", hours: "Gates from 6:00 am. Treks are booked through KWS-registered operators.",
    tips: ["Allow 3 – 5 days for Lenana and acclimatise.", "Book a licensed guide and porter."],
    gettingThere: "About 3 – 4 hours from Nairobi to Naro Moru or Chogoria by road. Nanyuki has the nearest airstrip.", website: `${KWS}/park/mount-kenya-national-park/`,
    gates: [
      { id: "sirimon", name: "Sirimon Gate", lat: -0.0589, lon: 37.2517, note: "North-western trailhead (from Nanyuki). A gentle, popular route." },
      { id: "naro-moru", name: "Naro Moru Gate", lat: -0.1639, lon: 37.1569, note: "Western trailhead, the fastest and steepest route." },
      { id: "chogoria", name: "Chogoria Gate", lat: -0.2597, lon: 37.6317, note: "Eastern trailhead, the most scenic route past Lake Ellis." },
    ] },
  { id: "aberdare", name: "Aberdare National Park", kind: "park", county: "Nyandarua / Nyeri", lat: -0.4167, lon: 36.7167, fame: 2,
    summary: "Cool moorland, waterfalls and forest where elephants, buffalo and bongo live. Home of the tree-hotel lodges.",
    highlights: ["Gura and Karuru waterfalls", "Treetops and The Ark game-viewing lodges", "Rare bongo antelope and giant forest hog", "Cool, misty mountain scenery"],
    bestTime: "January – March and July – October.", fee: "KSh 800 citizen · KSh 1,100 resident · USD 70 non-resident (adult, per day, KWS Oct 2025)", hours: PARK_HOURS,
    tips: ["Roads need a 4x4 in the rain.", "The tree-hotels fill up: book ahead."],
    gettingThere: "About 3 hours from Nairobi via Nyeri or Naivasha.", website: `${KWS}/park/aberdare-national-park/`,
    gates: [
      { id: "matubio", name: "Matubio Gate", lat: -0.3881, lon: 36.7233, note: "Southern gate on the Nyahururu side, close to the waterfalls." },
      { id: "wilson", name: "Wanjohi Gate", lat: -0.5, lon: 36.5667, note: "South-western gate in the Kinangop area." },
      { id: "ruhuruini", name: "Ruhuruini Gate", lat: -0.3167, lon: 36.9333, note: "Eastern gate near Nyeri and Treetops." },
    ] },
  { id: "samburu", name: "Samburu National Reserve", kind: "reserve", county: "Samburu", lat: 0.5667, lon: 37.5333, fame: 2,
    summary: "A dry northern reserve with species you rarely see elsewhere: Grevy's zebra, reticulated giraffe, gerenuk and Somali ostrich.",
    highlights: ["The 'Samburu Special Five'", "Elephants along the Ewaso Nyiro River", "Leopards in riverside acacia", "Samburu culture"],
    bestTime: "June – October and December – March.", fee: "County reserve fees apply. Confirm with the reserve before travelling.", hours: "Gates from 6:00 am to 6:00 pm",
    tips: ["Buffalo Springs reserve is next door on the same ticket in many cases. Ask at the gate.", "It is hot: bring a hat and plenty of water."],
    gettingThere: "About 5 – 6 hours by road from Nairobi via Nanyuki and Isiolo, or fly to Samburu airstrip.", website: "https://www.samburutourism.com/",
    gates: [
      { id: "ngare-mara", name: "Ngare Mara Gate", lat: 0.6, lon: 37.5333, note: "Main entrance, reached from Isiolo." },
      { id: "buffalo-springs", name: "Buffalo Springs Gate", lat: 0.6167, lon: 37.45, note: "Western entrance via Buffalo Springs Reserve." },
    ] },
  { id: "ol-pejeta", name: "Ol Pejeta Conservancy", kind: "wildlife", county: "Laikipia", lat: 0.0057, lon: 36.9133, fame: 2,
    summary: "Home to the last northern white rhinos on Earth, plus a chimpanzee sanctuary and night drives.",
    highlights: ["The last two northern white rhinos (protected)", "Sweetwaters Chimpanzee Sanctuary", "Night game drives and walking safaris", "Lions, leopards, wild dogs"],
    bestTime: "June – October and January – February.", fee: "Conservancy fees apply (higher for non-residents). Check olpejetaconservancy.org.", hours: "6:00 am – 6:00 pm",
    tips: ["Book rhino encounters in advance.", "The conservancy is on the equator: stop for the line."],
    gettingThere: "About 3 hours from Nairobi via Nyeri and Nanyuki.", website: "https://www.olpejetaconservancy.org/" },
  { id: "meru", name: "Meru National Park", kind: "park", county: "Meru", lat: 0.0833, lon: 38.2167, fame: 1,
    summary: "A quiet, green park with rivers and swamps, where Joy Adamson released Elsa the lioness.",
    highlights: ["Rhino sanctuary", "Elsa's Kopje and the Adamson story", "Rivers and swamp birdlife", "Few visitors"],
    bestTime: "June – October and January – March.", fee: "KSh 800 citizen · KSh 1,100 resident · USD 70 non-resident (adult, per day, KWS Oct 2025)", hours: PARK_HOURS,
    tips: ["Good for a calm safari without crowds.", "Roads can be rough after the rains."],
    gettingThere: "About 6 hours by road from Nairobi or a short flight to the Mulika airstrip.", website: `${KWS}/park/meru-national-park/` },
  { id: "lake-naivasha", name: "Lake Naivasha", kind: "lake", county: "Nakuru", lat: -0.7667, lon: 36.35, fame: 2,
    summary: "A freshwater lake in the Rift Valley with hippos, boat rides and the walkable Crescent Island.",
    highlights: ["Boat ride among hippos", "Walk with giraffes and zebra on Crescent Island", "Fish eagles and birdlife", "Flower farms nearby"],
    bestTime: "Year-round.", fee: "Boat rides and island entry are charged separately by operators.", hours: "Daylight hours",
    tips: ["Agree the boat price before getting in.", "Pair with Hell's Gate and Mount Longonot."],
    gettingThere: "About 1.5 – 2 hours from Nairobi by road. Matatus run to Naivasha town.", website: "https://www.kws.go.ke" },
  { id: "mount-longonot", name: "Mount Longonot", kind: "mountain", county: "Nakuru", lat: -0.9167, lon: 36.45, fame: 2,
    summary: "A dormant volcano with a crater rim hike and a view over the Rift Valley.",
    highlights: ["Crater rim walk (about 7 – 9 km loop)", "Views of Lake Naivasha", "Buffalo, zebra and giraffe on the lower slopes", "Day trip from Nairobi"],
    bestTime: "Dry months, starting early in the morning.", fee: "Check the KWS tariff (national park entry).", hours: PARK_HOURS,
    tips: ["Start by 7:00 am to avoid midday heat.", "Wear proper shoes: the path is steep and loose."],
    gettingThere: "About 1.5 hours from Nairobi off the Nairobi – Naivasha highway. SGR stops at Longonot station.", website: `${KWS}/park/mount-longonot-national-park/` },
  { id: "lake-bogoria", name: "Lake Bogoria National Reserve", kind: "lake", county: "Baringo", lat: 0.2667, lon: 36.1, fame: 1,
    summary: "A hot-spring lake with geysers and large flamingo flocks.",
    highlights: ["Geysers and boiling hot springs", "Flamingos at the shore", "Greater kudu in the surrounding hills", "Hot-spring picnic spots"],
    bestTime: "June – October.", fee: "County reserve fees apply.", hours: "6:00 am – 6:00 pm", tips: ["Do not touch the spring water: it is boiling.", "Take a local guide."],
    gettingThere: "About 4 hours from Nairobi via Nakuru and Marigat." },
  { id: "kakamega-forest", name: "Kakamega Forest", kind: "reserve", county: "Kakamega", lat: 0.2833, lon: 34.8667, fame: 1,
    summary: "Kenya's last patch of equatorial rainforest, with monkeys, rare butterflies and hundreds of bird species.",
    highlights: ["Blue monkeys and red-tailed monkeys", "Sunrise at Isiukhu Falls", "Guided nature walks", "Rare birds such as the great blue turaco"],
    bestTime: "Dry months; for birds go early morning.", fee: "KFS / KWS forest fees apply.", hours: "6:00 am – 6:00 pm", tips: ["Hire a local guide for the best bird and primate sightings.", "Bring rain gear."],
    gettingThere: "About 6 – 7 hours from Nairobi, or fly to Kisumu then a 1.5-hour drive." },
  { id: "mount-elgon", name: "Mount Elgon National Park", kind: "mountain", county: "Bungoma / Trans Nzoia", lat: 1.1167, lon: 34.5833, fame: 1,
    summary: "An ancient extinct volcano on the Uganda border with huge caves where elephants once mined salt.",
    highlights: ["Kitum Cave", "Hot springs and hiking", "Sasa trail to Koitoboss peak", "Colobus monkeys"],
    bestTime: "June – August and December – March.", fee: "KWS tariff applies.", hours: PARK_HOURS, tips: ["Go with a ranger in the caves.", "It rains a lot. Bring warm clothes."],
    gettingThere: "About 8 hours from Nairobi, or fly to Eldoret then drive 3 hours." },
  { id: "lake-turkana", name: "Lake Turkana (Loiyangalani)", kind: "lake", county: "Marsabit / Turkana", lat: 2.75, lon: 36.7167, fame: 2,
    summary: "The 'Jade Sea': the world's largest desert lake, with a UNESCO-listed shoreline, wind farms and the Turkana, El Molo and Samburu peoples.",
    highlights: ["The jade-green lake", "Sibiloi National Park and Koobi Fora fossils", "El Molo village visits", "Desert Rose Lodge and the Lake Turkana Festival"],
    bestTime: "June – October, the Lake Turkana Festival is usually in May – June.", fee: "Park and community fees apply.", hours: "Daylight hours", tips: ["Travel in a 4x4 with a local guide.", "Carry water. It is very hot and windy."],
    gettingThere: "Very remote: 2 – 3 days by road from Nairobi, or charter flights to Loiyangalani." },
  { id: "thomsons-falls", name: "Thomson's Falls", kind: "heritage", county: "Nyandarua", lat: 0.0167, lon: 36.3667, fame: 1,
    summary: "A 74-metre waterfall at Nyahururu, Kenya's highest town.",
    highlights: ["The waterfall viewpoint", "Curio stalls", "Camel rides", "Cool climate and fresh air"],
    bestTime: "After the rains (April – June) for the most water.", fee: "Small entry fee.", hours: "Daylight hours", tips: ["Take the short path to the base only if the ground is dry.", "Combine with the Equator crossing at Nanyuki."],
    gettingThere: "About 3 hours from Nairobi via Nakuru." },
  { id: "nairobi-national-museum", name: "Nairobi National Museum", kind: "museum", county: "Nairobi", lat: -1.2742, lon: 36.814, fame: 2,
    summary: "Kenya's main museum: human origins (Turkana Boy), art, culture, birds and a snake park.",
    highlights: ["Hall of Mankind and the Turkana Boy replica", "Kenya art gallery", "Bird and mammal halls", "Snake park and botanic trail"],
    bestTime: "Any day. Quiet on weekday mornings.", fee: "KSh 200 – 300 citizen · KSh 1,200 non-resident (approx., check the official site)", hours: "About 8:30 am – 5:30 pm",
    tips: ["Allow 2 – 3 hours.", "The restaurant and craft shops are good for gifts."],
    gettingThere: "Museum Hill, 5 minutes from the CBD. Matatus on Muranga Road or a short Ndai ride.", website: "https://www.museums.or.ke/" },
  { id: "karen-blixen-museum", name: "Karen Blixen Museum", kind: "museum", county: "Nairobi", lat: -1.3523, lon: 36.7123, fame: 2,
    summary: "The farmhouse of the Danish writer of 'Out of Africa', preserved with its original furniture and gardens.",
    highlights: ["Guided house tour", "Coffee-farm gardens", "Ngong Hills views", "Film connection to Out of Africa"],
    bestTime: "Any day, mornings are quieter.", fee: "About KSh 1,000 non-resident, lower for citizens (check the museum site).", hours: "About 9:00 am – 5:30 pm",
    tips: ["Combine with Giraffe Centre and Kazuri Beads nearby.", "Photography is allowed outside."],
    gettingThere: "In Karen, about 12 km from the CBD. Matatu 111 or Ndai.", website: "https://www.museums.or.ke/" },
  { id: "giraffe-centre", name: "Giraffe Centre", kind: "wildlife", county: "Nairobi", lat: -1.3768, lon: 36.7463, fame: 3,
    summary: "A conservation centre where you can feed Rothschild's giraffes from a raised platform.",
    highlights: ["Hand-feed giraffes", "Nature trail with warthogs", "Education centre", "Breakfast at Giraffe Manor (guests only)"],
    bestTime: "Morning or late afternoon.", fee: "About KSh 1,500 non-resident, KSh 500 citizen (check the official site).", hours: "About 9:00 am – 5:00 pm",
    tips: ["Buy pellets at the gate.", "Weekends get crowded."],
    gettingThere: "In Langata, about 15 km from the CBD. Ndai or a matatu to Karen Road.", website: "https://www.giraffecentre.org/" },
  { id: "sheldrick-trust", name: "David Sheldrick Wildlife Trust", kind: "wildlife", county: "Nairobi", lat: -1.3567, lon: 36.7928, fame: 3,
    summary: "The orphan elephant nursery, open for one hour a day so you can watch the baby elephants being fed.",
    highlights: ["Baby elephants at mud-bath time", "Keepers explain each orphan's story", "Adopt an orphan online", "Rhino and giraffe orphans too"],
    bestTime: "Public visit is 11:00 am – 12:00 pm.", fee: "About KSh 1,000 per person (check the Trust's website).", hours: "11:00 am – 12:00 pm daily",
    tips: ["Arrive 15 minutes early.", "Private visits can be booked in advance."],
    gettingThere: "Near the Nairobi National Park Main Gate, about 8 km from the CBD.", website: "https://www.sheldrickwildlifetrust.org/" },
  { id: "bomas-of-kenya", name: "Bomas of Kenya", kind: "culture", county: "Nairobi", lat: -1.3436, lon: 36.7597, fame: 1,
    summary: "Traditional homesteads of Kenya's communities with daily dance and music shows.",
    highlights: ["Dance performances from different communities", "Replica traditional homesteads", "Craft stalls", "Ranked as one of the best cultural shows in the country"],
    bestTime: "Afternoon shows on weekdays and weekends.", fee: "Check the venue for current show prices.", hours: "Shows usually around 2:30 – 4:00 pm",
    tips: ["Confirm the show time before going.", "Combine with Nairobi National Park."], gettingThere: "In Langata, near the Nairobi National Park Main Gate." },
  { id: "railway-museum", name: "Nairobi Railway Museum", kind: "museum", county: "Nairobi", lat: -1.2905, lon: 36.8285, fame: 1,
    summary: "Old steam locomotives and carriages from the 'Lunatic Express' era.",
    highlights: ["Steam locomotive collection", "The railway-era carriage of Uganda Railway", "History of the line to Mombasa", "Cheap and quick to visit"],
    bestTime: "Weekday mornings.", fee: "Small entry fee.", hours: "About 8:30 am – 5:00 pm", tips: ["A short visit, about 1 hour.", "Close to Nairobi Railways station."], gettingThere: "Next to Nairobi Railways station, in the CBD." },
  { id: "fort-jesus", name: "Fort Jesus (Mombasa)", kind: "heritage", county: "Mombasa", lat: -4.0621, lon: 39.6797, fame: 3,
    summary: "A 16th-century Portuguese fort, UNESCO World Heritage Site, looking over Mombasa's Old Town.",
    highlights: ["Fort walls and sea view", "Museum of pottery and history", "Old Town walks and Swahili doors", "Evening sound-and-light shows (when scheduled)"],
    bestTime: "Early morning, cooler and quieter.", fee: "About KSh 200 citizen · KSh 1,200 non-resident (check the official site).", hours: "About 8:00 am – 6:00 pm",
    tips: ["Combine with an Old Town walk and Mombasa's food street.", "Agree guide prices first."],
    gettingThere: "Old Town Mombasa. SGR to Mombasa Terminus then a short taxi, or fly to Moi International (MBA).", website: "https://www.museums.or.ke/" },
  { id: "diani-beach", name: "Diani Beach", kind: "beach", county: "Kwale", lat: -4.32, lon: 39.58, fame: 3,
    summary: "A long white-sand beach with palm trees, reef snorkelling and kite-surfing.",
    highlights: ["White sand and turquoise water", "Snorkelling and dolphin trips", "Kite-surfing and water sports", "Colobus monkeys in the trees"],
    bestTime: "December – March and July – October.", fee: "Beach access is free; activities cost extra.", hours: "Daylight hours",
    tips: ["Beach vendors are normal. Politely agree prices.", "Check tide times for snorkelling."],
    gettingThere: "About 30 km south of Mombasa via the Likoni Ferry, or fly to Ukunda airstrip." },
  { id: "lamu-old-town", name: "Lamu Old Town", kind: "heritage", county: "Lamu", lat: -2.2717, lon: 40.902, fame: 3,
    summary: "Kenya's oldest living Swahili town: narrow streets, carved doors, dhows and no cars.",
    highlights: ["Dhow trips at sunset", "Lamu Fort and the Donkey Sanctuary", "Swahili architecture", "Shela Beach"],
    bestTime: "November – March, and the Lamu Cultural Festival.", fee: "Old Town entry is free; museums charge small fees.", hours: "Daylight hours",
    tips: ["Dress modestly in town.", "Donkeys and boats are the transport; no cars."],
    gettingThere: "Fly to Manda Island (LAU) then a short boat to Lamu, or drive to Mokowe jetty." },
  { id: "watamu-gedi", name: "Watamu & Gedi Ruins", kind: "heritage", county: "Kilifi", lat: -3.305, lon: 40.021, fame: 2,
    summary: "A marine park with coral gardens, plus the mysterious ruined Swahili town of Gedi hidden in the forest.",
    highlights: ["Snorkelling in Watamu Marine Park", "Gedi Ruins in the forest", "Sea turtle conservation", "Whale shark season (Oct – March)"],
    bestTime: "Oct – March for water clarity and whale sharks.", fee: "Marine park and ruins have separate small fees.", hours: "Daylight hours",
    tips: ["Visit Gedi early to avoid heat.", "Hire a licensed boat for the marine park."],
    gettingThere: "About 2 hours from Mombasa or fly to Malindi (MYD)." },
  { id: "haller-park", name: "Haller Park (Bamburi)", kind: "wildlife", county: "Mombasa", lat: -3.9833, lon: 39.7283, fame: 1,
    summary: "A restored quarry turned into a nature park with giraffes, hippos, crocodiles and a tortoise sanctuary.",
    highlights: ["Hand-feeding giraffes", "Owen the hippo and Mzee", "Crocodile and fish farm", "Nature trails"],
    bestTime: "Morning or afternoon feeding times.", fee: "About KSh 1,000 non-resident, lower for citizens (check the official site).", hours: "About 8:00 am – 5:00 pm",
    tips: ["Great for families.", "Combine with a beach day at Bamburi."], gettingThere: "About 10 km north of Mombasa on the Malindi Road." },
];

const flat: SightEntry[] = [];
for (const s of SIGHTS) {
  flat.push(s);
  for (const g of s.gates ?? []) {
    flat.push({
      ...s, id: `${s.id}--${g.id}`, name: `${s.name.replace(/ National (Park|Reserve)| Reserve| Conservancy/, "")} · ${g.name}`, parentId: s.id, gateName: g.name, gateNote: g.note,
      lat: g.lat, lon: g.lon, gates: undefined, approx: true, fame: 1,
    });
  }
}
/** Every searchable entry: sights first, with each park gate as its own entry. */
export const SIGHT_ENTRIES: SightEntry[] = flat;
export const sightById = (id: string): SightEntry | undefined => SIGHT_ENTRIES.find(entry => entry.id === id);
export const KIND_LABEL: Record<SightKind, string> = { park: "National park", reserve: "Reserve", museum: "Museum", heritage: "Heritage site", lake: "Lake", mountain: "Mountain", beach: "Beach", culture: "Culture", wildlife: "Wildlife" };

/** Search: names that START with the typed letters come first, then names that contain them. Typing one letter lists everything starting with it. */
export function searchSights(query: string, limit = 12): SightEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (entry: SightEntry) => {
    const name = entry.name.toLowerCase();
    const words = name.split(/[^a-z0-9']+/);
    if (name.startsWith(q)) return 0;
    if (words.some(word => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (`${entry.county} ${KIND_LABEL[entry.kind]}`.toLowerCase().includes(q)) return 3;
    return 9;
  };
  return SIGHT_ENTRIES.map(entry => ({ entry, s: score(entry) })).filter(item => item.s < 9)
    .sort((a, b) => a.s - b.s || b.entry.fame - a.entry.fame || a.entry.name.localeCompare(b.entry.name)).slice(0, limit).map(item => item.entry);
}

/** Sights worth showing on a journey line: parents only, close to the path, in the order the traveller passes them. */
export function sightsAlongPath(path: [number, number][], maxKm = 45, max = 5): { sight: SightEntry; frac: number; at: [number, number] }[] {
  if (path.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const found = SIGHTS.map(sight => {
    let best = 0, bestKm = Infinity;
    path.forEach(([lon, lat], i) => {
      const km = Math.hypot((lat - sight.lat) * 111, (lon - sight.lon) * 111 * Math.cos((lat * Math.PI) / 180));
      if (km < bestKm) { bestKm = km; best = i; }
    });
    return { sight: sight as SightEntry, km: bestKm, frac: cum[best] / total, at: path[best] };
  }).filter(item => item.km <= maxKm && item.frac > 0.03 && item.frac < 0.97);
  const chosen = found.sort((a, b) => b.sight.fame - a.sight.fame || a.km - b.km).slice(0, max);
  return chosen.sort((a, b) => a.frac - b.frac).map(({ sight, frac, at }) => ({ sight, frac, at }));
}
