(() => {
  /*
    NON EVENT CINEMAS — Chaos skin helper

    IMPORTANT:
    This file is presentation-only now.
    The real screening state is owned by app.js / Supabase.

    The old version of this file forcibly rendered "YOU DECIDE" several times
    and used a MutationObserver to put it back whenever app.js changed the card.
    That was overwriting a genuinely selected upcoming film.
  */

  const DOORS_LABEL = "6:30 PM";
  const START_LABEL = "7:00 PM";

  const $ = (sel) => document.querySelector(sel);

  function decorateScreeningCard() {
    const grid = $("#screeningGrid");
    if (!grid) return;

    // Never replace the card. app.js owns its content.
    const card = grid.querySelector(".screening-card:not(.screening-card-undecided)");
    if (!card) return;

    const info = card.querySelector(".screening-info");
    if (!info || info.querySelector(".chaos-launch-times")) return;

    const date = info.querySelector(".date-chip");
    if (!date) return;

    const times = document.createElement("div");
    times.className = "launch-times chaos-launch-times";
    times.innerHTML = `<b>DOORS ${DOORS_LABEL}</b><br>FILM ${START_LABEL}`;
    date.insertAdjacentElement("afterend", times);
  }

  function init() {
    decorateScreeningCard();

    // app.js renders asynchronously. Observe only so we can add the small
    // doors/start-time decoration; never rewrite screening content.
    const grid = $("#screeningGrid");
    if (!grid) return;

    const observer = new MutationObserver(() => {
      decorateScreeningCard();
    });

    observer.observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();