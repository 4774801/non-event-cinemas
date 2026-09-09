(() => {
  const $ = (sel) => document.querySelector(sel);

  function applyPrelaunchStats() {
    const attendance = $("#attendancePodium");
    const records = $("#recordGrid");
    const ranking = $("#filmRanking");

    if (attendance) {
      attendance.innerHTML = `
        <div class="empty prelaunch-attendance">
          No attendance records yet. First screening: 1 Oct 2026.
        </div>`;
    }

    if (records) {
      records.innerHTML = `
        <article class="record-card">
          <div class="record-label">Films watched</div>
          <div class="record-value">0</div>
          <div class="record-note">No screenings have been marked watched yet.</div>
        </article>
        <article class="record-card">
          <div class="record-label">Films rated</div>
          <div class="record-value">0</div>
          <div class="record-note">Nothing has screened yet.</div>
        </article>
        <article class="record-card">
          <div class="record-label">Best curator</div>
          <div class="record-value">—</div>
          <div class="record-note">TBD after the first completed screening.</div>
        </article>`;
    }

    if (ranking) {
      ranking.innerHTML = `
        <div class="empty prelaunch-ranking">
          No films screened or rated yet.
        </div>`;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    applyPrelaunchStats();

    // stats.js may render old/demo data asynchronously.
    // Re-apply the correct pre-launch state after those fetches finish.
    setTimeout(applyPrelaunchStats, 300);
    setTimeout(applyPrelaunchStats, 900);
    setTimeout(applyPrelaunchStats, 1800);
  });
})();