import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * A live "room" that people can join with a code. Nothing is saved anywhere: messages are only passed along
 * while people are in the room, so when everyone leaves the room is gone (that is how the matatu chat ends with the trip).
 *
 * With Supabase connected the room works between different phones (Supabase Realtime).
 * Without it, the room only works between tabs on the same device (used for testing and as a fallback).
 */
export interface RoomMember { id: string; name: string }
export interface Room {
  id: string;
  me: RoomMember;
  /** Send to everybody else in the room. */
  send(msg: unknown): void;
  onMessage(cb: (msg: any, from: RoomMember) => void): () => void;
  /** Called with everyone in the room, including me, whenever someone joins or leaves. */
  onMembers(cb: (members: RoomMember[]) => void): () => void;
  /** "connecting" | "live" | "offline" */
  onStatus(cb: (status: "connecting" | "live" | "offline") => void): () => void;
  leave(): void;
}

const newId = () => (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 12);
export function localIdentity(defaultName?: string): RoomMember {
  let id = ""; let name = defaultName ?? "";
  try { id = sessionStorage.getItem("mirth_room_id") || ""; if (!id) { id = newId(); sessionStorage.setItem("mirth_room_id", id); } name = name || localStorage.getItem("mirth_room_name") || ""; } catch { id = id || newId(); }
  return { id, name: name || `Abiria ${100 + Math.floor(Math.random() * 900)}` };
}
export const rememberName = (name: string) => { try { localStorage.setItem("mirth_room_name", name); } catch { /* ignore */ } };

function useLocalOnly(): boolean {
  try { if (localStorage.getItem("mirth_local_rooms") === "1") return true; } catch { /* ignore */ }
  return !(isSupabaseConfigured && supabase);
}

export function openRoom(roomId: string, me: RoomMember, opts: { forceLocal?: boolean } = {}): Room {
  return opts.forceLocal || useLocalOnly() ? openLocalRoom(roomId, me) : openSupabaseRoom(roomId, me);
}

function makeEmitter() {
  const messageCbs = new Set<(msg: any, from: RoomMember) => void>();
  const memberCbs = new Set<(members: RoomMember[]) => void>();
  const statusCbs = new Set<(status: "connecting" | "live" | "offline") => void>();
  let status: "connecting" | "live" | "offline" = "connecting";
  let members: RoomMember[] = [];
  return {
    message: (msg: any, from: RoomMember) => messageCbs.forEach(cb => cb(msg, from)),
    setMembers: (next: RoomMember[]) => { members = next; memberCbs.forEach(cb => cb(next)); },
    setStatus: (next: typeof status) => { status = next; statusCbs.forEach(cb => cb(next)); },
    api: {
      onMessage: (cb: (msg: any, from: RoomMember) => void) => { messageCbs.add(cb); return () => { messageCbs.delete(cb); }; },
      onMembers: (cb: (members: RoomMember[]) => void) => { memberCbs.add(cb); cb(members); return () => { memberCbs.delete(cb); }; },
      onStatus: (cb: (status: "connecting" | "live" | "offline") => void) => { statusCbs.add(cb); cb(status); return () => { statusCbs.delete(cb); }; },
    },
  };
}

function openSupabaseRoom(roomId: string, me: RoomMember): Room {
  const emitter = makeEmitter();
  const channel = supabase!.channel(`mirth:${roomId}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
  channel.on("broadcast", { event: "msg" }, ({ payload }) => { if (payload?.from) emitter.message(payload.msg, payload.from as RoomMember); });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState() as Record<string, { name?: string }[]>;
    emitter.setMembers(Object.entries(state).map(([id, metas]) => ({ id, name: metas[0]?.name ?? "Abiria" })));
  });
  channel.subscribe(async status => {
    if (status === "SUBSCRIBED") { emitter.setStatus("live"); await channel.track({ name: me.name }); }
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") emitter.setStatus("offline");
  });
  return {
    id: roomId, me, ...emitter.api,
    send: msg => { void channel.send({ type: "broadcast", event: "msg", payload: { msg, from: me } }); },
    leave: () => { void channel.untrack(); void supabase!.removeChannel(channel); },
  };
}

function openLocalRoom(roomId: string, me: RoomMember): Room {
  const emitter = makeEmitter();
  const bc = new BroadcastChannel(`mirth:${roomId}`);
  const known = new Map<string, RoomMember>([[me.id, me]]);
  const push = () => emitter.setMembers([...known.values()]);
  bc.onmessage = event => {
    const data = event.data as { kind: string; from: RoomMember; msg?: unknown };
    if (!data?.from || data.from.id === me.id) return;
    if (data.kind === "hello") { known.set(data.from.id, data.from); push(); bc.postMessage({ kind: "here", from: me }); }
    else if (data.kind === "here") { known.set(data.from.id, data.from); push(); }
    else if (data.kind === "bye") { known.delete(data.from.id); push(); }
    else if (data.kind === "msg") emitter.message(data.msg, data.from);
  };
  const bye = () => bc.postMessage({ kind: "bye", from: me });
  window.addEventListener("pagehide", bye);
  queueMicrotask(() => { emitter.setStatus("live"); push(); bc.postMessage({ kind: "hello", from: me }); });
  return {
    id: roomId, me, ...emitter.api,
    send: msg => bc.postMessage({ kind: "msg", from: me, msg }),
    leave: () => { bye(); window.removeEventListener("pagehide", bye); bc.close(); },
  };
}
