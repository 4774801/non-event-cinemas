(() => {
  const LAUNCH_ISO = "2026-10-01T19:00:00+01:00";
  const LAUNCH_LABEL = "Thu 1 Oct 2026";
  const DOORS_LABEL = "6:30 PM";
  const START_LABEL = "7:00 PM";
  const VOTE_CLOSE_LABEL = "Tue 29 Sep 2026 · 7:00 PM";

  const $ = (sel) => document.querySelector(sel);
  const esc = (value="") => String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  let sb = null;
  let screeningId = null;

  function getUser() {
    return localStorage.getItem("ne_user") || "";
  }

  function comingSoonArchive() {
    const grid = $("#archiveGrid");
    if (!grid) return;
    const wanted = `
      <article class="coming-soon-card chaos-coming-soon">
        <div>
          <strong>COMING SOON</strong>
          <span>No films have screened yet.</span>
        </div>
      </article>`;
    if (!grid.querySelector(".chaos-coming-soon")) grid.innerHTML = wanted;
  }

  async function findLaunchScreening() {
    if (!sb) return null;

    let { data, error } = await sb
      .from("screenings")
      .select("id,screening_at")
      .eq("is_past", false)
      .order("screening_at", { ascending: true })
      .limit(1);

    if (!error && data?.length) return data[0];

    ({ data, error } = await sb
      .from("screenings")
      .select("id,screening_at")
      .order("screening_at", { ascending: false })
      .limit(1));

    return (!error && data?.length) ? data[0] : null;
  }

  async function getRsvps() {
    if (!screeningId) return [];

    if (!sb) {
      try {
        return JSON.parse(localStorage.getItem("ne_rsvps") || "[]")
          .filter(r => String(r.screening_id) === String(screeningId));
      } catch {
        return [];
      }
    }

    const { data, error } = await sb
      .from("rsvps")
      .select("*")
      .eq("screening_id", screeningId);

    if (error) {
      console.warn("Chaos RSVP load failed:", error);
      return [];
    }

    return data || [];
  }

  async function renderLaunchCard() {
    const grid = $("#screeningGrid");
    if (!grid) return;

    const rsvps = await getRsvps();
    const going = rsvps.filter(r => r.status === "going");
    const user = getUser();
    const mine = rsvps.find(r => r.user_name === user);

    grid.innerHTML = `
      <article class="screening-card screening-card-undecided chaos-launch-card">
        <div class="undecided-date">
          <div>
            <span class="date-chip">${LAUNCH_LABEL}</span>
            <div class="launch-times">
              <b>DOORS ${DOORS_LABEL}</b><br>
              FILM ${START_LABEL}
            </div>
          </div>
        </div>

        <div class="undecided-copy">
          <h3>YOU DECIDE.</h3>
          <p>The first film hasn&#39;t been chosen yet.</p>
          <a class="poll-link" href="#recommendations">VOTE FOR THE FILM →</a>

          <div class="attendee-line chaos-attendees">
            <strong>${going.length} attending</strong>
            ${going.length ? ` · ${going.map(x => esc(x.user_name)).join(", ")}` : " · Be the first to commit."}
          </div>

          <button class="rsvp-btn chaos-rsvp-btn" type="button">
            ${mine ? `RSVP: ${esc(mine.status.replace("_"," "))}` : "RSVP"}
          </button>
        </div>
      </article>`;

    grid.querySelector(".chaos-rsvp-btn")?.addEventListener("click", () => {
      const userNow = getUser();
      if (!userNow) {
        const dialog = $("#loginDialog");
        if (dialog && !dialog.open) dialog.showModal();
        return;
      }

      const dialog = $("#rsvpDialog");
      if (dialog && !dialog.open) {
        $("#rsvpTitle").textContent = `${LAUNCH_LABEL} · ${START_LABEL}`;
        dialog.showModal();
      }
    });
  }

  async function saveRsvp(status) {
    const user = getUser();
    if (!user || !screeningId) return;

    if (!sb) {
      let rows = [];
      try { rows = JSON.parse(localStorage.getItem("ne_rsvps") || "[]"); } catch {}
      rows = rows.filter(r => !(String(r.screening_id) === String(screeningId) && r.user_name === user));
      rows.push({ screening_id: screeningId, user_name: user, status });
      localStorage.setItem("ne_rsvps", JSON.stringify(rows));
    } else {
      const { error } = await sb.from("rsvps").upsert(
        { screening_id: screeningId, user_name: user, status },
        { onConflict: "screening_id,user_name" }
      );
      if (error) {
        console.error("Chaos RSVP save failed:", error);
        return;
      }
    }

    $("#rsvpDialog")?.close();
    await renderLaunchCard();
  }

  function lockVoteStatus() {
    const status = $("#voteStatus");
    if (!status) return;
    status.textContent = `Voting closes ${VOTE_CLOSE_LABEL}`;
    status.classList.remove("closed");
  }

  function installDialogHandlers() {
    document.querySelectorAll("#rsvpDialog [data-status]").forEach(btn => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveRsvp(btn.dataset.status);
      }, true);
    });
  }

  async function enforcePrelaunchState() {
    comingSoonArchive();
    lockVoteStatus();
    await renderLaunchCard();
  }

  async function init() {
    const cfg = window.NON_EVENT_CONFIG || {};

    if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const row = await findLaunchScreening();
      screeningId = row?.id ?? null;
    }

    if (!screeningId) screeningId = "launch-2026-10-01";

    installDialogHandlers();

    // app.js may finish its own async render after this file loads,
    // so re-assert the pre-launch state a few times.
    await enforcePrelaunchState();
    setTimeout(enforcePrelaunchState, 350);
    setTimeout(enforcePrelaunchState, 1000);
    setTimeout(enforcePrelaunchState, 2200);

    const archive = $("#archiveGrid");
    const screening = $("#screeningGrid");

    const observer = new MutationObserver(() => {
      if (archive && !archive.querySelector(".chaos-coming-soon")) comingSoonArchive();
      if (screening && !screening.querySelector(".chaos-launch-card")) renderLaunchCard();
    });

    if (archive) observer.observe(archive, { childList: true });
    if (screening) observer.observe(screening, { childList: true });
  }

  window.addEventListener("DOMContentLoaded", init);
})();