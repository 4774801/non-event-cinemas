(() => {
  const list = document.querySelector("#recommendationList");
  if (!list) return;

  const STOPWORDS = new Set(["the"]); // "The Raid" searches Commons for "Raid".
  const imageCacheKey = "ne_chaos_fake_poster_cache_v2";
  const creditsCacheKey = "ne_chaos_movie_credits_cache_v1";

  function readCache(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  }

  function writeCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch {}
  }

  function firstWord(title) {
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);
    return words.find(w => !STOPWORDS.has(w.toLowerCase())) || words[0] || title;
  }

  async function firstCommonsImage(title) {
    const key = String(title || "").toLowerCase();
    const cache = readCache(imageCacheKey);
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];

    const word = firstWord(title);
    let url = "";

    try {
      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: word,
        gsrnamespace: "6",
        gsrlimit: "8",
        prop: "imageinfo",
        iiprop: "url|mime",
        iiurlwidth: "360",
        format: "json",
        origin: "*"
      });

      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

      const usable = pages
        .sort((a,b) => (a.index ?? 999) - (b.index ?? 999))
        .find(page => {
          const info = page?.imageinfo?.[0];
          const mime = String(info?.mime || "");
          return info && /^image\/(jpeg|png|gif|webp)$/i.test(mime);
        });

      const info = usable?.imageinfo?.[0];
      url = info?.thumburl || info?.url || "";
    } catch (error) {
      console.warn("Fake Commons poster lookup failed:", error);
    }

    cache[key] = url;
    writeCache(imageCacheKey, cache);
    return url;
  }

  async function wikidataLabels(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return {};

    try {
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: unique.join("|"),
        props: "labels",
        languages: "en",
        format: "json",
        origin: "*"
      });
      const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`);
      const data = await response.json();
      const labels = {};
      for (const id of unique) labels[id] = data?.entities?.[id]?.labels?.en?.value || "";
      return labels;
    } catch (error) {
      console.warn("Wikidata labels failed:", error);
      return {};
    }
  }

  function entityIds(entity, property, limit) {
    return (entity?.claims?.[property] || [])
      .map(c => c?.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
      .slice(0, limit);
  }

  async function movieCredits(title) {
    const key = String(title || "").toLowerCase();
    const cache = readCache(creditsCacheKey);
    if (cache[key]) return cache[key];

    const result = { director: "", cast: [] };

    try {
      const searchParams = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: `${title} film`,
        gsrlimit: "5",
        prop: "pageprops",
        ppprop: "wikibase_item",
        format: "json",
        origin: "*"
      });

      const response = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams.toString()}`);
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      const wanted = String(title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const page = pages.find(p => String(p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").startsWith(wanted)) || pages[0];
      const qid = page?.pageprops?.wikibase_item;

      if (qid) {
        const entityResponse = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`);
        const entityData = await entityResponse.json();
        const entity = entityData?.entities?.[qid];
        const directorIds = entityIds(entity, "P57", 2);
        const castIds = entityIds(entity, "P161", 2);
        const labels = await wikidataLabels([...directorIds, ...castIds]);
        result.director = directorIds.map(id => labels[id]).filter(Boolean).join(", ");
        result.cast = castIds.map(id => labels[id]).filter(Boolean).slice(0, 2);
      }
    } catch (error) {
      console.warn("Movie credits lookup failed:", error);
    }

    cache[key] = result;
    writeCache(creditsCacheKey, cache);
    return result;
  }

  function ensureCopy(card) {
    let copy = card.querySelector(":scope > .rec-copy");
    if (copy) return copy;

    const title = card.querySelector(".rec-title");
    if (!title) return null;
    const holder = title.parentElement;
    holder.classList.add("rec-copy");
    return holder;
  }

  async function enhanceCard(card) {
    const titleEl = card.querySelector(".rec-title");
    const rank = card.querySelector(".rec-rank");
    if (!titleEl || !rank) return;

    const title = titleEl.textContent.trim();
    if (!title) return;
    if (card.dataset.chaosEnhanced === title) return;

    // Mark first so our own DOM edits do not trigger a loop.
    card.dataset.chaosEnhanced = title;

    const copy = ensureCopy(card);
    if (!copy) return;

    card.querySelectorAll(":scope > .rec-poster, :scope > .fake-official-poster").forEach(el => el.remove());
    copy.querySelectorAll(".rec-meta-row").forEach(el => el.remove());

    const [imageUrl, credits] = await Promise.all([
      firstCommonsImage(title),
      movieCredits(title)
    ]);

    if (card.dataset.chaosEnhanced !== title || !card.isConnected) return;

    const poster = document.createElement(imageUrl ? "img" : "div");
    poster.className = "rec-poster fake-official-poster";
    if (imageUrl) {
      poster.src = imageUrl;
      poster.alt = `${title} totally official poster`;
      poster.referrerPolicy = "no-referrer";
      poster.title = `OFFICIAL POSTER (searched Wikimedia Commons for “${firstWord(title)}”)`;
      poster.addEventListener("error", () => {
        poster.replaceWith(Object.assign(document.createElement("div"), {
          className: "rec-poster rec-poster-empty fake-official-poster",
          textContent: "OFFICIAL POSTER MISSING"
        }));
      }, { once: true });
    } else {
      poster.className += " rec-poster-empty";
      poster.textContent = "OFFICIAL POSTER MISSING";
    }
    rank.insertAdjacentElement("afterend", poster);

    const reason = copy.querySelector(".rec-reason");
    const insertBefore = reason || copy.querySelector(".rec-by");

    if (credits.director) {
      const row = document.createElement("div");
      row.className = "rec-meta-row";
      row.innerHTML = `<span>DIRECTOR</span>${escapeHtml(credits.director)}`;
      copy.insertBefore(row, insertBefore);
    }

    if (credits.cast?.length) {
      const row = document.createElement("div");
      row.className = "rec-meta-row";
      row.innerHTML = `<span>CAST</span>${escapeHtml(credits.cast.slice(0,2).join(", "))}`;
      copy.insertBefore(row, insertBefore);
    }
  }

  function escapeHtml(value="") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  let timer = null;
  function scan() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      list.querySelectorAll(".recommendation-item").forEach(card => enhanceCard(card));
    }, 30);
  }

  const observer = new MutationObserver(scan);
  observer.observe(list, { childList: true, subtree: false });
  scan();
})();
