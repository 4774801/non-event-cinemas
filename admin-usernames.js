(() => {
  const box = document.querySelector("#adminUserRegistry");
  if (!box) return;

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

  async function safeRead(client, table) {
    try {
      const { data, error } = await client.from(table).select("*");
      if (error) {
        console.warn(`USER_REGISTRY: couldn't read ${table}:`, error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`USER_REGISTRY: couldn't read ${table}:`, error);
      return [];
    }
  }

  async function loadUsers() {
    const cfg = window.NON_EVENT_CONFIG || {};

    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      box.innerHTML = '<div class="empty">USER REGISTRY OFFLINE</div>';
      return;
    }

    box.innerHTML = '<div class="empty">SCANNING USER ACTIVITY...</div>';

    try {
      const client = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      );

      // Give Supabase a chance to restore the existing authenticated admin
      // session before querying the authenticated-only friend_users table.
      try { await client.auth.getSession(); } catch {}

      const [friendUsers, recommendations, rsvps] = await Promise.all([
        safeRead(client, "friend_users"),
        safeRead(client, "recommendations"),
        safeRead(client, "rsvps")
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

        // Prefer the most recently encountered capitalisation rather than
        // displaying a lower-case normalised key.
        if (clean.length) user.name = clean;
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

      if (!rows.length) {
        box.innerHTML = `
          <div class="empty">
            NO USERNAMES FOUND<br>
            Checked friend_users, recommendations and rsvps.
          </div>`;
        return;
      }

      box.innerHTML = rows.map((user, index) => {
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
      }).join("");

    } catch (error) {
      console.error("Could not build username registry:", error);
      box.innerHTML = `
        <div class="empty">
          USER REGISTRY ERROR<br>
          Check browser console for the failed table query.
        </div>`;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    // admin.js restores/checks authentication asynchronously.
    setTimeout(loadUsers, 700);
    setTimeout(loadUsers, 2200);
  });
})();