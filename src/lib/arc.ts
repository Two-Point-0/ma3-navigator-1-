export type LonLat = [number, number];
const R = Math.PI / 180;

/**
 * A curved flight path. The Earth is round, so the shortest way between two airports is a great circle,
 * which looks curved on a flat map. A small extra bow is added so even short domestic hops visibly curve.
 */
export function flightArc(a: LonLat, b: LonLat, steps = 96, bow = 0.1): LonLat[] {
  const [lon1, lat1, lon2, lat2] = [a[0] * R, a[1] * R, b[0] * R, b[1] * R];
  const v1 = [Math.cos(lat1) * Math.cos(lon1), Math.cos(lat1) * Math.sin(lon1), Math.sin(lat1)];
  const v2 = [Math.cos(lat2) * Math.cos(lon2), Math.cos(lat2) * Math.sin(lon2), Math.sin(lat2)];
  const dot = Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const omega = Math.acos(dot);
  const dLon = ((b[0] - a[0] + 540) % 360) - 180; // shortest way round the globe
  const spanDeg = Math.hypot(dLon, b[1] - a[1]) || 1e-6;
  const nx = -(b[1] - a[1]) / spanDeg, ny = dLon / spanDeg; // sideways direction
  const side = ny >= 0 ? 1 : -1; // always bow towards the north so the curve looks natural
  const out: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let lon: number, lat: number;
    if (omega < 1e-9) { lon = a[0]; lat = a[1]; }
    else {
      const k1 = Math.sin((1 - t) * omega) / Math.sin(omega), k2 = Math.sin(t * omega) / Math.sin(omega);
      const x = k1 * v1[0] + k2 * v2[0], y = k1 * v1[1] + k2 * v2[1], z = k1 * v1[2] + k2 * v2[2];
      lat = Math.atan2(z, Math.hypot(x, y)) / R; lon = Math.atan2(y, x) / R;
    }
    const mag = Math.sin(Math.PI * t) * bow * spanDeg;
    out.push([lon + nx * side * mag, lat + ny * side * mag]);
  }
  return out;
}
