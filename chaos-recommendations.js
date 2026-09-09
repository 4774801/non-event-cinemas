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

  const STOPWORDS = new Set(["the"]);
  const imageCacheKey = "ne_chaos_fake_poster_cache_v3";
  const creditsCacheKey = "ne_chaos_movie_credits_cache_v2";

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

  async function findBestFilmPage(title) {
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);

    // Try the submitted title first, then progressively remove an extra
    // leading word. This catches things like:
    // "Basil the Great Mouse Detective" -> "The Great Mouse Detective".
    const searches = [title];

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
        const castIds=entityIds(entity,"P161",2);
        const labels=await wikidataLabels([...directorIds,...castIds]);
        result.director=directorIds.map(id=>labels[id]).filter(Boolean).join(", ");
        result.cast=castIds.map(id=>labels[id]).filter(Boolean).slice(0,2);
      }
    } catch (e) {
      console.warn("Movie credits lookup failed:",e);
    }
    cache[key]=result; writeCache(creditsCacheKey,cache); return result;
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
    timer=setTimeout(()=>list.querySelectorAll(".recommendation-item").forEach(enhanceCard),30);
  }

  new MutationObserver(scan).observe(list,{childList:true,subtree:false});
  scan();

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
      background-image: url("./lighthouse-tile.png") !important;
      background-repeat: repeat !important;
      background-size: 100px auto !important;
      background-position: top left !important;
      background-attachment: fixed !important;
    }
  `;
  document.head.appendChild(lighthouseTileStyle);

})();