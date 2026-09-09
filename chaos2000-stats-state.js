(() => {
  const $ = (sel) => document.querySelector(sel);

  function applyEmptyStats() {
    const attendance = $("#attendancePodium");
    const records = $("#recordGrid");
    const ranking = $("#filmRanking");

    if (attendance) {
      attendance.innerHTML = `
        <div class="empty prelaunch-empty">
          No attendance records yet. First screening: 1 Oct 2026.
        </div>`;
    }

    if (records) {
      records.innerHTML = `
        <article class="record-card"><div class="record-label">Screenings held</div><div class="record-value">0</div><div class="record-note">Opening night is 1 Oct.</div></article>
        <article class="record-card"><div class="record-label">Films rated</div><div class="record-value">0</div><div class="record-note">Nothing screened yet.</div></article>
        <article class="record-card"><div class="record-label">Best curator</div><div class="record-value">—</div><div class="record-note">TBD after real screenings.</div></article>`;
    }

    if (ranking) {
      ranking.innerHTML = `<div class="empty prelaunch-empty">No films screened or rated yet.</div>`;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    applyEmptyStats();
    setTimeout(applyEmptyStats, 400);
    setTimeout(applyEmptyStats, 1200);
    setTimeout(applyEmptyStats, 2200);

    const observer = new MutationObserver(applyEmptyStats);
    ["#attendancePodium", "#recordGrid", "#filmRanking"].forEach(sel => {
      const el = $(sel);
      if (el) observer.observe(el, { childList: true });
    });
  });
})();