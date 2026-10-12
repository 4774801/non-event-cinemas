HALLOWEEN RESKIN

Replace these files in GitHub:
- index.html
- app.js
- chaos2000.css
- stats.html

Optional but recommended:
- Run clear-halloween-suggestions.sql once in Supabase > SQL Editor
  if you want the current suggestion pile fully cleared for the host-picked
  Halloween screening.

What this changes:
- Same bad early-2000s vibe, but spooky Halloween themed.
- Adds skeleton trumpet gifs / pumpkin / bat nonsense.
- Removes the suggestions section from the homepage for this round.
- Removes the chaos-recommendations script from the homepage, so no more
  cheap sticker/fake-title recommendation poster treatment there.
- Top marquee now says 15 Oct 2026.
- app.js now safely handles the seasonal page with no suggestion form/list.
- Homepage selection still uses the actual next future screening row, so the
  15 Oct screening should show instead of 1 Oct/today.
