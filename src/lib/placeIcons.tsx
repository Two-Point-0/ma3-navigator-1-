import { renderToStaticMarkup } from "react-dom/server";
import maplibregl from "maplibre-gl";
import {
  Apple, Banknote, Baby, Beef, Beer, BedDouble, BookOpen, Bus, Cake, Camera, Car, Carrot, Church, Coffee, Cross, Croissant, Dumbbell, Egg, Eye,
  Fish, Flower, Fuel, GraduationCap, Hammer, Hospital, Hotel, Landmark, Library, Lightbulb, Milk, Monitor, Mountain, Music, PawPrint, Pill,
  Pizza, Printer, Salad, Sandwich, Scissors, Shield, Shirt, ShoppingBag, Smartphone, Sprout, Store, Tent, TreePine, Truck, Utensils,
  WashingMachine, Waves, Wine, Wrench, Bike, Gem, Footprints, Flame, Zap, PartyPopper, MapPin, Droplets, Stethoscope, Briefcase, Film, IceCream, Drumstick, Trees,
  type LucideIcon,
} from "lucide-react";

export type IconType = LucideIcon;

/** Business types people can pick when they register on Local. */
export const LOCAL_CATEGORIES: { id: string; label: string; Icon: IconType }[] = [
  { id: "mboga", label: "Mama mboga / vegetables", Icon: Carrot },
  { id: "fruits", label: "Fruits", Icon: Apple },
  { id: "butchery", label: "Butchery", Icon: Beef },
  { id: "dairy", label: "Milk & eggs", Icon: Milk },
  { id: "food", label: "Food / kibanda / hotel", Icon: Utensils },
  { id: "bakery", label: "Bakery", Icon: Croissant },
  { id: "kiosk", label: "Kiosk / shop", Icon: Store },
  { id: "salon", label: "Salon / barber", Icon: Scissors },
  { id: "mechanic", label: "Mechanic / garage", Icon: Wrench },
  { id: "phone", label: "Phone repair & airtime", Icon: Smartphone },
  { id: "tailor", label: "Tailor / clothes", Icon: Shirt },
  { id: "hardware", label: "Hardware", Icon: Hammer },
  { id: "pharmacy", label: "Chemist", Icon: Pill },
  { id: "cyber", label: "Cyber / printing", Icon: Printer },
  { id: "laundry", label: "Laundry", Icon: WashingMachine },
  { id: "transport", label: "Boda / transport", Icon: Bike },
  { id: "tours", label: "Tours & safaris", Icon: Camera },
  { id: "bar", label: "Bar / entertainment", Icon: Beer },
  { id: "farm", label: "Farm produce", Icon: Sprout },
  { id: "mpesa", label: "M-Pesa & bank agent", Icon: Banknote },
  { id: "water", label: "Water vendor", Icon: Droplets },
  { id: "carwash", label: "Car wash", Icon: Car },
  { id: "gym", label: "Gym & fitness", Icon: Dumbbell },
  { id: "shoes", label: "Shoemaker / cobbler", Icon: Footprints },
  { id: "gas", label: "Gas refill", Icon: Flame },
  { id: "electrical", label: "Electrician", Icon: Zap },
  { id: "photo", label: "Photography", Icon: Camera },
  { id: "events", label: "Events & tent hire", Icon: PartyPopper },
  { id: "daycare", label: "Daycare / school", Icon: Baby },
  { id: "clinic", label: "Clinic", Icon: Stethoscope },
  { id: "other", label: "Other", Icon: Briefcase },
];
export function localCategoryIcon(id: string): IconType {
  return LOCAL_CATEGORIES.find(item => item.id === id)?.Icon ?? Store;
}

/** Picks a map icon for an Explore place from its category and subtype words. */
const RULES: [RegExp, IconType][] = [
  [/restaurant|food_court|kibanda|canteen/, Utensils], [/cafe|coffee/, Coffee], [/fast_food|burger|takeaway/, Sandwich], [/pizza/, Pizza],
  [/ice_cream/, IceCream], [/pub|bar|nightclub|biergarten/, Beer], [/wine|liquor|alcohol/, Wine], [/bakery|pastry/, Croissant], [/butcher/, Beef],
  [/greengrocer|vegetable|fruit|market/, Carrot], [/supermarket|mall|department|general/, ShoppingBag], [/convenience|kiosk|variety/, Store],
  [/clothes|boutique|tailor|fashion|shoe/, Shirt], [/jewel/, Gem], [/hairdresser|barber|beauty|salon/, Scissors],
  [/hotel|motel|resort|lodge/, Hotel], [/guest_house|hostel|apartment|chalet|bnb/, BedDouble], [/camp_site|caravan|camp/, Tent],
  [/hospital/, Hospital], [/clinic|doctor|dentist/, Stethoscope], [/pharmacy|chemist/, Pill], [/school|college|kindergarten|university/, GraduationCap],
  [/library/, Library], [/place_of_worship|church|mosque|temple/, Church], [/bank|atm|bureau/, Banknote], [/police|fire_station/, Shield],
  [/fuel|petrol/, Fuel], [/car_repair|garage|car_wash|tyre/, Wrench], [/parking|car_rental/, Car], [/bus_station|bus_stop|matatu|terminal/, Bus],
  [/park|garden|forest|reserve|nature/, TreePine], [/zoo|wildlife|safari|game_reserve/, PawPrint], [/beach|lake|waterfall|river/, Waves],
  [/peak|mountain|hill|volcano/, Mountain], [/museum|monument|memorial|historic|castle|ruins/, Landmark], [/viewpoint|attraction/, Eye],
  [/theatre|cinema/, Film], [/music|club/, Music], [/gym|fitness|sports|stadium|pitch/, Dumbbell], [/water|borehole|well/, Droplets],
  [/post_office|courier/, Truck], [/computer|electronics|mobile|phone/, Smartphone], [/hardware|doityourself|building/, Hammer],
  [/books|stationery/, BookOpen], [/baby|toys/, Baby], [/florist|nursery|garden_centre/, Flower], [/electrical|lighting/, Lightbulb], [/fish/, Fish],
  [/egg|poultry|chicken/, Egg], [/dairy|milk/, Milk], [/cake|confectionery/, Cake], [/shop|retail|store/, Store],
];
export function placeIconFor(category: string | null | undefined, subtype: string | null | undefined): IconType {
  const text = `${subtype ?? ""} ${category ?? ""}`.toLowerCase();
  for (const [pattern, icon] of RULES) if (pattern.test(text)) return icon;
  return MapPin;
}

/** A bare map pin: just the Lucide icon in the group colour, with a dark outline so it reads on any map. No circle. */
export function iconMarker(map: maplibregl.Map, lat: number, lon: number, Icon: IconType, color: string, title: string, onClick?: () => void, options: { size?: number; label?: string } = {}) {
  const size = options.size ?? 30;
  const root = document.createElement("div"); // MapLibre positions this element, so it must not set its own position
  root.style.cssText = "cursor:pointer;line-height:0";
  root.title = title; root.setAttribute("role", "button"); root.setAttribute("aria-label", title);
  const box = document.createElement("div");
  box.style.cssText = `position:relative;width:${size}px;height:${size}px;filter:drop-shadow(0 1px 2px #0009)`;
  const icon = Math.round(size * 0.95);
  const layer = (stroke: string, width: number) => `<span style="position:absolute;inset:0;display:grid;place-items:center">${renderToStaticMarkup(<Icon size={icon} color={stroke} strokeWidth={width} />)}</span>`;
  box.innerHTML = layer("#0b1530", 5.4) + layer(color, 2.4);
  if (options.label) {
    const tag = document.createElement("span");
    tag.textContent = options.label;
    tag.style.cssText = "position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;font:700 10px Syne,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;pointer-events:none;";
    box.appendChild(tag);
  }
  root.appendChild(box);
  if (onClick) root.addEventListener("click", event => { event.stopPropagation(); onClick(); });
  return new maplibregl.Marker({ element: root, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
}
