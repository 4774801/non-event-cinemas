(() => {
  const cfg = window.NON_EVENT_CONFIG || {};
  const isShared = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = isShared ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const $ = (s) => document.querySelector(s);
  const screeningGrid = $("#screeningGrid");
  const recommendationList = $("#recommendationList");
  const archiveGrid = $("#archiveGrid");
  const recCount = $("#recCount");
  const loginDialog = $("#loginDialog");
  const rsvpDialog = $("#rsvpDialog");
  const loginLabel = $("#loginLabel");
  const loginBtn = $("#loginBtn");

  let user = localStorage.getItem("ne_user") || "";
  let activeScreeningId = null;

  const demo = {
    screenings: [
      {
        id: "s1",
        title: "TBC",
        curator: "",
        screening_at: "2026-10-01T19:30:00",
        runtime: "",
        year: null,
        note: "",
        poster_url: "",
        is_cancelled: false
      }
    ],
    archived: [],
    rsvps: [
      { screening_id: "s1", user_name: "KJ", status: "going" },
      { screening_id: "s1", user_name: "MG", status: "going" },
      { screening_id: "a1", user_name: "KJ", status: "going" },
      { screening_id: "a1", user_name: "MG", status: "going" },
      { screening_id: "a1", user_name: "BT", status: "going" },
      { screening_id: "a2", user_name: "KJ", status: "going" },
      { screening_id: "a2", user_name: "MG", status: "going" },
      { screening_id: "a2", user_name: "BT", status: "going" },
      { screening_id: "a3", user_name: "KJ", status: "going" }
    ],
    ratings: [
      { screening_id: "a1", user_name: "KJ", score: 5 },
      { screening_id: "a1", user_name: "MG", score: 4 },
      { screening_id: "a1", user_name: "BT", score: 5 },
      { screening_id: "a2", user_name: "KJ", score: 5 },
      { screening_id: "a2", user_name: "MG", score: 5 },
      { screening_id: "a2", user_name: "BT", score: 4 },
      { screening_id: "a3", user_name: "KJ", score: 4 },
      { screening_id: "a3", user_name: "MG", score: 3 },
      { screening_id: "a3", user_name: "BT", score: 5 }
    ]
  };

  const key = (name) => `ne_${name}`;
  const read = (name, fallback=[]) => {
    try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback; }
    catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));

  const posterCacheKey = key("poster_cache");

  function readPosterCache() {
    try { return JSON.parse(localStorage.getItem(posterCacheKey)) || {}; }
    catch { return {}; }
  }

  async function validateImageUrl(url) {
    if (!url) return "";
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = "";
        resolve("");
      }, 6000);

      img.onload = () => {
        clearTimeout(timer);
        resolve(url);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve("");
      };
      img.referrerPolicy = "no-referrer";
      img.src = url;
    });
  }

  async function lookupPoster(title, year) {
    if (!title) return "";
    const cache = readPosterCache();
    const cacheId = `${String(title).toLowerCase()}|${year || ""}`;
    if (Object.prototype.hasOwnProperty.call(cache, cacheId)) return cache[cacheId];

    let poster = "";

    // First choice: OMDb if you have added a free API key.
    if (cfg.OMDB_API_KEY) {
      try {
        const params = new URLSearchParams({
          apikey: cfg.OMDB_API_KEY,
          t: title,
          type: "movie"
        });
        if (year) params.set("y", String(year));
        const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
        const data = await response.json();
        if (data.Response === "True" && data.Poster && data.Poster !== "N/A") {
          poster = data.Poster;
        }
      } catch (error) {
        console.warn("OMDb poster lookup failed:", error);
      }
    }

    // No-key fallback: ask Wikipedia for the lead image on the most likely film page.
    if (!poster) {
      try {
        const query = `${title}${year ? ` ${year}` : ""} film`;
        const params = new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: query,
          gsrlimit: "1",
          prop: "pageimages",
          piprop: "thumbnail",
          pithumbsize: "900",
          format: "json",
          origin: "*"
        });
        const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
        const data = await response.json();
        const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
        poster = page?.thumbnail?.source || "";
      } catch (error) {
        console.warn("Wikipedia poster lookup failed:", error);
      }
    }

    poster = await validateImageUrl(poster);
    cache[cacheId] = poster;
    localStorage.setItem(posterCacheKey, JSON.stringify(cache));
    return poster;
  }

  function esc(value="") {
    return String(value)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function prettyDate(dateStr) {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
    }).format(d);
  }

  function voteCutoffFor(screeningAt) {
    const d = new Date(screeningAt);
    return new Date(d.getTime() - 48 * 60 * 60 * 1000);
  }

  function formatCutoff(date) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit"
    }).format(date);
  }

  async function getNextScreening() {
    const rows = await getScreenings();
    return rows[0] || null;
  }

  async function votingIsOpen() {
    const next = await getNextScreening();
    if (!next) return { open: false, next: null, cutoff: null };
    const cutoff = voteCutoffFor(next.screening_at);
    return { open: new Date() < cutoff, next, cutoff };
  }

  async function renderVoteStatus() {
    const el = $("#voteStatus");
    if (!el) return;
    const state = await votingIsOpen();
    if (!state.next) {
      el.textContent = "No upcoming screening scheduled.";
      el.classList.add("closed");
      return;
    }
    if (state.open) {
      el.textContent = `Voting closes ${formatCutoff(state.cutoff)}.`;
      el.classList.remove("closed");
    } else {
      el.textContent = `Voting closed ${formatCutoff(state.cutoff)}.`;
      el.classList.add("closed");
    }
  }

  function showToast(text) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function updateLoginUI() {
    loginLabel.textContent = user || "Sign in";
    loginBtn.classList.toggle("signed-in", Boolean(user));
  }

  function requireUser(action) {
    if (user) return true;
    loginDialog.showModal();
    loginDialog.dataset.pending = action || "";
    return false;
  }

  $("#loginBtn").addEventListener("click", () => {
    if (user) {
      if (confirm(`Signed in as ${user}. Sign out?`)) {
        user = "";
        localStorage.removeItem("ne_user");
        updateLoginUI();
        renderAll();
      }
    } else {
      loginDialog.showModal();
    }
  });

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = $("#nameInput").value.trim();
    if (!value) return;
    user = value;
    localStorage.setItem("ne_user", user);
    updateLoginUI();
    loginDialog.close();
    showToast(`Welcome, ${user}.`);
  });

  async function getScreenings() {
    if (!isShared) return demo.screenings;

    const { data, error } = await sb
      .from("screenings")
      .select("*")
      .eq("is_past", false)
      .eq("is_cancelled", false)
      .order("screening_at")
      .limit(1);

    if (error) throw error;

    return (data || []).map(row => {
      const title = String(row.title || "").trim().toLowerCase();
      const launchAt = "2026-10-01T19:30:00";
      const rowTime = new Date(row.screening_at || 0);
      const launchTime = new Date(launchAt);

      // Old development rows used September dates. The first real screening
      // is fixed at 1 October 2026, 7:30 PM.
      const correctedDate = rowTime < launchTime ? launchAt : row.screening_at;

      // Development seed only. Never show it as a genuine selected film.
      if (title.includes("nice guys")) {
        return {
          ...row,
          screening_at: correctedDate,
          title: "TBC",
          runtime: null,
          year: null,
          note: null,
          poster_url: null,
          curator: null
        };
      }

      return {
        ...row,
        screening_at: correctedDate
      };
    });
  }

  async function getArchive() {
    if (!isShared) return demo.archived;

    const { data, error } = await sb
      .from("screenings")
      .select("*")
      .eq("is_past", true)
      .order("screening_at", { ascending: false });

    if (error) throw error;

    // Non Event's first real screening is 1 October 2026.
    // Older rows were demo seed data from development and must never appear publicly.
    const launch = new Date("2026-10-01T00:00:00");
    return (data || []).filter(row => {
      const when = new Date(row.screened_at || row.screening_at || 0);
      return when >= launch;
    });
  }

  async function getRsvps() {
    if (!isShared) return read("rsvps", demo.rsvps);
    const { data, error } = await sb.from("rsvps").select("*");
    if (error) throw error;
    return data;
  }

  async function setRsvp(screeningId, status) {
    if (!requireUser("rsvp")) return;
    if (!isShared) {
      const rows = read("rsvps", []).filter(r => !(r.screening_id === screeningId && r.user_name === user));
      rows.push({ screening_id: screeningId, user_name: user, status });
      write("rsvps", rows);
    } else {
      const { error } = await sb.from("rsvps").upsert(
        { screening_id: screeningId, user_name: user, status },
        { onConflict: "screening_id,user_name" }
      );
      if (error) throw error;
    }
    rsvpDialog.close();
    showToast("RSVP updated.");
    await renderScreenings();
  }

  function isUndecidedScreening(s) {
    const title = String(s?.title || "").trim().toLowerCase();

    return (
      ["", "tbc", "tbd", "to be decided", "you decide", "undecided"].includes(title) ||
      title.includes("nice guys")
    );
  }

  async function renderScreenings() {
    const [screenings, rsvps] = await Promise.all([getScreenings(), getRsvps()]);
    if (!screenings.length) {
      screeningGrid.innerHTML = `
        <article class="screening-card screening-card-undecided">
          <div class="undecided-date">
            <span class="date-chip">Thu 1 Oct 2026 · 7:30 PM</span>
          </div>
          <div class="undecided-copy">
            <h3>You decide.</h3>
            <p>The first film hasn&#39;t been chosen yet.</p>
            <a class="poll-link" href="#recommendations">Vote for the film →</a>
          </div>
        </article>`;
      return;
    }

    const cards = await Promise.all(screenings.map(async s => {
      if (isUndecidedScreening(s)) {
        const going = rsvps.filter(r => String(r.screening_id) === String(s.id) && r.status === "going");
        const mine = rsvps.find(r => String(r.screening_id) === String(s.id) && r.user_name === user);

        return `
          <article class="screening-card screening-card-undecided">
            <div class="undecided-date">
              <span class="date-chip">Thu 1 Oct 2026 · 7:30 PM</span>
            </div>
            <div class="undecided-copy">
              <h3>You decide.</h3>
              <p>The first film hasn&#39;t been chosen yet.</p>
              <a class="poll-link" href="#recommendations">Vote for the film →</a>
              <div class="attendee-line undecided-attendees">
                <strong>${going.length} attending</strong>
                ${going.length ? ` · ${going.map(x => esc(x.user_name)).join(", ")}` : " · Be the first to commit."}
              </div>
              <button class="rsvp-btn" data-rsvp="${esc(s.id)}">
                ${mine ? `RSVP: ${mine.status.replace("_"," ")}` : "RSVP"}
              </button>
            </div>
          </article>`;
      }


      const going = rsvps.filter(r => String(r.screening_id) === String(s.id) && r.status === "going");
      const mine = rsvps.find(r => String(r.screening_id) === String(s.id) && r.user_name === user);
      const posterUrl = await validateImageUrl(s.poster_url) || await lookupPoster(s.title, s.year);
      const poster = posterUrl
        ? `<img src="${esc(posterUrl)}" alt="${esc(s.title)} poster" onerror="this.remove(); this.parentElement.insertAdjacentHTML('beforeend','<div class=&quot;poster-fallback&quot;><small>NON EVENT PRESENTS</small><strong>${esc(s.title)}</strong></div>')">`
        : `<div class="poster-fallback"><small>NON EVENT PRESENTS</small><strong>${esc(s.title)}</strong></div>`;

      return `
        <article class="screening-card">
          <div class="poster">${poster}</div>
          <div class="screening-info">
            <span class="date-chip">${esc(prettyDate(s.screening_at))}</span>
            <h3>${esc(s.title)}</h3>
            <div class="meta">${esc(s.year || "")}${s.runtime ? ` · ${esc(s.runtime)}` : ""}</div>
            <p>${esc(s.note || "Feature presentation")}</p>
            <div class="attendee-line">
              <strong>${going.length} attending</strong>
              ${going.length ? ` · ${going.map(x => esc(x.user_name)).join(", ")}` : " · Be the first to commit."}
            </div>
            <button class="rsvp-btn" data-rsvp="${esc(s.id)}">
              ${mine ? `RSVP: ${mine.status.replace("_"," ")}` : "RSVP"}
            </button>
          </div>
        </article>`;
    }));

    screeningGrid.innerHTML = cards.join("");

    document.querySelectorAll("[data-rsvp]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!requireUser("rsvp")) return;
        activeScreeningId = btn.dataset.rsvp;
        const screening = screenings.find(s => String(s.id) === String(activeScreeningId));
        $("#rsvpTitle").textContent = screening?.title || "RSVP";
        rsvpDialog.showModal();
      });
    });
  }

  document.querySelectorAll("[data-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (activeScreeningId) setRsvp(activeScreeningId, btn.dataset.status);
    });
  });

  async function getRecommendations() {
    if (!isShared) return read("recommendations", [
      { id: "r1", title: "Heat", reason: "Because we somehow still haven't done it.", user_name: "MG", votes: 2, voters: ["MG","KJ"], is_active: true },
      { id: "r2", title: "The Raid", reason: "Minimal plot. Maximum stairs.", user_name: "BT", votes: 1, voters: ["BT"], is_active: true }
    ]);
    const { data, error } = await sb.from("recommendations")
      .select("*")
      .eq("is_active", true)
      .order("votes", { ascending: false })
      .order("created_at");
    if (error) throw error;
    return data;
  }

  async function addRecommendation(title, reason, posterUrl) {
    if (!requireUser("recommend")) return false;
    const voting = await votingIsOpen();
    if (!voting.open) {
      showToast("Voting is closed for the next screening.");
      return false;
    }
    if (!isShared) {
      const rows = (await getRecommendations()).filter(r => r.is_active !== false);
      rows.push({ id: crypto.randomUUID(), title, reason, poster_url: posterUrl, user_name: user, votes: 0, voters: [], is_active: true });
      write("recommendations", rows);
    } else {
      const { error } = await sb.from("recommendations").insert({
        title,
        reason,
        poster_url: posterUrl || null,
        user_name: user,
        is_active: true
      });
      if (error) throw error;
    }
    return true;
  }

  async function voteRecommendation(id) {
    if (!requireUser("vote")) return;
    const voting = await votingIsOpen();
    if (!voting.open) {
      showToast("Voting is closed for the next screening.");
      return;
    }
    if (!isShared) {
      const rows = await getRecommendations();
      const row = rows.find(r => String(r.id) === String(id));
      row.voters ||= [];
      const has = row.voters.includes(user);
      row.voters = has ? row.voters.filter(v => v !== user) : [...row.voters, user];
      row.votes = row.voters.length;
      write("recommendations", rows);
    } else {
      const { data, error } = await sb.rpc("toggle_recommendation_vote", { rec_id: id, voter_name: user });
      if (error) throw error;
    }
    await renderRecommendations();
  }

  async function renderRecommendations() {
    const rows = await getRecommendations();
    rows.sort((a,b) => (b.votes || 0) - (a.votes || 0));
    recCount.textContent = `${rows.length} suggestion${rows.length === 1 ? "" : "s"}`;
    recommendationList.innerHTML = rows.length ? rows.map((r, i) => {
      const voted = !isShared && (r.voters || []).includes(user);
      return `
      <article class="recommendation-item">
        <div class="rec-rank">${String(i+1).padStart(2,"0")}</div>
        <div>
          <div class="rec-title">${esc(r.title)}</div>
          <div class="rec-reason">${esc(r.reason || "No pitch submitted. Bold strategy.")}</div>
          <div class="rec-by">NOMINATED BY ${esc(r.user_name || "ANON")}</div>
        </div>
        <button class="vote-btn ${voted ? "voted" : ""}" data-vote="${esc(r.id)}">▲ ${Number(r.votes || 0)}</button>
      </article>`;
    }).join("") : `<p class="empty">No suggestions yet. The programming committee is alarmingly quiet.</p>`;

    document.querySelectorAll("[data-vote]").forEach(btn =>
      btn.addEventListener("click", () => voteRecommendation(btn.dataset.vote))
    );
  }

  $("#recommendForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireUser("recommend")) return;
    const title = $("#recTitle").value.trim();
    const reason = $("#recReason").value.trim();
    if (!title) return;
    try {
      const poster = await lookupPoster(title);
      if (await addRecommendation(title, reason, poster)) {
        e.target.reset();
        showToast("Recommendation added.");
        await renderRecommendations();
      }
    } catch (err) {
      console.error(err);
      showToast("Could not save recommendation.");
    }
  });

  async function getRatings() {
    if (!isShared) return read("ratings", demo.ratings);
    const { data, error } = await sb.from("ratings").select("*");
    if (error) throw error;
    return data;
  }

  async function rateScreening(screeningId, score) {
    if (!requireUser("rating")) return;
    if (!isShared) {
      const rows = read("ratings", []).filter(r => !(String(r.screening_id) === String(screeningId) && r.user_name === user));
      rows.push({ screening_id: screeningId, user_name: user, score: Number(score) });
      write("ratings", rows);
    } else {
      const { error } = await sb.from("ratings").upsert(
        { screening_id: screeningId, user_name: user, score: Number(score) },
        { onConflict: "screening_id,user_name" }
      );
      if (error) throw error;
    }
    showToast(`Rated ${score}/5.`);
    await renderArchive();
  }

  async function renderArchive() {
    const [archive, ratings] = await Promise.all([getArchive(), getRatings()]);
    if (!archive.length) {
      archiveGrid.innerHTML = `
        <div class="coming-soon-card">
          <div>
            <strong>Coming Soon</strong>
            <span>Past showings will appear here</span>
          </div>
        </div>`;
    } else {
      const cards = await Promise.all(archive.map(async a => {
        const rs = ratings.filter(r => String(r.screening_id) === String(a.id));
        const avg = rs.length ? (rs.reduce((sum,r) => sum + Number(r.score), 0) / rs.length).toFixed(1) : "—";
        const mine = rs.find(r => r.user_name === user)?.score || 0;
        const posterUrl = await validateImageUrl(a.poster_url) || await lookupPoster(a.title, a.year);
        return `
        <article class="archive-card">
          ${posterUrl ? `<img class="archive-poster" src="${esc(posterUrl)}" alt="${esc(a.title)} poster" onerror="this.remove()">` : ""}
          <div class="archive-date">${esc(new Date(a.screened_at || a.screening_at).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"}))}</div>
          <h3>${esc(a.title)}</h3>
          <div class="meta">${esc(a.year || "")}</div>
          <div class="rating-row" aria-label="Rate ${esc(a.title)}">
            ${[1,2,3,4,5].map(n => `<button class="star ${n <= mine ? "active" : ""}" data-rate="${esc(a.id)}" data-score="${n}" aria-label="${n} stars">★</button>`).join("")}
            <span class="rating-average">${avg}/5 · ${rs.length} rating${rs.length === 1 ? "" : "s"}</span>
          </div>
        </article>`;
      }));
      archiveGrid.innerHTML = cards.join("");
    }

    document.querySelectorAll("[data-rate]").forEach(btn =>
      btn.addEventListener("click", () => rateScreening(btn.dataset.rate, btn.dataset.score))
    );
  }

  async function renderAll() {
    try {
      updateLoginUI();
      await Promise.all([renderScreenings(), renderRecommendations(), renderArchive(), renderVoteStatus()]);
    } catch (err) {
      console.error(err);
      showToast("Database connection failed — check config.js.");
    }
  }

  renderAll();

  if (!isShared) {
    console.info("Non Event is running in local demo mode. Add Supabase credentials to config.js for shared data.");
  }
})();
