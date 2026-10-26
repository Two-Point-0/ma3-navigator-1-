import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Search, Heart, ThumbsUp, Users, X, Swords, MessageSquareQuote, Crown, Dices, Brain, Grid3x3, BusFront, LoaderCircle, Trophy, Star, MapPin, Sparkles, Shield, Volume2, Route, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import PageTabs from "@/components/PageTabs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import maplibregl from "maplibre-gl";
import { removeLineLayer, setLineLayer } from "@/lib/mapLayers";

type Section = "games" | "nganya" | "challenges";
type GameDef = { id: string; name: string; Icon: React.ElementType; desc: string; players: string };
type Nganya = { id: string; display_name: string; sacco: string | null; route_code: string; route_label: string | null; image_url: string | null };
type Season = { id: string; title: string; season_year: number; status: "open" | "finalists"; opens_on: string; closes_on: string; finalist_limit: number };
type SeasonCandidate = Nganya & { finalist: boolean; voteCount: number };
type PointEvent = { activity: "nganya_vote" | "poi_navigation"; reference_key: string; points: number };
type StyleAverage = { artwork: number; sound: number; lighting: number; comfort: number; driving: number; service: number; rating_count: number };
type AnnualRow = Nganya & { active: boolean; vote_count: number; matatu_id?: string };
type RouteShape = { route_code: string; route_label: string; geometry: any };
const NAIROBI: [number, number] = [-1.2864, 36.8172];
function geoLines(value: any): [number, number][][] {
  if (!value) return [];
  if (value.type === "Feature") return geoLines(value.geometry);
  if (value.type === "FeatureCollection") return (value.features ?? []).flatMap((feature: any) => geoLines(feature));
  if (value.type === "LineString") return [value.coordinates ?? []];
  if (value.type === "MultiLineString") return value.coordinates ?? [];
  if (value.type === "GeometryCollection") return (value.geometries ?? []).flatMap((geometry: any) => geoLines(geometry));
  return [];
}

const GAMES: GameDef[] = [
  { id: "mchongwano", name: "Mchongwano", Icon: MessageSquareQuote, desc: "Roast battle in Sheng — crowd judges, clean but merciless.", players: "2 players" },
  { id: "chess", name: "Chess", Icon: Crown, desc: "Classic strategy — outwit your opponent.", players: "2 players" },
  { id: "ludo", name: "Ludo", Icon: Dices, desc: "Race your tokens home — roll and move.", players: "2–4 players" },
  { id: "trivia", name: "Trivia", Icon: Brain, desc: "General knowledge head-to-head.", players: "2 players" },
  { id: "monopoly", name: "Nairobi Board Game", Icon: Grid3x3, desc: "A neighbourhood property-trading game concept.", players: "2–4 players" },
];
const LazyTrivia = lazy(() => import("@/components/TriviaGame"));
const FAVOURITES_KEY = "ma3_nganya_favourites_v1";
const TAB_OPTIONS = [
  { id: "games", label: "Games", Icon: Swords },
  { id: "nganya", label: "Nganya battle", Icon: BusFront },
  { id: "challenges", label: "Challenges", Icon: Trophy },
] as const;
const RATING_FIELDS = [
  { key: "artwork", label: "Armour & exterior art" }, { key: "sound", label: "Music system" },
  { key: "lighting", label: "Lighting & entertainment" }, { key: "driving", label: "Driving style" },
  { key: "service", label: "Service & cleanliness" }, { key: "comfort", label: "Passenger comfort" },
] as const;
function kenyaDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export default function MirthPage() {
  const [section, setSection] = useState<Section>("games");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(20);
  const sheetDrag = useRef<{ y: number; height: number } | null>(null);
  const [gameQuery, setGameQuery] = useState("");
  const [gameChoice, setGameChoice] = useState(GAMES[0].id);
  const [gameRadius, setGameRadius] = useState(5);
  const [gameMatchMode, setGameMatchMode] = useState<"onboard" | "same-route">("onboard");
  const [gameRoute, setGameRoute] = useState("");
  const [triviaStarted, setTriviaStarted] = useState(() => sessionStorage.getItem(`mirth-trivia-start-${kenyaDate()}`) === "1");
  const [saccoQuery, setSaccoQuery] = useState("");
  const [nganyaQuery, setNganyaQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [selectedNganya, setSelectedNganya] = useState<Nganya | null>(null);
  const [styleAverage, setStyleAverage] = useState<StyleAverage | null>(null);
  const [ratingForm, setRatingForm] = useState<Record<string, string>>({ artwork: "", sound: "", lighting: "", comfort: "", driving: "", service: "" });
  const [matatus, setMatatus] = useState<Nganya[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [votedRoutes, setVotedRoutes] = useState<Set<string>>(new Set());
  const [dailyEvents, setDailyEvents] = useState<PointEvent[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [seasonCandidates, setSeasonCandidates] = useState<SeasonCandidate[]>([]);
  const [seasonPick, setSeasonPick] = useState<string | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [leaderboardYear, setLeaderboardYear] = useState(Number(kenyaDate().slice(0, 4)));
  const [leaderboardQuery, setLeaderboardQuery] = useState("");
  const [annualLeaderboard, setAnnualLeaderboard] = useState<AnnualRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
  const [mirthMap, setMirthMap] = useState<maplibregl.Map | null>(null);
  const mirthMapRef = useRef<MapLibreHandle>(null);
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAVOURITES_KEY) || "[]") as string[]); }
    catch { return new Set(); }
  });
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data, error }, { data: totals }] = await Promise.all([
        supabase!.from("nganya_matatus").select("id,display_name,sacco,route_code,route_label,image_url").eq("active", true).order("route_code").order("display_name"),
        supabase!.rpc("get_nganya_vote_totals"),
      ]);
      if (cancelled) return;
      if (error) { setBackendReady(false); setLoading(false); return; }
      const activeMatatus = (data ?? []) as Nganya[];
      setMatatus(activeMatatus);
      setCounts(Object.fromEntries((totals ?? []).map((row: { matatu_id: string; vote_count: number }) => [row.matatu_id, Number(row.vote_count)])));
      const { data: authData } = await supabase!.auth.getUser();
      if (authData.user) {
        const [{ data: ownVotes }, { data: events }] = await Promise.all([
          supabase!.from("nganya_votes").select("route_code").eq("user_id", authData.user.id).eq("vote_date", kenyaDate()),
          supabase!.from("nganya_point_events").select("activity,reference_key,points").eq("user_id", authData.user.id).eq("event_date", kenyaDate()),
        ]);
        if (!cancelled) {
          setVotedRoutes(new Set((ownVotes ?? []).map((row: { route_code: string }) => row.route_code)));
          setDailyEvents((events ?? []) as PointEvent[]);
        }
      }
      const { data: activeSeason } = await supabase!.from("nganya_seasons").select("id,title,season_year,status,opens_on,closes_on,finalist_limit").in("status", ["open", "finalists"]).order("season_year", { ascending: false }).limit(1).maybeSingle();
      if (cancelled) return;
      if (activeSeason) {
        const [{ data: entries }, { data: seasonTotals }] = await Promise.all([
          supabase!.from("nganya_season_entries").select("matatu_id,route_code,finalist").eq("season_id", activeSeason.id),
          supabase!.rpc("get_nganya_season_vote_totals", { p_opens_on: activeSeason.opens_on, p_closes_on: activeSeason.closes_on }),
        ]);
        const votesById = Object.fromEntries((seasonTotals ?? []).map((row: { matatu_id: string; vote_count: number }) => [row.matatu_id, Number(row.vote_count)]));
        const matatuById = new Map(activeMatatus.map(item => [item.id, item]));
        setSeasonCandidates((entries ?? []).flatMap((entry: { matatu_id: string; route_code: string; finalist: boolean }) => {
          const item = matatuById.get(entry.matatu_id);
          return item ? [{ ...item, route_code: entry.route_code, finalist: entry.finalist, voteCount: votesById[entry.matatu_id] ?? 0 }] : [];
        }).sort((a: SeasonCandidate, b: SeasonCandidate) => b.voteCount - a.voteCount));
        setSeason(activeSeason as Season);
        if (authData.user) {
          const { data: ownPick } = await supabase!.from("nganya_season_picks").select("matatu_id").eq("season_id", activeSeason.id).eq("user_id", authData.user.id).maybeSingle();
          if (!cancelled) setSeasonPick(ownPick?.matatu_id ?? null);
        }
      } else { setSeason(null); setSeasonCandidates([]); }
      if (!cancelled) { setBackendReady(true); setLoading(false); }
    })().catch(error => {
      console.error("Mirth data load failed", error);
      if (!cancelled) { setBackendReady(false); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !backendReady) return;
    let cancelled = false;
    setLeaderboardLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase!.rpc("get_nganya_annual_leaderboard", { p_year: leaderboardYear });
        if (cancelled) return;
        if (error) { console.error("Nganya annual leaderboard unavailable", error); setAnnualLeaderboard([]); }
        else setAnnualLeaderboard((data ?? []).map((row: AnnualRow) => ({ ...row, id: row.matatu_id || row.id, vote_count: Number(row.vote_count) })));
      } catch (error) {
        console.error("Nganya annual leaderboard failed", error);
        if (!cancelled) setAnnualLeaderboard([]);
      } finally { if (!cancelled) setLeaderboardLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [backendReady, leaderboardYear]);

  const saveFavourites = (next: Set<string>) => {
    setFavourites(next);
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...next]));
  };
  const toggleFavourite = (id: string) => {
    const next = new Set(favourites);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveFavourites(next);
  };
  const refreshPoints = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from("nganya_point_events").select("activity,reference_key,points").eq("user_id", userId).eq("event_date", kenyaDate());
    setDailyEvents((data ?? []) as PointEvent[]);
  };
  const getUser = async () => {
    if (!supabase) return null;
    let user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) { toast("Sign in to take part in community activities."); return null; }
      user = data.user;
    }
    return user;
  };
  const toggleVote = async (item: Nganya) => {
    if (!isSupabaseConfigured || !supabase || !backendReady) { toast("Nganya voting is temporarily unavailable."); return; }
    if (votedRoutes.has(item.route_code)) { toast(`You have already voted on ${item.route_label || item.route_code} today. Try a different route tomorrow.`); return; }
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from("nganya_votes").insert({ matatu_id: item.id, user_id: user.id });
    if (error) {
      toast(error.code === "23505" ? "One vote per route per account each Nairobi day." : "Could not save the vote. Try again later.");
      return;
    }
    setVotedRoutes(current => new Set([...current, item.route_code]));
    setCounts(current => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));
    await refreshPoints(user.id);
    toast(`Vote saved for ${item.route_label || item.route_code}. +10 community points.`);
  };
  const openNganya = async (item: Nganya) => {
    setSheetOpen(false); setSelectedNganya(item); setStyleAverage(null);
    setRatingForm({ artwork: "", sound: "", lighting: "", comfort: "", driving: "", service: "" });
    if (supabase) {
      const { data } = await supabase.rpc("get_nganya_style_averages", { p_matatu_id: item.id });
      const row = (data ?? []).find((entry: StyleAverage & { matatu_id: string }) => entry.matatu_id === item.id);
      if (row) setStyleAverage(row);
    }
  };
  const submitRating = async () => {
    if (!selectedNganya) return;
    if (!supabase) { toast("Community ratings are temporarily unavailable."); return; }
    if (RATING_FIELDS.some(field => !ratingForm[field.key])) { toast("Choose a 1–5 score for every style attribute."); return; }
    const user = await getUser(); if (!user) return;
    const values = Object.fromEntries(RATING_FIELDS.map(field => [field.key, Number(ratingForm[field.key])])) as { artwork: number; sound: number; lighting: number; comfort: number; driving: number; service: number };
    const { error } = await supabase.from("nganya_ratings").upsert({ matatu_id: selectedNganya.id, user_id: user.id, ...values, updated_at: new Date().toISOString() }, { onConflict: "matatu_id,user_id" });
    if (error) { toast("Could not save your community style rating. Try again later."); return; }
    const { data } = await supabase.rpc("get_nganya_style_averages", { p_matatu_id: selectedNganya.id });
    setStyleAverage((data ?? []).find((entry: StyleAverage & { matatu_id: string }) => entry.matatu_id === selectedNganya.id) ?? null);
    toast("Community style rating saved.");
  };
  const placeSeasonPick = async (candidate: SeasonCandidate) => {
    if (!season || !supabase || !backendReady) { toast("Free predictions are temporarily unavailable."); return; }
    if (seasonPick) { toast("Your free prediction for this season is already saved."); return; }
    const user = await getUser(); if (!user) return;
    const { error } = await supabase.from("nganya_season_picks").insert({ season_id: season.id, matatu_id: candidate.id, user_id: user.id });
    if (error) { toast(error.code === "23505" ? "Only one prediction is allowed per season." : "Could not save your free prediction."); return; }
    setSeasonPick(candidate.id); toast("Free, non-cash season prediction saved.");
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase!.from("nganya_route_shapes").select("route_code,route_label,geometry").eq("active", true);
      if (error) { console.warn("Could not load Nganya route map", error.message); return; }
      if (!cancelled) setRouteShapes((data ?? []) as RouteShape[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredGames = useMemo(() => {
    const query = gameQuery.trim().toLowerCase();
    return query ? GAMES.filter(game => `${game.name} ${game.desc}`.toLowerCase().includes(query)) : [];
  }, [gameQuery]);
  const routes = useMemo(() => [...new Set(matatus.map(item => item.route_code))], [matatus]);
  const routeStandings = useMemo(() => {
    const grouped = new Map<string, { route_code: string; route_label: string; vote_count: number; matatu_count: number }>();
    for (const item of annualLeaderboard) {
      const current = grouped.get(item.route_code);
      if (current) { current.matatu_count += 1; current.vote_count += item.vote_count; }
      else grouped.set(item.route_code, { route_code: item.route_code, route_label: item.route_label || item.route_code, vote_count: item.vote_count, matatu_count: 1 });
    }
    return [...grouped.values()].sort((a, b) => b.vote_count - a.vote_count || a.route_code.localeCompare(b.route_code));
  }, [annualLeaderboard]);
  const [battleRouteA, setBattleRouteA] = useState("");
  const [battleRouteB, setBattleRouteB] = useState("");
  const routeA = routeStandings.find(item => item.route_code === battleRouteA) ?? routeStandings[0] ?? null;
  const routeB = routeStandings.find(item => item.route_code === battleRouteB && item.route_code !== routeA?.route_code)
    ?? routeStandings.find(item => item.route_code !== routeA?.route_code) ?? null;
  useEffect(() => {
    if (!mirthMap) return;
    for (const code of routeShapes.map(shape => shape.route_code)) removeLineLayer(mirthMap, `mirth-route-${code.replace(/[^a-zA-Z0-9_-]/g, "-")}`);
    const chosenCodes = section === "nganya" && selectedNganya ? [selectedNganya.route_code] : [];
    routeShapes.filter(shape => chosenCodes.includes(shape.route_code)).forEach((shape, index) => {
      const coords = geoLines(shape.geometry).find(line => line.length > 1);
      if (coords) setLineLayer(mirthMap, `mirth-route-${shape.route_code.replace(/[^a-zA-Z0-9_-]/g, "-")}`, coords.map(([lon, lat]) => [lat, lon]), index ? "#16a34a" : "#d97706", 4, .88);
    });
    const coords = routeShapes.filter(shape => chosenCodes.includes(shape.route_code)).flatMap(shape => geoLines(shape.geometry).flat());
    if (coords.length) mirthMapRef.current?.fitBounds([[Math.min(...coords.map(p => p[0])), Math.min(...coords.map(p => p[1]))], [Math.max(...coords.map(p => p[0])), Math.max(...coords.map(p => p[1]))]], 80);
  }, [mirthMap, routeShapes, section, selectedNganya?.route_code]);
  const filteredNganyas = useMemo(() => {
    const query = nganyaQuery.trim().toLowerCase();
    const sacco = saccoQuery.trim().toLowerCase();
    return matatus.filter(item => (routeFilter === "all" || item.route_code === routeFilter) && (!onlyFavourites || favourites.has(item.id)) && (!query || item.display_name.toLowerCase().includes(query)) && (!sacco || (item.sacco ?? "").toLowerCase().includes(sacco)));
  }, [matatus, nganyaQuery, saccoQuery, routeFilter, onlyFavourites, favourites]);
  const favouriteNganyas = matatus.filter(item => favourites.has(item.id));
  const filteredAnnualLeaderboard = annualLeaderboard.filter(item => {
    const query = leaderboardQuery.trim().toLowerCase();
    return !query || `${item.display_name} ${item.sacco ?? ""} ${item.route_code} ${item.route_label ?? ""}`.toLowerCase().includes(query);
  });
  const voteRoutesDone = new Set(dailyEvents.filter(event => event.activity === "nganya_vote").map(event => event.reference_key)).size;
  const visitedPlacesDone = dailyEvents.filter(event => event.activity === "poi_navigation").length;
  const pointsToday = dailyEvents.reduce((sum, event) => sum + Number(event.points), 0);
  const statusMessage = loading ? "Loading registered Nganya…" : !backendReady ? "Nganya voting is temporarily unavailable." : matatus.length ? "One vote per route, per account, per Nairobi day. Every registered Nganya remains in the annual archive." : "No Nganya entries are listed yet.";

  const NganyaCard = ({ item }: { item: Nganya }) => {
    const saved = favourites.has(item.id);
    const alreadyVoted = votedRoutes.has(item.route_code);
    return <div className="card" style={{ padding: 11, display: "flex", alignItems: "center", gap: 9 }}>
      {item.image_url ? <img src={item.image_url} alt={`${item.display_name} Nganya`} loading="lazy" decoding="async" style={{ width: 42, height: 42, borderRadius: 11, objectFit: "cover" }} /> : <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(217,119,6,.12)", display: "grid", placeItems: "center", color: "var(--ready)" }}><BusFront size={20} /></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={() => { setSection("nganya"); void openNganya(item); }} style={{ display: "block", border: 0, padding: 0, background: "transparent", color: "var(--white)", fontWeight: 800, fontSize: ".76rem", textAlign: "left", cursor: "pointer" }}>{item.display_name}</button>
        <small style={{ color: "var(--muted2)" }}>{item.route_label || item.route_code}{item.sacco ? ` · ${item.sacco}` : ""}</small>
        <small style={{ display: "block", color: "var(--muted)" }}>{counts[item.id] ?? 0} all-time route votes</small>
        <small style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ready)", marginTop: 3 }}><Swords size={10} />Battle score {annualLeaderboard.find(row => row.id === item.id)?.vote_count ?? 0} · armour/style is community-rated, not a safety claim</small>
      </div>
      <button className="icon-btn" aria-label={saved ? "Remove favourite" : "Add favourite"} onClick={() => toggleFavourite(item.id)} style={{ color: saved ? "var(--ready)" : "var(--muted2)" }}><Heart size={15} fill={saved ? "currentColor" : "none"} /></button>
      <button className="btn btn-ready" disabled={alreadyVoted || loading || !backendReady} onClick={() => void toggleVote(item)} style={{ padding: "8px 9px", opacity: alreadyVoted ? .66 : 1 }}><ThumbsUp size={13} />{alreadyVoted ? "Route voted" : "Vote"}</button>
    </div>;
  };

  return <div className="page-wrap" style={{ position: "relative", minHeight: "calc(100dvh - var(--top-h))", paddingTop: "calc(var(--top-h) + 8px)" }}>
    <div style={{ position: "fixed", top: "var(--top-h)", left: 0, right: 0, bottom: "var(--nav-h)", zIndex: 0 }}><MapLibreView ref={mirthMapRef} center={NAIROBI} zoom={10} height="100%" borderRadius={0} onLoad={setMirthMap} /></div>
    <div className="inner" style={{ position: "absolute", top: 10, left: 0, right: 0, zIndex: 20 }}>
    <header style={{ padding: "0 0 .5rem" }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><Gamepad2 size={18} style={{ color: "var(--ready)" }} /><h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>Mirth</h2><span style={{ marginLeft: "auto", fontSize: ".55rem", color: "var(--muted2)" }}>Games · Nganya · Challenges</span></div></header>
    <PageTabs label="Mirth sections" active={section} tabs={TAB_OPTIONS} onChange={id => { setSection(id as Section); setSheetHeight(20); setSheetOpen(true); }} />
    </div>

    <AnimatePresence>{sheetOpen && <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }} className="bpanel open" style={{ position: "fixed", bottom: "var(--nav-h)", height: `${sheetHeight}vh`, maxHeight: "calc(100dvh - var(--top-h) - var(--nav-h) - 24px)" }}>
      <div className="bpanel-head" onPointerDown={event => { sheetDrag.current = { y: event.clientY, height: sheetHeight }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (sheetDrag.current) setSheetHeight(Math.max(20, Math.min(50, sheetDrag.current.height + ((sheetDrag.current.y - event.clientY) / window.innerHeight) * 100))); }} onPointerUp={() => { sheetDrag.current = null; }} style={{ touchAction: "none", cursor: "ns-resize" }}>
        <button aria-label={sheetHeight > 35 ? "Collapse panel" : "Expand panel"} className="handle" onClick={() => setSheetHeight(height => height > 35 ? 20 : 50)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ flex: 1, fontSize: ".75rem" }}>{section === "games" ? "Find a game" : section === "nganya" ? "Nganya route battle" : "Daily challenges"}</b><button className="icon-btn" aria-label="Close panel" onClick={() => setSheetOpen(false)}><X size={14} /></button></div>
      </div>
      <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}><div className="inner" style={{ padding: "0 0 18px" }}>

    {section === "challenges" && <div className="ios-glass" style={{ padding: 11, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Sparkles size={14} style={{ color: "var(--ready)" }} /><b style={{ fontSize: ".75rem", flex: 1 }}>Daily challenges · {pointsToday} community points</b><small style={{ color: "var(--muted2)" }}>Kenya day</small></div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".62rem" }}><ThumbsUp size={12} style={{ color: voteRoutesDone ? "var(--go)" : "var(--ready)" }} /><span style={{ flex: 1 }}>Vote for Nganya on up to 3 different routes</span><b>{Math.min(voteRoutesDone, 3)}/3 · +10 each</b></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".62rem" }}><MapPin size={12} style={{ color: visitedPlacesDone ? "var(--go)" : "var(--ready)" }} /><span style={{ flex: 1 }}>Start Ma3 directions to 3 Explore places</span><b>{Math.min(visitedPlacesDone, 3)}/3 · +5 each</b></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".62rem" }}><Gamepad2 size={12} style={{ color: triviaStarted ? "var(--go)" : "var(--ready)" }} /><span style={{ flex: 1 }}>Start a Trivia round</span><b>{triviaStarted ? "1/1 · started" : "0/1"}</b></div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".55rem", lineHeight: 1.4, margin: "8px 0 0" }}>Points are non-cash and have no monetary value. Demo wallet actions never count as paid bookings; points award only from verified backend actions.</p>
    </div>}

    {section === "games" && <section>
      <div className="ios-glass" style={{ padding: 10, marginBottom: 9, display: "grid", gap: 8 }}>
        <label>Choose a game<select className="finput" value={gameChoice} onChange={event => setGameChoice(event.target.value)}>{GAMES.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><label>Player search radius (km)<input className="finput" type="number" min={1} max={25} value={gameRadius} onChange={event => setGameRadius(Math.max(1, Math.min(25, Number(event.target.value) || 1)))} /></label><label>Match style<select className="finput" value={gameMatchMode} onChange={event => setGameMatchMode(event.target.value as "onboard" | "same-route")}><option value="onboard">On-board challenge</option><option value="same-route">Same route</option></select></label></div>
        {gameMatchMode === "same-route" && <label>Choose a route<select className="finput" value={gameRoute} onChange={event => setGameRoute(event.target.value)}><option value="">Any route</option>{routes.map(route => <option key={route} value={route}>{route}</option>)}</select></label>}
        <button className="btn btn-ready" onClick={() => setGameQuery(GAMES.find(game => game.id === gameChoice)?.name ?? "")}><Search size={13} /> Show {GAMES.find(game => game.id === gameChoice)?.name} options</button>
        <small style={{ color: "var(--muted2)", lineHeight: 1.4 }}>Nearby multiplayer matching is a preview; live opponent discovery is not connected yet.</small>
      </div>
      <div style={{ position: "relative", marginBottom: 10 }}><Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 36 }} placeholder="Search games…" value={gameQuery} onChange={event => setGameQuery(event.target.value)} /></div>
      {!gameQuery.trim() && <div className="ios-glass" style={{ padding: 15, textAlign: "center", color: "var(--muted2)", fontSize: ".7rem" }}>Search to narrow the game list.</div>}
      {gameQuery.trim() && <div style={{ display: "grid", gap: 8 }}>{filteredGames.map(game => <motion.button key={game.id} whileTap={{ scale: .98 }} onClick={() => { setSelectedGame(game); if (game.id === "trivia") { sessionStorage.setItem(`mirth-trivia-start-${kenyaDate()}`, "1"); setTriviaStarted(true); } }} className="card" style={{ padding: 13, display: "flex", alignItems: "center", gap: 11, textAlign: "left", width: "100%", color: "var(--white)", cursor: "pointer" }}><div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(217,119,6,.12)", display: "grid", placeItems: "center", color: "var(--ready)" }}><game.Icon size={19} /></div><span style={{ flex: 1 }}><b style={{ display: "block", fontSize: ".8rem" }}>{game.name}</b><small style={{ color: "var(--muted2)" }}>{game.desc}</small></span><Users size={13} style={{ color: "var(--muted2)" }} /><small>{game.players}</small></motion.button>)}{filteredGames.length === 0 && <p style={{ color: "var(--muted2)", textAlign: "center", padding: 18 }}>No games match that search.</p>}</div>}
    </section>}

    {section === "nganya" && <section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 9 }}><label>Matatu name<input data-page-search className="finput" placeholder="e.g. name or nickname" value={nganyaQuery} onChange={event => setNganyaQuery(event.target.value)} /></label><label>SACCO<input className="finput" placeholder="Search SACCO" value={saccoQuery} onChange={event => setSaccoQuery(event.target.value)} /></label></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: 8, marginBottom: 10 }}><label>Route<select className="finput" value={routeFilter} onChange={event => setRouteFilter(event.target.value)}><option value="all">All routes</option>{routes.map(route => <option key={route} value={route}>{route}</option>)}</select></label><button className={`pill ${onlyFavourites ? "on" : ""}`} onClick={() => setOnlyFavourites(value => !value)}><Heart size={10} /> Favourites {favouriteNganyas.length}</button></div>
      <div className="ios-glass" style={{ padding: 12, marginBottom: 10, borderLeft: "3px solid var(--ready)" }}>
        <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".76rem" }}><Swords size={15} style={{ color: "var(--ready)" }} />Route face-off · {leaderboardYear}</b>
        <p style={{ color: "var(--muted2)", fontSize: ".62rem", lineHeight: 1.5, marginTop: 6 }}>Pick two routes to compare annual support. Riders vote for a specific Nganya on its route; votes stay with that vehicle and route. Nobody gets eliminated, so every approved matatu remains in the all-years record.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 }}>
          <label>Route A<select className="finput" value={battleRouteA || routeA?.route_code || ""} onChange={event => setBattleRouteA(event.target.value)}><option value="">Choose route</option>{routeStandings.map(route => <option key={route.route_code} value={route.route_code}>{route.route_label}</option>)}</select></label>
          <label>Route B<select className="finput" value={battleRouteB || routeB?.route_code || ""} onChange={event => setBattleRouteB(event.target.value)}><option value="">Choose another</option>{routeStandings.filter(route => route.route_code !== (battleRouteA || routeA?.route_code)).map(route => <option key={route.route_code} value={route.route_code}>{route.route_label}</option>)}</select></label>
        </div>
        {leaderboardLoading ? <p style={{ color: "var(--muted2)", fontSize: ".63rem", marginTop: 9 }}>Loading annual route votes…</p> : routeA && routeB ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          {[routeA, routeB].map((route, index) => <div key={route.route_code} className="card" style={{ padding: 10, borderColor: index === 0 ? "rgba(217,119,6,.38)" : "var(--border2)" }}>
            <small style={{ color: "var(--muted2)" }}>ROUTE {index === 0 ? "A" : "B"}</small><b style={{ display: "block", fontSize: ".78rem", margin: "4px 0" }}>{route.route_label}</b>
            <p style={{ color: "var(--ready)", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: ".82rem" }}>{route.vote_count.toLocaleString()} votes</p>
            <small style={{ color: "var(--muted2)" }}>{route.matatu_count} approved Nganya entries</small>
          </div>)}
        </div> : <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 8 }}>No annual route votes are available yet.</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 7px" }}><p className="sec-label" style={{ flex: 1 }}>Vote for a registered Nganya · one vote per route each day</p></div>
      {loading && <div style={{ padding: 18, textAlign: "center", color: "var(--muted2)" }}><LoaderCircle size={17} /> Loading the curated list…</div>}
      {!loading && !backendReady && <div className="ios-glass" style={{ padding: 14, color: "var(--muted2)", fontSize: ".68rem" }}>{statusMessage}</div>}
      {!loading && backendReady && filteredNganyas.length === 0 && <div className="ios-glass" style={{ padding: 14, textAlign: "center", color: "var(--muted2)", fontSize: ".7rem" }}>{matatus.length ? "No Nganya match this search, route or favourite filter." : "No Nganya entries are listed yet."}</div>}
      <div style={{ display: "grid", gap: 7 }}>{filteredNganyas.map(item => <NganyaCard key={item.id} item={item} />)}</div>
      <p style={{ color: "var(--muted)", fontSize: ".58rem", lineHeight: 1.45, marginTop: 10 }}>Community favourites are not safety ratings. Votes use Supabase accounts and can be abused; use rate limits and moderation before awards. Vote totals are saved by calendar year and are never wiped when a new contest year starts.</p>
    </section>}

    {section === "challenges" && <section>
      <div className="ios-glass" style={{ padding: 12, marginBottom: 10, borderLeft: "3px solid var(--ready)" }}><b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".76rem" }}><Trophy size={15} style={{ color: "var(--ready)" }} />Nganya battle league · yearly votes</b><p style={{ color: "var(--muted2)", fontSize: ".63rem", lineHeight: 1.5, marginTop: 6 }}>Every approved Nganya stays in the archive. The annual board ranks the top through the rest by real recorded votes; the next year starts a new tally without deleting earlier years. Free predictions are optional and non-cash.</p></div>
      <div style={{ position: "relative", marginBottom: 9 }}><Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 34 }} placeholder="Search yearly results by Nganya, SACCO or route…" value={leaderboardQuery} onChange={event => setLeaderboardQuery(event.target.value)} /></div>
      <div className="ios-glass" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Shield size={14} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ flex: 1 }}>Year-end leaderboard · all vehicles</p><select aria-label="Leaderboard year" className="finput" value={leaderboardYear} onChange={event => setLeaderboardYear(Number(event.target.value))} style={{ width: 95, padding: "6px 7px" }}>{Array.from({ length: 6 }, (_, index) => Number(kenyaDate().slice(0, 4)) - index).map(year => <option key={year} value={year}>{year}</option>)}</select></div>
        {leaderboardLoading ? <p style={{ color: "var(--muted2)", fontSize: ".65rem" }}>Loading the yearly vote archive…</p> : annualLeaderboard.length ? <div style={{ display: "grid", gap: 6 }}>{filteredAnnualLeaderboard.map((item, index) => <div key={item.id} className="card" style={{ padding: 9, display: "grid", gridTemplateColumns: "30px 1fr auto", alignItems: "center", gap: 8 }}><b style={{ color: index === 0 ? "var(--ready)" : "var(--muted2)", fontFamily: "var(--font-mono)" }}>#{index + 1}</b><span style={{ minWidth: 0 }}><b style={{ display: "block", fontSize: ".7rem" }}>{item.display_name}</b><small style={{ color: "var(--muted2)" }}>{item.route_label || item.route_code}{item.sacco ? ` · ${item.sacco}` : ""}{item.active ? "" : " · inactive, archived"}</small></span><span style={{ textAlign: "right" }}><b style={{ display: "block", color: "var(--ready)", fontFamily: "var(--font-mono)", fontSize: ".7rem" }}>{item.vote_count.toLocaleString()}</b><small style={{ color: "var(--muted2)" }}>votes</small></span></div>)}</div> : <p style={{ color: "var(--muted2)", fontSize: ".64rem", lineHeight: 1.5 }}>{backendReady ? "No votes are recorded for this year yet." : "Annual vote results are temporarily unavailable."}</p>}
        {annualLeaderboard.length > 0 && filteredAnnualLeaderboard.length === 0 && <p style={{ color: "var(--muted2)", fontSize: ".63rem", marginTop: 8 }}>No annual results match that search.</p>}
      </div>
      {!season && <div className="ios-glass" style={{ padding: 14 }}><b style={{ fontSize: ".76rem" }}>No season is open</b><p style={{ color: "var(--muted2)", fontSize: ".65rem", lineHeight: 1.5, marginTop: 6 }}>{backendReady ? "The next free prediction round has not been announced." : "Seasonal predictions are temporarily unavailable."}</p></div>}
      {season && <><p className="sec-label">{season.title} · {season.season_year} · free prediction</p><p style={{ color: "var(--muted2)", fontSize: ".61rem", marginBottom: 9 }}>One optional free prediction per account; cutoff {new Date(`${season.closes_on}T23:59:00`).toLocaleDateString()}. The yearly vote archive keeps every matatu, including those outside any prediction shortlist.</p>{seasonPick && <div className="ios-glass" style={{ padding: 9, marginBottom: 8, color: "var(--go)", fontSize: ".66rem" }}>Your free prediction is saved. It cannot be exchanged after voting closes.</div>}
        <div style={{ display: "grid", gap: 7 }}>{seasonCandidates.filter(item => season.status !== "finalists" || item.finalist).map(candidate => <div key={candidate.id} className="card" style={{ padding: 11, display: "flex", alignItems: "center", gap: 9 }}><BusFront size={18} style={{ color: "var(--ready)" }} /><div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".74rem" }}>{candidate.display_name}</b><small style={{ color: "var(--muted2)" }}>{candidate.route_label || candidate.route_code} · {candidate.voteCount} season votes</small></div>{seasonPick === candidate.id ? <span className="chip" style={{ color: "var(--go)" }}>Your pick</span> : <button className="btn btn-ready" disabled={!!seasonPick || !backendReady} onClick={() => void placeSeasonPick(candidate)} style={{ padding: "7px 9px" }}>Predict</button>}</div>)}{seasonCandidates.length === 0 && <p style={{ color: "var(--muted2)", fontSize: ".68rem", padding: 12 }}>The organiser has not published candidate entries yet.</p>}</div>
      </>}
      <div className="ios-glass" style={{ padding: 11, marginTop: 10 }}><p style={{ fontSize: ".62rem", color: "var(--muted2)", lineHeight: 1.5 }}>Fair process recommendation: one vote per account per route/day; publish each round's dates, route representation and tie-break rule in advance; freeze and export each round's vote snapshot; publish the top-30 list and final-event rules. Have an independent moderator review suspicious account bursts before each cut. Do not add cash staking or payouts to this prototype.</p></div>
      <div className="ios-glass" style={{ padding: 11, marginTop: 10 }}><b style={{ fontSize: ".7rem" }}>Real-money betting links are not enabled</b><p style={{ fontSize: ".61rem", color: "var(--muted2)", lineHeight: 1.5, margin: "6px 0 9px" }}>Before listing any operator or affiliate link, verify its current licence and ask the Gambling Regulatory Authority whether this app needs a licence or advert approval for referrals. No odds, stakes or bet placement are handled here.</p><a href="https://gra.go.ke/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ready)", fontSize: ".63rem", fontWeight: 700 }}>GRA licensing, advertising rules and contacts ↗</a></div>
    </section>}

    <p style={{ color: "var(--muted)", fontSize: ".56rem", lineHeight: 1.45, marginTop: 13 }}>Points are not money, prizes or transferable value. Trivia plays as a single-player round; multiplayer game listings are concepts.</p>
      </div></div></motion.div>}</AnimatePresence>

    <AnimatePresence>{selectedNganya && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedNganya(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.56)", backdropFilter: "blur(7px)" }} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="ios-glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, maxWidth: 640, margin: "0 auto", padding: "1.1rem 1rem 1.8rem", borderRadius: "22px 22px 0 0", maxHeight: "86vh", overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ display: "flex", alignItems: "center", gap: 7 }}><BusFront size={17} style={{ color: "var(--ready)" }} />{selectedNganya.display_name}</b><button className="icon-btn" onClick={() => setSelectedNganya(null)}><X size={15} /></button></div><p style={{ color: "var(--muted2)", fontSize: ".63rem", margin: "4px 0 12px" }}>{selectedNganya.route_label || selectedNganya.route_code}{selectedNganya.sacco ? ` · ${selectedNganya.sacco}` : ""}</p><p className="sec-label">Community style stats · 1–5</p>{RATING_FIELDS.map(field => { const value = styleAverage?.[field.key] ?? 0; return <div key={field.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 58, fontSize: ".61rem", color: "var(--muted2)" }}>{field.label}</span><div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--glass2)" }}><div style={{ width: `${Math.min(100, value * 20)}%`, height: "100%", borderRadius: 99, background: "var(--ready)" }} /></div><span style={{ width: 32, textAlign: "right", color: "var(--muted2)", fontSize: ".59rem" }}>{value ? value.toFixed(1) : "—"}</span></div>; })}<p style={{ color: "var(--muted)", fontSize: ".55rem", margin: "3px 0 12px" }}>{styleAverage?.rating_count ? `${styleAverage.rating_count} community rating${styleAverage.rating_count === 1 ? "" : "s"} · subjective style, not safety data` : "No ratings yet. Scores appear only after community members submit them."}</p><div className="ios-glass" style={{ padding: 10 }}><p className="sec-label">Rate the style</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{RATING_FIELDS.map(field => <label key={field.key}>{field.label}<select className="finput" value={ratingForm[field.key]} onChange={event => setRatingForm(current => ({ ...current, [field.key]: event.target.value }))}><option value="">Choose 1–5</option>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}</div><button className="btn btn-ready" style={{ width: "100%", marginTop: 10 }} onClick={() => void submitRating()}><Star size={13} /> Save my style rating</button></div></motion.div></>}</AnimatePresence>

    <AnimatePresence>{selectedGame && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedGame(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)" }} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="ios-glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, maxWidth: 640, margin: "0 auto", padding: "1.2rem 1.2rem 2rem", borderRadius: "22px 22px 0 0", maxHeight: "85vh", overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ display: "flex", alignItems: "center", gap: 8 }}><selectedGame.Icon size={18} style={{ color: "var(--ready)" }} />{selectedGame.name}</b><button className="icon-btn" onClick={() => setSelectedGame(null)}><X size={15} /></button></div><p style={{ color: "var(--muted2)", fontSize: ".72rem", margin: "10px 0" }}>{selectedGame.desc}</p>{selectedGame.id === "trivia" ? <Suspense fallback={<p style={{ padding: 14, textAlign: "center", color: "var(--muted2)", fontSize: ".66rem" }}><LoaderCircle size={14} /> Loading game…</p>}><LazyTrivia /></Suspense> : <div className="ios-glass" style={{ padding: 11, fontSize: ".63rem", color: "var(--muted2)", lineHeight: 1.5 }}>This entry is a game concept, not yet a playable match. A small game module can be loaded only when opened; online multiplayer would need a separate game server.</div>}</motion.div></>}</AnimatePresence>
  </div>;
}
