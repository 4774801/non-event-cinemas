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

  function formatSeen(iso) {
    if (!iso) return "UNKNOWN";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "UNKNOWN";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  async function loadUsers() {
    const cfg = window.NON_EVENT_CONFIG || {};
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      box.innerHTML = '<div class="empty">USER REGISTRY OFFLINE</div>';
      return;
    }

    try {
      const client = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      );

      const { data, error } = await client
        .from("friend_users")
        .select("user_name,last_seen_at")
        .order("last_seen_at", { ascending: false });

      if (error) throw error;

      if (!data?.length) {
        box.innerHTML = '<div class="empty">NO USERNAMES RECORDED YET</div>';
        return;
      }

      box.innerHTML = data.map((row, index) => `
        <div class="admin-rec">
          <div>
            <strong>${String(index + 1).padStart(2, "0")} // ${esc(row.user_name)}</strong>
            <span>LAST LOGIN: ${esc(formatSeen(row.last_seen_at))}</span>
          </div>
        </div>
      `).join("");
    } catch (error) {
      console.error("Could not load friend usernames:", error);
      box.innerHTML = `
        <div class="empty">
          USER REGISTRY UNAVAILABLE<br>
          Run the supplied Supabase SQL first.
        </div>`;
    }
  }

  // admin.js may hide/show the app after checking auth.
  // Load after that process has had time to settle.
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(loadUsers, 500);
    setTimeout(loadUsers, 1800);
  });
})();