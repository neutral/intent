"use strict";
(() => {
  const input = document.getElementById("search");
  const data = document.getElementById("search-data");
  if (!input || !data) return;
  const entries = JSON.parse(data.textContent);
  const cards = Array.from(document.querySelectorAll("[data-record]"));
  const status = document.getElementById("search-status");
  const empty = document.getElementById("no-results");
  const update = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach(card => {
      const text = entries[Number(card.dataset.record)].toLocaleLowerCase();
      card.hidden = !words.every(word => text.includes(word));
      if (!card.hidden) count++;
    });
    status.textContent = `${count} of ${cards.length} selected records${query ? " match" : ""}`;
    empty.hidden = count !== 0 || cards.length === 0;
  };
  input.addEventListener("input", update);
  input.form.addEventListener("submit", event => event.preventDefault());
  input.form.addEventListener("reset", () => { input.value = ""; update(); input.focus(); });
})();
