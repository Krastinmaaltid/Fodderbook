// Bygger den statiske madblog til ./dist
// Kør: node build.js
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const SITE = { title: "Fodderbook", tagline: "Hvad vi har spist, uge for uge" };

const years = [2025, 2024, 2023, 2022];
const meals = [];
for (const y of years) {
  const rows = require(`./data/${y}.js`);
  for (const r of rows) {
    const [title, year, week, emoji, hue, desc, ing, steps, src] = r;
    meals.push({ title, year, week, emoji, hue, desc, ing: ing.split("|"), steps: steps.split("|"), src });
  }
}

// ---------- hjælpere ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) =>
  s.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
   .normalize("NFD").replace(/[̀-ͯ]/g, "")
   .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

const used = new Set();
for (const m of meals) {
  let s = slugify(m.title), n = 2, base = s;
  while (used.has(s)) s = `${base}-${n++}`;
  used.add(s);
  m.slug = s;
  const photo = ["jpg", "jpeg", "webp", "png"].map((e) => `${s}.${e}`).find((f) => fs.existsSync(path.join(ROOT, "images", f)));
  m.photo = photo ? `images/${photo}` : null;
}

function sources(src) {
  return src.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
    if (/^https?:/.test(p)) {
      const host = new URL(p).hostname.replace(/^www\./, "");
      const name = host.includes("seriouseats") ? "Serious Eats" : host.includes("valdemarsro") ? "Valdemarsro"
        : host.includes("youtube") ? "YouTube" : host.includes("delicious") ? "delicious.com.au"
        : host.includes("bonappetit") ? "Bon Appétit" : host;
      return { url: p, label: host.includes("youtube") ? "Se videoen på YouTube" : `Original opskrift hos ${name}`, direct: true };
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
<header class="site-header"><a class="brand" href="${rel}index.html"><span class="brand-mark">🍴</span> ${SITE.title}</a><span class="tagline">${SITE.tagline}</span></header>`;
const foot = `<footer class="site-footer">Opskrifterne er korte sammendrag skrevet med egne ord. Følg linkene for de fulde originalopskrifter hos <a href="https://www.seriouseats.com/">Serious Eats</a> og <a href="https://www.valdemarsro.dk/">Valdemarsro</a>.</footer>`;

// ---------- sider ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "meals"), { recursive: true });

meals.forEach((m, i) => {
  const prev = meals[i - 1], next = meals[i + 1];
  const srcs = sources(m.src);
  const html = `${head(`${m.title} – ${SITE.title}`, m.desc, "../")}
<main class="meal">
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

const chips = [`<button class="chip on" data-year="">Alle</button>`, ...years.map((y) => `<button class="chip" data-year="${y}">${y}</button>`)].join("");
const cards = meals.map((m) => `<a class="card" href="meals/${m.slug}.html" data-year="${m.year}" data-text="${esc((m.title + " " + m.desc + " " + m.ing.join(" ")).toLowerCase())}">${art(m, false, "")}<div class="card-body"><p class="meta">${esc(weekLabel(m))}</p><h3>${esc(m.title)}</h3></div></a>`).join("\n");

const index = `${head(`${SITE.title} – ${SITE.tagline}`, "En madblog med ugens aftensmad, billeder og opskrifter.", "")}
<main>
  <section class="intro"><h1>${SITE.tagline}</h1><p>${meals.length} retter fra vores køkken, med små opskrifter og links til de originale.</p></section>
  <div class="tools"><input id="q" type="search" placeholder="Søg efter ret eller ingrediens…" aria-label="Søg"><div class="chips">${chips}</div></div>
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
if (fs.existsSync(path.join(ROOT, "images"))) fs.cpSync(path.join(ROOT, "images"), path.join(DIST, "images"), { recursive: true });

console.log(`Bygget ${meals.length} retter -> ${DIST}`);
