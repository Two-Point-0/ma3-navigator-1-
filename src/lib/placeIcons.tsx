import { renderToStaticMarkup } from "react-dom/server";
import maplibregl from "maplibre-gl";
import {
  Apple, Banknote, Baby, Beef, Beer, BedDouble, BookOpen, Bus, Cake, Camera, Car, Carrot, Church, Coffee, Cross, Croissant, Dumbbell, Egg, Eye,
  Fish, Flower, Fuel, GraduationCap, Hammer, Hospital, Hotel, Landmark, Library, Lightbulb, Milk, Monitor, Mountain, Music, PawPrint, Pill,
  Pizza, Printer, Salad, Sandwich, Scissors, Shield, Shirt, ShoppingBag, Smartphone, Sprout, Store, Tent, TreePine, Truck, Utensils,
  WashingMachine, Waves, Wine, Wrench, Bike, Gem, MapPin, Droplets, Stethoscope, Briefcase, Film, IceCream, Drumstick, Trees,
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

/** A round coloured map pin with the icon inside. Colour tells the group, the icon tells the type. */
const svgCache = new Map<IconType, Map<number, string>>();
export function iconMarker(map: maplibregl.Map, lat: number, lon: number, Icon: IconType, color: string, title: string, onClick?: () => void, options: { size?: number; label?: string } = {}) {
  const size = options.size ?? 30;
  const el = document.createElement("button");
  el.type = "button"; el.title = title; el.setAttribute("aria-label", title);
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;background:${color};display:grid;place-items:center;padding:0;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.5);`;
  const bySize = svgCache.get(Icon) ?? new Map<number, string>(); svgCache.set(Icon, bySize);
  let markup = bySize.get(size);
  if (!markup) { markup = renderToStaticMarkup(<Icon size={Math.round(size * 0.55)} color="#fff" strokeWidth={2.3} />); bySize.set(size, markup); }
  el.innerHTML = markup;
  if (options.label) {
    const tag = document.createElement("span");
    tag.textContent = options.label;
    tag.style.cssText = "position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:3px;white-space:nowrap;font:700 10px Syne,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;pointer-events:none;";
    el.style.position = "relative"; el.appendChild(tag);
  }
  if (onClick) el.addEventListener("click", event => { event.stopPropagation(); onClick(); });
  return new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
}
