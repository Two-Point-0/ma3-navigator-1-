// Well-known Nairobi places so riders can type "Westgate" or "JKIA" instead of a stop name.
// Coordinates are approximate (prototype). They can move to a Supabase table later.
export interface Landmark { id: string; name: string; lat: number; lon: number }
export const LANDMARKS: Landmark[] = [
  { id: "lm-kicc", name: "KICC", lat: -1.2884, lon: 36.8233 },
  { id: "lm-kencom", name: "Kencom House", lat: -1.2862, lon: 36.8247 },
  { id: "lm-railways", name: "Railways Bus Station", lat: -1.2907, lon: 36.8283 },
  { id: "lm-gpo", name: "GPO (Kenyatta Avenue)", lat: -1.2869, lon: 36.8219 },
  { id: "lm-jkia", name: "JKIA Airport", lat: -1.3192, lon: 36.9275 },
  { id: "lm-wilson", name: "Wilson Airport", lat: -1.3217, lon: 36.8148 },
  { id: "lm-westgate", name: "Westgate Mall", lat: -1.2569, lon: 36.8034 },
  { id: "lm-sarit", name: "Sarit Centre", lat: -1.2634, lon: 36.8036 },
  { id: "lm-yaya", name: "Yaya Centre", lat: -1.2918, lon: 36.7868 },
  { id: "lm-junction", name: "The Junction Mall", lat: -1.2993, lon: 36.7616 },
  { id: "lm-gardencity", name: "Garden City Mall", lat: -1.2335, lon: 36.8788 },
  { id: "lm-tworivers", name: "Two Rivers Mall", lat: -1.2087, lon: 36.8043 },
  { id: "lm-trm", name: "Thika Road Mall (TRM)", lat: -1.2195, lon: 36.8886 },
  { id: "lm-uhuru", name: "Uhuru Park", lat: -1.2893, lon: 36.8156 },
  { id: "lm-uon", name: "University of Nairobi (Main Campus)", lat: -1.2796, lon: 36.8170 },
  { id: "lm-knh", name: "Kenyatta National Hospital", lat: -1.3011, lon: 36.8069 },
  { id: "lm-nyayo", name: "Nyayo Stadium", lat: -1.3047, lon: 36.8258 },
  { id: "lm-kasarani", name: "Moi International Sports Centre (Kasarani)", lat: -1.2223, lon: 36.8903 },
  { id: "lm-strathmore", name: "Strathmore University", lat: -1.3098, lon: 36.8118 },
  { id: "lm-gikomba", name: "Gikomba Market", lat: -1.2842, lon: 36.8378 },
  { id: "lm-toi", name: "Toi Market", lat: -1.3084, lon: 36.7831 },
  { id: "lm-carnivore", name: "Carnivore Grounds", lat: -1.3192, lon: 36.7861 },
  { id: "lm-ngongrace", name: "Ngong Racecourse", lat: -1.3013, lon: 36.7655 },
  { id: "lm-nationcentre", name: "Nation Centre", lat: -1.2837, lon: 36.8225 },
];
