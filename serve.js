// Local editor: serves the built site on http://localhost:3000 with an edit toolbar.
// Run: node serve.js   (or: npm run edit)
// Only listens on 127.0.0.1. The published site never contains the editor.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { build, loadMeals, ROOT, DIST, DATA } = require("./build.js");

const PORT = Number(process.env.PORT) || 3000;
const IMAGES = path.join(ROOT, "images");
const MAX_BODY = 12 * 1024 * 1024;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4",
};

build();

// ---------- data helpers ----------
const readRaw = () => JSON.parse(fs.readFileSync(DATA, "utf8"));
function writeRaw(list) {
  const tmp = DATA + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + "\n");
  fs.renameSync(tmp, DATA); // atomic-ish: never leaves a half-written file
}
const lines = (v) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((s) => String(s).trim()).filter(Boolean);
function clean(input) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Title is required");
  const year = parseInt(input.year, 10);
  if (!(year >= 1990 && year <= 2100)) throw new Error("Year must be a 4-digit year");
  const week = input.week === "" || input.week == null ? null : parseInt(input.week, 10);
  if (week !== null && !(week >= 1 && week <= 53)) throw new Error("Week must be 1-53 or empty");
  const hue = Math.max(0, Math.min(360, parseInt(input.hue, 10) || 0));
  return {
    title,
    cuisine: String(input.cuisine || "Andet").trim().slice(0, 40) || "Andet",
    year, week,
    emoji: String(input.emoji || "🍽️").trim().slice(0, 8) || "🍽️",
    hue,
    desc: String(input.desc || "").trim(),
    ing: lines(input.ing),
    steps: lines(input.steps),
    src: lines(input.src).join(";"),
  };
}
const imageFiles = (slug) => ["jpg", "jpeg", "webp", "png"].map((e) => path.join(IMAGES, `${slug}.${e}`)).filter((f) => fs.existsSync(f));

// ---------- git ----------
function git(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd: ROOT, timeout: 120000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) { err.output = (stderr || stdout || err.message).trim(); return reject(err); }
      resolve((stdout || "").trim());
    });
  });
}
async function status() {
  const out = await git(["status", "--porcelain", "--", "data", "images"]);
  const files = out ? out.split("\n").filter(Boolean) : [];
  return { changed: files.length, files };
}
async function publish() {
  const s = await status();
  if (!s.changed) return { published: false, message: "Nothing to publish." };
  await git(["add", "--", "data", "images"]);
  await git(["commit", "-m", "Update meals from editor"]);
  await git(["push"]);
  return { published: true, message: "Pushed to GitHub. The live site updates in about a minute." };
}

// ---------- http ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error("Body too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "meals", slug?]
  const method = req.method;
  try {
    if (parts[1] === "meals" && method === "GET" && !parts[2]) return send(res, 200, loadMeals());

    if (parts[1] === "status" && method === "GET") return send(res, 200, await status());

    if (parts[1] === "publish" && method === "POST") return send(res, 200, await publish());

    if (parts[1] === "meals" && method === "POST" && !parts[2]) {
      const meal = clean(JSON.parse((await readBody(req)).toString("utf8")));
      const list = readRaw(); list.unshift(meal); writeRaw(list); build();
      const created = loadMeals()[0];
      return send(res, 200, { slug: created.slug });
    }

    if (parts[1] === "meals" && parts[2]) {
      const slug = parts[2];
      const current = loadMeals();
      const idx = current.findIndex((m) => m.slug === slug);
      if (idx < 0) return send(res, 404, { error: "Meal not found" });

      if (method === "PUT") {
        const meal = clean(JSON.parse((await readBody(req)).toString("utf8")));
        const list = readRaw(); list[idx] = meal; writeRaw(list);
        const newSlug = loadMeals()[idx].slug;
        if (newSlug !== slug) { // keep the photo attached when a meal is renamed
          for (const f of imageFiles(slug)) fs.renameSync(f, path.join(IMAGES, `${newSlug}${path.extname(f)}`));
        }
        build();
        return send(res, 200, { slug: newSlug });
      }

      if (method === "DELETE") {
        const list = readRaw(); list.splice(idx, 1); writeRaw(list);
        imageFiles(slug).forEach((f) => fs.unlinkSync(f));
        build();
        return send(res, 200, { ok: true });
      }
    }

    if (parts[1] === "photo" && parts[2] && method === "POST") {
      const slug = parts[2];
      if (!loadMeals().some((m) => m.slug === slug)) return send(res, 404, { error: "Meal not found" });
      const ext = String(url.searchParams.get("ext") || "").toLowerCase().replace("jpeg", "jpg");
      if (!["jpg", "png", "webp"].includes(ext)) return send(res, 400, { error: "Use a JPG, PNG or WebP image" });
      const body = await readBody(req);
      if (!body.length) return send(res, 400, { error: "Empty file" });
      fs.mkdirSync(IMAGES, { recursive: true });
      imageFiles(slug).forEach((f) => fs.unlinkSync(f));
      fs.writeFileSync(path.join(IMAGES, `${slug}.${ext}`), body);
      build();
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: "Unknown endpoint" });
  } catch (e) {
    send(res, e.output ? 500 : 400, { error: e.output || e.message });
  }
}

function serveStatic(res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === "/__edit/edit.js") {
    res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" });
    return res.end(fs.readFileSync(path.join(ROOT, "assets", "edit.js")));
  }
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    const ext = path.extname(file).toLowerCase();
    if (ext === ".html") data = Buffer.from(data.toString("utf8").replace("</body>", `<script src="/__edit/edit.js"></script></body>`));
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // Block DNS-rebinding and cross-site requests: only accept our own host name
  const host = (req.headers.host || "").toLowerCase();
  if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`) { res.writeHead(403); return res.end("Forbidden"); }
  const url = new URL(req.url, `http://${host}`);
  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.headers["x-fodderbook"] !== "1") return send(res, 403, { error: "Missing header" });
    return api(req, res, url);
  }
  serveStatic(res, url);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Editor running at http://localhost:${PORT}\n  Press Ctrl+C to stop.\n`);
});
