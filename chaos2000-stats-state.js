(() => {
  const $ = (sel) => document.querySelector(sel);

  function attendanceIsCorrect(el) {
    return !!el?.querySelector(".prelaunch-attendance");
  }

  function recordsAreCorrect(el) {
    return el?.dataset?.prelaunch === "true";
  }

  function rankingIsCorrect(el) {
    return !!el?.querySelector(".prelaunch-ranking");
  }

  function applyAttendance() {
    const el = $("#attendancePodium");
    if (!el || attendanceIsCorrect(el)) return;
    el.innerHTML = `
      <div class="empty prelaunch-empty prelaunch-attendance">
        No attendance records yet. First screening: 1 Oct 2026.
      </div>`;
  }

  function applyRecords() {
    const el = $("#recordGrid");
    if (!el || recordsAreCorrect(el)) return;
    el.innerHTML = `
      <article class="record-card">
        <div class="record-label">Screenings held</div>
        <div class="record-value">0</div>
        <div class="record-note">Opening night is 1 Oct.</div>
      </article>
      <article class="record-card">
        <div class="record-label">Films rated</div>
        <div class="record-value">0</div>
        <div class="record-note">Nothing screened yet.</div>
      </article>
      <article class="record-card">
        <div class="record-label">Best curator</div>
        <div class="record-value">—</div>
        <div class="record-note">TBD after real screenings.</div>
      </article>`;
    el.dataset.prelaunch = "true";
  }

  function applyRanking() {
    const el = $("#filmRanking");
    if (!el || rankingIsCorrect(el)) return;
    el.innerHTML = `
      <div class="empty prelaunch-empty prelaunch-ranking">
        No films screened or rated yet.
      </div>`;
  }

  function applyEmptyStats() {
    applyAttendance();
    applyRecords();
    applyRanking();
  }

  function watchForStatsJsRerender() {
    const targets = [
      ["#attendancePodium", applyAttendance],
      ["#recordGrid", applyRecords],
      ["#filmRanking", applyRanking]
    ];

    for (const [selector, apply] of targets) {
      const el = $(selector);
      if (!el) continue;

      const observer = new MutationObserver(() => {
        // Only write when stats.js has actually replaced our pre-launch state.
        // Once our marker is back in place, apply() is a no-op, so there is no loop.
        apply();
      });

      observer.observe(el, { childList: true, subtree: false });
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    applyEmptyStats();
    watchForStatsJsRerender();

    // stats.js fetches asynchronously; these are harmless no-ops if our state remains.
    setTimeout(applyEmptyStats, 400);
    setTimeout(applyEmptyStats, 1200);
    setTimeout(applyEmptyStats, 2500);
  });
})();