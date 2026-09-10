(() => {
  const list = document.querySelector("#recommendationList");
  if (!list) return;

  const style = document.createElement("style");
  style.textContent = `
    .recommendation-item {
      grid-template-columns: 54px 78px minmax(0,1fr) !important;
      grid-template-rows: 1fr 1fr !important;
      column-gap: 8px !important;
      align-items: stretch !important;
    }

    .recommendation-item .rec-rank,
    .recommendation-item .vote-btn {
      box-sizing: border-box !important;
      width: 54px !important;
      min-width: 54px !important;
      height: auto !important;
      min-height: 0 !important;
      align-self: stretch !important;
      justify-self: stretch !important;
      display: grid !important;
      place-items: center !important;
      margin: 0 !important;
    }

    .recommendation-item .rec-rank {
      grid-column: 1 !important;
      grid-row: 1 !important;
    }

    .recommendation-item .vote-btn {
      grid-column: 1 !important;
      grid-row: 2 !important;
      padding: 0 !important;
      font-size: 11px !important;
      line-height: 1 !important;
      white-space: nowrap;
    }

    .recommendation-item .fake-official-poster {
      grid-column: 2 !important;
      grid-row: 1 / span 2 !important;
      width: 78px !important;
      height: 100% !important;
      min-height: 112px;
      object-fit: cover;
      align-self: stretch !important;
      border: 2px solid #000;
      background: #ddd;
    }

    .recommendation-item .rec-copy {
      grid-column: 3 !important;
      grid-row: 1 / span 2 !important;
      min-width: 0;
      align-self: stretch !important;
    }

    .recommendation-item .rec-meta-row {
      margin-top: 3px;
      color: #444;
      font-size: 10px;
      line-height: 1.3;
    }

    .recommendation-item .rec-meta-row span {
      display: inline-block;
      min-width: 56px;
      color: #0000aa;
      font: bold 9px "Courier New", monospace;
    }

    @media (max-width: 820px) {
      .recommendation-item {
        grid-template-columns: 48px 70px minmax(0,1fr) !important;
        grid-template-rows: 1fr 1fr !important;
        gap: 7px !important;
      }

      .recommendation-item .rec-rank,
      .recommendation-item .vote-btn {
        width: 48px !important;
        min-width: 48px !important;
      }

      .recommendation-item .fake-official-poster {
        width: 70px !important;
      }
    }
  `;
  document.head.appendChild(style);

  const interactionStyle = document.createElement("style");
  interactionStyle.textContent = `

    .recommendation-item .rec-voters {
      margin-top: 3px;
      color: #333;
      font: 8px/1.25 "Courier New", monospace;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    .recommendation-item .vote-btn.voted,
    .recommendation-item .vote-btn[aria-pressed="true"] {
      background: #a9a9a9 !important;
      color: #111 !important;
      border-style: solid !important;
      border-width: 4px !important;
      border-top-color: #333 !important;
      border-left-color: #333 !important;
      border-right-color: #fff !important;
      border-bottom-color: #fff !important;
      box-shadow:
        inset 3px 3px 0 #666,
        inset -1px -1px 0 #ddd !important;
      transform: translate(2px, 2px) !important;
      filter: none !important;
      font-weight: 900 !important;
    }

    .rec-form-window {
      display: flex !important;
      flex-direction: column !important;
      align-self: stretch !important;
    }

    .rec-form-window > .window-body {
      flex: 1 1 auto !important;
      display: flex !important;
      flex-direction: column !important;
      min-height: 0;
    }

    .pile-facts {
      flex: 1 1 auto;
      min-height: 150px;
      margin-top: 12px;
      padding: 8px;
      background: #c0c0c0;
      border: 3px inset #fff;
      color: #000;
      overflow: hidden;
    }

    .pile-facts-title {
      margin: -8px -8px 7px;
      padding: 5px 7px;
      color: #fff;
      background: #000080;
      font: bold 10px/1 "Courier New", monospace;
      text-transform: uppercase;
    }

    .pile-fact {
      margin: 0 0 7px;
      padding: 6px;
      background: #ffffcc;
      border: 1px solid #777;
      font: 9px/1.3 "Courier New", monospace;
    }

    .pile-fact:last-child { margin-bottom: 0; }
    .pile-fact strong {
      display: block;
      margin-bottom: 2px;
      color: #000080;
      text-transform: uppercase;
    }
`;
  document.head.appendChild(interactionStyle);

  const STOPWORDS = new Set(["the"]);
  const imageCacheKey = "ne_chaos_fake_poster_cache_v3";
  const creditsCacheKey = "ne_chaos_movie_credits_cache_v5";

  function readCache(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  }
  function writeCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function firstWord(title) {
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);
    return words.find(w => !STOPWORDS.has(w.toLowerCase())) || words[0] || title;
  }
  function escapeHtml(value="") {
    return String(value)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  async function firstCommonsImage(title) {
    const key = String(title || "").toLowerCase();
    const cache = readCache(imageCacheKey);
    if (Object.prototype.hasOwnProperty.call(cache,key)) return cache[key];

    const word = firstWord(title);
    let url = "";
    try {
      const params = new URLSearchParams({
        action:"query", generator:"search", gsrsearch:word, gsrnamespace:"6",
        gsrlimit:"8", prop:"imageinfo", iiprop:"url|mime", iiurlwidth:"360",
        format:"json", origin:"*"
      });
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      const usable = pages
        .sort((a,b)=>(a.index??999)-(b.index??999))
        .find(page => /^image\/(jpeg|png|gif|webp)$/i.test(String(page?.imageinfo?.[0]?.mime||"")));
      const info = usable?.imageinfo?.[0];
      url = info?.thumburl || info?.url || "";
    } catch (e) {
      console.warn("Fake Commons poster lookup failed:",e);
    }
    cache[key]=url; writeCache(imageCacheKey,cache); return url;
  }

  async function wikidataLabels(ids) {
    const unique=[...new Set(ids.filter(Boolean))];
    if (!unique.length) return {};
    try {
      const params=new URLSearchParams({
        action:"wbgetentities",ids:unique.join("|"),props:"labels",
        languages:"en",format:"json",origin:"*"
      });
      const response=await fetch(`https://www.wikidata.org/w/api.php?${params}`);
      const data=await response.json();
      const labels={};
      for (const id of unique) labels[id]=data?.entities?.[id]?.labels?.en?.value||"";
      return labels;
    } catch { return {}; }
  }

  function entityIds(entity, property, limit) {
    return (entity?.claims?.[property]||[])
      .map(c=>c?.mainsnak?.datavalue?.value?.id)
      .filter(Boolean).slice(0,limit);
  }

  function titleTokens(value) {
    const ignore = new Set(["the", "a", "an", "film", "movie"]);
    return String(value || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .filter(word => !ignore.has(word));
  }

  function titleMatchScore(inputTitle, candidateTitle) {
    const input = titleTokens(inputTitle);
    const candidate = titleTokens(candidateTitle);

    if (!input.length || !candidate.length) return 0;

    const a = new Set(input);
    const b = new Set(candidate);
    const shared = [...a].filter(word => b.has(word)).length;

    const inputCoverage = shared / a.size;
    const candidateCoverage = shared / b.size;

    // Favour candidates whose real title is mostly contained in what the
    // friend typed, while still allowing an extra/mistyped word.
    let score = (inputCoverage * 0.42) + (candidateCoverage * 0.58);

    const normInput = input.join(" ");
    const normCandidate = candidate.join(" ");

    if (normInput === normCandidate) score += 1;
    else if (normInput.includes(normCandidate) || normCandidate.includes(normInput)) score += 0.35;

    if (/disambiguation|list of|episode/i.test(candidateTitle)) score -= 0.5;

    return score;
  }

  async function wikipediaCandidates(searchText) {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${searchText} film`,
      gsrlimit: "10",
      prop: "pageprops",
      ppprop: "wikibase_item",
      format: "json",
      origin: "*"
    });

    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    const data = await response.json();
    return data?.query?.pages ? Object.values(data.query.pages) : [];
  }

  function canonicalMovieTitle(title) {
    const normalised = String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const aliases = {
      "basil the great mouse detective": "The Great Mouse Detective",
      "basil great mouse detective": "The Great Mouse Detective",
      "about time": "About Time (2013 film)"
    };

    return aliases[normalised] || String(title || "").trim();
  }

  async function exactWikipediaFilmPage(title) {
    try {
      const params = new URLSearchParams({
        action: "query",
        titles: title,
        prop: "pageprops",
        ppprop: "wikibase_item",
        redirects: "1",
        format: "json",
        origin: "*"
      });

      const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      return pages.find(page => !page?.missing && page?.pageprops?.wikibase_item) || null;
    } catch (error) {
      console.warn("Exact Wikipedia title lookup failed:", error);
      return null;
    }
  }

  async function findBestFilmPage(title) {
    const canonical = canonicalMovieTitle(title);

    // If we recognise a common near-miss, try the canonical Wikipedia
    // article directly before any fuzzy search.
    if (canonical && canonical.toLowerCase() !== String(title || "").trim().toLowerCase()) {
      const exact = await exactWikipediaFilmPage(canonical);
      if (exact) return exact;
    }

    const words = String(title || "").trim().split(/\s+/).filter(Boolean);

    // Try the canonical title, submitted title, then progressively remove
    // extra leading words.
    const searches = [...new Set([canonical, title].filter(Boolean))];

    if (words.length >= 4) {
      searches.push(words.slice(1).join(" "));
    }

    if (words.length >= 5) {
      searches.push(words.slice(2).join(" "));
    }

    const allPages = new Map();

    for (const search of searches) {
      try {
        const pages = await wikipediaCandidates(search);
        for (const page of pages) {
          if (page?.pageid) allPages.set(page.pageid, page);
        }
      } catch (error) {
        console.warn("Wikipedia fuzzy title search failed:", error);
      }
    }

    const ranked = [...allPages.values()]
      .map(page => ({
        page,
        score: titleMatchScore(title, page.title || "")
      }))
      .sort((a, b) => b.score - a.score);

    // 0.56 is deliberately forgiving enough for one bad/extra word,
    // but not so loose that "Heat" starts matching unrelated films.
    return ranked[0]?.score >= 0.56 ? ranked[0].page : ranked[0]?.page || null;
  }

  async function movieCredits(title) {
    const key=String(title||"").toLowerCase();
    const cache=readCache(creditsCacheKey);
    if (cache[key]) return cache[key];

    const result={director:"",cast:[],matchedTitle:""};
    try {
      const page = await findBestFilmPage(title);
      const qid = page?.pageprops?.wikibase_item;
      result.matchedTitle = page?.title || "";

      if (qid) {
        const er=await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`);
        const ed=await er.json();
        const entity=ed?.entities?.[qid];
        const directorIds=entityIds(entity,"P57",2);

        // Ordinary films generally use P161 (cast member), while animated
        // films may expose performers through P725 (voice actor).
        const castMemberIds=entityIds(entity,"P161",8);
        const voiceActorIds=entityIds(entity,"P725",8);
        const castIds=[...new Set([...castMemberIds,...voiceActorIds])].slice(0,2);

        const labels=await wikidataLabels([...directorIds,...castIds]);
        result.director=directorIds.map(id=>labels[id]).filter(Boolean).join(", ");
        result.cast=castIds.map(id=>labels[id]).filter(Boolean).slice(0,2);
      }
    } catch (e) {
      console.warn("Movie credits lookup failed:",e);
    }
    cache[key]=result; writeCache(creditsCacheKey,cache); return result;
  }

  const factsCacheKey = "ne_chaos_pile_facts_v1";

  async function wikipediaIntro(pageTitle) {
    const key = String(pageTitle || "").toLowerCase();
    const cache = readCache(factsCacheKey);
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];

    let extract = "";
    try {
      const params = new URLSearchParams({
        action: "query",
        titles: pageTitle,
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        exsentences: "1",
        redirects: "1",
        format: "json",
        origin: "*"
      });
      const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      extract = String(pages[0]?.extract || "").trim();
    } catch (error) {
      console.warn("Movie trivia lookup failed:", error);
    }

    cache[key] = extract;
    writeCache(factsCacheKey, cache);
    return extract;
  }

  function shortenFact(text, max = 190) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > 120 ? lastSpace : max).trim()}…`;
  }

  function ensureFactsPanel() {
    const body = document.querySelector(".rec-form-window > .window-body");
    if (!body) return null;
    let panel = body.querySelector(".pile-facts");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.className = "pile-facts";
    panel.innerHTML = `<div class="pile-facts-title">★ PILE TRIVIA DATABASE ★</div><div class="pile-facts-body">LOADING EXTREMELY IMPORTANT FILM FACTS...</div>`;
    body.appendChild(panel);
    return panel;
  }

  let factsRequest = 0;
  async function refreshPileFacts() {
    const panel = ensureFactsPanel();
    if (!panel) return;

    const titles = [...list.querySelectorAll(".rec-title")]
      .map(el => el.textContent.trim())
      .filter(Boolean);

    const signature = titles.join("|");
    if (!titles.length) {
      panel.querySelector(".pile-facts-body").innerHTML = `<div class="pile-fact">NO FILMS = NO FACTS. THIS IS A CRISIS.</div>`;
      panel.dataset.signature = "";
      return;
    }
    if (panel.dataset.signature === signature) return;

    panel.dataset.signature = signature;
    const requestId = ++factsRequest;
    const facts = await Promise.all(titles.map(async title => {
      const credits = await movieCredits(title);
      const matched = credits.matchedTitle || canonicalMovieTitle(title) || title;
      const intro = await wikipediaIntro(matched);

      let fact = shortenFact(intro);
      if (!fact && credits.director) {
        const cast = credits.cast?.length ? ` Starring ${credits.cast.join(" and ")}.` : "";
        fact = `Directed by ${credits.director}.${cast}`;
      }
      if (!fact) fact = "The internet has declined to provide a useful fact about this film.";
      return { title, fact };
    }));

    if (requestId !== factsRequest || !panel.isConnected) return;
    panel.querySelector(".pile-facts-body").innerHTML = facts.map(({title, fact}) => `
      <div class="pile-fact">
        <strong>${escapeHtml(title)}</strong>
        ${escapeHtml(fact)}
      </div>`).join("");
  }

  function ensureCopy(card) {
    let copy=card.querySelector(":scope > .rec-copy");
    if (copy) return copy;
    const title=card.querySelector(".rec-title");
    if (!title) return null;
    const holder=title.parentElement;
    holder.classList.add("rec-copy");
    return holder;
  }

  async function enhanceCard(card) {
    const titleEl=card.querySelector(".rec-title");
    const rank=card.querySelector(".rec-rank");
    if (!titleEl||!rank) return;

    const title=titleEl.textContent.trim();
    if (!title || card.dataset.chaosEnhanced===title) return;
    card.dataset.chaosEnhanced=title;

    const copy=ensureCopy(card);
    if (!copy) return;

    card.querySelectorAll(":scope > .rec-poster, :scope > .fake-official-poster").forEach(el=>el.remove());
    copy.querySelectorAll(".rec-meta-row").forEach(el=>el.remove());

    const [imageUrl,credits]=await Promise.all([firstCommonsImage(title),movieCredits(title)]);
    if (card.dataset.chaosEnhanced!==title || !card.isConnected) return;

    const poster=document.createElement(imageUrl?"img":"div");
    poster.className="rec-poster fake-official-poster";
    if (imageUrl) {
      poster.src=imageUrl;
      poster.alt=`${title} totally official poster`;
      poster.referrerPolicy="no-referrer";
    } else {
      poster.className+=" rec-poster-empty";
      poster.textContent="OFFICIAL POSTER MISSING";
    }
    rank.insertAdjacentElement("afterend",poster);

    const reason=copy.querySelector(".rec-reason");
    const insertBefore=reason||copy.querySelector(".rec-by");

    if (credits.director) {
      const row=document.createElement("div");
      row.className="rec-meta-row";
      row.innerHTML=`<span>DIRECTOR</span>${escapeHtml(credits.director)}`;
      copy.insertBefore(row,insertBefore);
    }
    if (credits.cast?.length) {
      const row=document.createElement("div");
      row.className="rec-meta-row";
      row.innerHTML=`<span>CAST</span>${escapeHtml(credits.cast.slice(0,2).join(", "))}`;
      copy.insertBefore(row,insertBefore);
    }
  }

  let timer=null;
  function scan() {
    clearTimeout(timer);
    timer=setTimeout(() => {
      list.querySelectorAll(".recommendation-item").forEach(enhanceCard);
      refreshPileFacts();
    },30);
  }

  new MutationObserver(scan).observe(list,{childList:true,subtree:false});
  scan();
  ensureFactsPanel();
  setTimeout(refreshPileFacts, 250);

  // ----------------------------------------------------------
  // Login / RSVP popup close fix
  // ----------------------------------------------------------
  function installDialogCloseFixes() {
    document.querySelectorAll("dialog").forEach((dialog) => {
      const closeButton = dialog.querySelector(".dialog-close");

      if (closeButton && !closeButton.dataset.closeFixInstalled) {
        closeButton.dataset.closeFixInstalled = "true";

        closeButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (dialog.open) dialog.close();

          // Clear typed sign-in value when the user explicitly cancels.
          if (dialog.id === "loginDialog") {
            const input = dialog.querySelector("#nameInput");
            if (input) input.value = "";
          }
        }, true);
      }

      if (!dialog.dataset.cancelFixInstalled) {
        dialog.dataset.cancelFixInstalled = "true";

        dialog.addEventListener("cancel", (event) => {
          event.preventDefault();
          if (dialog.open) dialog.close();

          if (dialog.id === "loginDialog") {
            const input = dialog.querySelector("#nameInput");
            if (input) input.value = "";
          }
        });
      }
    });
  }

  installDialogCloseFixes();


  // ----------------------------------------------------------
  // Username registry
  // Records anyone who submits the friend sign-in form.
  // ----------------------------------------------------------
  function installUsernameRegistry() {
    const form = document.querySelector("#loginForm");
    const input = document.querySelector("#nameInput");
    if (!form || !input || form.dataset.registryInstalled) return;

    form.dataset.registryInstalled = "true";

    form.addEventListener("submit", async () => {
      const userName = String(input.value || "").trim();
      if (!userName) return;

      const cfg = window.NON_EVENT_CONFIG || {};
      if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

      try {
        const client = window.supabase.createClient(
          cfg.SUPABASE_URL,
          cfg.SUPABASE_ANON_KEY
        );

        await client
          .from("friend_users")
          .upsert(
            {
              user_name: userName,
              last_seen_at: new Date().toISOString()
            },
            { onConflict: "user_name" }
          );
      } catch (error) {
        // Never block normal friend sign-in if registry logging fails.
        console.warn("Username registry update failed:", error);
      }
    });
  }

  installUsernameRegistry();


  // ----------------------------------------------------------
  // Lighthouse tiled page background
  // Uses the supplied image unchanged; CSS only controls display size/repeat.
  // ----------------------------------------------------------
  const lighthouseTileStyle = document.createElement("style");
  lighthouseTileStyle.textContent = `
    html,
    body {
      background-color: #0b1760 !important;
      background-image: url("./background-tile.png") !important;
      background-repeat: repeat !important;
      background-size: 100px auto !important;
      background-position: top left !important;
      background-attachment: fixed !important;
    }
  `;
  document.head.appendChild(lighthouseTileStyle);

})();