// Built-in SGR (Madaraka Express) route, used when the database has none yet. Station pins are approximate.
const stations: { id: string; name: string; lat: number; lon: number }[] = [
  { id: "sgr-nairobi", name: "Nairobi Terminus", lat: -1.3553597, lon: 36.8980718 },
  { id: "sgr-athi", name: "Athi River", lat: -1.4592, lon: 36.9786 },
  { id: "sgr-emali", name: "Emali", lat: -2.0861, lon: 37.4672 },
  { id: "sgr-mtito", name: "Mtito Andei", lat: -2.6906, lon: 38.1672 },
  { id: "sgr-voi", name: "Voi", lat: -3.4067, lon: 38.5517 },
  { id: "sgr-mariakani", name: "Mariakani", lat: -3.8639, lon: 39.4639 },
  { id: "sgr-mombasa", name: "Mombasa Terminus", lat: -4.0337, lon: 39.5753 },
];
export const SGR_ROUTE_ID = "sgr-madaraka";
export const SGR_FALLBACK = {
  route: { id: SGR_ROUTE_ID, name: "Madaraka Express · Nairobi – Mombasa", operator: "Kenya Railways", source_url: "https://metickets.krc.co.ke/", source_updated_at: null,
    geometry: { type: "LineString", coordinates: stations.map(station => [station.lon, station.lat]) } },
  stations: stations.map((station, index) => ({ id: station.id, name: station.name, route_id: SGR_ROUTE_ID, latitude: station.lat, longitude: station.lon, sequence_number: index + 1 })),
};
