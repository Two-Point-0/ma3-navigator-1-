export type PrototypeRailStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  prototypeOnly?: boolean;
};

export type PrototypeRailLine = {
  id: string;
  name: string;
  stationNames: string[];
  note: string;
};

export type PrototypeRailLeg = {
  lineId: string;
  lineName: string;
  from: string;
  to: string;
  stops: string[];
};

/**
 * Clearly provisional planning data for interface testing only. The ordered
 * corridors, Nairobi Central interchange and transfer assumptions must be
 * checked against an authoritative Kenya Railways schedule before launch.
 */
export const PROTOTYPE_RAIL_LINES: PrototypeRailLine[] = [
  {
    id: "kikuyu-limuru-sample",
    name: "Kikuyu–Limuru sample corridor",
    stationNames: ["Nairobi Central (prototype)", "Dagoretti Market", "Kibera", "Jamuhuri railways", "Satellite", "Mutuini", "Thogoto", "Kikuyu", "Gitaru", "Muguga", "Limuru Train Station"],
    note: "Sample station order and interchange; not a verified timetable or live service.",
  },
  {
    id: "nairobi-ruiru-sample",
    name: "Nairobi–Ruiru sample corridor",
    stationNames: ["Nairobi Central (prototype)", "Kariobangi South", "Umoja/ Mutindwa", "Mwiki", "Membley/ Gitambaya", "Ruiru"],
    note: "Sample station order and interchange; confirm operating service before travel.",
  },
  {
    id: "nairobi-mgr-sample",
    name: "Nairobi–Athi River MGR sample corridor",
    stationNames: ["Nairobi Central (prototype)", "Imara Daima", "Athi River (MGR)"],
    note: "Sample station order; service and stop pattern are not verified.",
  },
  {
    id: "sgr-south-sample",
    name: "Nairobi Terminus–Lukenya SGR sample corridor",
    stationNames: ["Nairobi Terminus", "Mlolongo", "Athi River (SGR)", "Lukenya"],
    note: "Sample station order; does not imply that every mapped point is a passenger stop.",
  },
];

export const PROTOTYPE_CENTRAL_STATION: PrototypeRailStation = {
  id: "prototype-nairobi-central",
  name: "Nairobi Central (prototype)",
  lat: -1.2866,
  lon: 36.8234,
  prototypeOnly: true,
};

const canonical = (name: string) => name.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");

/** Find a minimum-stop path over the sample corridor graph. */
export function planPrototypeRailConnection(
  fromName: string,
  toName: string,
  lines: PrototypeRailLine[] = PROTOTYPE_RAIL_LINES,
): PrototypeRailLeg[] | null {
  const from = canonical(fromName);
  const to = canonical(toName);
  if (!from || !to || from === to) return null;

  const adjacency = new Map<string, { station: string; line: PrototypeRailLine }[]>();
  for (const line of lines) {
    for (let i = 0; i < line.stationNames.length - 1; i++) {
      const a = line.stationNames[i];
      const b = line.stationNames[i + 1];
      adjacency.set(canonical(a), [...(adjacency.get(canonical(a)) ?? []), { station: b, line }]);
      adjacency.set(canonical(b), [...(adjacency.get(canonical(b)) ?? []), { station: a, line }]);
    }
  }

  const names = new Map<string, string>();
  for (const line of lines) for (const name of line.stationNames) names.set(canonical(name), name);
  if (!names.has(from) || !names.has(to)) return null;

  type Node = { station: string; line: PrototypeRailLine; path: string[] };
  const queue: Node[] = [];
  for (const edge of adjacency.get(from) ?? []) queue.push({ station: from, line: edge.line, path: [names.get(from)!] });
  const seen = new Set<string>();
  let found: Node | null = null;
  while (queue.length) {
    const current = queue.shift()!;
    const key = `${canonical(current.station)}|${current.line.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (canonical(current.station) === to) { found = current; break; }
    for (const edge of adjacency.get(canonical(current.station)) ?? []) {
      const nextKey = `${canonical(edge.station)}|${edge.line.id}`;
      if (!seen.has(nextKey)) queue.push({ station: edge.station, line: edge.line, path: [...current.path, edge.station] });
    }
  }
  if (!found || found.path.length < 2) return null;

  const legs: PrototypeRailLeg[] = [];
  for (let i = 0; i < found.path.length - 1; i++) {
    const a = found.path[i];
    const b = found.path[i + 1];
    const line = (adjacency.get(canonical(a)) ?? []).find(edge => canonical(edge.station) === canonical(b))?.line;
    if (!line) return null;
    const last = legs[legs.length - 1];
    if (last?.lineId === line.id) {
      last.to = b;
      last.stops.push(b);
    } else {
      legs.push({ lineId: line.id, lineName: line.name, from: a, to: b, stops: [a, b] });
    }
  }
  return legs;
}
