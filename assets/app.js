(function () {
  var q = document.getElementById("q");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var count = document.getElementById("count");
  var empty = document.getElementById("empty");
  var year = "";

  function apply() {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!year || c.dataset.year === year) && (!term || c.dataset.text.indexOf(term) !== -1);
      c.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = shown + " " + (shown === 1 ? "ret" : "retter");
    empty.hidden = shown !== 0;
  }

  q.addEventListener("input", apply);
  chips.forEach(function (b) {
    b.addEventListener("click", function () {
      year = b.dataset.year;
      chips.forEach(function (x) { x.classList.toggle("on", x === b); });
      apply();
    });
  });
  apply();
})();
