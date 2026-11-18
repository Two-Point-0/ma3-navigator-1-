// Prototype rail network (mock data). Real timetable/coordinates must be confirmed with Kenya Railways before launch.
// Generated from supabase/seed/rail/*.csv. The same data can live in Supabase (tables rail_lines, rail_stations, rail_line_stations).
export interface RailLineRow { id: string; name: string; color: string; speedKmh: number; waitMin: number; baseFare: number; perKm: number }
export interface RailStationRow { id: string; name: string; lat: number; lon: number; approx: boolean }
export interface RailLineStationRow { lineId: string; seq: number; stationId: string }
export const RAIL_LINES_BUNDLED: RailLineRow[] = [
 {
  "id": "L1",
  "name": "Nairobi - Ruiru (Thika line)",
  "color": "#16a34a",
  "speedKmh": 38.0,
  "waitMin": 20.0,
  "baseFare": 30.0,
  "perKm": 2.2
 },
 {
  "id": "L2",
  "name": "Nairobi - Limuru (Kikuyu line)",
  "color": "#8b5cf6",
  "speedKmh": 32.0,
  "waitMin": 25.0,
  "baseFare": 30.0,
  "perKm": 2.4
 },
 {
  "id": "L3",
  "name": "Nairobi - Lukenya (Mombasa Road line)",
  "color": "#d97706",
  "speedKmh": 40.0,
  "waitMin": 20.0,
  "baseFare": 40.0,
  "perKm": 2.6
 }
];
export const RAIL_STATIONS_BUNDLED: RailStationRow[] = [
 {
  "id": "NRB",
  "name": "Nairobi Central Station",
  "lat": -1.2907,
  "lon": 36.8283,
  "approx": true
 },
 {
  "id": "MKD",
  "name": "Makadara",
  "lat": -1.2968,
  "lon": 36.8588,
  "approx": true
 },
 {
  "id": "KRB",
  "name": "Kariobangi South",
  "lat": -1.2693768,
  "lon": 36.8873653,
  "approx": false
 },
 {
  "id": "MWK",
  "name": "Mwiki",
  "lat": -1.2350815,
  "lon": 36.9370912,
  "approx": false
 },
 {
  "id": "RUI",
  "name": "Ruiru",
  "lat": -1.150303,
  "lon": 36.9605273,
  "approx": false
 },
 {
  "id": "JAM",
  "name": "Jamuhuri",
  "lat": -1.3045149,
  "lon": 36.7680792,
  "approx": false
 },
 {
  "id": "KIB",
  "name": "Kibera",
  "lat": -1.3057767,
  "lon": 36.7696658,
  "approx": false
 },
 {
  "id": "SAT",
  "name": "Satellite",
  "lat": -1.2985823,
  "lon": 36.7453812,
  "approx": false
 },
 {
  "id": "LEN",
  "name": "Lenana Halt",
  "lat": -1.30265,
  "lon": 36.7301104,
  "approx": false
 },
 {
  "id": "MUT",
  "name": "Mutuini",
  "lat": -1.2963818,
  "lon": 36.7064086,
  "approx": false
 },
 {
  "id": "DAG",
  "name": "Dagoretti Market",
  "lat": -1.28442,
  "lon": 36.6828532,
  "approx": false
 },
 {
  "id": "THO",
  "name": "Thogoto",
  "lat": -1.2663887,
  "lon": 36.6771667,
  "approx": false
 },
 {
  "id": "GIT",
  "name": "Gitaru",
  "lat": -1.2373738,
  "lon": 36.6751103,
  "approx": false
 },
 {
  "id": "KIK",
  "name": "Kikuyu",
  "lat": -1.2461656,
  "lon": 36.6609366,
  "approx": false
 },
 {
  "id": "MUG",
  "name": "Muguga",
  "lat": -1.1787125,
  "lon": 36.6489392,
  "approx": false
 },
 {
  "id": "LIM",
  "name": "Limuru",
  "lat": -1.1150876,
  "lon": 36.6427913,
  "approx": false
 },
 {
  "id": "UMO",
  "name": "Umoja / Mutindwa",
  "lat": -1.2861195,
  "lon": 36.8838762,
  "approx": false
 },
 {
  "id": "AVI",
  "name": "Aviation",
  "lat": -1.3197544,
  "lon": 36.9060491,
  "approx": false
 },
 {
  "id": "IMD",
  "name": "Imara Daima",
  "lat": -1.3283403,
  "lon": 36.8742201,
  "approx": false
 },
 {
  "id": "EMB",
  "name": "Embakasi",
  "lat": -1.3505949,
  "lon": 36.8941437,
  "approx": false
 },
 {
  "id": "TRM",
  "name": "Nairobi Terminus (SGR)",
  "lat": -1.3553597,
  "lon": 36.8980718,
  "approx": false
 },
 {
  "id": "MLO",
  "name": "Mlolongo",
  "lat": -1.3990488,
  "lon": 36.9345142,
  "approx": false
 },
 {
  "id": "ATH",
  "name": "Athi River",
  "lat": -1.449094,
  "lon": 36.9754339,
  "approx": false
 },
 {
  "id": "LUK",
  "name": "Lukenya",
  "lat": -1.5235111,
  "lon": 36.9654496,
  "approx": false
 }
];
export const RAIL_LINE_STATIONS_BUNDLED: RailLineStationRow[] = [
 {
  "lineId": "L1",
  "seq": 1,
  "stationId": "NRB"
 },
 {
  "lineId": "L1",
  "seq": 2,
  "stationId": "MKD"
 },
 {
  "lineId": "L1",
  "seq": 3,
  "stationId": "KRB"
 },
 {
  "lineId": "L1",
  "seq": 4,
  "stationId": "MWK"
 },
 {
  "lineId": "L1",
  "seq": 5,
  "stationId": "RUI"
 },
 {
  "lineId": "L2",
  "seq": 1,
  "stationId": "NRB"
 },
 {
  "lineId": "L2",
  "seq": 2,
  "stationId": "JAM"
 },
 {
  "lineId": "L2",
  "seq": 3,
  "stationId": "KIB"
 },
 {
  "lineId": "L2",
  "seq": 4,
  "stationId": "SAT"
 },
 {
  "lineId": "L2",
  "seq": 5,
  "stationId": "LEN"
 },
 {
  "lineId": "L2",
  "seq": 6,
  "stationId": "MUT"
 },
 {
  "lineId": "L2",
  "seq": 7,
  "stationId": "DAG"
 },
 {
  "lineId": "L2",
  "seq": 8,
  "stationId": "THO"
 },
 {
  "lineId": "L2",
  "seq": 9,
  "stationId": "GIT"
 },
 {
  "lineId": "L2",
  "seq": 10,
  "stationId": "KIK"
 },
 {
  "lineId": "L2",
  "seq": 11,
  "stationId": "MUG"
 },
 {
  "lineId": "L2",
  "seq": 12,
  "stationId": "LIM"
 },
 {
  "lineId": "L3",
  "seq": 1,
  "stationId": "NRB"
 },
 {
  "lineId": "L3",
  "seq": 2,
  "stationId": "MKD"
 },
 {
  "lineId": "L3",
  "seq": 3,
  "stationId": "UMO"
 },
 {
  "lineId": "L3",
  "seq": 4,
  "stationId": "AVI"
 },
 {
  "lineId": "L3",
  "seq": 5,
  "stationId": "IMD"
 },
 {
  "lineId": "L3",
  "seq": 6,
  "stationId": "EMB"
 },
 {
  "lineId": "L3",
  "seq": 7,
  "stationId": "TRM"
 },
 {
  "lineId": "L3",
  "seq": 8,
  "stationId": "MLO"
 },
 {
  "lineId": "L3",
  "seq": 9,
  "stationId": "ATH"
 },
 {
  "lineId": "L3",
  "seq": 10,
  "stationId": "LUK"
 }
];
