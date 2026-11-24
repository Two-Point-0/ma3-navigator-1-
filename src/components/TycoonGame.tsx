import { useEffect, useMemo, useState } from "react";
import DicePopup from "@/components/DicePopup";
import { motion } from "framer-motion";
import { Banknote, BusFront, Dices, Hammer, Landmark, RotateCcw, Trophy } from "lucide-react";

type Group = "brown" | "lightblue" | "pink" | "orange" | "red" | "yellow" | "green" | "blue" | "stage" | "utility";
type Space = { name: string; kind: "start" | "property" | "stage" | "utility" | "kitty" | "dispatch" | "tax" | "yard" | "parking" | "cop"; price?: number; group?: Group; fee?: number; landmark?: string };
type Player = { name: string; token: string; cash: number; position: number; owned: number[]; jailed: number; freePasses: number; };
type Pending = { index: number; tile: Space; diceTotal: number } | null;

const BOARD: Space[] = [
  { name: "Stage Start", kind: "start" },
  { name: "Wayanoff Village", kind: "property", price: 60, group: "brown", landmark: "Wayanoff trading centre tower" },
  { name: "Sacco Kitty", kind: "kitty" },
  { name: "Sultan Hamud", kind: "property", price: 60, group: "brown", landmark: "Wayanoff trading centre tower" },
  { name: "NTSA Inspection Fee", kind: "tax", fee: 200 },
  { name: "Railways Terminal", kind: "stage", price: 200, group: "stage" },
  { name: "Kitengela", kind: "property", price: 100, group: "lightblue", landmark: "Thika Road mall" },
  { name: "Dispatch", kind: "dispatch" },
  { name: "Ruiru", kind: "property", price: 100, group: "lightblue", landmark: "Thika Road mall" },
  { name: "Juja", kind: "property", price: 120, group: "lightblue", landmark: "Thika Road mall" },
  { name: "Impound Yard", kind: "yard" },
  { name: "Githurai", kind: "property", price: 140, group: "pink", landmark: "Kasarani stadium dome" },
  { name: "Water Company", kind: "utility", price: 150, group: "utility" },
  { name: "Kayole", kind: "property", price: 140, group: "pink", landmark: "Kasarani stadium dome" },
  { name: "Kasarani", kind: "property", price: 160, group: "pink", landmark: "Kasarani stadium dome" },
  { name: "Ngara Terminal", kind: "stage", price: 200, group: "stage" },
  { name: "Umoja", kind: "property", price: 180, group: "orange", landmark: "Times Tower" },
  { name: "Sacco Kitty", kind: "kitty" },
  { name: "Donholm", kind: "property", price: 180, group: "orange", landmark: "Times Tower" },
  { name: "Eastleigh", kind: "property", price: 200, group: "orange", landmark: "Times Tower" },
  { name: "TALANTA STADIUM", kind: "parking" },
  { name: "South B", kind: "property", price: 220, group: "red", landmark: "Old Mutual Tower" },
  { name: "Dispatch", kind: "dispatch" },
  { name: "South C", kind: "property", price: 220, group: "red", landmark: "Old Mutual Tower" },
  { name: "Lang'ata", kind: "property", price: 240, group: "red", landmark: "Old Mutual Tower" },
  { name: "Kencom Terminal", kind: "stage", price: 200, group: "stage" },
  { name: "Kilimani", kind: "property", price: 260, group: "yellow", landmark: "Britam Tower" },
  { name: "Kileleshwa", kind: "property", price: 260, group: "yellow", landmark: "Britam Tower" },
  { name: "Power Company", kind: "utility", price: 150, group: "utility" },
  { name: "Parklands", kind: "property", price: 280, group: "yellow", landmark: "Britam Tower" },
  { name: "Traffic Cop Flags You", kind: "cop" },
  { name: "Lavington", kind: "property", price: 300, group: "green", landmark: "GTC Tower (Westlands)" },
  { name: "Westlands", kind: "property", price: 300, group: "green", landmark: "GTC Tower (Westlands)" },
  { name: "Sacco Kitty", kind: "kitty" },
  { name: "Gigiri", kind: "property", price: 320, group: "green", landmark: "GTC Tower (Westlands)" },
  { name: "Country Bus Terminal", kind: "stage", price: 200, group: "stage" },
  { name: "Dispatch", kind: "dispatch" },
  { name: "Karen", kind: "property", price: 350, group: "blue", landmark: "NSSF CBD tower" },
  { name: "Muthaiga", kind: "property", price: 380, group: "blue", landmark: "NSSF CBD tower" },
  { name: "Runda", kind: "property", price: 400, group: "blue", landmark: "NSSF CBD tower" },
];
const COLORS: Record<Group, string> = { brown: "#9b6b43", lightblue: "#38bdf8", pink: "#ec4899", orange: "#fb923c", red: "#ef4444", yellow: "#facc15", green: "#22c55e", blue: "#3b82f6", stage: "#f59e0b", utility: "#a78bfa" };
const LEVEL_COST: Record<string, number> = { brown: 50, lightblue: 50, pink: 100, orange: 100, red: 150, yellow: 150, green: 200, blue: 200 };
const GROUPS: Record<string, string[]> = { brown: ["Wayanoff Village", "Sultan Hamud"], lightblue: ["Kitengela", "Ruiru", "Juja"], pink: ["Githurai", "Kayole", "Kasarani"], orange: ["Umoja", "Donholm", "Eastleigh"], red: ["South B", "South C", "Lang'ata"], yellow: ["Kilimani", "Kileleshwa", "Parklands"], green: ["Lavington", "Westlands", "Gigiri"], blue: ["Karen", "Muthaiga", "Runda"] };
const LANDMARK: Record<string, string> = { brown: "Wayanoff trading centre", lightblue: "Thika Road mall", pink: "Kasarani stadium dome", orange: "Times Tower", red: "Old Mutual Tower", yellow: "Britam Tower", green: "GTC Tower", blue: "NSSF CBD tower" };
const KITTY_CARDS = ["Chama payout — collect KSh 100", "Best-graffiti trophy — collect KSh 150", "Sacco dividend — collect KSh 80", "Wash and wax — pay KSh 50", "Insurance renewal — pay KSh 100", "Birthday kitty — collect KSh 30 from each player", "Get out of the yard free"];
const DISPATCH_CARDS = ["Advance to Stage Start — collect KSh 200", "Advance to Karen", "Thika Road traffic — move back 3", "Cop wants chai — pay KSh 50", "Fuel jump — pay KSh 100 per landmark tower", "Go to the yard", "Rainy-day double fares — collect KSh 100", "Tyre burst — pay KSh 60", "88 Nairobi opens — collect KSh 200 if you own a yellow or green property"];
const STARTING_PLAYERS: Player[] = [
  { name: "You", token: "🚌", cash: 1500, position: 0, owned: [], jailed: 0, freePasses: 0 },
  { name: "Bot Makanga", token: "🐘", cash: 1500, position: 0, owned: [], jailed: 0, freePasses: 0 },
];
function tilePosition(index: number): [number, number] {
  if (index === 0) return [10, 10];
  if (index < 10) return [10, 10 - index];
  if (index === 10) return [10, 0];
  if (index < 20) return [20 - index, 0];
  if (index === 20) return [0, 0];
  if (index < 30) return [0, index - 20];
  if (index === 30) return [0, 10];
  return [index - 30, 10];
}
function fare(space: Space, owner: Player, diceTotal: number, levels: Record<string, number>) {
  if (space.kind === "stage") {
    const count = owner.owned.filter(index => BOARD[index].kind === "stage").length;
    return [0, 25, 50, 100, 200][count] ?? 200;
  }
  if (space.kind === "utility") {
    const count = owner.owned.filter(index => BOARD[index].kind === "utility").length;
    return diceTotal * (count > 1 ? 10 : 4);
  }
  if (space.kind !== "property" || !space.price || !space.group) return 0;
  const base = Math.round(space.price / 8);
  const complete = (GROUPS[space.group] ?? []).every(name => owner.owned.some(index => BOARD[index].name === name));
  const level = levels[String(BOARD.indexOf(space))] ?? 0;
  return base * ([complete ? 2 : 1, 5, 15, 30, 40, 50][Math.min(level, 5)] ?? 50);
}
/** Pieces that make Kenya Kenya: the Big Five, plus Nairobi landmarks. */
const PIECES: [string, string][] = [["🦁", "Lion"], ["🐘", "Elephant"], ["🐃", "Buffalo"], ["🐆", "Leopard"], ["🦏", "Rhino"], ["🏙️", "KICC"], ["🦒", "Giraffe"], ["🏃", "Marathoner"]];
function makePlayers(): Player[] {
  let token = "🦁";
  try { token = JSON.parse(localStorage.getItem("mirth_active_cosmetic_v1") || "{}").token || token; } catch { /* keep the default token */ }
  return STARTING_PLAYERS.map((player, index) => ({ ...player, token: index === 0 ? token : player.token, owned: [] }));
}

export default function TycoonGame({ onStart, onFinish }: { onStart?: () => void; onFinish?: (points: number) => void }) {
  const [players, setPlayers] = useState<Player[]>(makePlayers);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [turn, setTurn] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [doubleCount, setDoubleCount] = useState(0);
  const [kitty, setKitty] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState("Poa! Roll the dice to start your route.");
  const [over, setOver] = useState(false);
  const [intro, setIntro] = useState(true);
  const [reported, setReported] = useState(false);
  const [rollId, setRollId] = useState(0);
  const active = players[turn];
  const ownedBy = useMemo(() => new Map(players.flatMap((player, p) => player.owned.map(index => [index, p] as const))), [players]);

  useEffect(() => { onStart?.(); const timer = window.setTimeout(() => setIntro(false), 650); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (nextPlayers: Player[]) => {
    setPlayers(nextPlayers); setOver(true);
    if (!reported) {
      const worth = nextPlayers.map(player => player.cash + player.owned.reduce((sum, index) => sum + (BOARD[index].price ?? 0), 0));
      const points = Math.max(0, Math.min(100, Math.round((worth[0] / Math.max(1, worth[0] + worth[1])) * 100)));
      onFinish?.(points); setReported(true);
      try { navigator.vibrate?.([60, 35, 90]); } catch { /* unsupported */ }
    }
  };
  const moveTo = (playerIndex: number, steps: number, diceTotal: number, isDouble: boolean, bot = false, sourcePlayers = players) => {
    let next = sourcePlayers.map(player => ({ ...player, owned: [...player.owned] }));
    const player = next[playerIndex];
    if (isDouble && doubleCount >= 2) {
      player.position = 10; player.jailed = 3; setDoubleCount(0); setMessage(`${player.name} rolled three doubles and went to the Impound Yard for up to three turns.`); setPlayers(next);
      if (playerIndex === 0) setTurnCount(value => value + 1);
      setTurn(playerIndex === 0 ? 1 : 0); return;
    }
    const old = player.position; const raw = old + steps;
    if (raw >= 40) { player.cash += 200; setMessage(`${player.name} passed Stage Start and collected KSh 200.`); }
    player.position = raw % 40;
    const tile = BOARD[player.position];
    if (tile.kind === "cop") { player.position = 10; player.jailed = 3; setMessage(`${player.name} was flagged and sent to the Impound Yard for up to three turns.`); }
    else if (tile.kind === "tax") { player.cash -= tile.fee ?? 0; setKitty(value => value + (tile.fee ?? 0)); setMessage(`${player.name} paid KSh ${tile.fee} into the Talanta match-day kitty.`); }
    else if (tile.kind === "parking") { player.cash += kitty; setMessage(`${player.name} landed at TALANTA STADIUM and collected the KSh ${kitty} match-day kitty.`); setKitty(0); }
    else if (tile.kind === "kitty" || tile.kind === "dispatch") {
      const cards = tile.kind === "kitty" ? KITTY_CARDS : DISPATCH_CARDS;
      const card = cards[Math.floor(Math.random() * cards.length)];
      if (card.includes("collect KSh 100")) player.cash += 100;
      else if (card.includes("collect KSh 150")) player.cash += 150;
      else if (card.includes("collect KSh 80")) player.cash += 80;
      else if (card.includes("pay KSh 50")) { player.cash -= 50; setKitty(value => value + 50); }
      else if (card.includes("pay KSh 100")) { player.cash -= 100; setKitty(value => value + 100); }
      else if (card.includes("pay KSh 60")) { player.cash -= 60; setKitty(value => value + 60); }
      else if (card.includes("collect KSh 30")) { player.cash += 30; next[1 - playerIndex].cash -= 30; }
      else if (card.includes("Advance to Stage Start")) { player.position = 0; player.cash += 200; }
      else if (card.includes("Advance to Karen")) player.position = 37;
      else if (card.includes("move back 3")) player.position = (player.position + 37) % 40;
      else if (card.includes("get out of the yard free")) player.freePasses += 1;
      else if (card.includes("Go to the yard")) { player.position = 10; player.jailed = 3; }
      else if (card.includes("Rainy-day")) player.cash += 100;
      else if (card.includes("88 Nairobi")) { if (player.owned.some(index => [26,27,29,31,32,34].includes(index))) player.cash += 200; }
      else if (card.includes("Fuel jump")) { const towers = player.owned.filter(index => BOARD[index].kind === "property" && (levels[String(index)] ?? 0) === 5).length; const amount = towers * 100; player.cash -= amount; setKitty(value => value + amount); }
      setMessage(`${player.name}: ${card}.`);
    } else if (tile.kind === "property" || tile.kind === "stage" || tile.kind === "utility") {
      const ownerIndex = next.findIndex(other => other.owned.includes(player.position));
      if (ownerIndex < 0) {
        if (playerIndex === 0) { setPending({ index: player.position, tile, diceTotal }); setMessage(`${tile.name} is unclaimed. Buy it for KSh ${tile.price}?`); setPlayers(next); return; }
        if (player.cash >= (tile.price ?? 999) + 80 && Math.random() > .2) { player.cash -= tile.price ?? 0; player.owned.push(player.position); setMessage(`${player.name} bought ${tile.name} for KSh ${tile.price}.`); }
        else setMessage(`${player.name} passed on ${tile.name}.`);
      } else if (ownerIndex !== playerIndex) {
        const rent = fare(tile, next[ownerIndex], diceTotal, levels);
        player.cash -= rent; next[ownerIndex].cash += rent; setMessage(`${player.name} paid KSh ${rent} fare to ${next[ownerIndex].name} at ${tile.name}.`);
      } else setMessage(`${player.name} landed on their own ${tile.name}.`);
    } else if (tile.kind === "start") setMessage(`${player.name} stopped at Stage Start.`);
    if (player.cash < 0) { setMessage(`${player.name} was repossessed. The game is over.`); finish(next); return; }
    setPlayers(next);
    if (playerIndex === 0) setTurnCount(value => value + 1);
    if (isDouble && player.jailed === 0) { setDoubleCount(value => value + 1); setMessage(current => `${current} Double! Roll again.`); }
    else { setDoubleCount(0); setTurn(playerIndex === 0 ? 1 : 0); }
    if (turnCount >= 39) finish(next);
  };
  const roll = (playerIndex: number, bot = false, values?: number[]) => {
    setRollId(id => id + 1);
    const d1 = values?.[0] ?? Math.floor(Math.random() * 6) + 1, d2 = values?.[1] ?? Math.floor(Math.random() * 6) + 1;
    setDice([d1, d2]);
    const player = players[playerIndex];
    if (player.jailed > 0) {
      const next = players.map(item => ({ ...item }));
      if (d1 === d2) { next[playerIndex].jailed = 0; setMessage(`${player.name} rolled doubles and left the yard.`); setPlayers(next); moveTo(playerIndex, d1 + d2, d1 + d2, false, bot, next); return; }
      else { next[playerIndex].jailed -= 1; setMessage(next[playerIndex].jailed === 0 ? `${player.name} served three yard turns and is free next turn.` : `${player.name} remains in the yard. Roll doubles or pay KSh 50.`); setPlayers(next); setTurn(playerIndex === 0 ? 1 : 0); return; }
    }
    moveTo(playerIndex, d1 + d2, d1 + d2, d1 === d2, bot);
  };
    const decideBuy = (buy: boolean) => {
    if (!pending) return;
    const next = players.map(player => ({ ...player, owned: [...player.owned] }));
    const player = next[0];
    if (buy && player.cash >= (pending.tile.price ?? 999)) { player.cash -= pending.tile.price ?? 0; player.owned.push(pending.index); setMessage(`You bought ${pending.tile.name}. Nice hustle!`); }
    else setMessage(`You passed on ${pending.tile.name}.`);
    const rolledDouble = Boolean(dice && dice[0] === dice[1]);
    setPlayers(next); setPending(null);
    if (rolledDouble && player.jailed === 0) setMessage(current => `${current} Double! Roll again.`);
    else { setDoubleCount(0); setTurn(1); }
  };
  const build = (index: number) => {
    const tile = BOARD[index]; if (!tile.group || tile.kind !== "property") return;
    const owner = players[0];
    if (turn !== 0 || pending || over) { setMessage("You can build between turns when it is your turn."); return; }
    const complete = (GROUPS[tile.group] ?? []).every(name => owner.owned.some(ownedIndex => BOARD[ownedIndex].name === name));
    if (!complete) { setMessage("Own the full colour set before building."); return; }
    const level = levels[String(index)] ?? 0;
    const groupLevels = owner.owned.filter(ownedIndex => BOARD[ownedIndex].group === tile.group).map(ownedIndex => levels[String(ownedIndex)] ?? 0);
    if (level >= 5 || level > Math.min(...groupLevels) || owner.cash < LEVEL_COST[tile.group]) { setMessage("Build evenly across the colour set and make sure you can cover the cost."); return; }
    setPlayers(all => all.map((player, playerIndex) => playerIndex === 0 ? { ...player, cash: player.cash - LEVEL_COST[tile.group!] } : player));
    setLevels(old => ({ ...old, [String(index)]: level + 1 }));
    setMessage(`${tile.name}: added ${level === 4 ? "the group's landmark tower" : `level ${level + 1}`}.`);
  };
  const reset = () => { setPlayers(makePlayers()); setLevels({}); setTurn(0); setTurnCount(0); setDice(null); setDoubleCount(0); setKitty(0); setPending(null); setMessage("Poa! Roll the dice to start your route."); setOver(false); setReported(false); setIntro(false); onStart?.(); };
  const tiles = BOARD.map((tile, index) => ({ tile, index, position: tilePosition(index) }));
  const pips = dice ? `${dice[0]} + ${dice[1]} = ${dice[0] + dice[1]}` : "Ready for the first roll";

  return <div style={{ color: "var(--white)" }}>
    <DicePopup key={rollId} open={!over && !intro && !pending} count={2} auto={turn === 1} label={turn === 0 ? "Your turn" : "Bot Makanga"} color={turn === 0 ? "#22c55e" : "#f472b6"} onRolled={values => roll(turn, turn === 1, values)} />
    {intro && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(5,7,13,.94)", display: "grid", placeItems: "center", pointerEvents: "none" }}><motion.div initial={{ scale: .7, y: 18 }} animate={{ scale: 1, y: 0 }} style={{ textAlign: "center" }}><BusFront size={48} style={{ color: "#22d3ee", filter: "drop-shadow(0 0 16px #22d3ee)" }} /><h2 style={{ fontFamily: "var(--font-display)", color: "#f0abfc" }}>NAIROBI TYCOON</h2><p style={{ color: "#86efac" }}>Stake your route. Build your landmark.</p></motion.div></motion.div>}
    {turnCount === 0 && !dice && <div style={{ marginBottom: 8 }}><small style={{ color: "var(--muted2)", fontSize: ".6rem" }}>Pick your piece</small>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>{PIECES.map(([icon, name]) => <button key={name} type="button" aria-label={name} onClick={() => setPlayers(all => all.map((pl, i) => i === 0 ? { ...pl, token: icon } : i === 1 && pl.token === icon ? { ...pl, token: icon === "🐘" ? "🦏" : "🐘" } : pl))} style={{ width: 38, height: 38, borderRadius: 12, fontSize: 20, cursor: "pointer", border: players[0].token === icon ? "2px solid var(--go)" : "1px solid var(--border2)", background: "rgba(8,8,16,.7)" }}>{icon}</button>)}</div></div>}
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Landmark size={15} style={{ color: "#22d3ee" }} /><b style={{ flex: 1, fontSize: ".74rem" }}>Stage board · KSh {kitty} match-day kitty</b><span className="chip" style={{ color: "#f0abfc", background: "rgba(217,70,239,.12)" }}>TURN {turnCount + 1}/40</span></div>
    <p aria-live="polite" style={{ minHeight: 34, padding: 8, borderRadius: 10, background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.25)", color: "#cffafe", fontSize: ".64rem", lineHeight: 1.45 }}>{message}</p>
    <div style={{ display: "grid", gridTemplateColumns: "1.9fr repeat(9,minmax(0,1fr)) 1.9fr", gridTemplateRows: "1.5fr repeat(9,minmax(0,1fr)) 1.5fr", gap: 2, aspectRatio: "0.66", width: "min(100%, calc((100dvh - 290px) * 0.66))", minWidth: 300, margin: "0 auto", background: "rgba(2,6,23,.8)", border: "1px solid rgba(34,211,238,.35)", borderRadius: 13, padding: 5, boxShadow: "0 0 22px rgba(34,211,238,.12)" }}>
      {tiles.map(({ tile, index, position: [row, col] }) => {
        const owner = ownedBy.get(index);
        const tokens = players.map((player, playerIndex) => player.position === index ? playerIndex : -1).filter(value => value >= 0);
        const color = tile.group ? COLORS[tile.group] : tile.kind === "cop" ? "#ef4444" : "#64748b";
        return <div key={index} style={{ gridRow: row + 1, gridColumn: col + 1, minWidth: 0, borderRadius: 4, border: `1px solid ${owner !== undefined ? (owner === 0 ? "#22c55e" : "#f472b6") : `${color}66`}`, background: owner !== undefined ? `${owner === 0 ? "#22c55e" : "#f472b6"}1c` : `${color}14`, padding: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", fontSize: "clamp(6.5px,2.15vw,11px)", lineHeight: 1.12 }} title={`${index}. ${tile.name}${tile.price ? ` · KSh ${tile.price}` : ""}`}>
          <span style={{ height: 2, background: color, margin: "-2px -2px 2px" }} /><b style={{ overflow: "hidden", maxHeight: "3.4em", fontSize: (row === 0 || row === 10) ? "clamp(5.5px,1.65vw,7.5px)" : undefined, hyphens: "none" }}>{(row === 0 || row === 10) ? tile.name.split(" ")[0] : tile.name}</b>
          {tile.price && <small style={{ color: "#cbd5e1" }}>{tile.kind === "property" ? `KSh ${tile.price}` : tile.kind === "stage" ? "Stage" : "Utility"}</small>}
          <span>{tokens.map(playerIndex => <span key={playerIndex} aria-label={players[playerIndex].name}>{players[playerIndex].token}</span>)}{owner !== undefined && <small style={{ color: owner === 0 ? "#86efac" : "#f9a8d4" }}>●</small>}</span>
        </div>;
      })}
      <div style={{ gridRow: "2 / 11", gridColumn: "2 / 11", borderRadius: 8, background: "radial-gradient(circle,rgba(8,47,73,.55),rgba(2,6,23,.9) 68%)", border: "1px solid rgba(34,211,238,.12)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: 8, gap: 5 }}>
        <BusFront size={24} style={{ color: "#22d3ee", filter: "drop-shadow(0 0 8px #22d3ee)" }} /><b style={{ fontFamily: "var(--font-display)", fontSize: ".76rem", color: "#f0abfc" }}>NAIROBI TYCOON</b>
        <span style={{ fontSize: ".57rem", color: "#cbd5e1" }}>{active?.name ?? "Game over"} · {pips}</span>
        <div style={{ display: "flex", gap: 7, marginTop: 3 }}>{players.map(player => <span key={player.name} style={{ fontSize: ".6rem", color: player.name === "You" ? "#86efac" : "#f9a8d4" }}>{player.token} {player.name} · KSh {player.cash}</span>)}</div>
      </div>
    </div>
    {pending && <div className="ios-glass" style={{ padding: 10, marginTop: 9, borderColor: "rgba(34,211,238,.35)" }}>
      <b style={{ fontSize: ".68rem" }}>Buy {pending.tile.name} for KSh {pending.tile.price}?</b>
      {pending.tile.group && <p style={{ margin: "4px 0", color: "var(--muted2)", fontSize: ".56rem" }}>Group: {pending.tile.group} · Landmark: {pending.tile.landmark}</p>}
      <div style={{ display: "flex", gap: 7, marginTop: 7 }}><button className="btn btn-go" style={{ flex: 1, padding: 8 }} onClick={() => decideBuy(true)}>Buy logbook</button><button className="btn btn-ghost" style={{ flex: 1, padding: 8 }} onClick={() => decideBuy(false)}>Pass</button></div>
    </div>}
    {!over && <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
      <small style={{ flex: 1, color: "var(--muted2)", fontSize: ".6rem", alignSelf: "center" }}>{turn === 0 ? "Your turn: the dice will pop up." : "Bot Makanga is rolling…"}</small>
      {turn === 0 && active?.jailed > 0 && <button className="btn btn-ghost" style={{ flex: 1, padding: 8 }} onClick={() => { setPlayers(all => all.map((player, index) => index === 0 ? { ...player, cash: player.cash - 50, jailed: 0 } : player)); setMessage("You paid KSh 50 to leave the Impound Yard."); setTurn(1); }}>Pay KSh 50 to leave</button>}
      {turn === 0 && active?.jailed > 0 && active.freePasses > 0 && <button className="btn btn-ghost" style={{ flex: 1, padding: 8 }} onClick={() => { setPlayers(all => all.map((player, index) => index === 0 ? { ...player, jailed: 0, freePasses: player.freePasses - 1 } : player)); setMessage("You used a Sacco Kitty free-yard card."); setTurn(1); }}>Use free yard card</button>}
    </div>}
    <div style={{ display: "grid", gap: 5, marginTop: 10 }}>
      {players[0].owned.map(index => {
        const tile = BOARD[index]; const level = levels[String(index)] ?? 0;
        return <div key={index} className="card" style={{ padding: 7, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 24, background: COLORS[tile.group ?? "stage"], borderRadius: 4 }} /><span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".6rem" }}>{tile.name}</b><small style={{ color: "var(--muted2)", fontSize: ".52rem" }}>{tile.kind === "property" ? `${LANDMARK[tile.group ?? ""] ?? ""} · ${level === 5 ? "Landmark hotel" : `${level} build level${level === 1 ? "" : "s"}`}` : tile.kind === "stage" ? "Terminal fare asset" : "Utility asset"}</small></span>{tile.kind === "property" && level < 5 && <button className="btn btn-ghost" style={{ padding: "5px 7px", fontSize: ".54rem" }} onClick={() => build(index)}><Hammer size={10} /> Build KSh {LEVEL_COST[tile.group ?? "brown"]}</button>}</div>;
      })}
    </div>
    {over && <div className="ios-glass" style={{ marginTop: 10, padding: 12, textAlign: "center" }}><Trophy size={22} style={{ color: "#facc15" }} /><h3 style={{ margin: "5px 0", fontSize: ".8rem" }}>{players[0].cash >= 0 ? "Game over, makanga!" : "Route repossessed"}</h3><p style={{ color: "var(--muted2)", fontSize: ".6rem" }}>Your score is estimated from your share of cash and assets. This local prototype is not multiplayer.</p><button className="btn btn-ready" style={{ marginTop: 8, padding: 8 }} onClick={reset}><RotateCcw size={12} /> Play again</button></div>}
    <p style={{ color: "var(--muted2)", fontSize: ".52rem", lineHeight: 1.45, marginTop: 8 }}>Prototype rules: two local players (you vs bot), KSh 1,500 start, two dice, KSh 200 passing Start, stage rents 25/50/100/200 and utilities 4×/10× the dice. Trading, live auctions and full jail turn-count rules are not implemented yet.</p>
  </div>;
}
