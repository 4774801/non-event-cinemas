(() => {
  const cfg = window.NON_EVENT_CONFIG || {};
  const isShared = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = isShared ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const $ = (s) => document.querySelector(s);
  const key = (name) => `ne_${name}`;

  const demo = {
    archived: [],
    rsvps: [
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

  function read(name, fallback=[]) {
    try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback; }
    catch { return fallback; }
  }

  function esc(value="") {
    return String(value)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function readPosterCache() {
    try { return JSON.parse(localStorage.getItem(key("poster_cache"))) || {}; }
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

    if (cfg.OMDB_API_KEY) {
      try {
        const params = new URLSearchParams({ apikey: cfg.OMDB_API_KEY, t: title, type: "movie" });
        if (year) params.set("y", String(year));
        const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
        const data = await response.json();
        if (data.Response === "True" && data.Poster && data.Poster !== "N/A") poster = data.Poster;
      } catch {}
    }

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
      } catch {}
    }

    poster = await validateImageUrl(poster);
    cache[cacheId] = poster;
    localStorage.setItem(key("poster_cache"), JSON.stringify(cache));
    return poster;
  }

  async function loadData() {
    if (!isShared) {
      return {
        archive: demo.archived,
        rsvps: read("rsvps", demo.rsvps),
        ratings: read("ratings", demo.ratings)
      };
    }

    const [archiveRes, rsvpRes, ratingRes] = await Promise.all([
      sb.from("screenings").select("*").eq("is_past", true).order("screening_at", { ascending: false }),
      sb.from("rsvps").select("*"),
      sb.from("ratings").select("*")
    ]);
    if (archiveRes.error) throw archiveRes.error;
    if (rsvpRes.error) throw rsvpRes.error;
    if (ratingRes.error) throw ratingRes.error;

    return { archive: archiveRes.data, rsvps: rsvpRes.data, ratings: ratingRes.data };
  }

  function runtimeMinutes(runtime) {
    if (!runtime) return 0;
    const h = Number((runtime.match(/(\d+)\s*h/i) || [0,0])[1]);
    const m = Number((runtime.match(/(\d+)\s*m/i) || [0,0])[1]);
    return h * 60 + m;
  }

  function formatWatchTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function filmStats(archive, ratings, rsvps) {
    return archive.map(film => {
      const filmRatings = ratings.filter(r => String(r.screening_id) === String(film.id));
      const scores = filmRatings.map(r => Number(r.score));
      const avg = scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : null;
      const spread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
      const crowd = rsvps.filter(r => String(r.screening_id) === String(film.id) && r.status === "going").length;
      return { ...film, avg, ratingCount: scores.length, spread, crowd };
    });
  }

  function renderAttendance(archive, rsvps) {
    const completedIds = new Set(archive.map(f => String(f.id)));
    const counts = new Map();

    rsvps
      .filter(r => r.status === "going" && completedIds.has(String(r.screening_id)))
      .forEach(r => counts.set(r.user_name, (counts.get(r.user_name) || 0) + 1));

    const top = [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        rate: archive.length ? Math.round((count / archive.length) * 100) : 0
      }))
      .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3);

    $("#attendancePodium").innerHTML = top.length ? top.map((person, i) => `
      <article class="podium-card">
        <div class="podium-place">${i + 1}</div>
        <div>
          <div class="podium-name">${esc(person.name)}</div>
          <div class="podium-detail">${person.count} screening${person.count === 1 ? "" : "s"} · ${person.rate}% attendance</div>
        </div>
      </article>
    `).join("") : `<p class="empty">No completed-screening attendance data yet.</p>`;
  }

  function renderRecords(archive, films) {
    const rated = films.filter(f => f.avg !== null);
    const best = rated.length ? [...rated].sort((a,b) => b.avg - a.avg)[0] : null;
    const curatorGroups = new Map();
    rated.filter(f => f.curator).forEach(f => {
      const key = f.curator;
      const group = curatorGroups.get(key) || [];
      group.push(f.avg);
      curatorGroups.set(key, group);
    });
    const curatorScores = [...curatorGroups.entries()].map(([name, scores]) => ({
      name,
      films: scores.length,
      avg: scores.reduce((a,b) => a + b, 0) / scores.length
    }));
    const bestCurator = curatorScores.length
      ? curatorScores.sort((a,b) => b.avg - a.avg || b.films - a.films)[0]
      : null;
    const biggest = films.length ? [...films].sort((a,b) => b.crowd - a.crowd)[0] : null;
    const minutes = archive.reduce((sum, film) => sum + runtimeMinutes(film.runtime), 0);

    const cards = [
      ["Screenings", archive.length || "—", "completed"],
      ["Watch time", minutes ? formatWatchTime(minutes) : "—", "on the clock"],
      ["Best rated", best ? best.avg.toFixed(1) : "—", best ? best.title : "No ratings yet"],
      ["Best curator", bestCurator ? bestCurator.avg.toFixed(1) : "—", bestCurator ? `${bestCurator.name} · ${bestCurator.films} film${bestCurator.films === 1 ? "" : "s"}` : "No curator data"],
      ["Biggest crowd", biggest ? biggest.crowd : "—", biggest ? biggest.title : "No attendance yet"]
    ];

    $("#recordGrid").innerHTML = cards.map(([label, value, note]) => `
      <article class="record-card">
        <div class="record-label">${esc(label)}</div>
        <div class="record-value">${esc(value)}</div>
        <div class="record-note">${esc(note)}</div>
      </article>
    `).join("");
  }

  async function renderFilms(films) {
    const sorted = [...films].sort((a,b) => {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    });

    const rows = await Promise.all(sorted.map(async (film, i) => {
      const poster = await validateImageUrl(film.poster_url) || await lookupPoster(film.title, film.year);
      return `
        <article class="film-rank-row">
          <div class="film-rank-number">${String(i + 1).padStart(2, "0")}</div>
          <div class="film-rank-poster">
            ${poster
              ? `<img src="${esc(poster)}" alt="${esc(film.title)} poster" onerror="this.remove(); this.parentElement.insertAdjacentHTML('beforeend','<div class=&quot;mini-poster-fallback&quot;>${esc(film.title)}</div>')">`
              : `<div class="mini-poster-fallback">${esc(film.title)}</div>`}
          </div>
          <div class="film-rank-title">
            <strong>${esc(film.title)}</strong>
            <span>${esc(film.year || "")}${film.runtime ? ` · ${esc(film.runtime)}` : ""}${film.curator ? ` · Curated by ${esc(film.curator)}` : ""}</span>
          </div>
          <div class="film-rank-score">
            <strong>${film.avg === null ? "—" : film.avg.toFixed(1)}</strong>
            <span>${film.ratingCount} rating${film.ratingCount === 1 ? "" : "s"}</span>
          </div>
        </article>`;
    }));

    $("#filmRanking").innerHTML = rows.length ? rows.join("") : `<p class="empty">No films watched yet.</p>`;
  }

  async function render() {
    try {
      const { archive, rsvps, ratings } = await loadData();
      const films = filmStats(archive, ratings, rsvps);
      renderAttendance(archive, rsvps);
      renderRecords(archive, films);
      await renderFilms(films);
    } catch (error) {
      console.error(error);
      document.querySelector("main").insertAdjacentHTML(
        "beforeend",
        `<p class="empty section">Could not load stats. Check config.js.</p>`
      );
    }
  }

  render();
})();
