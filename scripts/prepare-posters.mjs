// Turns unzipped Stitch folders into correctly named files, ready to drag into Supabase Storage.
// Usage: node scripts/prepare-posters.mjs <folder with unzipped Stitch zips> [more folders...]
// Output: poster-ready/sights/<id>.png  and  poster-ready/demo/<slug>.png  (+ poster-ready/REPORT.txt)
import fs from "node:fs"; import path from "node:path";

const inputs = process.argv.slice(2);
if (!inputs.length) { console.log("Give the folder(s) where you unzipped the Stitch zips."); process.exit(1); }

const here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const names = fs.readFileSync(path.join(here, "poster-names.csv"), "utf8").trim().split(/\r?\n/).slice(1).map(line => {
  const m = line.match(/^(\w+),([^,]+),"?(.*?)"?$/); return { type: m[1], id: m[2], name: m[3] };
});
const FILLER = new Set(["the","of","and","a","in","at","to","for","poster","sights","sight"]);
const SOFT = new Set(["national","park","reserve","kenya","hub","shop","stall","game","conservancy"]);
const squash = text => text.toLowerCase().replace(/[^a-z0-9]/g, "");
// Name -> the text we look for inside a folder name or page title, e.g. "Mount Kenya National Park" -> "mountkenya".
const needle = name => {
  const words = (name.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/'/g, "").match(/[a-z0-9]+/g) || []).filter(w => !FILLER.has(w));
  while (words.length > 1 && SOFT.has(words[words.length - 1])) words.pop();
  return words.join("");
};
const items = names.map(item => ({ ...item, needle: needle(item.name) })).filter(item => item.needle.length >= 4);

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "poster-ready" && entry.name !== "node_modules") walk(full, found); }
    else if (/^screen\.(png|jpg|jpeg)$/i.test(entry.name)) found.push(full);
  }
  return found;
}
function labelsFor(file) {
  const dir = path.dirname(file); const labels = [path.basename(dir)];
  const html = path.join(dir, "code.html");
  if (fs.existsSync(html)) {
    const text = fs.readFileSync(html, "utf8");
    const title = text.match(/<title>([^<]*)<\/title>/i); if (title) labels.push(title[1]);
    for (const h of text.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) labels.push(h[1].replace(/<[^>]+>/g, " "));
  }
  return labels;
}
function best(labels) {
  let top = null;
  for (const label of labels) {
    const flat = squash(label);
    for (const item of items) {
      if (flat.includes(item.needle) && item.needle.length > (top?.item.needle.length ?? 0)) top = { item, label };
    }
  }
  return top;
}
// Tall pictures are full pages; wide ones are plain photos. Prefer the tallest one for each name.
function ratio(file) {
  try { const fd = fs.openSync(file, "r"); const b = Buffer.alloc(24); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
    return b.toString("latin1", 1, 4) === "PNG" ? b.readUInt32BE(20) / Math.max(1, b.readUInt32BE(16)) : 0; } catch { return 0; }
}

const files = inputs.flatMap(dir => walk(path.resolve(dir)));
const outRoot = path.resolve("poster-ready"); const report = [];
const winners = new Map(); const unmatched = [];
for (const file of files) {
  const match = best(labelsFor(file));
  if (!match) { unmatched.push(file); continue; }
  const folder = match.item.type === "sight" ? "sights" : "demo";
  const key = `${folder}/${match.item.id}`; const r = ratio(file);
  const old = winners.get(key);
  if (!old || r > old.r + 0.01) winners.set(key, { file, r, match, folder });
}
fs.mkdirSync(outRoot, { recursive: true });
for (const [key, w] of [...winners].sort()) {
  fs.mkdirSync(path.join(outRoot, w.folder), { recursive: true });
  const ext = path.extname(w.file).toLowerCase().replace(".jpeg", ".jpg");
  fs.copyFileSync(w.file, path.join(outRoot, w.folder, w.match.item.id + ext));
  const mb = fs.statSync(w.file).size / 1048576;
  report.push(`OK  ${key}${ext}  <-  ${path.basename(path.dirname(w.file)).slice(0, 60)}  (${w.r > 1.2 ? "full page" : "PHOTO ONLY, no full page found"})${mb > 2.5 ? `  big: ${mb.toFixed(1)} MB` : ""}`);
}
if (unmatched.length) { fs.mkdirSync(path.join(outRoot, "unmatched"), { recursive: true }); unmatched.forEach((file, i) => { const to = `unmatched-${i + 1}${path.extname(file)}`; fs.copyFileSync(file, path.join(outRoot, "unmatched", to)); report.push(`UNMATCHED: ${path.basename(path.dirname(file))}  ->  unmatched/${to}`); }); }
const missing = names.filter(n => n.type === "sight" && !winners.has(`sights/${n.id}`)).map(n => n.id);
report.push("", `Pictures ready: ${winners.size}. Sights still without a picture: ${missing.length ? missing.join(", ") : "none"}.`);
fs.writeFileSync(path.join(outRoot, "REPORT.txt"), report.join("\n"));
console.log(report.join("\n"));
