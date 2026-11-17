// Builds the static site into ./dist from data/meals.json
// Run: node build.js
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const DATA = path.join(ROOT, "data", "meals.json");
const SITE = { title: "Fodderbook" };
// Preferred order of the cuisine filters; any other cuisine typed in the editor is added after these ("Andet" is always last)
const CUISINE_ORDER = ["Dansk", "Italiensk", "Japansk & koreansk", "Asiatisk", "Indisk", "Mexicansk", "Græsk & mellemøstlig", "Fransk", "Amerikansk"];
let TOTAL = 0;

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) =>
  s.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
   .normalize("NFD").replace(/[̀-ͯ]/g, "")
   .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "ret";

// Reads meals.json and adds slug + photo to each meal
function loadMeals() {
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const used = new Set();
  return raw.map((m) => {
    let slug = slugify(m.title), n = 2;
    const base = slug;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    const file = ["jpg", "jpeg", "webp", "png"].map((e) => `${slug}.${e}`).find((f) => fs.existsSync(path.join(ROOT, "images", f)));
    return { ...m, slug, photo: file ? `images/${file}` : null };
  });
}

function sources(src) {
  return String(src || "").split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
    if (/^https?:/.test(p)) {
      let host;
      try { host = new URL(p).hostname.replace(/^www\./, ""); } catch { return null; }
      const name = host.includes("seriouseats") ? "Serious Eats" : host.includes("valdemarsro") ? "Valdemarsro"
        : host.includes("youtube") ? "YouTube" : host.includes("delicious") ? "delicious.com.au"
        : host.includes("bonappetit") ? "Bon Appétit" : host;
      return { url: p, label: host.includes("youtube") ? "Se videoen på YouTube" : `Se opskrift hos ${name}`, direct: true };
    }
    const [k, ...q] = p.split(":");
    const query = encodeURIComponent(q.join(":"));
    if (k === "se") return { url: `https://www.seriouseats.com/search?q=${query}`, label: "Find opskrift hos Serious Eats", direct: false };
    if (k === "vr") return { url: `https://www.valdemarsro.dk/?s=${query}`, label: "Find opskrift hos Valdemarsro", direct: false };
    return null;
  }).filter(Boolean);
}

const weekLabel = (m) => (m.week ? `Uge ${m.week}, ${m.year}` : `${m.year}`);
const art = (m, big, rel) => {
  if (m.photo) return `<img class="art-img" src="${rel}${m.photo}" alt="${esc(m.title)}" loading="lazy">`;
  return `<div class="art" style="--h:${m.hue}" aria-hidden="true"><span class="art-emoji${big ? " big" : ""}">${m.emoji}</span></div>`;
};

const head = (title, desc, rel) => `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="stylesheet" href="${rel}style.css">
</head>
<body>
<header class="site-header"><a class="brand" href="${rel}index.html"><span class="brand-mark">🍴</span> ${SITE.title}</a><span class="tagline">${TOTAL} retter fra vores køkken, med små opskrifter og links til de originale.</span></header>`;
const foot = `<footer class="site-footer">Opskrifterne er korte sammendrag skrevet med egne ord. Linkene peger på de fulde opskrifter (eller tæt beslægtede) hos <a href="https://www.seriouseats.com/">Serious Eats</a> og <a href="https://www.valdemarsro.dk/">Valdemarsro</a>.</footer>`;

// ---------- build ----------
function build() {
  const meals = loadMeals();
  TOTAL = meals.length;
  const counts = {};
  meals.forEach((m) => { m.cuisine = (m.cuisine || "Andet").trim() || "Andet"; counts[m.cuisine] = (counts[m.cuisine] || 0) + 1; });
  const others = Object.keys(counts).filter((c) => !CUISINE_ORDER.includes(c) && c !== "Andet").sort();
  const cuisines = [...CUISINE_ORDER, ...others, "Andet"].filter((c) => counts[c]);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, "meals"), { recursive: true });

  meals.forEach((m, i) => {
    const prev = meals[i - 1], next = meals[i + 1];
    const srcs = sources(m.src);
    const html = `${head(`${m.title} – ${SITE.title}`, m.desc, "../")}
<main class="meal" data-slug="${m.slug}">
  <a class="back" href="../index.html">← Alle retter</a>
  <div class="hero">${art(m, true, "../")}</div>
  <p class="meta">${esc(weekLabel(m))}</p>
  <h1>${esc(m.title)}</h1>
  <p class="lede">${esc(m.desc)}</p>
  <div class="cols">
    <section><h2>Ingredienser</h2><ul class="ing">${m.ing.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
    <section><h2>Sådan gør du</h2><ol class="steps">${m.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></section>
  </div>
  <div class="sources"><h2>Fuld opskrift</h2>${srcs.map((s) => `<a class="btn${s.direct ? " direct" : ""}" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`).join("")}</div>
  <nav class="pager">${prev ? `<a href="${prev.slug}.html">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="${next.slug}.html">${esc(next.title)} →</a>` : "<span></span>"}</nav>
</main>
${foot}
</body></html>`;
    fs.writeFileSync(path.join(DIST, "meals", `${m.slug}.html`), html);
  });

  const chips = [`<button class="chip on" data-cuisine="">Alle <span class="n">${meals.length}</span></button>`, ...cuisines.map((c) => `<button class="chip" data-cuisine="${esc(c)}">${esc(c)} <span class="n">${counts[c]}</span></button>`)].join("");
  const cards = meals.map((m) => `<a class="card" href="meals/${m.slug}.html" data-cuisine="${esc(m.cuisine)}" data-text="${esc((m.title + " " + m.desc + " " + m.ing.join(" ")).toLowerCase())}">${art(m, false, "")}<div class="card-body"><p class="meta">${esc(weekLabel(m))}</p><h3>${esc(m.title)}</h3></div></a>`).join("\n");

  const index = `${head(`${SITE.title} – madblog`,"En madblog med ugens aftensmad, billeder og opskrifter.", "")}
<main>
  <div class="tools"><div class="search-row"><input id="q" type="search" placeholder="Søg efter ret eller ingrediens…" aria-label="Søg"><button id="mute" class="mute" type="button" hidden aria-pressed="false" title="Lyd til/fra">🔊</button></div><div class="chips">${chips}</div></div>
  <p id="count" class="count"></p>
  <div class="grid" id="grid">
${cards}
  </div>
  <p id="empty" class="empty" hidden>Ingen retter matcher din søgning.</p>
</main>
${foot}
<script src="app.js"></script>
</body></html>`;
  fs.writeFileSync(path.join(DIST, "index.html"), index);

  fs.copyFileSync(path.join(ROOT, "assets", "style.css"), path.join(DIST, "style.css"));
  fs.copyFileSync(path.join(ROOT, "assets", "app.js"), path.join(DIST, "app.js"));
  fs.copyFileSync(path.join(ROOT, "assets", "bg.png"), path.join(DIST, "bg.png"));
  if (fs.existsSync(path.join(ROOT, "images"))) fs.cpSync(path.join(ROOT, "images"), path.join(DIST, "images"), { recursive: true });
  // Optional click sounds: any audio files in ./audio are copied and listed in audio/clips.json
  const audioSrc = path.join(ROOT, "audio");
  const clips = fs.existsSync(audioSrc) ? fs.readdirSync(audioSrc).filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f)).sort() : [];
  if (clips.length) fs.cpSync(audioSrc, path.join(DIST, "audio"), { recursive: true });
  fs.mkdirSync(path.join(DIST, "audio"), { recursive: true });
  fs.writeFileSync(path.join(DIST, "audio", "clips.json"), JSON.stringify(clips));
  return meals;
}

module.exports = { build, loadMeals, slugify, ROOT, DIST, DATA };

if (require.main === module) {
  const meals = build();
  console.log(`Built ${meals.length} meals -> ${DIST}`);
}
