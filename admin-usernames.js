(() => {
  const cfg = window.NON_EVENT_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const sb = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normaliseName(value) {
    return String(value || "").trim();
  }

  function nameKey(value) {
    return normaliseName(value).toLowerCase();
  }

  function rowTime(row) {
    const candidates = [
      row?.last_seen_at,
      row?.updated_at,
      row?.created_at,
      row?.voted_at,
      row?.submitted_at
    ];

    for (const value of candidates) {
      if (!value) continue;
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }

    return null;
  }

  function formatSeen(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  async function safeRead(table) {
    try {
      const { data, error } = await sb.from(table).select("*");
      if (error) {
        console.warn(`ADMIN: couldn't read ${table}:`, error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`ADMIN: couldn't read ${table}:`, error);
      return [];
    }
  }

  async function loadUsers() {
    const box = document.querySelector("#adminUserRegistry");
    if (!box) return;

    try {
      const [friendUsers, recommendations, rsvps] = await Promise.all([
        safeRead("friend_users"),
        safeRead("recommendations"),
        safeRead("rsvps")
      ]);

      const users = new Map();

      function add(name, source, row) {
        const clean = normaliseName(name);
        if (!clean) return;

        const key = nameKey(clean);
        const time = rowTime(row);

        if (!users.has(key)) {
          users.set(key, {
            name: clean,
            sources: new Set(),
            lastActivity: time
          });
        }

        const user = users.get(key);
        user.sources.add(source);

        if (time && (!user.lastActivity || time > user.lastActivity)) {
          user.lastActivity = time;
        }

        user.name = clean;
      }

      friendUsers.forEach(row =>
        add(row.user_name ?? row.name ?? row.username, "LOGIN", row)
      );

      recommendations.forEach(row =>
        add(row.user_name ?? row.name ?? row.username, "RECOMMENDATION", row)
      );

      rsvps.forEach(row =>
        add(row.user_name ?? row.name ?? row.username, "RSVP", row)
      );

      const rows = [...users.values()].sort((a, b) => {
        if (a.lastActivity && b.lastActivity) return b.lastActivity - a.lastActivity;
        if (a.lastActivity) return -1;
        if (b.lastActivity) return 1;
        return a.name.localeCompare(b.name);
      });

      box.innerHTML = rows.length ? rows.map((user, index) => {
        const sourceText = [...user.sources].join(" + ");
        const when = formatSeen(user.lastActivity);

        return `
          <div class="admin-rec">
            <div>
              <strong>${String(index + 1).padStart(2, "0")} // ${esc(user.name)}</strong>
              <span>SOURCE: ${esc(sourceText)}</span>
              ${when ? `<span>LAST ACTIVITY: ${esc(when)}</span>` : ""}
            </div>
          </div>`;
      }).join("") : '<div class="empty">NO USERNAMES RECORDED YET</div>';

    } catch (error) {
      console.error("Could not build username registry:", error);
      box.innerHTML = '<div class="empty">USER REGISTRY ERROR</div>';
    }
  }

  function ensureDeletePanel() {
    let panel = document.querySelector("#adminDeleteSuggestionsPanel");
    if (panel) return panel;

    const grid = document.querySelector(".admin-grid");
    const adminApp = document.querySelector("#adminApp");
    const parent = grid || adminApp;
    if (!parent) return null;

    panel = document.createElement("section");
    panel.id = "adminDeleteSuggestionsPanel";
    panel.className = "admin-card";
    panel.innerHTML = `
      <h2>&gt; DELETE_SUGGESTIONS</h2>
      <p class="admin-note">
        Remove a film from the active recommendation pile.
      </p>
      <div id="adminDeleteSuggestionsStatus" class="admin-note"></div>
      <div id="adminDeleteSuggestions" class="admin-list">
        <div class="empty">SCANNING RECOMMENDATION QUEUE...</div>
      </div>
    `;

    parent.appendChild(panel);
    return panel;
  }

  async function loadDeleteSuggestions() {
    const panel = ensureDeletePanel();
    if (!panel) return;

    const box = panel.querySelector("#adminDeleteSuggestions");
    const status = panel.querySelector("#adminDeleteSuggestionsStatus");

    try {
      const { data, error } = await sb
        .from("recommendations")
        .select("id,title,user_name,votes,created_at,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = data || [];

      if (!rows.length) {
        box.innerHTML = '<div class="empty">NO ACTIVE SUGGESTIONS</div>';
        return;
      }

      box.innerHTML = rows.map(row => `
        <div class="admin-rec" data-admin-delete-row="${esc(row.id)}">
          <div>
            <strong>${esc(row.title || "UNTITLED")}</strong>
            <span>NOMINATED BY ${esc(row.user_name || "ANON")} // ${Number(row.votes || 0)} VOTES</span>
          </div>
          <div class="admin-rec-actions">
            <button
              type="button"
              class="admin-secondary admin-danger"
              data-admin-delete-rec="${esc(row.id)}"
              data-admin-delete-title="${esc(row.title || "this suggestion")}"
            >DELETE</button>
          </div>
        </div>
      `).join("");

      box.querySelectorAll("[data-admin-delete-rec]").forEach(button => {
        button.addEventListener("click", async () => {
          const id = button.dataset.adminDeleteRec;
          const title = button.dataset.adminDeleteTitle || "this suggestion";

          if (!confirm(`Delete "${title}" from the recommendation pile?`)) return;

          button.disabled = true;
          status.textContent = `DELETING ${title.toUpperCase()}...`;

          try {
            // First try a genuine delete. If the DB has a restrictive FK or
            // only UPDATE permission, fall back to making the suggestion inactive.
            const { error: deleteError } = await sb
              .from("recommendations")
              .delete()
              .eq("id", id);

            if (deleteError) {
              console.warn("Hard delete failed; falling back to inactive:", deleteError);

              const { error: updateError } = await sb
                .from("recommendations")
                .update({ is_active: false })
                .eq("id", id);

              if (updateError) throw updateError;
            }

            status.textContent = `"${title}" REMOVED FROM PILE.`;
            await Promise.all([loadDeleteSuggestions(), loadUsers()]);

            // Existing admin.js owns the normal recommendation queue.
            // Nudge it by reloading after a moment so its Use Film list also
            // reflects the deletion immediately without changing admin.js.
            setTimeout(() => location.reload(), 450);
          } catch (error) {
            console.error("Could not delete recommendation:", error);
            status.textContent = `DELETE FAILED: ${error.message || "DATABASE REFUSED CHANGE"}`;
            button.disabled = false;
          }
        });
      });

    } catch (error) {
      console.error("Could not load recommendations for deletion:", error);
      box.innerHTML = '<div class="empty">COULD NOT READ ACTIVE SUGGESTIONS</div>';
      status.textContent = error.message || "";
    }
  }

  async function refreshAdminExtras() {
    try {
      await sb.auth.getSession();
    } catch {}

    await Promise.all([
      loadUsers(),
      loadDeleteSuggestions()
    ]);
  }

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(refreshAdminExtras, 700);
    setTimeout(refreshAdminExtras, 2200);
  });

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) setTimeout(refreshAdminExtras, 250);
  });
})();