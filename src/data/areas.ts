// Well-known Nairobi-area neighbourhoods and towns. Positions are APPROXIMATE (centre of the area) and are only used
// to find the nearest matatu stops, so a few hundred metres either way does not matter.
export interface Area { id: string; name: string; lat: number; lon: number }
const a = (name: string, lat: number, lon: number): Area => ({ id: `area-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, lat, lon });

export const AREAS: Area[] = [
  a("Wangige", -1.2, 36.75), a("Langata", -1.364, 36.748), a("Kikuyu", -1.2467, 36.6633), a("Zambezi", -1.229, 36.71), a("Githurai", -1.2, 36.919), a("Kahawa", -1.181, 36.928), a("Gikomba", -1.284, 36.833), a("Kitengela Stage", -1.473, 36.9585), a("Kiserian", -1.418, 36.69), a("Ongata Rongai", -1.396, 36.76), a("Thome", -1.22, 36.83), a("Mwiki", -1.2, 36.93),
  a("Nyayo Estate Embakasi", -1.3170, 36.9060), a("Embakasi", -1.3200, 36.9250), a("Pipeline", -1.3170, 36.8985), a("Donholm", -1.2975, 36.8935),
  a("Umoja", -1.2833, 36.8985), a("Buruburu", -1.2860, 36.8750), a("Kayole", -1.2795, 36.9160), a("Komarock", -1.2760, 36.9060), a("Utawala", -1.2930, 36.9500),
  a("Dandora", -1.2600, 36.8960), a("Kasarani", -1.2220, 36.8990), a("Roysambu", -1.2192, 36.8858), a("Zimmerman", -1.2120, 36.8940), a("Githurai 45", -1.2000, 36.9120),
  a("Kahawa West", -1.1900, 36.9100), a("Ruiru", -1.1480, 36.9600), a("Juja", -1.1000, 37.0120), a("Thika", -1.0333, 37.0693), a("Kiambu Town", -1.1714, 36.8356),
  a("Ruaka", -1.2070, 36.7770), a("Limuru", -1.1050, 36.6430), a("Kikuyu Town", -1.2465, 36.6628), a("Kinoo", -1.2547, 36.7037), a("Kangemi", -1.2677, 36.7488),
  a("Uthiru", -1.2733, 36.7200), a("Kawangware", -1.2827, 36.7432), a("Dagoretti Corner", -1.2987, 36.7457), a("Karen", -1.3197, 36.7107), a("Ngong Town", -1.3636, 36.6588),
  a("Rongai", -1.3963, 36.7589), a("Kitengela", -1.4730, 36.9585), a("Athi River", -1.4560, 36.9780), a("Mlolongo", -1.3940, 36.9400), a("Syokimau", -1.3590, 36.9370),
  a("Westlands", -1.2670, 36.8110), a("Parklands", -1.2610, 36.8180), a("Lavington", -1.2800, 36.7750), a("Kilimani", -1.2900, 36.7900), a("Kileleshwa", -1.2750, 36.7850),
  a("Muthaiga", -1.2560, 36.8320), a("Eastleigh", -1.2750, 36.8480), a("Pangani", -1.2680, 36.8340), a("Ngara", -1.2750, 36.8200), a("Mathare", -1.2610, 36.8570),
  a("Huruma", -1.2540, 36.8630), a("South B", -1.3070, 36.8420), a("South C", -1.3170, 36.8260), a("Nairobi West", -1.3070, 36.8180), a("Madaraka", -1.3090, 36.8130),
  a("Kibera", -1.3125, 36.7870), a("Industrial Area", -1.3030, 36.8470), a("Kitisuru", -1.2300, 36.7900), a("Runda", -1.2150, 36.8040),
];
