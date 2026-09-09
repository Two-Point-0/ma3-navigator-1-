// Nairobi Commuter Rail (NCR) — Kenya Railways
// 5 active lines, real published station list/order + researched coordinates.
// Polylines trace the actual rail corridor (not straight station-to-station lines):
// the metre-gauge line runs along the historic Uganda Railway alignment through
// Makadara, then splits south toward Imara Daima/Syokimau (Mombasa Rd corridor)
// or further to Embakasi Village, while the Ruiru line runs north via Pangani/
// Kasarani, and the Limuru line runs west via Kibera/Dagoretti.

export interface RailStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface RailLine {
  id: string;
  name: string;
  color: string;
  stations: string[];       // station ids in order, CBD -> terminus
  corridor: [number, number][]; // real-ish rail-corridor polyline [lat,lon], CBD -> terminus
  departuresFromCBD: string[];
  departuresToCBD: string[];
  avgSpeedKmh: number;
}

export const RAIL_STATIONS: Record<string, RailStation> = {
  // Shared trunk (all lines pass through these from Nairobi Central)
  nrb_central:  { id: "nrb_central",  name: "Nairobi Central Station", lat: -1.28848, lon: 36.82774 },
  makadara:     { id: "makadara",     name: "Makadara",                lat: -1.29550, lon: 36.84850 },

  // Syokimau branch (south-east, Mombasa Rd corridor)
  imara_daima:  { id: "imara_daima",  name: "Imara Daima",             lat: -1.32130, lon: 36.86670 },
  sgr_terminus: { id: "sgr_terminus", name: "SGR Terminus",            lat: -1.34100, lon: 36.89600 },
  syokimau:     { id: "syokimau",     name: "Syokimau",                lat: -1.35965, lon: 36.90781 },

  // Embakasi Village branch
  donholm:      { id: "donholm",      name: "Donholm",                 lat: -1.29850, lon: 36.88350 },
  pipeline:     { id: "pipeline",     name: "Pipeline",                lat: -1.31000, lon: 36.89400 },
  embakasi_vlg: { id: "embakasi_vlg", name: "Embakasi Village",        lat: -1.31209, lon: 36.91454 },

  // Athi River / Lukenya branch (continues past Imara Daima)
  embakasi_stn: { id: "embakasi_stn", name: "Embakasi",                lat: -1.33600, lon: 36.90100 },
  mlolongo:     { id: "mlolongo",     name: "Mlolongo",                lat: -1.40450, lon: 36.93870 },
  athi_river:   { id: "athi_river",   name: "Athi River",              lat: -1.45640, lon: 36.97840 },
  lukenya:      { id: "lukenya",      name: "Lukenya",                 lat: -1.48900, lon: 37.05500 },

  // Ruiru branch (north, via Pangani/Kasarani corridor)
  dandora:      { id: "dandora",      name: "Dandora",                 lat: -1.25700, lon: 36.89400 },
  mwiki:        { id: "mwiki",        name: "Mwiki",                   lat: -1.20900, lon: 36.92700 },
  githurai:     { id: "githurai",     name: "Githurai",                lat: -1.20420, lon: 36.92140 },
  kahawa:       { id: "kahawa",       name: "Kahawa",                  lat: -1.19130, lon: 36.93350 },
  ruiru:        { id: "ruiru",        name: "Ruiru",                   lat: -1.14970, lon: 36.96170 },

  // Limuru branch (west, via Kibera/Dagoretti corridor)
  kibera:       { id: "kibera",       name: "Kibera",                  lat: -1.31330, lon: 36.78310 },
  dagoretti:    { id: "dagoretti",    name: "Dagoretti Corner",        lat: -1.30220, lon: 36.75560 },
  kikuyu:       { id: "kikuyu",       name: "Kikuyu",                  lat: -1.24830, lon: 36.66510 },
  limuru:       { id: "limuru",       name: "Limuru",                  lat: -1.11360, lon: 36.64220 },
};

export const RAIL_LINES: RailLine[] = [
  {
    id: "syo", name: "Syokimau Line", color: "#dc2626",
    stations: ["nrb_central", "makadara", "imara_daima", "sgr_terminus", "syokimau"],
    // follows Mombasa Road / SGR corridor south-east out of the city
    corridor: [
      [-1.28848, 36.82774], [-1.29100, 36.83400], [-1.29550, 36.84850],
      [-1.30400, 36.85600], [-1.31200, 36.86200], [-1.32130, 36.86670],
      [-1.33200, 36.87900], [-1.34100, 36.89600], [-1.35100, 36.90200],
      [-1.35965, 36.90781],
    ],
    departuresFromCBD: ["06:20", "06:35", "07:00", "08:00", "09:35", "12:00", "14:30", "17:30", "18:20", "20:20"],
    departuresToCBD:   ["06:25", "06:47", "07:15", "08:12", "09:47", "10:45", "14:35", "17:42", "18:32", "20:32"],
    avgSpeedKmh: 42,
  },
  {
    id: "emb", name: "Embakasi Village Line", color: "#3b82f6",
    stations: ["nrb_central", "makadara", "donholm", "pipeline", "embakasi_vlg"],
    // shares trunk to Makadara then continues east along the Eastlands corridor
    corridor: [
      [-1.28848, 36.82774], [-1.29100, 36.83400], [-1.29550, 36.84850],
      [-1.29680, 36.86600], [-1.29850, 36.88350], [-1.30400, 36.89000],
      [-1.31000, 36.89400], [-1.31100, 36.90400], [-1.31209, 36.91454],
    ],
    departuresFromCBD: ["06:35", "07:20", "08:00", "09:42", "11:30", "14:35", "17:30", "18:20"],
    departuresToCBD:   ["07:04", "07:52", "10:05", "12:35", "15:13", "18:13", "18:55", "19:23"],
    avgSpeedKmh: 38,
  },
  {
    id: "ruu", name: "Ruiru Line", color: "#16a34a",
    stations: ["nrb_central", "makadara", "dandora", "mwiki", "githurai", "kahawa", "ruiru"],
    // shares trunk to Makadara then heads north via Pangani/Kasarani corridor
    corridor: [
      [-1.28848, 36.82774], [-1.28500, 36.83400], [-1.27200, 36.85100],
      [-1.25700, 36.89400], [-1.22800, 36.91200], [-1.20900, 36.92700],
      [-1.20420, 36.92140], [-1.19700, 36.92700], [-1.19130, 36.93350],
      [-1.17000, 36.94800], [-1.14970, 36.96170],
    ],
    departuresFromCBD: ["06:20", "06:28", "06:38", "06:54", "07:12", "07:53", "09:08", "09:18", "09:32", "09:48", "10:00", "17:53"],
    departuresToCBD:   ["06:28", "06:38", "07:53", "08:16", "08:23", "08:30", "09:08", "18:16"],
    avgSpeedKmh: 45,
  },
  {
    id: "lim", name: "Limuru Line", color: "#d97706",
    stations: ["nrb_central", "kibera", "dagoretti", "kikuyu", "limuru"],
    // heads west via Ngong Rd / Kibera then climbs through Dagoretti / Kikuyu corridor
    corridor: [
      [-1.28848, 36.82774], [-1.29400, 36.80900], [-1.31330, 36.78310],
      [-1.30220, 36.75560], [-1.27900, 36.71400], [-1.24830, 36.66510],
      [-1.18600, 36.65300], [-1.11360, 36.64220],
    ],
    departuresFromCBD: ["05:50", "07:00", "07:35", "17:50", "18:40"],
    departuresToCBD:   ["06:27", "07:28", "08:05", "18:10", "19:05"],
    avgSpeedKmh: 40,
  },
  {
    id: "ath", name: "Athi River / Lukenya Line", color: "#8b5cf6",
    stations: ["nrb_central", "makadara", "imara_daima", "embakasi_stn", "mlolongo", "athi_river", "lukenya"],
    // shares Syokimau trunk then continues further south-east past Embakasi
    corridor: [
      [-1.28848, 36.82774], [-1.29100, 36.83400], [-1.29550, 36.84850],
      [-1.30400, 36.85600], [-1.32130, 36.86670], [-1.33600, 36.90100],
      [-1.37000, 36.91500], [-1.40450, 36.93870], [-1.43000, 36.95500],
      [-1.45640, 36.97840], [-1.48900, 37.05500],
    ],
    departuresFromCBD: ["05:45", "13:30"],
    departuresToCBD:   ["06:25", "14:15"],
    avgSpeedKmh: 48,
  },
];

export const NCR_FARE_ESTIMATE: Record<string, number> = {
  syo: 60, emb: 50, ruu: 100, lim: 100, ath: 150,
};

export function railLineCoords(line: RailLine): [number, number][] {
  return line.corridor;
}

export function nextDeparture(times: string[], nowMin: number): { time: string; inMin: number } | null {
  const parsed = times
    .map(t => {
      const [h, m] = t.split(":").map(Number);
      return { time: t, mins: h * 60 + m };
    })
    .sort((a, b) => a.mins - b.mins);
  const next = parsed.find(t => t.mins >= nowMin);
  if (next) return { time: next.time, inMin: next.mins - nowMin };
  // wrap to first departure tomorrow
  if (parsed.length) return { time: parsed[0].time, inMin: (1440 - nowMin) + parsed[0].mins };
  return null;
}

// Find a matatu transfer point near a given rail station ("Railways" CBD stage,
// Syokimau Railway Station stage, etc.) — used by the journey planner to offer
// train + matatu combined routes.
export const RAIL_MATATU_INTERCHANGES: { stationId: string; matatuStopId: string; matatuStopName: string }[] = [
  { stationId: "nrb_central",  matatuStopId: "0001RLW", matatuStopName: "Railways" },
  { stationId: "syokimau",     matatuStopId: "0500SKR", matatuStopName: "Syokimau Railway Station" },
];
