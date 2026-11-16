import { useEffect, useState } from "react";
import { Copy, Gamepad2, LockKeyhole, Palette, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type RoomPlayer = { seat: number; user_id: string };
type Profile = { handle: string; xp: number; avatar: { token?: string; colour?: string } | null };
const COSMETICS = [
  { id: "classic", name: "Classic bus", minXp: 0, token: "🚌", colour: "#22d3ee" },
  { id: "matatu", name: "Neon matatu", minXp: 100, token: "🚐", colour: "#f472b6" },
  { id: "stage-king", name: "Stage King", minXp: 250, token: "👑", colour: "#facc15" },
  { id: "superstar", name: "Road superstar", minXp: 500, token: "⭐", colour: "#a78bfa" },
];
const ROOM_GAMES = ["tycoon", "chess", "ludo", "trivia", "memory", "snake", "whack"];

export default function MirthSocialPanel({ gameId = "chess" }: { gameId?: string }) {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [profile, setProfile] = useState<Profile>({ handle: "", xp: 0, avatar: { token: "🚌", colour: "#22d3ee" } });
  const [handle, setHandle] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [roomGame, setRoomGame] = useState(gameId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !signedIn || !user) return;
    let cancelled = false;
    void supabase.from("mirth_players").select("handle,xp,avatar").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return;
      const next = { handle: data.handle, xp: Number(data.xp), avatar: data.avatar ?? {} } as Profile;
      setProfile(next); setHandle(next.handle);
      localStorage.setItem("mirth_active_cosmetic_v1", JSON.stringify(next.avatar));
    });
    return () => { cancelled = true; };
  }, [signedIn, user?.id]);

  useEffect(() => {
    if (!supabase || !roomId) return;
    let cancelled = false;
    const loadRoom = async () => {
      const { data, error } = await supabase!.from("mirth_room_players").select("seat,user_id").eq("room_id", roomId).order("seat");
      if (!cancelled && !error) setPlayers((data ?? []) as RoomPlayer[]);
    };
    void loadRoom();
    const timer = window.setInterval(() => void loadRoom(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [roomId]);

  const saveProfile = async () => {
    if (!supabase || !user || !signedIn) { toast("Sign in with Google or phone to save a player profile."); return; }
    const clean = handle.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 24) { toast("Choose a handle between 2 and 24 characters."); return; }
    setBusy(true);
    const { error } = await supabase.from("mirth_players").upsert({ user_id: user.id, handle: clean, avatar: profile.avatar ?? {} }, { onConflict: "user_id" });
    setBusy(false);
    if (error) { toast(error.message); return; }
    setProfile(old => ({ ...old, handle: clean })); toast("Player profile saved.");
  };
  const pickCosmetic = async (cosmetic: typeof COSMETICS[number]) => {
    if (cosmetic.minXp > profile.xp) return;
    const nextAvatar = { token: cosmetic.token, colour: cosmetic.colour };
    setProfile(old => ({ ...old, avatar: nextAvatar }));
    localStorage.setItem("mirth_active_cosmetic_v1", JSON.stringify(nextAvatar));
    if (supabase && user && signedIn && profile.handle) {
      const { error } = await supabase.from("mirth_players").upsert({ user_id: user.id, handle: profile.handle, avatar: nextAvatar }, { onConflict: "user_id" });
      if (error) toast(error.message);
    }
  };
  const createRoom = async () => {
    if (!supabase || !signedIn) { toast("Sign in to create a friend room."); return; }
    setBusy(true); const { data, error } = await supabase.rpc("create_mirth_room", { p_game_id: roomGame }); setBusy(false);
    if (error) { toast(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setRoomCode(String(row?.room_code ?? "")); setRoomId(String(row?.room_id ?? ""));
    toast("Room created. Share its five-character code with your friend.");
  };
  const joinRoom = async () => {
    if (!supabase || !signedIn) { toast("Sign in to join a friend room."); return; }
    const clean = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(clean)) { toast("Enter the five-character room code."); return; }
    setBusy(true); const { data, error } = await supabase.rpc("join_mirth_room", { p_code: clean });
    if (error) { setBusy(false); toast(error.message); return; }
    const joinedId = String(data);
    const { data: room } = await supabase.from("mirth_rooms").select("game_id").eq("id", joinedId).maybeSingle();
    setBusy(false); setRoomId(joinedId); setRoomCode(clean); if (room?.game_id) setRoomGame(room.game_id); toast("You joined the room lobby.");
  };
  const copyCode = async () => { try { await navigator.clipboard.writeText(roomCode); toast("Room code copied."); } catch { toast(`Room code: ${roomCode}`); } };

  return <div className="ios-glass" style={{ padding: 11, marginBottom: 12 }}>
    <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".75rem" }}><Users size={14} style={{ color: "var(--ready)" }} />Player profile & friends</b>
    {!isSupabaseConfigured || !signedIn ? <p style={{ margin: "6px 0 0", color: "var(--muted2)", fontSize: ".59rem", lineHeight: 1.45 }}>Sign in with Google or phone to save your handle, XP and room membership. Single-player games remain available without sign-in.</p> : <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7, marginTop: 8 }}><label>Player handle<input className="finput" maxLength={24} placeholder="Choose a stage name" value={handle} onChange={event => setHandle(event.target.value)} /></label><button className="btn btn-ready" style={{ alignSelf: "end", padding: "8px 10px" }} disabled={busy} onClick={() => void saveProfile()}>Save</button></div>
      <p style={{ margin: "6px 0", fontSize: ".62rem", color: "var(--muted2)" }}>XP: <b style={{ color: "var(--ready)" }}>{profile.xp}</b> · cosmetics unlock as your score XP grows</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{COSMETICS.map(cosmetic => {
        const locked = profile.xp < cosmetic.minXp;
        const active = profile.avatar?.token === cosmetic.token;
        return <button key={cosmetic.id} className="pill" disabled={locked} onClick={() => void pickCosmetic(cosmetic)} style={{ opacity: locked ? .48 : 1, borderColor: active ? cosmetic.colour : undefined, color: active ? cosmetic.colour : undefined }}>
          {locked ? <LockKeyhole size={10} /> : <Palette size={10} />} {cosmetic.token} {cosmetic.name}{locked ? ` · ${cosmetic.minXp} XP` : ""}
        </button>;
      })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 10 }}>
        <div style={{ display: "flex", gap: 5 }}><select className="finput" value={roomGame} onChange={event => setRoomGame(event.target.value)} aria-label="Choose room game">{ROOM_GAMES.map(id => <option key={id} value={id}>{id === "memory" ? "Matatu Match" : id === "whack" ? "Whack-a-Matatu" : id === "snake" ? "Matatu Snake" : id[0].toUpperCase() + id.slice(1)}</option>)}</select><button className="btn btn-ghost" style={{ justifyContent: "center", padding: "7px 8px", fontSize: ".56rem" }} disabled={busy} onClick={() => void createRoom()}><Gamepad2 size={12} /> Create</button></div>
        <div style={{ display: "flex", gap: 5 }}><input className="finput" maxLength={5} placeholder="5-char code" value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} /><button className="btn btn-ghost" disabled={busy} onClick={() => void joinRoom()} style={{ padding: "7px 9px" }}>Join</button></div>
      </div>
      {roomCode && <div className="card" style={{ marginTop: 8, padding: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><b style={{ flex: 1, letterSpacing: ".18em", color: "var(--ready)" }}>ROOM {roomCode}</b><button className="icon-btn" aria-label="Copy room code" onClick={() => void copyCode()}><Copy size={13} /></button></div><small style={{ color: "var(--muted2)" }}>{players.length}/4 players in lobby · game: {roomGame}</small></div>}
      <p style={{ color: "var(--muted2)", fontSize: ".53rem", lineHeight: 1.45, margin: "8px 0 0" }}>Friend-room creation and joining use Supabase, but live turn/move sync is not enabled yet. A server-side move validator is required before room play; room state cannot be edited by browsers.</p>
    </>}
  </div>;
}
