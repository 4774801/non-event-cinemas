MIDNIGHT ROUND ROLLOVER

1. Replace these website files in GitHub:
   - app.js
   - chaos2000-state.js
   - chaos2000.css
   - index.html
   - stats.js
   - chaos2000-stats-state.js
   - stats.html
   - admin.js
   - admin.html

2. In Supabase > SQL Editor, run:
   - midnight-rollover.sql

WHAT HAPPENS
- Rating opens one hour after film start (7 PM -> 8 PM).
- Rating closes at UK midnight.
- At midnight:
  * current screening is marked past
  * it appears in Past Films
  * ratings become final/read-only
  * attendance and ratings feed into Stats
  * the next screening is created 14 days later as TBC if needed
  * carried recommendations remain
  * recommendation votes reset
  * voting opens for the next film
- If the homepage/stats page is already open, it refreshes the round automatically just after midnight.
- If someone opens the site after midnight, it performs the rollover on load.

ADMIN
- FINALISE NIGHT NOW performs the exact same rollover early.
- It requires the existing authenticated Supabase admin login.
