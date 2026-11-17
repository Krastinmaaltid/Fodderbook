(function () {
  var q = document.getElementById("q");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var count = document.getElementById("count");
  var empty = document.getElementById("empty");
  var cuisine = "";

  function apply() {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!cuisine || c.dataset.cuisine === cuisine) && (!term || c.dataset.text.indexOf(term) !== -1);
      c.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = shown + " " + (shown === 1 ? "ret" : "retter");
    empty.hidden = shown !== 0;
  }

  q.addEventListener("input", apply);
  chips.forEach(function (b) {
    b.addEventListener("click", function () {
      cuisine = b.dataset.cuisine;
      chips.forEach(function (x) { x.classList.toggle("on", x === b); });
      apply();
    });
  });
  apply();

  // ---------- click sounds ----------
  // Put audio files in the project's /audio folder. A random one plays when a meal is opened.
  var muteBtn = document.getElementById("mute");
  var clips = [];
  var last = -1;
  var muted = false;
  try { muted = localStorage.getItem("fodderbook-muted") === "1"; } catch (e) {}

  function paintMute() {
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.title = muted ? "Slå lyd til" : "Slå lyd fra";
  }
  muteBtn.addEventListener("click", function () {
    muted = !muted;
    try { localStorage.setItem("fodderbook-muted", muted ? "1" : "0"); } catch (e) {}
    paintMute();
  });

  fetch("audio/clips.json").then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
    clips = Array.isArray(list) ? list : [];
    if (clips.length) { muteBtn.hidden = false; paintMute(); }
  }).catch(function () {});

  document.getElementById("grid").addEventListener("click", function (ev) {
    var a = ev.target.closest ? ev.target.closest("a.card") : null;
    // Only plain left-clicks; let ctrl/cmd/shift/middle clicks open normally
    if (!a || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
    if (!clips.length || muted) return;
    ev.preventDefault();
    var i;
    do { i = Math.floor(Math.random() * clips.length); } while (clips.length > 1 && i === last);
    last = i;
    var done = false;
    function go() { if (!done) { done = true; location.href = a.href; } }
    var audio = new Audio("audio/" + encodeURIComponent(clips[i]));
    audio.addEventListener("ended", go);
    audio.addEventListener("error", go);
    setTimeout(go, 2500); // never make people wait long, even if a clip is long
    var p = audio.play();
    if (p && p.catch) p.catch(go);
  });
})();
