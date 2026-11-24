/** Street-following walking paths from the free OpenStreetMap foot router. Falls back to a straight line if it is unreachable. */
const cache = new Map<string, [number, number][] | null>();
const key = (a: [number, number], b: [number, number]) => `${a[0].toFixed(5)},${a[1].toFixed(5)}>${b[0].toFixed(5)},${b[1].toFixed(5)}`;

/** a and b are [lat, lon]. Returns [lat, lon] points along real streets, or null when unavailable. */
export async function fetchWalkPath(a: [number, number], b: [number, number]): Promise<[number, number][] | null> {
  const k = key(a, b);
  if (cache.has(k)) return cache.get(k) ?? null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    const path = coords && coords.length > 1 ? coords.map(([lon, lat]) => [lat, lon] as [number, number]) : null;
    cache.set(k, path);
    return path;
  } catch {
    return null; // not cached, so a later try can succeed
  } finally { clearTimeout(timer); }
}
