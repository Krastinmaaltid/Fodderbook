// Edit toolbar. Injected by serve.js only; never part of the published site.
(function () {
  var HEADERS = { "Content-Type": "application/json", "X-Fodderbook": "1" };
  var main = document.querySelector("main.meal");
  var slug = main ? main.getAttribute("data-slug") : null;

  function api(method, url, body, raw) {
    var opts = { method: method, headers: raw ? { "X-Fodderbook": "1" } : HEADERS };
    if (body !== undefined) opts.body = raw ? body : JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Request failed"); return j; });
    });
  }

  // ---------- styles ----------
  var css = document.createElement("style");
  css.textContent = [
    ".ed-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:50;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 32px);padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:999px;box-shadow:0 8px 28px rgba(0,0,0,.2);font:600 14px var(--sans)}",
    ".ed-bar .ed-tag{color:var(--muted);padding:0 8px;font-weight:600}",
    ".ed-btn{font:inherit;font-size:14px;padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}",
    ".ed-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}",
    ".ed-btn.danger{color:#b3261e;border-color:#b3261e}",
    ".ed-btn:disabled{opacity:.5;cursor:default}",
    ".ed-btn:focus-visible,.ed-form input:focus-visible,.ed-form textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}",
    ".ed-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:60;max-width:calc(100vw - 32px);padding:10px 16px;border-radius:12px;background:var(--ink);color:var(--bg);font:500 14px var(--sans)}",
    ".ed-toast.err{background:#b3261e;color:#fff}",
    "dialog.ed-dlg{width:min(720px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:0;border:1px solid var(--line);border-radius:16px;background:var(--bg);color:var(--ink)}",
    "dialog.ed-dlg::backdrop{background:rgba(0,0,0,.5)}",
    ".ed-form{display:flex;flex-direction:column;gap:12px;padding:20px;font:15px/1.4 var(--sans)}",
    ".ed-form h2{margin:0;font:600 22px var(--serif)}",
    ".ed-form label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px;color:var(--muted)}",
    ".ed-form input,.ed-form textarea{font:15px/1.4 var(--sans);padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);width:100%}",
    ".ed-row{display:grid;gap:12px;grid-template-columns:1fr 1fr 1fr}",
    ".ed-row.wide{grid-template-columns:2fr 1fr 1fr}",
    ".ed-hint{font-weight:400;color:var(--muted);font-size:12px}",
    ".ed-actions{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-top:4px}",
    ".ed-swatch{height:36px;border-radius:8px;display:grid;place-items:center;font-size:22px}"
  ].join("\n");
  document.head.appendChild(css);

  // ---------- toast ----------
  var toastEl;
  function toast(msg, isErr) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement("div");
    toastEl.className = "ed-toast" + (isErr ? " err" : "");
    toastEl.setAttribute("role", "status");
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    setTimeout(function () { if (toastEl) toastEl.remove(); }, isErr ? 7000 : 3500);
  }

  // ---------- toolbar ----------
  var bar = document.createElement("div");
  bar.className = "ed-bar";
  var tag = document.createElement("span"); tag.className = "ed-tag"; tag.textContent = "Edit mode";
  bar.appendChild(tag);
  function btn(label, cls, onClick) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "ed-btn" + (cls ? " " + cls : ""); b.textContent = label; b.addEventListener("click", onClick);
    bar.appendChild(b); return b;
  }
  if (slug) btn("✏️ Edit this meal", "", function () { openForm(slug); });
  btn("＋ New meal", "", function () { openForm(null); });
  var pub = btn("Publish", "primary", doPublish);
  document.body.appendChild(bar);

  function refreshStatus() {
    api("GET", "/api/status").then(function (s) {
      pub.textContent = s.changed ? "Publish (" + s.changed + " changed)" : "Publish";
      pub.disabled = !s.changed;
    }).catch(function () { pub.textContent = "Publish"; });
  }
  function doPublish() {
    pub.disabled = true; pub.textContent = "Publishing…";
    api("POST", "/api/publish", {}).then(function (r) { toast(r.message); }, function (e) { toast("Publish failed: " + e.message, true); })
      .then(refreshStatus);
  }
  refreshStatus();

  // ---------- form ----------
  function openForm(editSlug) {
    api("GET", "/api/meals").then(function (all) {
      var m = editSlug ? all.filter(function (x) { return x.slug === editSlug; })[0]
                       : { title: "", cuisine: "", year: new Date().getFullYear(), week: null, emoji: "🍽️", hue: 30, desc: "", ing: [], steps: [], src: "", photo: null };
      if (!m) { toast("Meal not found", true); return; }
      var cuisines = [];
      all.forEach(function (x) { if (x.cuisine && cuisines.indexOf(x.cuisine) < 0) cuisines.push(x.cuisine); });
      buildForm(editSlug, m, cuisines.sort());
    }, function (e) { toast(e.message, true); });
  }

  function field(label, el, hint) {
    var l = document.createElement("label");
    l.appendChild(document.createTextNode(label));
    if (hint) { var h = document.createElement("span"); h.className = "ed-hint"; h.textContent = hint; l.appendChild(h); }
    l.appendChild(el); return l;
  }
  function input(type, value) { var i = document.createElement("input"); i.type = type; i.value = value == null ? "" : value; return i; }
  function area(value, rows) { var t = document.createElement("textarea"); t.rows = rows; t.value = value; return t; }

  function buildForm(editSlug, m, cuisines) {
    var dlg = document.createElement("dialog"); dlg.className = "ed-dlg";
    var form = document.createElement("form"); form.className = "ed-form"; form.method = "dialog";
    var h = document.createElement("h2"); h.textContent = editSlug ? "Edit meal" : "New meal"; form.appendChild(h);

    var title = input("text", m.title); title.required = true;
    var cuisine = input("text", m.cuisine); cuisine.setAttribute("list", "ed-cuisines"); cuisine.placeholder = "e.g. Italiensk";
    var dl = document.createElement("datalist"); dl.id = "ed-cuisines";
    cuisines.forEach(function (c) { var o = document.createElement("option"); o.value = c; dl.appendChild(o); });
    var year = input("number", m.year); year.required = true; year.min = 1990; year.max = 2100;
    var week = input("number", m.week); week.min = 1; week.max = 53;
    var emoji = input("text", m.emoji);
    var hue = input("range", m.hue); hue.min = 0; hue.max = 360;
    var swatch = document.createElement("div"); swatch.className = "ed-swatch";
    function paint() { swatch.style.background = "linear-gradient(135deg,hsl(" + hue.value + " 75% 85%),hsl(" + (+hue.value + 28) + " 70% 74%))"; swatch.textContent = emoji.value; }
    hue.addEventListener("input", paint); emoji.addEventListener("input", paint); paint();
    var desc = area(m.desc, 3);
    var ing = area(m.ing.join("\n"), 7);
    var steps = area(m.steps.join("\n"), 7);
    var src = area((m.src || "").split(";").join("\n"), 3);
    var photo = input("file", ""); photo.accept = "image/jpeg,image/png,image/webp";

    var r1 = document.createElement("div"); r1.className = "ed-row wide";
    r1.appendChild(field("Title", title)); r1.appendChild(field("Year", year)); r1.appendChild(field("Week", week, " optional"));
    var r2 = document.createElement("div"); r2.className = "ed-row";
    r2.appendChild(field("Emoji", emoji)); r2.appendChild(field("Colour", hue)); r2.appendChild(swatch);
    form.appendChild(r1);
    form.appendChild(field("Cuisine", cuisine, " pick one or type a new one; it becomes a filter on the front page"));
    form.appendChild(dl);
    form.appendChild(field("Description", desc));
    form.appendChild(r2);
    form.appendChild(field("Ingredients", ing, " one per line"));
    form.appendChild(field("Steps", steps, " one per line"));
    form.appendChild(field("Recipe links", src, " one per line: a full https:// URL, se:search words (Serious Eats search) or vr:search words (Valdemarsro search)"));
    form.appendChild(field("Photo", photo, m.photo ? " replaces the current photo" : " optional, replaces the illustration"));

    var actions = document.createElement("div"); actions.className = "ed-actions";
    var left = document.createElement("div");
    if (editSlug) {
      var del = document.createElement("button"); del.type = "button"; del.className = "ed-btn danger"; del.textContent = "Delete meal";
      del.addEventListener("click", function () {
        if (!window.confirm("Delete \"" + m.title + "\"? This changes the data file (you can still undo it with git).")) return;
        api("DELETE", "/api/meals/" + editSlug).then(function () { location.href = "/index.html"; }, function (e) { toast(e.message, true); });
      });
      left.appendChild(del);
    }
    var right = document.createElement("div"); right.style.display = "flex"; right.style.gap = "8px";
    var cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "ed-btn"; cancel.textContent = "Cancel";
    cancel.addEventListener("click", function () { dlg.close(); });
    var save = document.createElement("button"); save.type = "submit"; save.className = "ed-btn primary"; save.textContent = "Save";
    right.appendChild(cancel); right.appendChild(save);
    actions.appendChild(left); actions.appendChild(right); form.appendChild(actions);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      save.disabled = true; save.textContent = "Saving…";
      var body = { title: title.value, cuisine: cuisine.value, year: year.value, week: week.value, emoji: emoji.value, hue: hue.value, desc: desc.value, ing: ing.value, steps: steps.value, src: src.value };
      var req = editSlug ? api("PUT", "/api/meals/" + editSlug, body) : api("POST", "/api/meals", body);
      req.then(function (res) {
        var file = photo.files && photo.files[0];
        if (!file) return res;
        var ext = (file.name.split(".").pop() || "").toLowerCase();
        return api("POST", "/api/photo/" + res.slug + "?ext=" + encodeURIComponent(ext), file, true).then(function () { return res; });
      }).then(function (res) {
        location.href = "/meals/" + res.slug + ".html";
      }, function (e) {
        save.disabled = false; save.textContent = "Save"; toast(e.message, true);
      });
    });

    dlg.appendChild(form); document.body.appendChild(dlg);
    dlg.addEventListener("close", function () { dlg.remove(); });
    dlg.showModal(); title.focus();
  }
})();
