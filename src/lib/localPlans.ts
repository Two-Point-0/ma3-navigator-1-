// Page types for Local businesses. The fee and the page layout depend on the business type.
// Keep the numbers in step with the table `local_plans` in the 20261128 migration (that table limits how many items a business can add).
export type PageType = "basic" | "shop" | "services" | "pharmacy" | "clinic";

export interface Plan { label: string; fee: number; maxItems: number; bookings: boolean; itemsWord: string; itemKind: "product" | "service" | "medicine"; blurb: string }

export const PLANS: Record<PageType, Plan> = {
  basic: { label: "Basic page", fee: 100, maxItems: 3, bookings: false, itemsWord: "What we sell", itemKind: "product", blurb: "Photos of up to 3 things you sell, hours and contacts." },
  shop: { label: "Shop page", fee: 300, maxItems: 40, bookings: false, itemsWord: "Products and prices", itemKind: "product", blurb: "A searchable list of up to 40 products with prices and photos." },
  services: { label: "Services page", fee: 300, maxItems: 30, bookings: true, itemsWord: "Services and prices", itemKind: "service", blurb: "Your services and prices, and customers can book a slot." },
  pharmacy: { label: "Pharmacy page", fee: 800, maxItems: 300, bookings: false, itemsWord: "Medicines and products", itemKind: "medicine", blurb: "Up to 300 medicines and products with names, prices and photos." },
  clinic: { label: "Clinic page", fee: 1000, maxItems: 60, bookings: true, itemsWord: "Services and fees", itemKind: "service", blurb: "Services, fees and appointment booking." },
};

const MAP: Record<string, PageType> = {
  mboga: "basic", fruits: "basic", dairy: "basic", farm: "basic", water: "basic", kiosk: "basic", shoes: "basic", transport: "basic", other: "basic",
  butchery: "shop", food: "shop", bakery: "shop", phone: "shop", hardware: "shop", electrical: "shop", gas: "shop",
  salon: "services", mechanic: "services", carwash: "services", tailor: "services", laundry: "services", gym: "services", daycare: "services", photo: "services", events: "services", tours: "services", cyber: "services", mpesa: "services", bar: "services",
  pharmacy: "pharmacy", clinic: "clinic",
};
export const pageTypeOf = (category: string): PageType => MAP[category] ?? "basic";
export const planOf = (category: string): Plan => PLANS[pageTypeOf(category)];

export type LocalBusiness = {
  id: string; owner_id?: string; name: string; category: string; description: string; services: string[]; phone: string | null; whatsapp: string | null;
  address: string | null; latitude: number; longitude: number; image_paths: string[]; distance_km?: number | null;
  status?: string; paid_until?: string | null; tagline?: string | null; hours?: string | null; website?: string | null;
};
export type LocalItem = { id: string; business_id: string; kind: string; name: string; price_kes: number | null; note: string | null; image_path: string | null; in_stock: boolean; sort: number };
