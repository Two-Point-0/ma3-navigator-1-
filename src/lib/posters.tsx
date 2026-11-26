import { CalendarDays, Clock, DoorOpen, Phone, Route, Ticket, MapPin, Globe, type LucideIcon } from "lucide-react";
import { KIND_LABEL, SIGHTS, type SightEntry } from "@/data/sights";
import { KIND_ICON } from "@/lib/sightIcons";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Sight pictures live in the Supabase storage bucket "posters", folder "sights", file <id>.jpg. */
export const sightImageUrl = (id: string, ext: "png" | "jpg" = "png") => isSupabaseConfigured && supabase ? supabase.storage.from("posters").getPublicUrl(`sights/${id}.${ext}`).data.publicUrl : `/sights/${id}.${ext}`;
import type { PosterData } from "@/components/PosterModal";

/** Poster for a curated sight or one gate of a park. The picture is /public/sights/<id>.jpg (gates use the park's picture). */
export function sightPoster(entry: SightEntry): PosterData {
  const parent = entry.parentId ? SIGHTS.find(sight => sight.id === entry.parentId) : entry;
  const facts: PosterData["facts"] = [];
  if (entry.gateName) facts.push({ icon: DoorOpen, label: `This entrance: ${entry.gateName}`, text: entry.gateNote + (entry.approx ? " (Pin is approximate.)" : "") });
  facts.push({ icon: CalendarDays, label: "Best time", text: entry.bestTime }, { icon: Ticket, label: "Entry fee", text: entry.fee }, { icon: Clock, label: "Hours", text: entry.hours }, { icon: Route, label: "Getting there", text: entry.gettingThere });
  return {
    id: entry.id, title: parent?.name ?? entry.name, subtitle: `${KIND_LABEL[entry.kind]} · ${entry.county}`, imageUrls: [sightImageUrl(entry.parentId ?? entry.id, "png"), sightImageUrl(entry.parentId ?? entry.id, "jpg"), `/sights/${entry.parentId ?? entry.id}.jpg`],
    icon: KIND_ICON[entry.kind], summary: entry.summary, highlights: entry.highlights, facts, tips: entry.tips, note: "Fees and hours change. Confirm before you travel.",
  };
}

export interface PlacePosterRow {
  place_ref: string; title: string; tagline: string | null; poster_url: string | null; description: string | null; highlights: string[] | null;
  hours: string | null; price: string | null; phone: string | null; website: string | null; address: string | null; tips: string | null;
  lat: number | null; lon: number | null; category: string | null; subtype: string | null;
}
export const POSTER_COLUMNS = "place_ref,title,tagline,poster_url,description,highlights,hours,price,phone,website,address,tips,lat,lon,category,subtype";

export function rowPoster(row: PlacePosterRow, icon: LucideIcon): PosterData {
  const facts: PosterData["facts"] = [];
  if (row.hours) facts.push({ icon: Clock, label: "Hours", text: row.hours });
  if (row.price) facts.push({ icon: Ticket, label: "Price", text: row.price });
  if (row.address) facts.push({ icon: MapPin, label: "Where", text: row.address });
  if (row.phone) facts.push({ icon: Phone, label: "Phone", text: row.phone });
  if (row.website) facts.push({ icon: Globe, label: "Website", text: row.website });
  return { id: row.place_ref, title: row.title, subtitle: row.tagline ?? undefined, imageUrl: row.poster_url ?? undefined, icon, summary: row.description ?? undefined, highlights: row.highlights ?? undefined, facts, tips: row.tips ? [row.tips] : undefined };
}

/** The poster row for one mapped place, or null when it has none. */
export async function fetchPlacePoster(ref: string): Promise<PlacePosterRow | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("place_posters").select(POSTER_COLUMNS).eq("place_ref", ref).eq("active", true).maybeSingle();
  return (data as PlacePosterRow | null) ?? null;
}
