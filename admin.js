(() => {
  const cfg = window.NON_EVENT_CONFIG || {};
  const isShared = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = isShared ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (s) => document.querySelector(s);
  const key = (name) => `ne_${name}`;

  const demoDefault = {
    id: "s1",
    title: "TBC",
    screening_at: "2026-10-01T19:30:00",
    runtime: "",
    year: null,
    curator: "",
    poster_url: "",
    is_past: false,
    is_cancelled: false
  };

  function read(name, fallback=[]) {
    try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback; }
    catch { return fallback; }
  }
  function write(name, value) {
    localStorage.setItem(key(name), JSON.stringify(value));
  }
  function esc(v="") {
    return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function localInputValue(dateString) {
    const d = new Date(dateString);
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function cutoffFor(dateString) {
    const d = new Date(dateString);
    d.setDate(d.getDate() - 2);
    return d;
  }
  function fmt(d) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday:"long", day:"numeric", month:"long", year:"numeric", hour:"numeric", minute:"2-digit"
    }).format(d);
  }

  async function getScreenings() {
    if (!isShared) return read("admin_screenings", [demoDefault]);

    const { data, error } = await sb
      .from("screenings")
      .select("*")
      .order("screening_at");

    if (error) throw error;

    return (data || []).map(row => {
      const title = String(row.title || "").trim().toLowerCase();
      if (title.includes("nice guys")) {
        return {
          ...row,
          title: "TBC",
          runtime: null,
          year: null,
          note: null,
          poster_url: null,
          curator: null
        };
      }
      return row;
    });
  }

  async function getRecommendations() {
    if (!isShared) return read("recommendations", [
      { id:"r1", title:"Heat", reason:"", user_name:"MG", votes:2, poster_url:"", is_active:true, voters:["MG","KJ"] },
      { id:"r2", title:"The Raid", reason:"", user_name:"BT", votes:1, poster_url:"", is_active:true, voters:["BT"] }
    ]).sort((a,b)=>(b.votes||0)-(a.votes||0));
    const { data, error } = await sb.from("recommendations")
      .select("*")
      .eq("is_active", true)
      .order("votes",{ascending:false})
      .order("created_at");
    if (error) throw error;
    return data;
  }

  async function saveScreening(row) {
    if (!isShared) {
      const rows = await getScreenings();
      const idx = rows.findIndex(x => String(x.id) === String(row.id));
      if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
      else rows.push(row);
      write("admin_screenings", rows);
      return;
    }
    const payload = { ...row };
    if (!payload.id) delete payload.id;
    const { error } = payload.id
      ? await sb.from("screenings").update(payload).eq("id", payload.id)
      : await sb.from("screenings").insert(payload);
    if (error) throw error;
  }

  async function setCancelled(id, value) {
    if (!id) return;
    if (!isShared) {
      const rows = await getScreenings();
      const row = rows.find(x => String(x.id) === String(id));
      if (row) row.is_cancelled = value;
      write("admin_screenings", rows);
      return;
    }
    const { error } = await sb.from("screenings").update({is_cancelled:value}).eq("id", id);
    if (error) throw error;
  }

  async function markPast(id) {
    if (!id) return;
    if (!isShared) {
      const rows = await getScreenings();
      const row = rows.find(x => String(x.id) === String(id));
      if (row) row.is_past = true;
      write("admin_screenings", rows);
      return;
    }
    const { error } = await sb.from("screenings").update({is_past:true}).eq("id", id);
    if (error) throw error;
  }

  async function closeRoundAndCarryForward(winnerId) {
    if (!isShared) {
      const rows = read("recommendations", []);
      const updated = rows.map(r => {
        if (String(r.id) === String(winnerId)) {
          return { ...r, is_active: false, votes: 0, voters: [] };
        }
        if (r.is_active !== false) {
          return { ...r, votes: 0, voters: [] };
        }
        return r;
      });
      write("recommendations", updated);
      return;
    }

    // Remove the selected film from future voting.
    let { error } = await sb.from("recommendations")
      .update({ is_active: false, votes: 0 })
      .eq("id", winnerId);
    if (error) throw error;

    // Reset remaining active recommendations for the next round.
    ({ error } = await sb.from("recommendations")
      .update({ votes: 0 })
      .eq("is_active", true));
    if (error) throw error;

    // Clear per-user votes so everyone gets a fresh vote next round.
    ({ error } = await sb.from("recommendation_votes")
      .delete()
      .neq("recommendation_id", -1));
    if (error) throw error;
  }


  async function removeRecommendation(id) {
    if (!id) return;

    if (!isShared) {
      const rows = read("recommendations", []);
      write("recommendations", rows.filter(r => String(r.id) !== String(id)));
      return;
    }

    // Remove any individual vote records first, then remove the recommendation.
    let { error } = await sb.from("recommendation_votes")
      .delete()
      .eq("recommendation_id", id);
    if (error) throw error;

    ({ error } = await sb.from("recommendations")
      .delete()
      .eq("id", id));
    if (error) throw error;
  }


  async function chooseRecommendation(rec) {
    const rows = await getScreenings();
    const next = rows.filter(x => !x.is_past && !x.is_cancelled).sort((a,b)=>new Date(a.screening_at)-new Date(b.screening_at))[0];
    if (!next) return;

    next.title = rec.title;
    next.poster_url = rec.poster_url || "";
    await saveScreening(next);

    // Lock this round's result, remove the winner, and carry the rest forward.
    await closeRoundAndCarryForward(rec.id);

    await render();
  }


  async function requireAdminSession() {
    if (!isShared) {
      $("#adminLogin").hidden = true;
      $("#adminApp").hidden = false;
      return true;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      $("#adminLogin").hidden = true;
      $("#adminApp").hidden = false;
      return true;
    }

    $("#adminLogin").hidden = false;
    $("#adminApp").hidden = true;
    return false;
  }

  $("#adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isShared) return;

    $("#adminLoginError").textContent = "";
    const email = $("#adminEmail").value.trim();
    const password = $("#adminPassword").value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      $("#adminLoginError").textContent = "Sign in failed.";
      return;
    }

    $("#adminPassword").value = "";
    await requireAdminSession();
    await render();
  });

  $("#adminLogout").addEventListener("click", async () => {
    if (isShared) await sb.auth.signOut();
    $("#adminApp").hidden = true;
    $("#adminLogin").hidden = false;
  });


  async function render() {
    if (!(await requireAdminSession())) return;

    $("#adminModeNotice").textContent = isShared
      ? "Connected to Supabase."
      : "Demo mode: changes are stored only in this browser.";

    const screenings = await getScreenings();
    const futureAll = screenings.filter(x => !x.is_past).sort((a,b)=>new Date(a.screening_at)-new Date(b.screening_at));
    const future = futureAll.filter(x => !x.is_cancelled);
    const next = future[0] || futureAll[0] || null;

    if (next) {
      $("#screeningId").value = next.id || "";
      $("#filmTitle").value = next.title || "";
      $("#filmDate").value = localInputValue(next.screening_at);
      $("#filmRuntime").value = next.runtime || "";
      $("#filmYear").value = next.year || "";
      $("#filmCurator").value = next.curator || "";
      $("#filmPoster").value = next.poster_url || "";
      $("#cancelBtn").textContent = next.is_cancelled ? "Reinstate screening" : "Cancel screening";
      $("#cancelStatus").textContent = next.is_cancelled ? "This screening is cancelled." : "";
      const cutoff = cutoffFor(next.screening_at);
      $("#adminCutoff").innerHTML = `<strong>${new Date() < cutoff ? "Open" : "Closed"}</strong><p class="admin-note">Closes ${esc(fmt(cutoff))}</p>`;
    } else {
      $("#screeningId").value = "";
      $("#filmTitle").value = "";
      $("#filmDate").value = "";
      $("#adminCutoff").innerHTML = `<p class="admin-note">No future screening scheduled.</p>`;
    }

    $("#futureDates").innerHTML = futureAll.map((s,i)=>`
      <div class="admin-rec">
        <div>
          <strong>${esc(s.title || "TBC")}</strong>
          <span>${esc(fmt(new Date(s.screening_at)))}${s.is_cancelled ? " · CANCELLED" : ""}</span>
        </div>
        <span>${!s.is_cancelled && String(s.id) === String(future[0]?.id) ? "NEXT" : ""}</span>
      </div>`).join("") || `<p class="empty">No future dates.</p>`;

    const recs = await getRecommendations();
    $("#adminRecommendations").innerHTML = recs.map((r,i)=>`
      <div class="admin-rec">
        <div>
          <strong>${i+1}. ${esc(r.title)}</strong>
          <span>${Number(r.votes||0)} vote${Number(r.votes||0)===1?"":"s"} · ${esc(r.user_name||"")}</span>
        </div>
        <div class="admin-rec-actions">
          <button class="admin-secondary" data-pick="${esc(r.id)}">Use film</button>
          <button class="admin-secondary admin-danger" data-remove-rec="${esc(r.id)}">Remove</button>
        </div>
      </div>`).join("") || `<p class="empty">No recommendations.</p>`;

    document.querySelectorAll("[data-pick]").forEach(btn => {
      btn.addEventListener("click", () => {
        const rec = recs.find(r => String(r.id) === String(btn.dataset.pick));
        if (rec) chooseRecommendation(rec);
      });
    });

    document.querySelectorAll("[data-remove-rec]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const rec = recs.find(r => String(r.id) === String(btn.dataset.removeRec));
        if (!rec) return;

        const ok = confirm(`Remove "${rec.title}" from recommendations?`);
        if (!ok) return;

        try {
          await removeRecommendation(rec.id);
          await render();
        } catch (err) {
          console.error(err);
          alert("Could not remove recommendation. Supabase may need an admin delete policy.");
        }
      });
    });
  }

  $("#screeningForm").addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("#screeningId").value || (isShared ? null : crypto.randomUUID());
    const row = {
      id,
      title: $("#filmTitle").value.trim(),
      screening_at: new Date($("#filmDate").value).toISOString(),
      runtime: $("#filmRuntime").value.trim() || null,
      year: $("#filmYear").value ? Number($("#filmYear").value) : null,
      curator: $("#filmCurator").value.trim() || null,
      poster_url: $("#filmPoster").value.trim() || null,
      is_past: false,
      is_cancelled: false
    };
    await saveScreening(row);
    await render();
  });

  $("#cancelBtn").addEventListener("click", async () => {
    const id = $("#screeningId").value;
    if (!id) return;
    const rows = await getScreenings();
    const row = rows.find(x => String(x.id) === String(id));
    const newValue = !(row?.is_cancelled);
    await setCancelled(id, newValue);
    await render();
  });

  $("#markPastBtn").addEventListener("click", async () => {
    const id = $("#screeningId").value;
    if (!id) return;
    await markPast(id);
    await render();
  });

  $("#createNextDateBtn").addEventListener("click", async () => {
    const rows = await getScreenings();
    const all = rows.sort((a,b)=>new Date(a.screening_at)-new Date(b.screening_at));
    let nextDate;
    if (all.length) {
      nextDate = new Date(all[all.length-1].screening_at);
      nextDate.setDate(nextDate.getDate() + 14);
    } else {
      nextDate = new Date("2026-10-01T19:30:00");
    }
    const row = {
      id: isShared ? null : crypto.randomUUID(),
      title: "TBC",
      screening_at: nextDate.toISOString(),
      runtime: null,
      year: null,
      curator: null,
      poster_url: null,
      is_past: false,
      is_cancelled: false
    };
    await saveScreening(row);
    await render();
  });

  requireAdminSession().then(ok => { if (ok) render(); });
})();